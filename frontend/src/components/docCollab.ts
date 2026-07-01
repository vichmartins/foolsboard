// A minimal Yjs provider over foolsboard's existing WebSocket relay hub — no
// separate y-websocket server. Rather than state-vector diffing, it broadcasts
// every local update and, on join, asks peers for their full state (Yjs merges
// idempotently). Simple and robust for the single-process relay and doc-sized
// data. Awareness (cursors/selections) rides the same channel.
import * as Y from 'yjs'
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import { realtime } from '../realtime'

// base64 <-> Uint8Array. Chunked so large updates don't blow the call stack.
export function u8ToB64(u8: Uint8Array): string {
  let s = ''
  const CH = 0x8000
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode(...u8.subarray(i, i + CH))
  return btoa(s)
}
export function b64ToU8(b64: string): Uint8Array {
  const s = atob(b64)
  const u8 = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
  return u8
}

export class WsDocProvider {
  awareness: Awareness
  private nodeId: string
  private doc: Y.Doc
  private connected = false
  private unsub: (() => void) | null = null
  private unsubConnect: (() => void) | null = null
  private onDoc: (update: Uint8Array, origin: unknown) => void
  private onAware: (
    c: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => void

  // The constructor is side-effect-free (safe under React StrictMode's double
  // render). Wiring to the socket happens in connect(), driven by an effect.
  constructor(nodeId: string, doc: Y.Doc) {
    this.nodeId = nodeId
    this.doc = doc
    this.awareness = new Awareness(doc)

    // Broadcast local doc changes (skip echoes of updates we just applied).
    this.onDoc = (update, origin) => {
      if (origin === this) return
      realtime.sendDocUpdate(this.nodeId, 'update', u8ToB64(update))
    }
    // Broadcast local awareness (cursor) changes.
    this.onAware = ({ added, updated, removed }, origin) => {
      if (origin === 'remote') return
      const changed = added.concat(updated, removed)
      realtime.sendDocAwareness(
        this.nodeId,
        u8ToB64(encodeAwarenessUpdate(this.awareness, changed)),
      )
    }
  }

  private announce = () => {
    realtime.sendDocUpdate(this.nodeId, 'sync-req', '')
    const ids = [...this.awareness.getStates().keys()]
    if (ids.length)
      realtime.sendDocAwareness(this.nodeId, u8ToB64(encodeAwarenessUpdate(this.awareness, ids)))
  }

  connect(): void {
    if (this.connected) return
    this.connected = true
    this.doc.on('update', this.onDoc)
    this.awareness.on('update', this.onAware)
    this.unsub = realtime.onDocMessage((msg) => this.receive(msg))
    // Ask peers for their state and re-announce ours now + on every (re)connect.
    this.announce()
    this.unsubConnect = realtime.subscribeConnect(this.announce)
  }

  disconnect(): void {
    if (!this.connected) return
    this.connected = false
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'local')
    this.doc.off('update', this.onDoc)
    this.awareness.off('update', this.onAware)
    this.unsub?.()
    this.unsub = null
    this.unsubConnect?.()
    this.unsubConnect = null
  }

  private receive(msg: {
    type: string
    node_id: string
    sub?: string
    update?: string
  }): void {
    if (msg.node_id !== this.nodeId) return
    try {
      if (msg.type === 'doc_awareness') {
        if (msg.update) applyAwarenessUpdate(this.awareness, b64ToU8(msg.update), 'remote')
        return
      }
      // doc_update
      if (msg.sub === 'sync-req') {
        // A peer just joined — hand them our full doc state + current cursors.
        realtime.sendDocUpdate(this.nodeId, 'sync-state', u8ToB64(Y.encodeStateAsUpdate(this.doc)))
        const ids = [...this.awareness.getStates().keys()]
        if (ids.length)
          realtime.sendDocAwareness(this.nodeId, u8ToB64(encodeAwarenessUpdate(this.awareness, ids)))
        return
      }
      if ((msg.sub === 'update' || msg.sub === 'sync-state') && msg.update) {
        // origin=this so onDoc doesn't rebroadcast what we just merged.
        Y.applyUpdate(this.doc, b64ToU8(msg.update), this)
      }
    } catch (err) {
      console.warn('[collab] receive error', err)
    }
  }

  destroy(): void {
    this.disconnect()
    this.awareness.destroy()
  }
}
