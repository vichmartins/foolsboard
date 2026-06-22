// Pick one or more boards to merge into the current board, navigating the same
// folders/categories as the explorer. Their content is appended beside what's
// already there (handled in Canvas); the source boards are then deleted, so a
// confirmation step makes that explicit. Shared boards can't be sources (they'd
// be deleted), so they're shown faded and disabled.
import { useState } from 'react'
import type { Board, Category, Folder } from '../types'
import { BoardIcon, CategoryIcon, ChevronIcon, FolderIcon } from './icons'

interface Props {
  boards: Board[] // candidates (the current board is excluded by the caller)
  folders: Folder[]
  categories: Category[]
  orderedTop: string[] // ordered ids of uncategorized top-level items
  targetName: string // the board being merged into
  onConfirm: (ids: string[]) => void
  onCancel: () => void
}

export default function MergeDialog({
  boards,
  folders,
  categories,
  orderedTop,
  targetName,
  onConfirm,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const boardById = new Map(boards.map((b) => [b.id, b]))
  const folderById = new Map(folders.map((f) => [f.id, f]))
  const boardsIn = (fid: string) => boards.filter((b) => b.folder_id === fid)
  const count = selected.size

  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleOpen = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  function boardRow(b: Board, depth: number) {
    const disabled = b.shared
    return (
      <label
        key={b.id}
        className={'merge-tree__board' + (disabled ? ' merge-tree__board--disabled' : '')}
        style={{ paddingLeft: depth * 16 + 6 }}
        title={disabled ? `Shared by ${b.owner_name ?? 'someone'} — can't be merged` : b.name}
      >
        <input
          type="checkbox"
          disabled={disabled}
          checked={selected.has(b.id)}
          onChange={() => toggleSel(b.id)}
        />
        <span className="merge-tree__icon">
          <BoardIcon />
        </span>
        <span className="merge-tree__name">{b.name}</span>
        {disabled && <span className="merge-tree__tag">shared</span>}
      </label>
    )
  }

  function folderNode(f: Folder, depth: number) {
    const open = !collapsed.has(f.id)
    const inside = boardsIn(f.id)
    return (
      <div key={f.id}>
        <button
          className="merge-tree__row"
          style={{ paddingLeft: depth * 16 }}
          onClick={() => toggleOpen(f.id)}
        >
          <span className={'merge-tree__chev' + (open ? ' merge-tree__chev--open' : '')}>
            <ChevronIcon />
          </span>
          <FolderIcon />
          <span className="merge-tree__name">{f.name}</span>
          <span className="merge-tree__count">{inside.length}</span>
        </button>
        {open && inside.map((b) => boardRow(b, depth + 1))}
      </div>
    )
  }

  const renderItem = (id: string, depth: number) => {
    const f = folderById.get(id)
    if (f) return folderNode(f, depth)
    const b = boardById.get(id)
    if (b) return boardRow(b, depth)
    return null
  }

  const topItems = orderedTop.filter((id) => boardById.has(id) || folderById.has(id))

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Merge Boards</h2>

        {confirming ? (
          <>
            <p className="dialog__message">
              {count === 1 ? 'The selected board' : `These ${count} boards`} will be copied into{' '}
              <strong>“{targetName}”</strong> and then <strong>permanently deleted</strong>. This
              can’t be undone.
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
              Choose boards to merge into the current one — navigate your folders and categories
              below. Their content is placed beside what’s already here; the merged boards are
              deleted afterward.
            </p>

            {boards.length === 0 ? (
              <p className="dialog__message">There are no other boards to merge.</p>
            ) : (
              <div className="merge-tree">
                {topItems.map((id) => renderItem(id, 0))}
                {categories.map((c) => {
                  const open = !collapsed.has(c.id)
                  return (
                    <div key={c.id}>
                      <button className="merge-tree__row merge-tree__cat" onClick={() => toggleOpen(c.id)}>
                        <span className={'merge-tree__chev' + (open ? ' merge-tree__chev--open' : '')}>
                          <ChevronIcon />
                        </span>
                        <span className="merge-tree__icon">
                          <CategoryIcon />
                        </span>
                        <span className="merge-tree__name">{c.name}</span>
                      </button>
                      {open && c.items.map((id) => renderItem(id, 1))}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="dialog__actions">
              <button className="btn" onClick={onCancel}>
                Cancel
              </button>
              <button className="btn btn--primary" disabled={count === 0} onClick={() => setConfirming(true)}>
                Merge{count > 0 ? ` (${count})` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
