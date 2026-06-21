// Mirrors the backend's color_for() (app/realtime.py) so a user's OWN node
// selection is drawn in the same color other collaborators see for them -- a
// stable per-user color, not the node's type color.
const PALETTE = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
]

export function collabColor(userId: string): string {
  try {
    const n = BigInt('0x' + userId.replace(/-/g, ''))
    return PALETTE[Number(n % BigInt(PALETTE.length))]
  } catch {
    return PALETTE[0]
  }
}
