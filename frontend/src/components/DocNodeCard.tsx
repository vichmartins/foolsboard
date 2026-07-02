// A rich-text document node on the canvas. Renders as a small "page" showing the
// title and a plain-text preview (from content.text); double-clicking it opens
// the full editor (handled in Canvas via onNodeDoubleClick). Connectable and
// movable like any other node. Hovering reveals a chevron that expands an in-card,
// scrollable preview of the rendered document (like the other object cards).
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useAuth } from '../auth'
import { collabColor } from '../collab'
import { KIND_COLORS, type StoryNode } from '../types'
import { docNodeToHtml } from './docExport'
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
  const isScript = content.mode === 'script'
  const ring = {
    borderColor: selected ? selColor : undefined,
    boxShadow: selected ? `0 0 0 2px ${selColor}55` : undefined,
  }

  // In-card preview (rendered document), expanded via the chevron. Keep the HTML
  // mounted through the collapse animation, then release it.
  const [expanded, setExpanded] = useState(false)
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const showContent = expanded || closing
  const html = useMemo(
    () => (showContent && d.story ? docNodeToHtml(d.story) : ''),
    [showContent, d.story],
  )
  function toggle() {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    if (expanded) {
      setExpanded(false)
      setClosing(true)
      closeTimer.current = window.setTimeout(() => setClosing(false), 300)
    } else {
      setClosing(false)
      setExpanded(true)
    }
  }
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
    },
    [],
  )

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
      <button
        type="button"
        className={'doc-node__toggle nodrag' + (expanded ? ' doc-node__toggle--open' : '')}
        title={expanded ? 'Hide preview' : 'Preview content'}
        aria-label={expanded ? 'Hide preview' : 'Preview content'}
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        ▾
      </button>
      <span className="story-node__kind" style={{ background: KIND_COLORS.doc }}>
        {isScript ? 'Screenplay' : 'Document'}
      </span>
      <div className="doc-node__head">
        <span className="doc-node__icon" style={{ color: KIND_COLORS.doc }}>
          <DocIcon />
        </span>
        <span className="doc-node__title">{title}</span>
      </div>
      {/* Plain-text preview when collapsed; the rendered preview replaces it when
          expanded (so the same text isn't shown twice). */}
      {!expanded && (
        <div className="doc-node__preview">
          {preview ? (
            preview
          ) : (
            <span className="doc-node__empty">Empty document — double-click to write</span>
          )}
        </div>
      )}

      <div className={'doc-node__more' + (expanded ? ' doc-node__more--open' : '')}>
        <div className="doc-node__more-inner nodrag">
          {showContent &&
            (html ? (
              <div
                className={'doc-node__render pt-doc nowheel' + (isScript ? ' pt-doc--script' : '')}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <p className="doc-node__more-empty">No content yet</p>
            ))}
        </div>
      </div>
    </div>
  )
}
