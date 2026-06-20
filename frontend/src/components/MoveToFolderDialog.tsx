// Move a board into a folder (or unfile it) via a picker dialog.
import { useState } from 'react'
import type { Folder } from '../types'

const NONE = '__none__'

interface Props {
  folders: Folder[]
  boardName: string
  currentFolderId: string | null
  onMove: (folderId: string | null) => void
  onCancel: () => void
}

export default function MoveToFolderDialog({
  folders,
  boardName,
  currentFolderId,
  onMove,
  onCancel,
}: Props) {
  const [choice, setChoice] = useState<string>(currentFolderId ?? NONE)

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Move to Folder</h2>
        <p className="dialog__message">
          Move “{boardName}” to:
        </p>

        <ul className="merge-list move-list">
          <li>
            <label className="merge-item">
              <input
                type="radio"
                name="move-folder"
                checked={choice === NONE}
                onChange={() => setChoice(NONE)}
              />
              <span>No folder (unfiled)</span>
            </label>
          </li>
          {folders.map((f) => (
            <li key={f.id}>
              <label className="merge-item">
                <input
                  type="radio"
                  name="move-folder"
                  checked={choice === f.id}
                  onChange={() => setChoice(f.id)}
                />
                <span>{f.name}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="dialog__actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={() => onMove(choice === NONE ? null : choice)}
          >
            Move
          </button>
        </div>
      </div>
    </div>
  )
}
