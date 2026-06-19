// A clipboard that persists in localStorage so copied content survives board
// switches (and reloads) — this is what makes copy/paste work between boards.
import type { Portable } from './boardOps'

const KEY = 'foolsboard:clipboard'

export function writeClipboard(p: Portable): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // Ignore quota / privacy-mode failures; clipboard just won't persist.
  }
}

export function readClipboard(): Portable | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Portable
    return p && Array.isArray(p.nodes) && p.nodes.length ? p : null
  } catch {
    return null
  }
}

export function clipboardHasContent(): boolean {
  return readClipboard() !== null
}
