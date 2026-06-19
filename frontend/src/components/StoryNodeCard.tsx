// Custom React Flow node: a story card with ghost handles on every side. The
// handles are invisible until you hover the node, and exist only to start a new
// connection. The draggable connection points themselves live on the edges
// (see FloatingEdge), so a link can be repositioned, reassigned, or deleted by
// grabbing its endpoint.
//
// Hovering also reveals a chevron that expands an in-card preview of the node's
// content (its type fields + a reference count), with a smooth height animation.
import { Fragment, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { KIND_COLORS, TYPE_FIELDS, type StoryNode } from '../types'

export interface StoryNodeData extends Record<string, unknown> {
  title: string
  kind: string
  preview?: string
  story?: StoryNode
}

const SIDES: Position[] = [Position.Top, Position.Right, Position.Bottom, Position.Left]

interface PreviewRow {
  label: string
  text: string
}

// Flatten a node's content into label/value rows for the expanded preview.
function previewRows(kind: string, content: Record<string, unknown>): PreviewRow[] {
  const rows: PreviewRow[] = []
  for (const f of TYPE_FIELDS[kind] ?? TYPE_FIELDS.note) {
    const v = content[f.key]
    if (typeof v === 'string') {
      if (v.trim()) rows.push({ label: f.label, text: v.trim() })
    } else if (Array.isArray(v) && v.length > 0) {
      rows.push({ label: f.label, text: `${v.length} ${v.length === 1 ? 'item' : 'items'}` })
    }
  }
  const refs = content.references
  if (Array.isArray(refs) && refs.length > 0) {
    rows.push({
      label: 'References',
      text: `${refs.length} ${refs.length === 1 ? 'link' : 'links'}`,
    })
  }
  return rows
}

export default function StoryNodeCard({ data, selected }: NodeProps) {
  const d = data as StoryNodeData
  const accent = KIND_COLORS[d.kind] ?? KIND_COLORS.note
  const [expanded, setExpanded] = useState(false)
  const rows = previewRows(d.kind, d.story?.content ?? {})

  return (
    <div
      className="story-node"
      style={{
        borderColor: selected ? accent : 'transparent',
        boxShadow: selected ? `0 0 0 2px ${accent}55` : undefined,
      }}
    >
      {/* Ghost handles — invisible by default, appear on hover for new connections */}
      {SIDES.map((pos) => (
        <Fragment key={pos}>
          <Handle id={pos} type="target" position={pos} className="story-handle" />
          <Handle id={pos} type="source" position={pos} className="story-handle" />
        </Fragment>
      ))}

      <button
        type="button"
        className={'story-node__toggle nodrag' + (expanded ? ' story-node__toggle--open' : '')}
        title={expanded ? 'Hide preview' : 'Preview content'}
        aria-label={expanded ? 'Hide preview' : 'Preview content'}
        onClick={(e) => {
          e.stopPropagation()
          setExpanded((v) => !v)
        }}
      >
        ▾
      </button>

      <span className="story-node__kind" style={{ background: accent }}>
        {d.kind}
      </span>
      <span className="story-node__title">{d.title || 'Untitled'}</span>
      {d.preview && <span className="story-node__preview">{d.preview}</span>}

      <div className={'story-node__more' + (expanded ? ' story-node__more--open' : '')}>
        <div className="story-node__more-inner nodrag">
          {rows.length === 0 ? (
            <p className="story-node__more-empty">No content yet</p>
          ) : (
            rows.map((r) => (
              <div className="story-node__row" key={r.label}>
                <span className="story-node__row-label">{r.label}</span>
                <span className="story-node__row-text">{r.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
