// Side panel: view/edit the selected object and manage its media.
import { useEffect, useRef, useState } from 'react'
import {
  apiError,
  deleteAsset,
  deleteNode,
  listAssets,
  referenceAssets,
  renameAsset,
  updateNode,
  uploadAsset,
} from '../api'
import {
  downloadAsset,
  fileExt,
  genId,
  KIND_COLORS,
  mediaKind,
  NODE_TYPES,
  OBJECT_COLOR,
  setAssetDragData,
  TYPE_FIELDS,
  typeLabel,
  uploadSizeError,
  type Asset,
  type LinkRef,
  type NearbyNode,
  type StoryNode,
} from '../types'
import { realtime } from '../realtime'
import AnimationsField from './AnimationsField'
import ConfirmDialog from './ConfirmDialog'
import Gallery from './Gallery'
import NearbyNodes from './NearbyNodes'
import ReferencesField from './ReferencesField'
import TimestampsField from './TimestampsField'
import { DownloadIcon } from './icons'
import Select from './Select'

interface Props {
  boardId: string
  node: StoryNode
  nearby: NearbyNode[]
  onChange: (node: StoryNode) => void
  // Report a committed edit (before/after title/type/content) so the canvas can
  // make it undoable. Only fired when something actually changed.
  onEdited?: (
    nodeId: string,
    before: { title: string; type: string; content: Record<string, unknown> },
    after: { title: string; type: string; content: Record<string, unknown> },
  ) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
  // True while the panel is sliding out (before it unmounts).
  closing?: boolean
  // Files dropped onto the app while this panel was open (uploaded here).
  droppedFiles?: File[] | null
  onDroppedConsumed?: () => void
}

// Run an async task over items with at most `limit` running concurrently.
async function runPooled<T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>,
  stop: () => boolean,
): Promise<void> {
  let i = 0
  const worker = async () => {
    while (i < items.length && !stop()) await run(items[i++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

export default function ContextPanel({
  boardId,
  node,
  nearby,
  onChange,
  onEdited,
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
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [justSaved, setJustSaved] = useState(false)
  const savingRef = useRef(false)
  const savedTimer = useRef<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ url: string; top: number } | null>(null)
  // In-flight uploads: progress 0-100 (100 = bytes sent, server still processing).
  const [uploads, setUploads] = useState<{ id: string; name: string; progress: number }[]>([])
  // Last upload rejection (too large / failed); auto-dismisses with an animation.
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [errorLeaving, setErrorLeaving] = useState(false)
  // Busy while any upload is in flight (derived, so parallel uploads stay correct).
  const busy = uploads.length > 0
  const [mediaExpanded, setMediaExpanded] = useState(false)
  const [mediaClosing, setMediaClosing] = useState(false)
  const [showNearby, setShowNearby] = useState(false)
  const mediaTimer = useRef<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // The node state we last loaded into the fields -- lets us tell an external
  // change (undo/redo, a collaborator) apart from the user's in-progress edits.
  const baseline = useRef({
    title: node.title,
    type: node.type,
    content: JSON.stringify(node.content ?? {}),
  })

  // Re-sync local state whenever a different node is selected.
  useEffect(() => {
    setTitle(node.title)
    setType(node.type)
    setContent(node.content ?? {})
    baseline.current = {
      title: node.title,
      type: node.type,
      content: JSON.stringify(node.content ?? {}),
    }
    setConfirmDelete(false)
    setShowNearby(false)
    listAssets(node.id).then(setAssets).catch(() => setAssets([]))
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // The SAME node changed underneath us (undo/redo, or a collaborator's save):
  // adopt it -- but only if the user has no unsaved edits, so we never clobber
  // in-progress typing.
  useEffect(() => {
    const incoming = JSON.stringify(node.content ?? {})
    const changed =
      node.title !== baseline.current.title ||
      node.type !== baseline.current.type ||
      incoming !== baseline.current.content
    const noLocalEdits =
      title === baseline.current.title &&
      type === baseline.current.type &&
      JSON.stringify(content) === baseline.current.content
    if (changed && noLocalEdits) {
      setTitle(node.title)
      setType(node.type)
      setContent(node.content ?? {})
      baseline.current = { title: node.title, type: node.type, content: incoming }
    }
  }, [node.title, node.type, node.content]) // eslint-disable-line react-hooks/exhaustive-deps

  // Untyped (blank) objects show no type-specific fields until a type is chosen.
  const fields = type ? TYPE_FIELDS[type] ?? TYPE_FIELDS.note : []

  // Once an object has real content (a title beyond the default, or any filled
  // field), show its title + colored type tag instead of a generic header.
  const accent = KIND_COLORS[type] ?? OBJECT_COLOR
  const hasContent = Object.values(content).some((v) => String(v ?? '').trim() !== '')
  const isExisting = (title.trim() !== '' && title.trim() !== 'New object') || hasContent

  function setField(key: string, value: unknown) {
    setContent((c) => ({ ...c, [key]: value }))
  }

  // Pull media from a nearby node into this node's Media (shares the stored file
  // via dedup -- instant, persisted immediately like an upload).
  async function addReferencedMedia(assetIds: string[]) {
    const added = await referenceAssets(node.id, assetIds)
    setAssets((prev) => {
      const have = new Set(prev.map((a) => a.id))
      return [...prev, ...added.filter((a) => !have.has(a.id))]
    })
  }

  function startRename(a: Asset) {
    setRenamingId(a.id)
    // Edit only the base name -- the extension is fixed (it reflects the file
    // type), and the server re-appends it on save.
    const dot = a.filename.lastIndexOf('.')
    setRenameVal(dot > 0 ? a.filename.slice(0, dot) : a.filename)
  }
  function submitRename(id: string) {
    const v = renameVal.trim()
    setRenamingId(null)
    if (!v) return
    void renameAsset(node.id, id, v)
      .then((updated) => setAssets((prev) => prev.map((x) => (x.id === id ? updated : x))))
      .catch(() => {})
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
    // Snapshot the last-saved state (the node prop) so the edit can be undone.
    const before = { title: node.title, type: node.type, content: node.content ?? {} }
    try {
      const updated = await updateNode(boardId, node.id, { title, type, content })
      onChange(updated)
      const after = { title: updated.title, type: updated.type, content: updated.content ?? {} }
      // The fields now match the saved state, so move the baseline forward (lets
      // a later undo/redo be recognised as an external change and re-synced).
      baseline.current = { title: after.title, type: after.type, content: JSON.stringify(after.content) }
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        onEdited?.(node.id, before, after)
        // Tell collaborators something changed so they refetch — otherwise a
        // title/field edit only shows up after they refresh.
        realtime.sendDirty()
      }
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
    const tooBig = uploadSizeError(file) // instant client-side check
    if (tooBig) {
      setUploadError(`${file.name}: ${tooBig}`)
      return
    }
    const uploadId = genId()
    setUploads((u) => [...u, { id: uploadId, name: file.name, progress: 0 }])
    try {
      const asset = await uploadAsset(node.id, file, (pct) =>
        setUploads((u) => u.map((x) => (x.id === uploadId ? { ...x, progress: pct } : x))),
      )
      setAssets((prev) => (prev.some((a) => a.id === asset.id) ? prev : [...prev, asset]))
    } catch (e) {
      // Backstop: the server also enforces limits (e.g. when the browser didn't
      // report a type), so surface its message too.
      setUploadError(`${file.name}: ${apiError(e, 'Upload failed.')}`)
    } finally {
      setUploads((u) => u.filter((x) => x.id !== uploadId))
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    await uploadFile(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Upload files dropped onto the app (handed down from Canvas).
  useEffect(() => {
    if (!droppedFiles || droppedFiles.length === 0) return
    let cancelled = false
    setUploadError(null)
    ;(async () => {
      // Upload several at once for faster batches; the server handles concurrency.
      await runPooled(droppedFiles, 3, uploadFile, () => cancelled)
      onDroppedConsumed?.()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedFiles])

  // Broadcast my upload activity so collaborators get a top-bar indicator; when a
  // batch finishes, nudge them to refresh so the new media shows up.
  const uploadCount = uploads.length
  const prevUploadCount = useRef(0)
  useEffect(() => {
    realtime.sendUpload(uploadCount > 0, uploadCount, node.title)
    if (prevUploadCount.current > 0 && uploadCount === 0) realtime.sendDirty()
    prevUploadCount.current = uploadCount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadCount])
  // Clear my indicator if the panel closes mid-upload.
  useEffect(() => () => realtime.sendUpload(false, 0), [])

  // Auto-dismiss an upload error: hold a few seconds, play the exit animation,
  // then remove it.
  useEffect(() => {
    if (!uploadError) return
    setErrorLeaving(false)
    const hide = window.setTimeout(() => setErrorLeaving(true), 5500)
    const remove = window.setTimeout(() => setUploadError(null), 5500 + 320)
    return () => {
      window.clearTimeout(hide)
      window.clearTimeout(remove)
    }
  }, [uploadError])

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
                  draggable
                  onDragStart={(e) => setAssetDragData(e.dataTransfer, a)}
                  title={a.filename}
                >
                  {k === 'image' && (
                    <img
                      src={a.url ?? ''}
                      alt={a.filename}
                      className="media-tile__img"
                      draggable={false}
                      onMouseEnter={(e) => showPreview(e, a.url)}
                      onMouseLeave={() => setPreview(null)}
                    />
                  )}

                  {k === 'video' &&
                    (a.thumbnail_url ? (
                      <img
                        src={a.thumbnail_url}
                        alt={a.filename}
                        className="media-tile__img"
                        draggable={false}
                      />
                    ) : (
                      <span className="media-tile__placeholder">🎬</span>
                    ))}
                  {k === 'video' && <span className="media-tile__badge">▶</span>}

                  {k === 'audio' &&
                    (a.thumbnail_url ? (
                      <img
                        src={a.thumbnail_url}
                        alt={a.filename}
                        className="media-tile__img"
                        draggable={false}
                      />
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

                  {a.url && (
                    <span
                      className="media-tile__download"
                      role="button"
                      aria-label="Download"
                      title="Download"
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadAsset(a)
                      }}
                    >
                      <DownloadIcon />
                    </span>
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
                {renamingId === a.id ? (
                  <input
                    className="media-name media-name--edit"
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename(a.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onBlur={() => submitRename(a.id)}
                  />
                ) : (
                  <button
                    type="button"
                    className="media-name"
                    title={`${a.filename} — click to rename`}
                    onClick={() => startRename(a)}
                  >
                    {a.filename}
                  </button>
                )}
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
        <div className="panel__heading">
          <span className="panel__kind" style={{ background: accent }}>{typeLabel(type)}</span>
          <h2
            className="panel__title"
            title={isExisting ? title || 'Untitled' : 'Edit Object'}
          >
            {isExisting ? title || 'Untitled' : 'Edit Object'}
          </h2>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close">✕</button>
      </div>

      <div className="field">
        <span>Type</span>
        <Select
          value={type}
          ariaLabel="Type"
          placeholder="Choose a type…"
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

      {/* Timestamps: time markers, on every kind (like References). */}
      <div className="panel__refs">
        <h3 className="panel__refs-head">Timestamps</h3>
        <TimestampsField
          value={content.timestamps}
          onChange={(stamps) => setField('timestamps', stamps)}
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

        {uploadError && (
          <p
            className={'panel__upload-error' + (errorLeaving ? ' panel__upload-error--leaving' : '')}
            role="alert"
          >
            {uploadError}
          </p>
        )}

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
