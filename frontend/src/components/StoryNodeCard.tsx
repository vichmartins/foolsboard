// Custom React Flow node: a story object card with connection handles.
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { KIND_COLORS } from '../types'

export interface StoryNodeData extends Record<string, unknown> {
  title: string
  kind: string
}

export default function StoryNodeCard({ data, selected }: NodeProps) {
  const d = data as StoryNodeData
  const accent = KIND_COLORS[d.kind] ?? KIND_COLORS.note
  return (
    <div
      className="story-node"
      style={{
        borderColor: selected ? accent : 'transparent',
        boxShadow: selected ? `0 0 0 2px ${accent}55` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <span className="story-node__kind" style={{ background: accent }}>
        {d.kind}
      </span>
      <span className="story-node__title">{d.title || 'Untitled'}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
