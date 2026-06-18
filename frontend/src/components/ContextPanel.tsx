// Side panel: view/edit the selected object and manage its media.
import { useEffect, useRef, useState } from 'react'
import {
  deleteAsset,
  deleteNode,
  listAssets,
  updateNode,
  uploadAsset,
} from '../api'
import { NODE_TYPES, TYPE_FIELDS, type Asset, type StoryNode } from '../types'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  boardId: string
  node: StoryNode
  onChange: (node: StoryNode) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
}

export default function ContextPanel({ boardId, node, onChange, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(node.title)
  const [type, setType] = useState(node.type)
  // The whole content blob is held in state; per-type fields read/write keys in it
  // so switching type never loses data the other type captured.
  const [content, setContent] = useState<Record<string, unknown>>(node.content ?? {})
  const [assets, setAssets] = useState<Asset[]>([])
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
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

  return (
    <aside className="panel">
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

        <ul className="media-list">
          {assets.map((a) => (
            <li key={a.id} className="media-item">
              {a.kind === 'image' && a.url ? (
                <img src={a.url} alt={a.filename} />
              ) : a.kind === 'video' && a.url ? (
                <video src={a.url} controls />
              ) : (
                <a href={a.url ?? '#'} target="_blank" rel="noreferrer">
                  📎 {a.filename}
                </a>
              )}
              <button className="icon-btn" onClick={() => removeAsset(a.id)} title="Remove">
                ✕
              </button>
            </li>
          ))}
          {assets.length === 0 && <li className="media-empty">No media yet</li>}
        </ul>
      </div>

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
