// Side panel: view/edit the selected object and manage its media.
import { useEffect, useRef, useState } from 'react'
import {
  deleteAsset,
  deleteNode,
  listAssets,
  updateNode,
  uploadAsset,
} from '../api'
import { NODE_TYPES, type Asset, type StoryNode } from '../types'

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
  const [text, setText] = useState(String(node.content?.text ?? ''))
  const [assets, setAssets] = useState<Asset[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Re-sync local fields whenever a different node is selected.
  useEffect(() => {
    setTitle(node.title)
    setType(node.type)
    setText(String(node.content?.text ?? ''))
    listAssets(node.id).then(setAssets).catch(() => setAssets([]))
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true)
    try {
      const updated = await updateNode(boardId, node.id, {
        title,
        type,
        content: { ...node.content, text },
      })
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

      <label className="field">
        <span>Notes</span>
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      </label>

      <div className="panel__actions">
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          Save
        </button>
        <button className="btn btn--danger" onClick={removeNode} disabled={busy}>
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
    </aside>
  )
}
