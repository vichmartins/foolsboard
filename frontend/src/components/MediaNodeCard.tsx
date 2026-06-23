// A standalone media node: an image, video, audio clip, file, or link dropped
// straight onto the canvas. Draggable and connectable like a story object, but
// it renders its media directly instead of an editable field card.
//
// Interactive bits (video/audio controls, the link/file anchors) are marked
// `nodrag` so React Flow doesn't start a drag from them; the frame, caption, and
// padding remain draggable so the node can still be moved.
import { Fragment, useEffect, useRef, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import * as api from '../api'
import { safeHref, type StoryNode } from '../types'
import { useAuth } from '../auth'
import { useBoardId } from '../boardContext'
import { collabColor } from '../collab'

const SIDES: Position[] = [Position.Top, Position.Right, Position.Bottom, Position.Left]

interface MediaNodeData extends Record<string, unknown> {
  title: string
  kind: string
  story?: StoryNode
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function MediaNodeCard({ id, data, selected }: NodeProps) {
  const d = data as MediaNodeData
  const { user } = useAuth()
  const { deleteElements, getZoom, setNodes } = useReactFlow()
  const boardId = useBoardId()
  const selColor = user ? user.color ?? collabColor(user.id) : '#94a3b8'
  const content = (d.story?.content ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof content[k] === 'string' ? (content[k] as string) : '')
  const assetId = str('assetId')

  // Resize: a corner grip drives the media's width; height follows (aspect kept).
  // Stored on node.width so it survives reloads.
  const savedW =
    typeof d.story?.width === 'number' && d.story.width > 0 ? d.story.width : undefined
  const [width, setWidth] = useState<number | undefined>(savedW)
  useEffect(() => setWidth(savedW), [savedW])
  const mediaRef = useRef<HTMLElement | null>(null)
  function startResize(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const zoom = getZoom() || 1
    const startX = e.clientX
    const startW =
      width ?? (mediaRef.current ? mediaRef.current.getBoundingClientRect().width / zoom : 240)
    const onMove = (ev: PointerEvent) => {
      setWidth(Math.max(60, Math.min(1600, startW + (ev.clientX - startX) / zoom)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setWidth((w) => {
        if (w) void api.updateNode(boardId, id, { width: Math.round(w) }).catch(() => {})
        return w
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  const sizeStyle = width
    ? { width: `${width}px`, maxWidth: 'none' as const, maxHeight: 'none' as const }
    : undefined
  const resizeGrip = (
    <div
      className="media-node__resize nodrag"
      title="Drag to resize"
      onPointerDown={startResize}
      onClick={(e) => e.stopPropagation()}
    />
  )

  // Rename: double-click the caption to edit the filename (extension stays
  // locked, like the panel). Updates the asset + the node's cached title.
  const filename = str('filename') || d.title || 'file'
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState('')
  function startRename() {
    const dot = filename.lastIndexOf('.')
    setNameVal(dot > 0 ? filename.slice(0, dot) : filename)
    setEditing(true)
  }
  async function submitRename() {
    setEditing(false)
    const v = nameVal.trim()
    if (!v || !assetId) return
    try {
      const updated = await api.renameAsset(id, assetId, v)
      const newContent = { ...content, filename: updated.filename }
      await api.updateNode(boardId, id, { content: newContent, title: updated.filename })
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  title: updated.filename,
                  story: {
                    ...(n.data.story as StoryNode),
                    title: updated.filename,
                    content: newContent,
                  },
                },
              }
            : n,
        ),
      )
    } catch {
      /* ignore */
    }
  }
  const caption =
    editing ? (
      <input
        className="media-node__caption media-node__caption--edit nodrag"
        autoFocus
        value={nameVal}
        onChange={(e) => setNameVal(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submitRename()
          if (e.key === 'Escape') setEditing(false)
        }}
        onBlur={() => void submitRename()}
      />
    ) : (
      <span
        className="media-node__caption"
        title="Double-click to rename"
        onDoubleClick={(e) => {
          e.stopPropagation()
          startRename()
        }}
      >
        {filename}
      </span>
    )

  const ring = {
    borderColor: selected ? selColor : 'transparent',
    boxShadow: selected ? `0 0 0 2px ${selColor}55` : undefined,
  }
  const handles = (
    <>
      {SIDES.map((pos) => (
        <Fragment key={pos}>
          <Handle id={pos} type="target" position={pos} className="story-handle" />
          <Handle id={pos} type="source" position={pos} className="story-handle" />
        </Fragment>
      ))}
      <button
        type="button"
        className="media-node__del nodrag"
        title="Remove from board"
        aria-label="Remove from board"
        onClick={(e) => {
          e.stopPropagation()
          void deleteElements({ nodes: [{ id }] })
        }}
      >
        ✕
      </button>
    </>
  )

  // --- Link node ---------------------------------------------------------
  if (d.kind === 'link') {
    const url = str('url')
    const title = str('title') || url || 'Link'
    const image = str('image')
    return (
      <div className="media-node media-node--link" style={ring}>
        {handles}
        {image ? (
          <img
            className="media-node__link-img"
            src={image}
            alt=""
            draggable={false}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <span className="media-node__link-img media-node__link-img--blank">🔗</span>
        )}
        <span className="media-node__link-body">
          <span className="media-node__link-title">{title}</span>
          <span className="media-node__link-site">{str('site_name') || hostname(url)}</span>
        </span>
        <a
          className="media-node__open nodrag"
          href={safeHref(url)}
          target="_blank"
          rel="noreferrer noopener"
          title="Open link"
          onClick={(e) => e.stopPropagation()}
        >
          ↗
        </a>
      </div>
    )
  }

  // --- File-based media (image / video / audio / file) -------------------
  const mk = str('mediaKind') || 'file'
  const url = str('url')
  const thumb = str('thumbnailUrl')
  const downloadBtn = url ? (
    <a
      className="media-node__dl nodrag"
      href={url}
      download={filename}
      title="Download"
      aria-label="Download"
      onClick={(e) => e.stopPropagation()}
    >
      ⬇
    </a>
  ) : null

  // Created node before its upload finished: show a placeholder.
  if (!url) {
    return (
      <div className="media-node media-node--loading" style={ring}>
        {handles}
        <span className="media-node__spin">Uploading…</span>
      </div>
    )
  }

  let body
  if (mk === 'image') {
    body = (
      <img
        ref={(el) => {
          mediaRef.current = el
        }}
        className="media-node__img"
        src={url}
        alt={filename}
        draggable={false}
        style={sizeStyle}
      />
    )
  } else if (mk === 'video') {
    body = (
      <video
        ref={(el) => {
          mediaRef.current = el
        }}
        className="media-node__video nodrag"
        src={url}
        poster={thumb || undefined}
        controls
        preload="metadata"
        style={sizeStyle}
      />
    )
  } else if (mk === 'audio') {
    body = (
      <div
        ref={(el) => {
          mediaRef.current = el
        }}
        className="media-node__audio"
        style={sizeStyle}
      >
        {thumb && (
          <img className="media-node__audio-cover" src={thumb} alt="" draggable={false} />
        )}
        <audio className="media-node__audio-el nodrag" src={url} controls preload="metadata" />
      </div>
    )
  } else {
    body = (
      <a
        className="media-node__file nodrag"
        href={safeHref(url)}
        target="_blank"
        rel="noreferrer noopener"
        download={filename}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="media-node__file-icon">📄</span>
        <span className="media-node__file-name">{filename}</span>
      </a>
    )
  }

  return (
    <div className={'media-node media-node--' + mk} style={ring}>
      {handles}
      {downloadBtn}
      <div className="media-node__body">{body}</div>
      {mk !== 'file' && caption}
      {(mk === 'image' || mk === 'video' || mk === 'audio') && resizeGrip}
    </div>
  )
}
