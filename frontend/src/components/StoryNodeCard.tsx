// Custom React Flow node: a story card with ghost handles on every side. The
// handles are invisible until you hover the node, and exist only to start a new
// connection. The draggable connection points themselves live on the edges
// (see FloatingEdge), so a link can be repositioned, reassigned, or deleted by
// grabbing its endpoint.
//
// Hovering reveals a chevron that expands an in-card preview of the node's
// content: its type fields, media thumbnails, and reference link previews, with
// a smooth height animation. Media is fetched lazily the first time it expands.
import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { listAssets } from '../api'
import {
  fileExt,
  KIND_COLORS,
  mediaKind,
  OBJECT_COLOR,
  safeHref,
  setAssetDragData,
  TYPE_FIELDS,
  typeLabel,
  type Asset,
  type LinkRef,
  type StoryNode,
} from '../types'
import { useAuth } from '../auth'
import { collabColor } from '../collab'
import Gallery from './Gallery'
import { fmt, parseTime } from './TimestampsField'
import {
  SceneIcon,
  CharacterIcon,
  DialogIcon,
  EventIcon,
  NoteIcon,
  ObjectIcon,
} from './icons'

// The icon for each object kind (colored to match the kind's tag via CSS).
function kindIcon(kind: string) {
  switch (kind) {
    case 'scene':
      return <SceneIcon />
    case 'character':
      return <CharacterIcon />
    case 'dialog':
      return <DialogIcon />
    case 'event':
      return <EventIcon />
    case 'note':
      return <NoteIcon />
    default:
      return <ObjectIcon />
  }
}

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
  const accent = KIND_COLORS[d.kind] ?? OBJECT_COLOR
  // My own selection ring uses my stable collaborator color (the same one others
  // see for me), so a selected node looks consistent for everyone.
  const { user } = useAuth()
  const selColor = user ? user.color ?? collabColor(user.id) : accent
  const [expanded, setExpanded] = useState(false)
  const [closing, setClosing] = useState(false)
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const closeTimer = useRef<number | null>(null)

  const story = d.story
  const content = story?.content ?? {}
  const rows = fieldRows(d.kind, content)
  const references: LinkRef[] = Array.isArray(content.references)
    ? (content.references as LinkRef[])
    : []
  const timestamps: LinkRef[] = Array.isArray(content.timestamps)
    ? (content.timestamps as LinkRef[])
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
  const isEmpty =
    rows.length === 0 && media.length === 0 && references.length === 0 && timestamps.length === 0

  // Keep the preview's images mounted only while open (plus a short window so
  // the collapse animation can play). Collapsing releases the decoded images.
  const showContent = expanded || closing
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
    <div
      className="story-node"
      style={{
        borderColor: selected ? selColor : 'transparent',
        boxShadow: selected ? `0 0 0 2px ${selColor}55` : undefined,
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
          toggle()
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        ▾
      </button>

      <span className="story-node__kind" style={{ background: accent }}>
        {typeLabel(d.kind)}
      </span>
      <div className="story-node__head">
        <span className="story-node__icon" style={{ color: accent }}>
          {kindIcon(d.kind)}
        </span>
        <span className="story-node__title">{d.title || 'Untitled'}</span>
      </div>
      {d.preview && <span className="story-node__preview">{d.preview}</span>}

      <div className={'story-node__more' + (expanded ? ' story-node__more--open' : '')}>
        <div className="story-node__more-inner nodrag">
          {showContent && (
            <>
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
                    title={`${a.filename} · drag onto the canvas to place it`}
                    draggable
                    onDragStart={(e) => setAssetDragData(e.dataTransfer, a)}
                    onClick={(e) => {
                      e.stopPropagation()
                      setGalleryIndex(i)
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    {thumb ? (
                      <img src={thumb} alt="" loading="lazy" draggable={false} />
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
                  href={safeHref(r.url)}
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

          {timestamps.length > 0 && (
            <div className="story-node__refs">
              {timestamps.slice(0, MAX_LINKS).map((r, i) => {
                const t = parseTime(r.url)
                return (
                  <a
                    className="story-node__ref nodrag"
                    key={r.url + i}
                    href={safeHref(r.url)}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={r.url}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <span className="story-node__ref-thumb">
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
                        <span className="story-node__ref-img story-node__ref-img--blank">▶</span>
                      )}
                      {t != null && <span className="stamp-time">{fmt(t)}</span>}
                    </span>
                    <span className="story-node__ref-title">{r.title || r.url}</span>
                  </a>
                )
              })}
              {timestamps.length > MAX_LINKS && (
                <span className="story-node__refs-more">
                  +{timestamps.length - MAX_LINKS} more
                </span>
              )}
            </div>
          )}

          {isEmpty && <p className="story-node__more-empty">No content yet</p>}
            </>
          )}
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
