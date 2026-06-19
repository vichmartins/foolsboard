// Custom React Flow node: a story card with ghost handles on every side. The
// handles are invisible until you hover the node, and exist only to start a new
// connection. The draggable connection points themselves live on the edges
// (see FloatingEdge), so a link can be repositioned, reassigned, or deleted by
// grabbing its endpoint.
//
// Hovering reveals a chevron that expands an in-card preview of the node's
// content: its type fields, media thumbnails, and reference link previews, with
// a smooth height animation. Media is fetched lazily the first time it expands.
import { Fragment, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { listAssets } from '../api'
import {
  fileExt,
  KIND_COLORS,
  mediaKind,
  TYPE_FIELDS,
  type Asset,
  type LinkRef,
  type StoryNode,
} from '../types'
import Gallery from './Gallery'

export interface StoryNodeData extends Record<string, unknown> {
  title: string
  kind: string
  preview?: string
  story?: StoryNode
}

const SIDES: Position[] = [Position.Top, Position.Right, Position.Bottom, Position.Left]

// Caps for the in-card preview (the lightbox still browses all media).
const MAX_THUMBS = 8
const MAX_LINKS = 4

interface PreviewRow {
  label: string
  text: string
}

// Text rows for the expanded preview: string fields verbatim, array fields
// (e.g. Animations) as a count. References/media are rendered separately.
function fieldRows(kind: string, content: Record<string, unknown>): PreviewRow[] {
  const rows: PreviewRow[] = []
  for (const f of TYPE_FIELDS[kind] ?? TYPE_FIELDS.note) {
    const v = content[f.key]
    if (typeof v === 'string') {
      if (v.trim()) rows.push({ label: f.label, text: v.trim() })
    } else if (Array.isArray(v) && v.length > 0) {
      rows.push({ label: f.label, text: `${v.length} ${v.length === 1 ? 'item' : 'items'}` })
    }
  }
  return rows
}

export default function StoryNodeCard({ data, selected }: NodeProps) {
  const d = data as StoryNodeData
  const accent = KIND_COLORS[d.kind] ?? KIND_COLORS.note
  const [expanded, setExpanded] = useState(false)
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)

  const story = d.story
  const content = story?.content ?? {}
  const rows = fieldRows(d.kind, content)
  const references: LinkRef[] = Array.isArray(content.references)
    ? (content.references as LinkRef[])
    : []

  // Load this node's media the first time the preview is opened.
  useEffect(() => {
    if (expanded && assets === null && story?.id) {
      listAssets(story.id)
        .then(setAssets)
        .catch(() => setAssets([]))
    }
  }, [expanded, assets, story?.id])

  const media = assets ?? []
  const isEmpty = rows.length === 0 && media.length === 0 && references.length === 0

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
        onDoubleClick={(e) => e.stopPropagation()}
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
          {rows.map((r) => (
            <div className="story-node__row" key={r.label}>
              <span className="story-node__row-label">{r.label}</span>
              <span className="story-node__row-text">{r.text}</span>
            </div>
          ))}

          {media.length > 0 && (
            <div className="story-node__media">
              {media.slice(0, MAX_THUMBS).map((a, i) => {
                const k = mediaKind(a)
                const thumb = a.thumbnail_url ?? (k === 'image' ? a.url : null)
                return (
                  <button
                    type="button"
                    className="story-node__thumb nodrag"
                    key={a.id}
                    title={a.filename}
                    onClick={(e) => {
                      e.stopPropagation()
                      setGalleryIndex(i)
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    {thumb ? (
                      <img src={thumb} alt="" loading="lazy" />
                    ) : (
                      <span className="story-node__thumb-ph">
                        {k === 'audio' ? '♪' : fileExt(a.filename) || 'FILE'}
                      </span>
                    )}
                    {k === 'video' && <span className="story-node__thumb-badge">▶</span>}
                  </button>
                )
              })}
              {media.length > MAX_THUMBS && (
                <button
                  type="button"
                  className="story-node__thumb story-node__thumb--more nodrag"
                  title={`${media.length - MAX_THUMBS} more`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setGalleryIndex(MAX_THUMBS)
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  +{media.length - MAX_THUMBS}
                </button>
              )}
            </div>
          )}

          {references.length > 0 && (
            <div className="story-node__refs">
              {references.slice(0, MAX_LINKS).map((r, i) => (
                <a
                  className="story-node__ref nodrag"
                  key={r.url + i}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={r.url}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  {r.image ? (
                    <img
                      className="story-node__ref-img"
                      src={r.image}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <span className="story-node__ref-img story-node__ref-img--blank">🔗</span>
                  )}
                  <span className="story-node__ref-title">{r.title || r.url}</span>
                </a>
              ))}
              {references.length > MAX_LINKS && (
                <span className="story-node__refs-more">
                  +{references.length - MAX_LINKS} more
                </span>
              )}
            </div>
          )}

          {isEmpty && <p className="story-node__more-empty">No content yet</p>}
        </div>
      </div>

      {/* Portal to body so the lightbox isn't scaled by the canvas transform. */}
      {galleryIndex !== null &&
        media[galleryIndex] &&
        createPortal(
          <Gallery
            assets={media}
            index={galleryIndex}
            onIndexChange={setGalleryIndex}
            onClose={() => setGalleryIndex(null)}
          />,
          document.body,
        )}
    </div>
  )
}
