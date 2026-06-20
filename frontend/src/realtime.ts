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

  private presenceListeners = new Set<() => void>()
  private collabListeners = new Set<() => void>()
  // Board ops (node_move, board_dirty) are apply-and-forget, so they go to
  // direct handlers (the canvas) rather than into rendered state.
  private opListeners = new Set<(msg: any) => void>()

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
    this.emitPresence()
    this.emitCollab()
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
    const board = msg.board_id as string

    if (msg.type === 'presence') {
      this.presence[board] = msg.members ?? []
      // Drop cursors/selections for anyone no longer on the board.
      const ids = new Set<string>((msg.members ?? []).map((m: PresenceMember) => m.id))
      for (const map of [this.cursors[board], this.selections[board], this.uploads[board]]) {
        if (map) for (const uid of Object.keys(map)) if (!ids.has(uid)) delete map[uid]
      }
      this.emitPresence()
      this.emitCollab()
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
