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
import { safeHref, type Asset, type StoryNode } from '../types'
import { useAuth } from '../auth'
import { useBoardId } from '../boardContext'
import { useRegisterNodeEdit } from '../nodeEditContext'
import { collabColor } from '../collab'
import { realtime } from '../realtime'
import { DownloadIcon, FlipIcon, ResizeGripIcon, RotateIcon } from './icons'

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
    // offsetWidth is the unrotated layout width — getBoundingClientRect would be
    // skewed by zoom and (for image nodes) by any rotation transform.
    const startW = width ?? (mediaRef.current ? mediaRef.current.offsetWidth : 240)
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
    >
      <ResizeGripIcon />
    </div>
  )

  // Free-angle rotation (image nodes). A handle above the node sets the angle from
  // the pointer's position around the node centre; persisted in content.rotation
  // and broadcast so collaborators see it. Hold Shift to snap to 15°.
  const registerEdit = useRegisterNodeEdit()
  const rot0 = typeof content.rotation === 'number' ? (content.rotation as number) : 0
  const flipH = content.flipH === true
  const [rot, setRot] = useState(rot0)
  useEffect(() => setRot(rot0), [rot0])
  // Persist a content change, sync it to collaborators, and record it as an
  // undoable edit (same before/after path the object panel uses) so Ctrl+Z
  // restores the previous state. `before` is the content captured beforehand.
  function commitContent(before: Record<string, unknown>, after: Record<string, unknown>) {
    const story = d.story
    const title = (story?.title as string) ?? (d.title as string) ?? 'file'
    const type = (story?.type as string) ?? 'media'
    void api.updateNode(boardId, id, { content: after }).then(() => realtime.sendDirty()).catch(() => {})
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, story: { ...(n.data.story as StoryNode), content: after } } }
          : n,
      ),
    )
    registerEdit?.(id, { title, type, content: before }, { title, type, content: after })
  }
  const commitRotation = (before: Record<string, unknown>, deg: number) =>
    commitContent(before, { ...before, rotation: deg })
  // Flip horizontally (mirror). A discrete toggle — also undoable.
  const toggleFlip = () => commitContent({ ...content }, { ...content, flipH: !flipH })
  // Manual double-click detection: a pointerdown's preventDefault() suppresses the
  // browser's compatibility dblclick, so we time two taps ourselves. Double-click
  // the handle to snap the image back to its original (0°) orientation.
  const lastRotTap = useRef(0)
  function startRotate(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.timeStamp - lastRotTap.current < 350) {
      lastRotTap.current = 0
      if (rot0 !== 0) {
        setRot(0)
        commitRotation({ ...content }, 0)
      }
      return // a reset, not a rotate drag
    }
    lastRotTap.current = e.timeStamp
    const card = (e.currentTarget as HTMLElement).closest('.media-node') as HTMLElement | null
    if (!card) return
    const before = { ...content } // angle before this drag, for undo
    const r = card.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const onMove = (ev: PointerEvent) => {
      let a = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90
      if (ev.shiftKey) a = Math.round(a / 15) * 15
      a = ((Math.round(a) % 360) + 360) % 360 // 0..359
      if (a > 180) a -= 360 // normalise to (-180, 180]
      setRot(a)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setRot((a) => {
        if (a !== rot0) commitRotation(before, a) // skip no-op (a click, not a drag)
        return a
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  const rotateHandle = (
    <div
      className="media-node__rotate nodrag"
      title="Drag to rotate · hold Shift to snap · double-click to reset"
      onPointerDown={startRotate}
      onClick={(e) => e.stopPropagation()}
    >
      <RotateIcon />
    </div>
  )
  const flipBtn = (
    <button
      type="button"
      className="media-node__flip nodrag"
      title="Flip horizontally (mirror)"
      aria-label="Flip horizontally"
      aria-pressed={flipH}
      onClick={(e) => {
        e.stopPropagation()
        toggleFlip()
      }}
    >
      <FlipIcon />
    </button>
  )
  // Combined image transform: mirror is applied in the image's own frame first
  // (rightmost), then rotation, so a flipped image still rotates intuitively.
  const imgTransform =
    [rot ? `rotate(${rot}deg)` : '', flipH ? 'scaleX(-1)' : ''].filter(Boolean).join(' ') || undefined

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
      let targetId = assetId
      let updated: Asset
      try {
        updated = await api.renameAsset(id, targetId, v)
      } catch {
        // The asset belongs to another node -- an older copy that still shares
        // the original's asset (the ownership check 404s). Give THIS node its own
        // asset row (sharing the stored file), then rename that one.
        const refs = await api.referenceAssets(id, [assetId])
        if (!refs[0]) return
        targetId = refs[0].id
        updated = await api.renameAsset(id, targetId, v)
      }
      const newContent = {
        ...content,
        assetId: targetId,
        filename: updated.filename,
        url: updated.url,
        thumbnailUrl: updated.thumbnail_url,
      }
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
      // Let collaborators see the new name without a refresh.
      realtime.sendDirty()
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
      <DownloadIcon />
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
        style={imgTransform ? { ...(sizeStyle ?? {}), transform: imgTransform } : sizeStyle}
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
      {mk === 'image' && selected && rotateHandle}
      {mk === 'image' && selected && flipBtn}
      <div className="media-node__body">{body}</div>
      {mk !== 'file' && caption}
      {(mk === 'image' || mk === 'video' || mk === 'audio') && resizeGrip}
    </div>
  )
}
