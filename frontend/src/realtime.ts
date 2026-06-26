// Single shared WebSocket to the backend collaboration hub. A module-level
// singleton (not per-component) so the whole app multiplexes one connection;
// it auto-reconnects and re-announces the current board on reopen.
//
// Carries presence (who's viewing the board), plus live cursors and selection
// highlights. Presence and collab changes use separate listener sets so the
// high-frequency cursor stream only re-renders the canvas overlay, not the app.
import { useEffect, useState } from 'react'
import { getToken } from './api'
import { HIGHLIGHT_PALETTE, collabColor } from './collab'

export interface PresenceMember {
  id: string
  username: string
  color: string
}

export interface RemoteCursor {
  userId: string
  username: string
  color: string
  x: number
  y: number
  // Recent (receive-time, flow-coord) samples for jitter-buffered playback.
  samples: { t: number; x: number; y: number }[]
}

export interface RemoteSelection {
  userId: string
  color: string
  nodeIds: string[]
}

export interface BoardUpload {
  userId: string
  username: string
  color: string
  count: number
  title?: string // node the upload targets
}

// What a collaborator is currently doing. 'editing'/'uploading' come from the
// node-level channels; the rest are broadcast app-wide via sendActivity().
export type ActivityKind =
  | 'viewing'
  | 'editing'
  | 'uploading'
  | 'gallery'
  | 'merging'
  | 'moving'
  | 'transferring'
  | 'creating'
  | 'renaming'
  | 'downloading'
  | 'away'

const ACTIVITY_KINDS = new Set<ActivityKind>([
  'viewing', 'editing', 'uploading', 'gallery', 'merging', 'moving',
  'transferring', 'creating', 'renaming', 'downloading', 'away',
])

// A collaborator on the board plus what they're currently doing.
export interface MemberActivity {
  id: string
  username: string
  color: string
  status: ActivityKind
  detail?: string // node title for editing/uploading
}

class Realtime {
  private ws: WebSocket | null = null
  private wantOpen = false
  private boardId: string | null = null
  private reconnectTimer: number | null = null

  // Me, for per-viewer color disambiguation: my color stays fixed; a collaborator
  // who happens to share my color is shown to me in a different one.
  private self: { id: string; color: string } | null = null

  private presence: Record<string, PresenceMember[]> = {}
  private cursors: Record<string, Record<string, RemoteCursor>> = {}
  private selections: Record<string, Record<string, RemoteSelection>> = {}
  private uploads: Record<string, Record<string, BoardUpload>> = {}
  // Per board, the node each user currently has open for editing (one each), so
  // others can show "X is editing" and block concurrent edits.
  private editing: Record<string, Record<string, { nodeId: string; username: string; color: string; title: string }>> = {}
  // Per board, each user's broadcast app activity (gallery, merging, away, ...).
  private activities: Record<string, Record<string, ActivityKind>> = {}
  private myActivity: ActivityKind = 'viewing'

  private presenceListeners = new Set<() => void>()
  private collabListeners = new Set<() => void>()
  // Board ops (node_move, board_dirty) are apply-and-forget, so they go to
  // direct handlers (the canvas) rather than into rendered state.
  private opListeners = new Set<(msg: any) => void>()
  // Fired each time the socket (re)connects -- e.g. after a deploy restarts the
  // server -- used to check for a newer app version.
  private connectListeners = new Set<() => void>()
  // User-level share events (invite arrived / accepted / rejected / removed).
  // Not board-scoped, so they bypass the board maps and go straight to listeners.
  private shareListeners = new Set<(msg: any) => void>()
  // Edit-lock changes -- a low-frequency channel (separate from cursors) so the
  // canvas re-renders on lock changes without churning on every cursor move.
  private editListeners = new Set<() => void>()
  // Global presence: which board(s) each online user is viewing, for the
  // here/away/offline dots on shared boards in the explorer + picker.
  private globalPresence: Record<string, string[]> = {}
  private globalListeners = new Set<() => void>()

  start() {
    this.wantOpen = true
    this.connect()
  }

  stop() {
    this.wantOpen = false
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onclose = null // don't trigger a reconnect
      this.ws.close()
      this.ws = null
    }
    this.presence = {}
    this.cursors = {}
    this.selections = {}
    this.uploads = {}
    this.editing = {}
    this.activities = {}
    this.globalPresence = {}
    this.emitPresence()
    this.emitCollab()
    this.emitEdit()
    this.globalListeners.forEach((l) => l())
  }

  private connect() {
    if (!this.wantOpen || this.ws) return
    const token = getToken()
    if (!token) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(
      `${proto}://${location.host}/api/ws?token=${encodeURIComponent(token)}`,
    )
    this.ws = ws

    ws.onopen = () => {
      if (this.boardId) this.send({ type: 'join', board_id: this.boardId })
      this.connectListeners.forEach((l) => l())
    }
    ws.onmessage = (e) => this.onMessage(e)
    ws.onclose = () => {
      this.ws = null
      if (this.wantOpen) this.scheduleReconnect()
    }
    ws.onerror = () => ws.close()
  }

  private onMessage(e: MessageEvent) {
    let msg: any
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }

    if (msg.type === 'share') {
      this.shareListeners.forEach((l) => l(msg))
      return
    }

    if (msg.type === 'global_presence') {
      this.globalPresence = msg.users ?? {}
      this.globalListeners.forEach((l) => l())
      return
    }

    const board = msg.board_id as string

    if (msg.type === 'presence') {
      this.presence[board] = msg.members ?? []
      // Drop cursors/selections/edit-locks for anyone no longer on the board
      // (this is also how a disconnected user's edit lock is released).
      const ids = new Set<string>((msg.members ?? []).map((m: PresenceMember) => m.id))
      for (const map of [this.cursors[board], this.selections[board], this.uploads[board]]) {
        if (map) for (const uid of Object.keys(map)) if (!ids.has(uid)) delete map[uid]
      }
      for (const map of [this.editing[board], this.activities[board]]) {
        if (map) for (const uid of Object.keys(map)) if (!ids.has(uid)) delete map[uid]
      }
      this.emitPresence()
      this.emitCollab()
      this.emitEdit()
    } else if (msg.type === 'edit') {
      const map = (this.editing[board] ??= {})
      if (msg.active && msg.node_id) {
        map[msg.user_id] = {
          nodeId: msg.node_id,
          username: msg.username,
          color: msg.color,
          title: msg.node_title ?? '',
        }
      } else {
        delete map[msg.user_id]
      }
      this.emitEdit()
    } else if (msg.type === 'color') {
      // A collaborator changed their color: recolor everything cached for them.
      const uid = msg.user_id as string
      const cur = this.cursors[board]?.[uid]
      if (cur) cur.color = msg.color
      const sel = this.selections[board]?.[uid]
      if (sel) sel.color = msg.color
      const ed = this.editing[board]?.[uid]
      if (ed) ed.color = msg.color
      const up = this.uploads[board]?.[uid]
      if (up) up.color = msg.color
      const member = this.presence[board]?.find((m) => m.id === uid)
      if (member) member.color = msg.color
      this.emitPresence()
      this.emitCollab()
      this.emitEdit()
    } else if (msg.type === 'cursor') {
      const map = (this.cursors[board] ??= {})
      const t = performance.now()
      const cur = map[msg.user_id]
      if (cur) {
        cur.x = msg.x
        cur.y = msg.y
        cur.username = msg.username
        cur.color = msg.color
        cur.samples.push({ t, x: msg.x, y: msg.y })
        // Keep ~1s of history (and always a couple to interpolate between).
        while (cur.samples.length > 3 && t - cur.samples[0].t > 1000) cur.samples.shift()
        // No emit: the playback loop reads samples live, so position updates
        // don't trigger a React re-render (only join/leave/color changes do).
      } else {
        map[msg.user_id] = {
          userId: msg.user_id,
          username: msg.username,
          color: msg.color,
          x: msg.x,
          y: msg.y,
          samples: [{ t, x: msg.x, y: msg.y }],
        }
        this.emitCollab() // a new cursor appeared -> render its element
      }
    } else if (msg.type === 'select') {
      const map = (this.selections[board] ??= {})
      if (msg.node_ids?.length) {
        map[msg.user_id] = { userId: msg.user_id, color: msg.color, nodeIds: msg.node_ids }
      } else {
        delete map[msg.user_id]
      }
      this.emitCollab()
    } else if (msg.type === 'upload') {
      const map = (this.uploads[board] ??= {})
      if (msg.active && msg.count > 0) {
        map[msg.user_id] = {
          userId: msg.user_id,
          username: msg.username,
          color: msg.color,
          count: msg.count,
          title: msg.node_title ?? '',
        }
      } else {
        delete map[msg.user_id]
      }
      this.emitPresence()
    } else if (msg.type === 'activity') {
      const map = (this.activities[board] ??= {})
      const a = msg.activity as ActivityKind
      if (a && a !== 'viewing' && ACTIVITY_KINDS.has(a)) map[msg.user_id] = a
      else delete map[msg.user_id]
      this.emitPresence()
    } else if (msg.type === 'node_move' || msg.type === 'board_dirty') {
      this.opListeners.forEach((l) => l(msg))
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 2000)
  }

  private send(obj: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
    }
  }

  setBoard(boardId: string | null) {
    if (this.boardId === boardId) return
    const prev = this.boardId
    this.boardId = boardId
    // Drop the board we're leaving from the per-board live-state maps. The server
    // re-sends a fresh snapshot on join, so keeping old boards' entries only leaks
    // memory across a long multi-board session. (globalPresence is workspace-wide.)
    if (prev) {
      delete this.presence[prev]
      delete this.cursors[prev]
      delete this.selections[prev]
      delete this.uploads[prev]
      delete this.editing[prev]
      delete this.activities[prev]
    }
    this.send({ type: 'join', board_id: boardId })
    // Let the new board's members see what I'm currently doing.
    if (boardId && this.myActivity !== 'viewing') {
      this.send({ type: 'activity', activity: this.myActivity })
    }
  }

  sendCursor(x: number, y: number) {
    this.send({ type: 'cursor', x, y })
  }

  sendSelection(nodeIds: string[]) {
    this.send({ type: 'select', node_ids: nodeIds })
  }

  // Live node movement (sent during/after a drag) — advisory, view-only.
  sendNodeMove(positions: { id: string; x: number; y: number }[]) {
    this.send({ type: 'node_move', positions })
  }

  // "Something structural changed on this board" — receivers refetch the graph.
  sendDirty() {
    this.send({ type: 'board_dirty' })
  }

  // Announce my in-flight upload count (and which node) so collaborators see an
  // activity indicator.
  sendUpload(active: boolean, count: number, nodeTitle?: string) {
    this.send({ type: 'upload', active, count, node_title: nodeTitle ?? '' })
  }

  // Announce the node I'm now editing (or null when I close the editor) so others
  // can show a lock + "editing X" and block concurrent edits.
  sendEdit(nodeId: string | null, nodeTitle?: string) {
    this.send({ type: 'edit', node_id: nodeId, node_title: nodeTitle ?? '', active: nodeId != null })
  }

  // Announce my current app activity (viewing, gallery, merging, away, ...) so
  // collaborators show a status badge. Only sends on change.
  sendActivity(kind: ActivityKind) {
    if (kind === this.myActivity) return
    this.myActivity = kind
    this.send({ type: 'activity', activity: kind })
  }

  // Set who I am so my own color is held fixed and clashing collaborators get a
  // distinct display color (from my perspective only).
  setSelf(id: string, color: string | null) {
    this.self = { id, color: color || collabColor(id) }
    this.emitPresence()
    this.emitCollab()
    this.emitEdit()
  }

  // Per-board map of userId -> the color to DISPLAY for them. Mine is fixed; a
  // collaborator whose color collides with mine (or another) is reassigned the
  // next free palette color, stably by user id.
  private resolveColors(boardId: string): Record<string, string> {
    const out: Record<string, string> = {}
    const used = new Set<string>()
    if (this.self) {
      out[this.self.id] = this.self.color
      used.add(this.self.color)
    }
    const members = (this.presence[boardId] ?? [])
      .filter((m) => !this.self || m.id !== this.self.id)
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    for (const m of members) {
      let c = m.color
      if (used.has(c)) c = HIGHLIGHT_PALETTE.find((p) => !used.has(p)) ?? c
      out[m.id] = c
      used.add(c)
    }
    return out
  }

  // Map of nodeId -> the remote user editing it (used to lock + label nodes).
  editLocksFor(boardId: string | null): Record<string, { userId: string; username: string; color: string }> {
    const out: Record<string, { userId: string; username: string; color: string }> = {}
    if (!boardId) return out
    const colors = this.resolveColors(boardId)
    for (const [uid, lock] of Object.entries(this.editing[boardId] ?? {})) {
      if (!out[lock.nodeId])
        out[lock.nodeId] = { userId: uid, username: lock.username, color: colors[uid] ?? lock.color }
    }
    return out
  }

  membersFor(boardId: string | null): PresenceMember[] {
    if (!boardId) return []
    const colors = this.resolveColors(boardId)
    return (this.presence[boardId] ?? []).map((m) => ({ ...m, color: colors[m.id] ?? m.color }))
  }

  cursorsFor(boardId: string | null): RemoteCursor[] {
    if (!boardId) return []
    const colors = this.resolveColors(boardId)
    return Object.values(this.cursors[boardId] ?? {}).map((c) => ({
      ...c,
      color: colors[c.userId] ?? c.color,
    }))
  }

  // Live sample buffer for one cursor (read each frame by the playback loop).
  cursorSamples(boardId: string | null, uid: string): { t: number; x: number; y: number }[] {
    if (!boardId) return []
    return this.cursors[boardId]?.[uid]?.samples ?? []
  }

  selectionsFor(boardId: string | null): RemoteSelection[] {
    if (!boardId) return []
    const colors = this.resolveColors(boardId)
    return Object.values(this.selections[boardId] ?? {}).map((s) => ({
      ...s,
      color: colors[s.userId] ?? s.color,
    }))
  }

  uploadsFor(boardId: string | null): BoardUpload[] {
    if (!boardId) return []
    return Object.values(this.uploads[boardId] ?? {})
  }

  // Collaborator presence for a board's dot, from my perspective (excluding me):
  // someone is on this board ('here'), a collaborator is online elsewhere
  // ('away'), or none are online ('offline').
  boardStatus(boardId: string, memberIds: string[] | undefined): 'here' | 'away' | 'offline' {
    const others = (memberIds ?? []).filter((id) => id !== this.self?.id)
    if (!others.length) return 'offline'
    if (others.some((id) => this.globalPresence[id]?.includes(boardId))) return 'here'
    return others.some((id) => this.globalPresence[id]) ? 'away' : 'offline'
  }

  // Other collaborators on the board + what each is doing (uploading > editing >
  // idle), with display colors resolved. Excludes me.
  activityFor(boardId: string | null): MemberActivity[] {
    if (!boardId) return []
    const colors = this.resolveColors(boardId)
    const editing = this.editing[boardId] ?? {}
    const uploads = this.uploads[boardId] ?? {}
    const acts = this.activities[boardId] ?? {}
    const selfId = this.self?.id
    return (this.presence[boardId] ?? [])
      .filter((m) => m.id !== selfId)
      .map((m) => {
        const color = colors[m.id] ?? m.color
        // Node-level work wins (it carries a title); then the broadcast activity;
        // otherwise the person is just viewing.
        const up = uploads[m.id]
        if (up && up.count > 0)
          return { id: m.id, username: m.username, color, status: 'uploading' as const, detail: up.title }
        const ed = editing[m.id]
        if (ed)
          return { id: m.id, username: m.username, color, status: 'editing' as const, detail: ed.title }
        return { id: m.id, username: m.username, color, status: acts[m.id] ?? ('viewing' as const) }
      })
  }

  subscribePresence(fn: () => void) {
    this.presenceListeners.add(fn)
    return () => {
      this.presenceListeners.delete(fn)
    }
  }
  subscribeConnect(fn: () => void) {
    this.connectListeners.add(fn)
    return () => {
      this.connectListeners.delete(fn)
    }
  }
  subscribeShare(fn: (msg: any) => void) {
    this.shareListeners.add(fn)
    return () => {
      this.shareListeners.delete(fn)
    }
  }
  subscribeEdit(fn: () => void) {
    this.editListeners.add(fn)
    return () => {
      this.editListeners.delete(fn)
    }
  }
  subscribeGlobal(fn: () => void) {
    this.globalListeners.add(fn)
    return () => {
      this.globalListeners.delete(fn)
    }
  }
  private emitEdit() {
    this.editListeners.forEach((l) => l())
  }
  subscribeCollab(fn: () => void) {
    this.collabListeners.add(fn)
    return () => {
      this.collabListeners.delete(fn)
    }
  }
  subscribeOps(fn: (msg: any) => void) {
    this.opListeners.add(fn)
    return () => {
      this.opListeners.delete(fn)
    }
  }
  private emitPresence() {
    this.presenceListeners.forEach((l) => l())
  }
  private emitCollab() {
    this.collabListeners.forEach((l) => l())
  }
}

export const realtime = new Realtime()

// Announce the active board and re-render when its presence roster changes.
export function useBoardPresence(boardId: string | null): PresenceMember[] {
  const [, force] = useState(0)
  useEffect(() => realtime.subscribePresence(() => force((n) => n + 1)), [])
  useEffect(() => {
    realtime.setBoard(boardId)
  }, [boardId])
  return realtime.membersFor(boardId)
}

// Collaborators currently uploading to this board (top-bar activity indicator).
// Low-frequency, so it shares the presence channel.
export function useBoardUploads(boardId: string | null): BoardUpload[] {
  const [, force] = useState(0)
  useEffect(() => realtime.subscribePresence(() => force((n) => n + 1)), [])
  return realtime.uploadsFor(boardId)
}

// Re-renders when anyone's online location changes, so shared-board presence
// dots (here/away/offline) stay current. Read status via realtime.boardStatus().
export function useGlobalPresence(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => realtime.subscribeGlobal(() => setTick((n) => n + 1)), [])
  return tick
}

// Other collaborators on the board + what each is currently doing. Updates on
// presence (join/leave/upload) and edit-lock changes -- not on cursor traffic.
export function useBoardActivity(boardId: string | null): MemberActivity[] {
  const [, force] = useState(0)
  useEffect(() => realtime.subscribePresence(() => force((n) => n + 1)), [])
  useEffect(() => realtime.subscribeEdit(() => force((n) => n + 1)), [])
  return realtime.activityFor(boardId)
}

// nodeId -> the remote collaborator editing it (lock + "X is editing" label).
// Re-renders only when a lock changes, not on cursor traffic.
export function useBoardEditLocks(
  boardId: string | null,
): Record<string, { userId: string; username: string; color: string }> {
  const [, force] = useState(0)
  useEffect(() => realtime.subscribeEdit(() => force((n) => n + 1)), [])
  return realtime.editLocksFor(boardId)
}

// Live cursors + selection highlights for a board. Subscribes only to the
// collab channel, so cursor traffic re-renders just the consumer.
export function useCollab(boardId: string | null): {
  cursors: RemoteCursor[]
  selections: RemoteSelection[]
} {
  const [, force] = useState(0)
  useEffect(() => realtime.subscribeCollab(() => force((n) => n + 1)), [])
  return {
    cursors: realtime.cursorsFor(boardId),
    selections: realtime.selectionsFor(boardId),
  }
}
