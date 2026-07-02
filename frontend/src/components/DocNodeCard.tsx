// A rich-text document node on the canvas. Renders as a small "page" showing the
// title and a plain-text preview (from content.text); double-clicking it opens
// the full editor (handled in Canvas via onNodeDoubleClick). Connectable and
// movable like any other node.
import { Fragment } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useAuth } from '../auth'
import { collabColor } from '../collab'
import { KIND_COLORS, type StoryNode } from '../types'
import { DocIcon } from './icons'

const SIDES: Position[] = [Position.Top, Position.Right, Position.Bottom, Position.Left]

interface DocNodeData extends Record<string, unknown> {
  title: string
  kind: string
  story?: StoryNode
}

export default function DocNodeCard({ id, data, selected }: NodeProps) {
  const d = data as DocNodeData
  const { user } = useAuth()
  const { deleteElements } = useReactFlow()
  const selColor = user ? user.color ?? collabColor(user.id) : '#94a3b8'
  const content = (d.story?.content ?? {}) as Record<string, unknown>
  const title = (d.story?.title as string) || d.title || 'Untitled document'
  const preview = typeof content.text === 'string' ? (content.text as string).trim() : ''
  const ring = {
    borderColor: selected ? selColor : undefined,
    boxShadow: selected ? `0 0 0 2px ${selColor}55` : undefined,
  }

  return (
    <div className="doc-node" style={ring} title="Double-click to open">
      {SIDES.map((pos) => (
        <Fragment key={pos}>
          <Handle id={pos} type="target" position={pos} className="story-handle" />
          <Handle id={pos} type="source" position={pos} className="story-handle" />
        </Fragment>
      ))}
      <button
        type="button"
        className="media-node__del nodrag"
        title="Remove from Board"
        aria-label="Remove from board"
        onClick={(e) => {
          e.stopPropagation()
          void deleteElements({ nodes: [{ id }] })
        }}
      >
        ✕
      </button>
      <span className="story-node__kind" style={{ background: KIND_COLORS.doc }}>
        {content.mode === 'script' ? 'Screenplay' : 'Document'}
      </span>
      <div className="doc-node__head">
        <span className="doc-node__icon" style={{ color: KIND_COLORS.doc }}>
          <DocIcon />
        </span>
        <span className="doc-node__title">{title}</span>
      </div>
      <div className="doc-node__preview">
        {preview ? preview : <span className="doc-node__empty">Empty document — double-click to write</span>}
      </div>
    </div>
  )
}
