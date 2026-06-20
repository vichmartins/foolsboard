// Choose where to move the selected objects: into an existing board, or into a
// new board created on the spot.
import { useState } from 'react'
import type { Board } from '../types'

export type MoveTarget = { boardId: string } | { newName: string }

interface Props {
  boards: Board[] // candidates (the current board is excluded by the caller)
  count: number // how many objects are being moved
  onConfirm: (target: MoveTarget) => void
  onCancel: () => void
}

const NEW = '__new__'

export default function MoveDialog({ boards, count, onConfirm, onCancel }: Props) {
  const [choice, setChoice] = useState(NEW)
  const [newName, setNewName] = useState('New Board')

  const canMove = choice !== NEW || newName.trim().length > 0

  function confirm() {
    if (!canMove) return
    if (choice === NEW) onConfirm({ newName: newName.trim() || 'New Board' })
    else onConfirm({ boardId: choice })
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Move Objects</h2>
        <p className="dialog__message">
          Move the {count} selected object{count === 1 ? '' : 's'} to:
        </p>

        <ul className="merge-list move-list">
          <li>
            <label className="merge-item">
              <input
                type="radio"
                name="move-dest"
                checked={choice === NEW}
                onChange={() => setChoice(NEW)}
              />
              <span>＋ New Board</span>
            </label>
            {choice === NEW && (
              <input
                className="move-name"
                value={newName}
                autoFocus
                placeholder="Board name"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirm()
                }}
              />
            )}
          </li>
          {boards.map((b) => (
            <li key={b.id}>
              <label className="merge-item">
                <input
                  type="radio"
                  name="move-dest"
                  checked={choice === b.id}
                  onChange={() => setChoice(b.id)}
                />
                <span>{b.name}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="dialog__actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={!canMove} onClick={confirm}>
            Move
          </button>
        </div>
      </div>
    </div>
  )
}
