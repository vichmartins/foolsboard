// Move a board into a folder or a category (or unfile it) via a picker dialog.
// onMove receives 'none' | a folder id | 'cat:<categoryId>'.
import { useState } from 'react'
import type { Category, Folder } from '../types'
import { CategoryIcon, FolderIcon } from './icons'

const NONE = '__none__'

interface Props {
  folders: Folder[]
  categories: Category[]
  boardName: string
  currentFolderId: string | null
  currentCategoryId: string | null
  onMove: (dest: string) => void
  onCancel: () => void
  title?: string
  confirmLabel?: string
}

export default function MoveToFolderDialog({
  folders,
  categories,
  boardName,
  currentFolderId,
  currentCategoryId,
  onMove,
  onCancel,
  title = 'Move',
  confirmLabel = 'Move',
}: Props) {
  const [choice, setChoice] = useState<string>(
    currentCategoryId ? 'cat:' + currentCategoryId : currentFolderId ?? NONE,
  )
  const ownFolders = folders.filter((f) => !f.shared)

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">{title}</h2>
        <p className="dialog__message">
          Destination for <strong>{boardName}</strong>:
        </p>

        <ul className="merge-list move-list">
          <li>
            <label className="merge-item">
              <input
                type="radio"
                name="move-dest"
                checked={choice === NONE}
                onChange={() => setChoice(NONE)}
              />
              <span className="merge-tree__icon merge-item__icon--empty" aria-hidden="true" />
              <span>No Folder / Category (Top Level)</span>
            </label>
          </li>

          {ownFolders.length > 0 && <li className="move-list__head">Folders</li>}
          {ownFolders.map((f) => (
            <li key={f.id}>
              <label className="merge-item">
                <input
                  type="radio"
                  name="move-dest"
                  checked={choice === f.id}
                  onChange={() => setChoice(f.id)}
                />
                <span className="merge-tree__icon">
                  <FolderIcon />
                </span>
                <span>{f.name}</span>
              </label>
            </li>
          ))}

          {categories.length > 0 && <li className="move-list__head">Categories</li>}
          {categories.map((c) => (
            <li key={c.id}>
              <label className="merge-item">
                <input
                  type="radio"
                  name="move-dest"
                  checked={choice === 'cat:' + c.id}
                  onChange={() => setChoice('cat:' + c.id)}
                />
                <span className="merge-tree__icon">
                  <CategoryIcon />
                </span>
                <span>{c.name}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="dialog__actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={() => onMove(choice === NONE ? 'none' : choice)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
