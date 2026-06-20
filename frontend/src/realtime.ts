// Single shared WebSocket to the backend collaboration hub. A module-level
// singleton (not per-component) so the whole app multiplexes one connection;
// it auto-reconnects and re-announces the current board on reopen.
//
// Phase 2a handles presence (who's viewing the current board). The protocol is
// built to grow: later message types (cursors, live edits, uploads) ride the
// same socket.
import { useEffect, useState } from 'react'
import { getToken } from './api'

export interface PresenceMember {
  id: string
  username: string
  color: string
}

class Realtime {
  private ws: WebSocket | null = null
  private wantOpen = false
  private boardId: string | null = null
  private reconnectTimer: number | null = null
  private presence: Record<string, PresenceMember[]> = {}
  private listeners = new Set<() => void>()

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
    this.emit()
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
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'presence') {
          this.presence[msg.board_id] = msg.members ?? []
          this.emit()
        }
      } catch {
        /* ignore malformed frames */
      }
    }
    ws.onclose = () => {
      this.ws = null
      if (this.wantOpen) this.scheduleReconnect()
    }
    ws.onerror = () => ws.close()
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

  membersFor(boardId: string | null): PresenceMember[] {
    if (!boardId) return []
    return this.presence[boardId] ?? []
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }
}

export const realtime = new Realtime()

// Announce the active board and re-render when its presence roster changes.
export function useBoardPresence(boardId: string | null): PresenceMember[] {
  const [, force] = useState(0)
  useEffect(() => realtime.subscribe(() => force((n) => n + 1)), [])
  useEffect(() => {
    realtime.setBoard(boardId)
  }, [boardId])
  return realtime.membersFor(boardId)
}
