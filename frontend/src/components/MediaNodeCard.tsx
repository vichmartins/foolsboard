// A standalone media node: an image, video, audio clip, file, or link dropped
// straight onto the canvas. Draggable and connectable like a story object, but
// it renders its media directly instead of an editable field card.
//
// Interactive bits (video/audio controls, the link/file anchors) are marked
// `nodrag` so React Flow doesn't start a drag from them; the frame, caption, and
// padding remain draggable so the node can still be moved.
import { Fragment } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { safeHref, type StoryNode } from '../types'
import { useAuth } from '../auth'
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
  const { deleteElements } = useReactFlow()
  const selColor = user ? user.color ?? collabColor(user.id) : '#94a3b8'
  const content = (d.story?.content ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof content[k] === 'string' ? (content[k] as string) : '')

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
  const filename = str('filename') || d.title || 'file'
  const thumb = str('thumbnailUrl')

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
    body = <img className="media-node__img" src={url} alt={filename} draggable={false} />
  } else if (mk === 'video') {
    body = (
      <video
        className="media-node__video nodrag"
        src={url}
        poster={thumb || undefined}
        controls
        preload="metadata"
      />
    )
  } else if (mk === 'audio') {
    body = (
      <div className="media-node__audio">
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
      <div className="media-node__body">{body}</div>
      {mk !== 'file' && <span className="media-node__caption">{filename}</span>}
    </div>
  )
}
