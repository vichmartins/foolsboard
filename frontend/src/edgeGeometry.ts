// Shared geometry helpers for floating edges and draggable connection points.
import type { Node } from '@xyflow/react'
import type { Side } from './types'

export const NODE_FALLBACK_W = 180
export const NODE_FALLBACK_H = 60

export function nodeSize(node: Node): { w: number; h: number } {
  return {
    w: node.measured?.width ?? NODE_FALLBACK_W,
    h: node.measured?.height ?? NODE_FALLBACK_H,
  }
}

// Given a flow-space point and a node's box, return the nearest border side and
// the position along it (t in 0..1). Used both when dragging a pin and when
// dropping a freshly drawn connection.
export function snapToBorder(
  fx: number, fy: number,
  nx: number, ny: number, nw: number, nh: number,
): { side: Side; t: number } {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const dTop    = Math.abs(fy - ny)
  const dBottom = Math.abs(fy - (ny + nh))
  const dLeft   = Math.abs(fx - nx)
  const dRight  = Math.abs(fx - (nx + nw))
  const min = Math.min(dTop, dBottom, dLeft, dRight)
  if (min === dTop)    return { side: 'top',    t: clamp((fx - nx) / nw) }
  if (min === dBottom) return { side: 'bottom', t: clamp((fx - nx) / nw) }
  if (min === dLeft)   return { side: 'left',   t: clamp((fy - ny) / nh) }
  return                      { side: 'right',  t: clamp((fy - ny) / nh) }
}

// Topmost node whose box (expanded by `margin`) contains the point, excluding
// one id (the connection's source). The margin lets a connection "latch on"
// when released just outside the border.
export function findNodeAt(
  nodes: Node[],
  point: { x: number; y: number },
  excludeId?: string,
  margin = 24,
): Node | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]
    if (excludeId && n.id === excludeId) continue
    const { w, h } = nodeSize(n)
    if (
      point.x >= n.position.x - margin && point.x <= n.position.x + w + margin &&
      point.y >= n.position.y - margin && point.y <= n.position.y + h + margin
    ) {
      return n
    }
  }
  return null
}
