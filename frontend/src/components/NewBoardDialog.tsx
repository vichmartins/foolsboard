// Create a board, folder, or category. Boards/folders can optionally be placed
// in a folder (boards only) or a category.
import { useState } from 'react'
import Select from './Select'
import { CategoryIcon, FolderIcon } from './icons'
import type { Category, Folder } from '../types'

const NONE = '__none__'

export type CreateSpec =
  | { kind: 'board'; name: string; folderId: string | null; categoryId: string | null }
  | { kind: 'folder'; name: string; categoryId: string | null }
  | { kind: 'category'; name: string }

interface Props {
  folders: Folder[]
  categories: Category[]
  defaultFolderId: string | null
  defaultCategoryId: string | null
  onCreate: (spec: CreateSpec) => void
  onCancel: () => void
}

export default function NewBoardDialog({
  folders,
  categories,
  defaultFolderId,
  defaultCategoryId,
  onCreate,
  onCancel,
}: Props) {
  const [kind, setKind] = useState<'board' | 'folder' | 'category'>('board')
  const [name, setName] = useState('')
  // destination: NONE | 'f:<folderId>' | 'c:<categoryId>'
  const [dest, setDest] = useState(
    defaultCategoryId ? 'c:' + defaultCategoryId : defaultFolderId ? 'f:' + defaultFolderId : NONE,
  )

  const canCreate = name.trim().length > 0
  const ownFolders = folders.filter((f) => !f.shared)
  const destOptions = [
    { value: NONE, label: kind === 'board' ? 'No folder / category' : 'No category' },
    ...(kind === 'board'
      ? ownFolders.map((f) => ({ value: 'f:' + f.id, label: f.name, icon: <FolderIcon /> }))
      : []),
    ...categories.map((c) => ({ value: 'c:' + c.id, label: c.name, icon: <CategoryIcon /> })),
  ]

  function submit() {
    if (!canCreate) return
    const n = name.trim()
    if (kind === 'category') {
      onCreate({ kind: 'category', name: n })
      return
    }
    const folderId = dest.startsWith('f:') ? dest.slice(2) : null
    const categoryId = dest.startsWith('c:') ? dest.slice(2) : null
    if (kind === 'folder') onCreate({ kind: 'folder', name: n, categoryId })
    else onCreate({ kind: 'board', name: n, folderId, categoryId })
  }

  const kinds: Array<{ k: typeof kind; label: string }> = [
    { k: 'board', label: 'Board' },
    { k: 'folder', label: 'Folder' },
    { k: 'category', label: 'Category' },
  ]

  return (
    <div className="overlay" onMouseDown={onCancel}>
      <div className="dialog" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Create</h2>

        <div className="seg" role="tablist">
          {kinds.map(({ k, label }) => (
            <button
              key={k}
              className={'seg__btn' + (kind === k ? ' seg__btn--active' : '')}
              onClick={() => setKind(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="dialog__label" htmlFor="create-name">
          Name
        </label>
        <input
          id="create-name"
          className="dialog__input"
          value={name}
          autoFocus
          placeholder={
            kind === 'category'
              ? 'e.g. Season 1'
              : kind === 'folder'
                ? 'e.g. Drafts'
                : 'e.g. Episode 1: The Fork'
          }
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />

        {kind !== 'category' && (
          <>
            <label className="dialog__label new-board__folder-label">
              Place in <span className="dialog__hint">— optional</span>
            </label>
            <Select value={dest} options={destOptions} onChange={setDest} ariaLabel="Destination" />
          </>
        )}

        <div className="dialog__actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={!canCreate} onClick={submit}>
            {kind === 'category' ? 'Create Category' : kind === 'folder' ? 'Create Folder' : 'Create Board'}
          </button>
        </div>
      </div>
    </div>
  )
}
