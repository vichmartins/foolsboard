// Create a new storyboard. Optionally place it in a folder -- pick an existing
// one or create a new folder inline. The folder is optional (the labels say so).
import { useState } from 'react'
import Select from './Select'
import type { Folder } from '../types'

const NONE = '__none__'
const NEW = '__new__'

export type NewBoardTarget = { folderId: string | null } | { newFolder: string }

interface Props {
  folders: Folder[]
  defaultFolderId: string | null // pre-select the currently active folder
  onCreate: (name: string, target: NewBoardTarget) => void
  onCancel: () => void
}

export default function NewBoardDialog({ folders, defaultFolderId, onCreate, onCancel }: Props) {
  const [name, setName] = useState('')
  const [folder, setFolder] = useState(defaultFolderId ?? NONE)
  const [newFolder, setNewFolder] = useState('')

  const canCreate = name.trim().length > 0

  function submit() {
    if (!canCreate) return
    const n = name.trim()
    if (folder === NEW) {
      const fn = newFolder.trim()
      onCreate(n, fn ? { newFolder: fn } : { folderId: null })
    } else {
      onCreate(n, { folderId: folder === NONE ? null : folder })
    }
  }

  const options = [
    { value: NONE, label: 'No folder' },
    ...folders.map((f) => ({ value: f.id, label: f.name })),
    { value: NEW, label: '＋ Create New Folder…' },
  ]

  return (
    <div className="overlay" onMouseDown={onCancel}>
      <div className="dialog" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Create a New Storyboard</h2>

        <label className="dialog__label" htmlFor="new-board-name">
          Name
        </label>
        <input
          id="new-board-name"
          className="dialog__input"
          value={name}
          autoFocus
          placeholder="e.g. Episode 1: The Fork"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && folder !== NEW) submit()
          }}
        />

        <label className="dialog__label new-board__folder-label">
          Folder <span className="dialog__hint">— optional</span>
        </label>
        <Select value={folder} options={options} onChange={setFolder} ariaLabel="Folder" />

        {folder === NEW && (
          <input
            className="dialog__input new-board__newfolder"
            value={newFolder}
            placeholder="New folder name (optional)"
            onChange={(e) => setNewFolder(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
        )}

        <div className="dialog__actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={!canCreate} onClick={submit}>
            Create Board
          </button>
        </div>
      </div>
    </div>
  )
}
