// Side panel: view/edit the selected object and manage its media.
import { useEffect, useRef, useState } from 'react'
import {
  deleteAsset,
  deleteNode,
  listAssets,
  updateNode,
  uploadAsset,
} from '../api'
import {
  fileExt,
  mediaKind,
  NODE_TYPES,
  TYPE_FIELDS,
  type Asset,
  type StoryNode,
} from '../types'
import ConfirmDialog from './ConfirmDialog'
import Gallery from './Gallery'

interface Props {
  boardId: string
  node: StoryNode
  onChange: (node: StoryNode) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
  // True while the panel is sliding out (before it unmounts).
  closing?: boolean
}

export default function ContextPanel({
  boardId,
  node,
  onChange,
  onDelete,
  onClose,
  closing,
}: Props) {
  const [title, setTitle] = useState(node.title)
  const [type, setType] = useState(node.type)
  // The whole content blob is held in state; per-type fields read/write keys in it
  // so switching type never loses data the other type captured.
  const [content, setContent] = useState<Record<string, unknown>>(node.content ?? {})
  const [assets, setAssets] = useState<Asset[]>([])
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ url: string; top: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Re-sync local state whenever a different node is selected.
  useEffect(() => {
    setTitle(node.title)
    setType(node.type)
    setContent(node.content ?? {})
    setConfirmDelete(false)
    listAssets(node.id).then(setAssets).catch(() => setAssets([]))
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fields = TYPE_FIELDS[type] ?? TYPE_FIELDS.note

  function setField(key: string, value: string) {
    setContent((c) => ({ ...c, [key]: value }))
  }

  async function save() {
    setBusy(true)
    try {
      const updated = await updateNode(boardId, node.id, { title, type, content })
      onChange(updated)
    } finally {
      setBusy(false)
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const asset = await uploadAsset(node.id, file)
      setAssets((prev) => [...prev, asset])
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

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
    const top = Math.min(Math.max(8, r.top - 40), window.innerHeight - 320)
    setPreview({ url, top })
  }

  return (
    <aside className={'panel' + (closing ? ' panel--closing' : '')}>
      <div className="panel__head">
        <h2>Edit object</h2>
        <button className="icon-btn" onClick={onClose} title="Close">✕</button>
      </div>

      <label className="field">
        <span>Type</span>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {NODE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      {/* Dynamic, type-specific fields (stored in node.content). */}
      {fields.map((f) => (
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
      ))}

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
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            + Add
          </button>
          <input ref={fileRef} type="file" hidden onChange={onUpload} />
        </div>

        {assets.length === 0 ? (
          <p className="media-empty">No media yet</p>
        ) : (
          <div className="media-grid">
            {assets.map((a, i) => {
              const k = mediaKind(a)
              return (
                <button
                  key={a.id}
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
              )
            })}
          </div>
        )}
      </div>

      {preview && (
        <div className="media-preview" style={{ top: preview.top }}>
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
    </aside>
  )
}
