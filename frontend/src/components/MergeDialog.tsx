// Pick one or more boards to merge into the current board. Their content is
// appended beside what's already there (handled in Canvas); the source boards
// are then deleted. A confirmation step makes that deletion explicit.
import { useState } from 'react'
import type { Board } from '../types'

interface Props {
  boards: Board[] // candidates (the current board is excluded by the caller)
  targetName: string // the board being merged into
  onConfirm: (ids: string[]) => void
  onCancel: () => void
}

export default function MergeDialog({ boards, targetName, onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const count = selected.size

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Merge Boards</h2>

        {confirming ? (
          <>
            <p className="dialog__message">
              {count === 1 ? 'The selected board' : `These ${count} boards`} will be copied
              into <strong>“{targetName}”</strong> and then <strong>permanently deleted</strong>.
              This can’t be undone.
            </p>
            <div className="dialog__actions">
              <button className="btn" onClick={() => setConfirming(false)}>
                Back
              </button>
              <button className="btn btn--danger" onClick={() => onConfirm([...selected])}>
                Merge &amp; delete{count > 0 ? ` (${count})` : ''}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dialog__message">
              Choose boards to merge into the current one. Their content is placed beside
              what’s already here — nothing is overwritten — and the merged boards are deleted
              afterward.
            </p>

            {boards.length === 0 ? (
              <p className="dialog__message">There are no other boards to merge.</p>
            ) : (
              <ul className="merge-list">
                {boards.map((b) => (
                  <li key={b.id}>
                    <label className="merge-item">
                      <input
                        type="checkbox"
                        checked={selected.has(b.id)}
                        onChange={() => toggle(b.id)}
                      />
                      <span>{b.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <div className="dialog__actions">
              <button className="btn" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                disabled={count === 0}
                onClick={() => setConfirming(true)}
              >
                Merge{count > 0 ? ` (${count})` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
