// Maps a persisted StoryEdge into the React Flow edge shape used on the canvas.
import type { Edge } from '@xyflow/react'
import type { StoryEdge } from './types'

export function toRFEdge(e: StoryEdge): Edge {
  return {
    id: e.id,
    type: 'floating',
    source: e.source_id,
    target: e.target_id,
    sourceHandle: (e.data?.sourceHandle as string | undefined) ?? 'right',
    targetHandle: (e.data?.targetHandle as string | undefined) ?? 'left',
    label: e.label ?? undefined,
    data: e.data,
  }
}
