// Pick one or more boards to merge into the current board. Their content is
// appended beside what's already there (handled in Canvas), nothing overwritten.
import { useState } from 'react'
import type { Board } from '../types'

interface Props {
  boards: Board[] // candidates (the current board is excluded by the caller)
  onConfirm: (ids: string[]) => void
  onCancel: () => void
}

export default function MergeDialog({ boards, onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Merge Boards</h2>
        <p className="dialog__message">
          Choose boards to copy into the current one. Their content is placed
          beside what's already here — nothing is overwritten.
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
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn--primary"
            disabled={selected.size === 0}
            onClick={() => onConfirm([...selected])}
          >
            Merge{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
