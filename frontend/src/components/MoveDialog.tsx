// Choose where to move the selected objects: into a new board, or into an
// existing one found by navigating the same folders/categories as the explorer.
import { useState } from 'react'
import type { Board, Category, Folder } from '../types'
import { BoardIcon, ChevronIcon, FolderIcon } from './icons'

export type MoveTarget = { boardId: string } | { newName: string }

interface Props {
  boards: Board[] // candidates (the current board is excluded by the caller)
  folders: Folder[]
  categories: Category[]
  orderedTop: string[]
  count: number // how many objects are being moved
  onConfirm: (target: MoveTarget) => void
  onCancel: () => void
}

const NEW = '__new__'

export default function MoveDialog({
  boards,
  folders,
  categories,
  orderedTop,
  count,
  onConfirm,
  onCancel,
}: Props) {
  const [choice, setChoice] = useState(NEW)
  const [newName, setNewName] = useState('New Board')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const boardById = new Map(boards.map((b) => [b.id, b]))
  const folderById = new Map(folders.map((f) => [f.id, f]))
  const boardsIn = (fid: string) => boards.filter((b) => b.folder_id === fid)
  const canMove = choice !== NEW || newName.trim().length > 0

  const toggleOpen = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  function confirm() {
    if (!canMove) return
    if (choice === NEW) onConfirm({ newName: newName.trim() || 'New Board' })
    else onConfirm({ boardId: choice })
  }

  function boardRow(b: Board, depth: number) {
    return (
      <label
        key={b.id}
        className="merge-tree__board"
        style={{ paddingLeft: depth * 16 + 6 }}
        title={b.name}
      >
        <input
          type="radio"
          name="move-dest"
          checked={choice === b.id}
          onChange={() => setChoice(b.id)}
        />
        <span className="merge-tree__icon">
          <BoardIcon />
        </span>
        <span className="merge-tree__name">{b.name}</span>
      </label>
    )
  }

  function folderNode(f: Folder, depth: number) {
    const open = !collapsed.has(f.id)
    const inside = boardsIn(f.id)
    return (
      <div key={f.id}>
        <button className="merge-tree__row" style={{ paddingLeft: depth * 16 }} onClick={() => toggleOpen(f.id)}>
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
        <h2 className="dialog__title">Move Objects</h2>
        <p className="dialog__message">
          Move the {count} selected object{count === 1 ? '' : 's'} to a new board, or navigate to
          an existing one:
        </p>

        <label className="merge-tree__board move-new">
          <input type="radio" name="move-dest" checked={choice === NEW} onChange={() => setChoice(NEW)} />
          <span className="merge-tree__icon">＋</span>
          <span className="merge-tree__name">New Board</span>
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
                  <span className="merge-tree__name">{c.name}</span>
                </button>
                {open && c.items.map((id) => renderItem(id, 1))}
              </div>
            )
          })}
        </div>

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
