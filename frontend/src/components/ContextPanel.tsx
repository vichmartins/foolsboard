// Side panel: view/edit the selected object and manage its media.
import { useEffect, useRef, useState } from 'react'
import {
  deleteAsset,
  deleteNode,
  listAssets,
  referenceAssets,
  updateNode,
  uploadAsset,
} from '../api'
import {
  fileExt,
  KIND_COLORS,
  mediaKind,
  NODE_TYPES,
  TYPE_FIELDS,
  typeLabel,
  type Asset,
  type LinkRef,
  type NearbyNode,
  type StoryNode,
} from '../types'
import AnimationsField from './AnimationsField'
import ConfirmDialog from './ConfirmDialog'
import Gallery from './Gallery'
import NearbyNodes from './NearbyNodes'
import ReferencesField from './ReferencesField'
import Select from './Select'

interface Props {
  boardId: string
  node: StoryNode
  nearby: NearbyNode[]
  onChange: (node: StoryNode) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
  // True while the panel is sliding out (before it unmounts).
  closing?: boolean
  // Files dropped onto the app while this panel was open (uploaded here).
  droppedFiles?: File[] | null
  onDroppedConsumed?: () => void
}

export default function ContextPanel({
  boardId,
  node,
  nearby,
  onChange,
  onDelete,
  onClose,
  closing,
  droppedFiles,
  onDroppedConsumed,
}: Props) {
  const [title, setTitle] = useState(node.title)
  const [type, setType] = useState(node.type)
  // The whole content blob is held in state; per-type fields read/write keys in it
  // so switching type never loses data the other type captured.
  const [content, setContent] = useState<Record<string, unknown>>(node.content ?? {})
  const [assets, setAssets] = useState<Asset[]>([])
  const [busy, setBusy] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const savingRef = useRef(false)
  const savedTimer = useRef<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ url: string; top: number } | null>(null)
  // In-flight uploads: progress 0-100 (100 = bytes sent, server still processing).
  const [uploads, setUploads] = useState<{ id: string; name: string; progress: number }[]>([])
  const [mediaExpanded, setMediaExpanded] = useState(false)
  const [mediaClosing, setMediaClosing] = useState(false)
  const [showNearby, setShowNearby] = useState(false)
  const mediaTimer = useRef<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Re-sync local state whenever a different node is selected.
  useEffect(() => {
    setTitle(node.title)
    setType(node.type)
    setContent(node.content ?? {})
    setConfirmDelete(false)
    setShowNearby(false)
    listAssets(node.id).then(setAssets).catch(() => setAssets([]))
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fields = TYPE_FIELDS[type] ?? TYPE_FIELDS.note

  // Once an object has real content (a title beyond the default, or any filled
  // field), show its title + colored type tag instead of a generic header.
  const accent = KIND_COLORS[type] ?? KIND_COLORS.note
  const hasContent = Object.values(content).some((v) => String(v ?? '').trim() !== '')
  const isExisting = (title.trim() !== '' && title.trim() !== 'New object') || hasContent

  function setField(key: string, value: unknown) {
    setContent((c) => ({ ...c, [key]: value }))
  }

  // Pull media from a nearby node into this node's Media (shares the stored file
  // via dedup -- instant, persisted immediately like an upload).
  async function addReferencedMedia(assetIds: string[]) {
    const added = await referenceAssets(node.id, assetIds)
    setAssets((prev) => [...prev, ...added])
  }

  // Pull reference links from a nearby node into this node's References (saved
  // with the node's content on Save). Skips links already present.
  function addReferencedLinks(links: LinkRef[]) {
    setContent((c) => {
      const existing = Array.isArray(c.references) ? (c.references as LinkRef[]) : []
      const seen = new Set(existing.map((r) => r.url))
      return { ...c, references: [...existing, ...links.filter((l) => !seen.has(l.url))] }
    })
  }

  async function save() {
    // Guarded with a ref (not the visual `busy` state) so a fast save doesn't
    // flash the buttons' disabled styling.
    if (savingRef.current) return
    savingRef.current = true
    try {
      const updated = await updateNode(boardId, node.id, { title, type, content })
      onChange(updated)
      setJustSaved(true)
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setJustSaved(false), 1800)
    } finally {
      savingRef.current = false
    }
  }

  useEffect(() => () => {
    if (savedTimer.current) window.clearTimeout(savedTimer.current)
  }, [])

  // Ctrl/Cmd+S saves while the panel is open (reads the latest save via a ref).
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function uploadFile(file: File) {
    const uploadId = crypto.randomUUID()
    setUploads((u) => [...u, { id: uploadId, name: file.name, progress: 0 }])
    setBusy(true)
    try {
      const asset = await uploadAsset(node.id, file, (pct) =>
        setUploads((u) => u.map((x) => (x.id === uploadId ? { ...x, progress: pct } : x))),
      )
      setAssets((prev) => [...prev, asset])
    } finally {
      setBusy(false)
      setUploads((u) => u.filter((x) => x.id !== uploadId))
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Upload files dropped onto the app (handed down from Canvas).
  useEffect(() => {
    if (!droppedFiles || droppedFiles.length === 0) return
    let cancelled = false
    ;(async () => {
      for (const f of droppedFiles) {
        if (cancelled) break
        await uploadFile(f)
      }
      onDroppedConsumed?.()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedFiles])

  // While media is still being optimized in the background, poll for the
  // finished version. Paused while the gallery is open so a swap never
  // interrupts playback — it applies once the gallery is closed.
  const hasProcessing = assets.some((a) => a.processing)
  useEffect(() => {
    if (!hasProcessing || galleryIndex !== null) return
    const id = window.setInterval(() => {
      listAssets(node.id).then(setAssets).catch(() => {})
    }, 3000)
    return () => window.clearInterval(id)
  }, [hasProcessing, galleryIndex, node.id])

  async function removeAsset(id: string) {
    await deleteAsset(node.id, id)
    setAssets((prev) => prev.filter((a) => a.id !== id))
  }

  async function removeNode() {
    await deleteNode(boardId, node.id)
    onDelete(node.id)
  }

  // Show an enlarged floating preview to the left of the panel on image hover.
  function showPreview(e: React.MouseEvent, url: string | null) {
    if (!url) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const top = Math.min(Math.max(8, r.top - 40), window.innerHeight - 372)
    setPreview({ url, top })
  }

  // Expand the gallery into a retractable drawer that overlays the canvas to the
  // left of the panel. Keep it mounted briefly while closing for the slide-out.
  function toggleMedia() {
    if (mediaTimer.current) {
      window.clearTimeout(mediaTimer.current)
      mediaTimer.current = null
    }
    if (mediaExpanded) {
      setMediaExpanded(false)
      setMediaClosing(true)
      setPreview(null)
      mediaTimer.current = window.setTimeout(() => setMediaClosing(false), 220)
    } else {
      setMediaClosing(false)
      setMediaExpanded(true)
    }
  }

  useEffect(
    () => () => {
      if (mediaTimer.current) window.clearTimeout(mediaTimer.current)
    },
    [],
  )

  // Esc cascade within the panel (capture phase + stopPropagation, so each press
  // handles one level): first close the hover preview, then retract the gallery
  // drawer — only then does the event reach the canvas (close panel / deselect).
  useEffect(() => {
    if (!preview && !mediaExpanded) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Let an open lightbox/dialog/dropdown consume Esc first.
      if (document.querySelector('.overlay, .ctx-menu, .gallery, [aria-expanded="true"]'))
        return
      if (preview) {
        e.preventDefault()
        e.stopPropagation()
        setPreview(null)
        return
      }
      e.preventDefault()
      e.stopPropagation()
      setMediaExpanded(false)
      setMediaClosing(true)
      if (mediaTimer.current) window.clearTimeout(mediaTimer.current)
      mediaTimer.current = window.setTimeout(() => setMediaClosing(false), 220)
    }
    window.addEventListener('keydown', onEsc, true)
    return () => window.removeEventListener('keydown', onEsc, true)
  }, [preview, mediaExpanded])

  const drawerMounted = mediaExpanded || mediaClosing

  // The media list (uploads + grid). Rendered either inside the panel (compact)
  // or inside the expanded drawer — never both, so it stays a single instance.
  const mediaBody = (
    <>
      {uploads.length > 0 && (
        <div className="media-uploads">
          {uploads.map((u) => (
            <div key={u.id} className="media-upload">
              <div className="media-upload__row">
                <span className="media-upload__name" title={u.name}>{u.name}</span>
                <span className="media-upload__pct">
                  {u.progress < 100 ? `${u.progress}%` : 'processing…'}
                </span>
              </div>
              <div className="media-upload__bar">
                <div
                  className={
                    'media-upload__fill' +
                    (u.progress >= 100 ? ' media-upload__fill--processing' : '')
                  }
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {assets.length === 0 && uploads.length === 0 && (
        <p className="media-empty">No media yet</p>
      )}

      {assets.length > 0 && (
        <div className="media-grid">
          {assets.map((a, i) => {
            const k = mediaKind(a)
            return (
              <div key={a.id} className="media-cell">
                <button
                  type="button"
                  className={`media-tile media-tile--${k}`}
                  onClick={() => setGalleryIndex(i)}
                  title={a.filename}
                >
                  {k === 'image' && (
                    <img
                      src={a.url ?? ''}
                      alt={a.filename}
                      className="media-tile__img"
                      onMouseEnter={(e) => showPreview(e, a.url)}
                      onMouseLeave={() => setPreview(null)}
                    />
                  )}

                  {k === 'video' &&
                    (a.thumbnail_url ? (
                      <img src={a.thumbnail_url} alt={a.filename} className="media-tile__img" />
                    ) : (
                      <span className="media-tile__placeholder">🎬</span>
                    ))}
                  {k === 'video' && <span className="media-tile__badge">▶</span>}

                  {k === 'audio' &&
                    (a.thumbnail_url ? (
                      <img src={a.thumbnail_url} alt={a.filename} className="media-tile__img" />
                    ) : (
                      <span className="media-tile__placeholder">♪</span>
                    ))}

                  {k === 'file' && (
                    <span className="media-tile__file">
                      <span className="media-tile__ext">{fileExt(a.filename) || 'FILE'}</span>
                    </span>
                  )}

                  {a.processing && (
                    <span className="media-tile__processing">optimizing…</span>
                  )}

                  <span
                    className="media-tile__remove"
                    role="button"
                    aria-label="Remove"
                    title="Remove"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAsset(a.id)
                    }}
                  >
                    ✕
                  </span>
                </button>
                <span className="media-name" title={a.filename}>
                  {a.filename}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  return (
    <>
    {drawerMounted && (
      <div
        className={
          'media-drawer' +
          (closing ? ' media-drawer--dismiss' : mediaClosing ? ' media-drawer--closing' : '')
        }
      >
        <div className="media-drawer__head">
          <h3 title={title || 'Media'}>{title || 'Media'}</h3>
          <button
            className="icon-btn"
            title="Collapse gallery"
            aria-label="Collapse gallery"
            onClick={toggleMedia}
          >
            <span className="media-expand media-expand--open">◀</span>
          </button>
        </div>
        <div className="media-drawer__body">{mediaBody}</div>
        {nearby.length > 0 && (
          <div className={'nearby-sheet' + (showNearby ? ' nearby-sheet--open' : '')}>
            <button
              type="button"
              className={'nearby-sheet__toggle' + (showNearby ? ' nearby-sheet__toggle--open' : '')}
              onClick={() => setShowNearby((v) => !v)}
            >
              <span className="nearby-sheet__title">Nearby Nodes</span>
              <span className="nearby-section__count">{nearby.length}</span>
              <span className="nearby-section__caret">▾</span>
            </button>
            <div className="nearby-sheet__body">
              <NearbyNodes
                key={node.id}
                nodes={nearby}
                onAddMedia={addReferencedMedia}
                onAddLinks={addReferencedLinks}
              />
            </div>
          </div>
        )}
      </div>
    )}
    <aside className={'panel' + (closing ? ' panel--closing' : '')}>
      <div className="panel__head">
        {isExisting ? (
          <div className="panel__heading">
            <span className="panel__kind" style={{ background: accent }}>{typeLabel(type)}</span>
            <h2 className="panel__title" title={title || 'Untitled'}>{title || 'Untitled'}</h2>
          </div>
        ) : (
          <h2>Edit Object</h2>
        )}
        <button className="icon-btn" onClick={onClose} title="Close">✕</button>
      </div>

      <div className="field">
        <span>Type</span>
        <Select
          value={type}
          ariaLabel="Type"
          onChange={setType}
          options={NODE_TYPES.map((t) => ({
            value: t,
            label: typeLabel(t),
            color: KIND_COLORS[t],
          }))}
        />
      </div>

      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      {/* Dynamic, type-specific fields (stored in node.content). */}
      {fields.map((f) =>
        f.widget === 'animations' ? (
          <div className="field" key={f.key}>
            <span>{f.label}</span>
            <AnimationsField
              value={content[f.key]}
              onChange={(rows) => setField(f.key, rows)}
            />
          </div>
        ) : (
          <label className="field" key={f.key}>
            <span>{f.label}</span>
            {f.multiline ? (
              <textarea
                rows={5}
                placeholder={f.placeholder}
                value={String(content[f.key] ?? '')}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            ) : (
              <input
                placeholder={f.placeholder}
                value={String(content[f.key] ?? '')}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            )}
          </label>
        ),
      )}

      {/* References: link previews — its own section (like Media), on every kind. */}
      <div className="panel__refs">
        <h3 className="panel__refs-head">References</h3>
        <ReferencesField
          value={content.references}
          onChange={(refs) => setField('references', refs)}
        />
      </div>

      <div className="panel__actions">
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          Save
        </button>
        <button
          className="btn btn--danger"
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
        >
          Delete
        </button>
      </div>

      <div className="panel__media">
        <div className="panel__media-head">
          <h3>Media</h3>
          {assets.length > 0 && (
            <button
              className="icon-btn"
              title={mediaExpanded ? 'Collapse gallery' : 'Expand gallery'}
              aria-label={mediaExpanded ? 'Collapse gallery' : 'Expand gallery'}
              onClick={toggleMedia}
            >
              <span className={'media-expand' + (mediaExpanded ? ' media-expand--open' : '')}>◀</span>
            </button>
          )}
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            + Add
          </button>
          <input ref={fileRef} type="file" hidden onChange={onUpload} />
        </div>

        {!drawerMounted && <div className="panel__media-body">{mediaBody}</div>}
        {drawerMounted && (
          <p className="media-collapsed-note">Gallery expanded in the drawer ◀</p>
        )}
      </div>

      {preview && (
        <div
          className={'media-preview' + (drawerMounted ? ' media-preview--drawer' : '')}
          style={{ top: preview.top }}
        >
          <img src={preview.url} alt="" />
        </div>
      )}

      {galleryIndex !== null && assets[galleryIndex] && (
        <Gallery
          assets={assets}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete object?"
          message={`"${title || 'Untitled'}" and its media will be permanently deleted.`}
          confirmLabel="Delete"
          danger
          onConfirm={removeNode}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {justSaved && (
        <div className="panel__saved" role="status">Saved ✓</div>
      )}
    </aside>
    </>
  )
}
