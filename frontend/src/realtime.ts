// Single shared WebSocket to the backend collaboration hub. A module-level
// singleton (not per-component) so the whole app multiplexes one connection;
// it auto-reconnects and re-announces the current board on reopen.
//
// Carries presence (who's viewing the board), plus live cursors and selection
// highlights. Presence and collab changes use separate listener sets so the
// high-frequency cursor stream only re-renders the canvas overlay, not the app.
import { useEffect, useState } from 'react'
import { getToken } from './api'

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
}

class Realtime {
  private ws: WebSocket | null = null
  private wantOpen = false
  private boardId: string | null = null
  private reconnectTimer: number | null = null

  private presence: Record<string, PresenceMember[]> = {}
  private cursors: Record<string, Record<string, RemoteCursor>> = {}
  private selections: Record<string, Record<string, RemoteSelection>> = {}
  private uploads: Record<string, Record<string, BoardUpload>> = {}
  // Per board, the node each user currently has open for editing (one each), so
  // others can show "X is editing" and block concurrent edits.
  private editing: Record<string, Record<string, { nodeId: string; username: string; color: string }>> = {}

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
    this.emitPresence()
    this.emitCollab()
    this.emitEdit()
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

    const board = msg.board_id as string

    if (msg.type === 'presence') {
      this.presence[board] = msg.members ?? []
      // Drop cursors/selections/edit-locks for anyone no longer on the board
      // (this is also how a disconnected user's edit lock is released).
      const ids = new Set<string>((msg.members ?? []).map((m: PresenceMember) => m.id))
      for (const map of [this.cursors[board], this.selections[board], this.uploads[board]]) {
        if (map) for (const uid of Object.keys(map)) if (!ids.has(uid)) delete map[uid]
      }
      const editMap = this.editing[board]
      if (editMap) for (const uid of Object.keys(editMap)) if (!ids.has(uid)) delete editMap[uid]
      this.emitPresence()
      this.emitCollab()
      this.emitEdit()
    } else if (msg.type === 'edit') {
      const map = (this.editing[board] ??= {})
      if (msg.active && msg.node_id) {
        map[msg.user_id] = { nodeId: msg.node_id, username: msg.username, color: msg.color }
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
      const member = this.presence[board]?.find((m) => m.id === uid)
      if (member) member.color = msg.color
      this.emitPresence()
      this.emitCollab()
      this.emitEdit()
    } else if (msg.type === 'cursor') {
      ;(this.cursors[board] ??= {})[msg.user_id] = {
        userId: msg.user_id,
        username: msg.username,
        color: msg.color,
        x: msg.x,
        y: msg.y,
      }
      this.emitCollab()
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
        }
      } else {
        delete map[msg.user_id]
      }
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
    this.boardId = boardId
    this.send({ type: 'join', board_id: boardId })
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

  // Announce my in-flight upload count so collaborators see an activity indicator.
  sendUpload(active: boolean, count: number) {
    this.send({ type: 'upload', active, count })
  }

  // Announce the node I'm now editing (or null when I close the editor) so others
  // can show a lock and block concurrent edits.
  sendEdit(nodeId: string | null) {
    this.send({ type: 'edit', node_id: nodeId, active: nodeId != null })
  }

  // Map of nodeId -> the remote user editing it (used to lock + label nodes).
  editLocksFor(boardId: string | null): Record<string, { userId: string; username: string; color: string }> {
    const out: Record<string, { userId: string; username: string; color: string }> = {}
    if (!boardId) return out
    for (const [uid, lock] of Object.entries(this.editing[boardId] ?? {})) {
      if (!out[lock.nodeId]) out[lock.nodeId] = { userId: uid, username: lock.username, color: lock.color }
    }
    return out
  }

  membersFor(boardId: string | null): PresenceMember[] {
    if (!boardId) return []
    return this.presence[boardId] ?? []
  }

  cursorsFor(boardId: string | null): RemoteCursor[] {
    if (!boardId) return []
    return Object.values(this.cursors[boardId] ?? {})
  }

  selectionsFor(boardId: string | null): RemoteSelection[] {
    if (!boardId) return []
    return Object.values(this.selections[boardId] ?? {})
  }

  uploadsFor(boardId: string | null): BoardUpload[] {
    if (!boardId) return []
    return Object.values(this.uploads[boardId] ?? {})
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
