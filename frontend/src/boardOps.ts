// Portable representation of board content (nodes + edges) plus the geometry
// helpers used to copy/paste/duplicate/merge it without overlapping what's
// already on the target board.
import type { Edge, Node } from '@xyflow/react'
import type { StoryEdge, StoryNode } from './types'

export interface PortableNode {
  tempId: string
  type: string
  title: string
  content: Record<string, unknown>
  x: number
  y: number
  width: number | null
  height: number | null
  color: string | null
}

export interface PortableEdge {
  source: string // references a PortableNode.tempId
  target: string
  label: string | null
  data: Record<string, unknown>
}

export interface Portable {
  sourceBoardId: string
  nodes: PortableNode[]
  edges: PortableEdge[]
}

export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const FALLBACK_W = 180
const FALLBACK_H = 60

function boxOf(items: { x: number; y: number; w: number; h: number }[]): Box | null {
  if (!items.length) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const it of items) {
    minX = Math.min(minX, it.x)
    minY = Math.min(minY, it.y)
    maxX = Math.max(maxX, it.x + it.w)
    maxY = Math.max(maxY, it.y + it.h)
  }
  return { minX, minY, maxX, maxY }
}

export function portableBox(nodes: PortableNode[]): Box | null {
  return boxOf(nodes.map((n) => ({
    x: n.x, y: n.y, w: n.width ?? FALLBACK_W, h: n.height ?? FALLBACK_H,
  })))
}

export function rfNodesBox(nodes: Node[]): Box | null {
  return boxOf(nodes.map((n) => ({
    x: n.position.x,
    y: n.position.y,
    w: n.measured?.width ?? FALLBACK_W,
    h: n.measured?.height ?? FALLBACK_H,
  })))
}

export function unionBox(a: Box, b: Box): Box {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

// Offset that places `incoming` just to the right of `existing`, tops aligned.
export function besideOffset(incoming: Box, existing: Box, gap = 80): { dx: number; dy: number } {
  return { dx: existing.maxX + gap - incoming.minX, dy: existing.minY - incoming.minY }
}

// Serialize a set of RF nodes (by id) plus their edges. `edgesTouching` includes
// edges with only one endpoint in the set (needed to faithfully restore a delete);
// otherwise only fully-internal edges are taken (for copy/duplicate).
export function serializeSelection(
  rfNodes: Node[],
  rfEdges: Edge[],
  ids: Set<string>,
  sourceBoardId: string,
  opts: { edgesTouching?: boolean } = {},
): Portable {
  const nodes: PortableNode[] = rfNodes
    .filter((n) => ids.has(n.id))
    .map((n) => {
      const s = n.data?.story as StoryNode | undefined
      return {
        tempId: n.id,
        type: (n.data?.kind as string) ?? s?.type ?? 'note',
        title: (n.data?.title as string) ?? s?.title ?? '',
        content: s?.content ?? {},
        x: n.position.x,
        y: n.position.y,
        width: s?.width ?? null,
        height: s?.height ?? null,
        color: s?.color ?? null,
      }
    })
  const edges: PortableEdge[] = rfEdges
    .filter((e) =>
      opts.edgesTouching
        ? ids.has(e.source) || ids.has(e.target)
        : ids.has(e.source) && ids.has(e.target),
    )
    .map((e) => ({
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : null,
      data: (e.data as Record<string, unknown>) ?? {},
    }))
  return { sourceBoardId, nodes, edges }
}

// Build a Portable from a whole board graph (used by the merge feature).
export function graphToPortable(
  boardId: string,
  nodes: StoryNode[],
  edges: StoryEdge[],
): Portable {
  return {
    sourceBoardId: boardId,
    nodes: nodes.map((n) => ({
      tempId: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      color: n.color,
    })),
    edges: edges.map((e) => ({
      source: e.source_id,
      target: e.target_id,
      label: e.label,
      data: e.data ?? {},
    })),
  }
}
