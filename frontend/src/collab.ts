// Pickable collaborator highlight colors. Must match the backend PALETTE
// (app/realtime.py) and deliberately avoids the object-type colors (KIND_COLORS
// / OBJECT_COLOR in types.ts) so a highlight never looks like a node type.
export const HIGHLIGHT_PALETTE = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#84cc16',
  '#eab308',
]

// Deterministic fallback color for a user who hasn't picked one (mirrors the
// backend's color_for).
export function collabColor(userId: string): string {
  try {
    const n = BigInt('0x' + userId.replace(/-/g, ''))
    return HIGHLIGHT_PALETTE[Number(n % BigInt(HIGHLIGHT_PALETTE.length))]
  } catch {
    return HIGHLIGHT_PALETTE[0]
  }
}
