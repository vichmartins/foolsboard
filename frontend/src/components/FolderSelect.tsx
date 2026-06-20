// Folder picker for the top bar. Selecting a folder filters the board list.
// Folders can be created, renamed, deleted, drag-reordered, and sorted A-Z/Z-A.
// Folder rows (and "All Boards") are drop targets for boards dragged from the
// board picker, moving the board into that folder (or unfiling it).
import { useEffect, useRef, useState } from 'react'
import type { Board, Folder } from '../types'

const BOARD_DND = 'application/x-foolsboard-board'
const FOLDER_DND = 'application/x-foolsboard-folder'

interface Props {
  folders: Folder[]
  boards: Board[]
  activeFolderId: string | null
  onSelect: (folderId: string | null) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onReorder: (orderedIds: string[]) => void
  onSort: (dir: 'asc' | 'desc') => void
  onDropBoard: (boardId: string, folderId: string | null) => void
}

export default function FolderSelect({
  folders,
  boards,
  activeFolderId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onReorder,
  onSort,
  onDropBoard,
}: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Folder[]>(folders)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overId, setOverId] = useState<string | 'all' | null>(null) // board-drag hover
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [sortAsc, setSortAsc] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  const active = folders.find((f) => f.id === activeFolderId)
  const count = (id: string | null) => boards.filter((b) => b.folder_id === id).length

  useEffect(() => {
    if (dragIndex === null) setItems(folders)
  }, [folders, dragIndex])

  useEffect(() => {
    if (!open) return
    const onOutside = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setEditingId(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const raf = requestAnimationFrame(() => {
      window.addEventListener('pointerdown', onOutside)
      window.addEventListener('keydown', onKey)
    })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onOutside)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // --- folder reorder (drag) ---
  function onFolderDragStart(e: React.DragEvent, i: number) {
    setDragIndex(i)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(FOLDER_DND, items[i].id)
  }
  function onFolderDragOver(e: React.DragEvent, i: number) {
    if (dragIndex === null) return
    e.preventDefault()
    if (dragIndex === i) return
    setItems((cur) => {
      const next = [...cur]
      const [m] = next.splice(dragIndex, 1)
      next.splice(i, 0, m)
      return next
    })
    setDragIndex(i)
  }
  function onFolderDragEnd() {
    if (dragIndex === null) return
    setDragIndex(null)
    const ids = items.map((f) => f.id)
    if (ids.join() !== folders.map((f) => f.id).join()) onReorder(ids)
  }

  // --- board drop (move board into folder / unfile) ---
  const isBoardDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(BOARD_DND)
  function onRowDragOver(e: React.DragEvent, target: string | 'all') {
    if (isBoardDrag(e)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setOverId(target)
    }
  }
  function onRowDrop(e: React.DragEvent, folderId: string | null) {
    const boardId = e.dataTransfer.getData(BOARD_DND)
    if (!boardId) return
    e.preventDefault()
    onDropBoard(boardId, folderId)
    setOverId(null)
  }

  // Auto-open the menu when a board is dragged over the trigger.
  function onTriggerDragOver(e: React.DragEvent) {
    if (isBoardDrag(e)) {
      e.preventDefault()
      if (!open) setOpen(true)
    }
  }

  function startSort() {
    onSort(sortAsc ? 'asc' : 'desc')
    setSortAsc((s) => !s)
  }

  function submitNew() {
    const n = newName.trim()
    if (n) onCreate(n)
    setNewName('')
    setCreating(false)
  }
  function submitRename(id: string) {
    const n = editName.trim()
    if (n) onRename(id, n)
    setEditingId(null)
  }

  return (
    <div className="folder-select" ref={ref}>
      <button
        className="board-select__button folder-select__button"
        onClick={() => setOpen((o) => !o)}
        onDragEnter={onTriggerDragOver}
        onDragOver={onTriggerDragOver}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Folders"
      >
        <span className="folder-select__icon">🗀</span>
        <span className="board-select__current">{active?.name ?? 'All Boards'}</span>
        <span className={'board-select__chevron' + (open ? ' board-select__chevron--open' : '')}>
          ▾
        </span>
      </button>

      <div className={'board-select__menu folder-menu' + (open ? ' board-select__menu--open' : '')}>
        <div className="folder-menu__head">
          <span className="folder-menu__title">Folders</span>
          <button className="folder-sort" onClick={startSort} title="Sort A–Z / Z–A">
            {sortAsc ? 'A→Z' : 'Z→A'}
          </button>
        </div>

        <ul className="folder-list">
          <li>
            <button
              className={
                'folder-row folder-row--all' +
                (activeFolderId === null ? ' folder-row--active' : '') +
                (overId === 'all' ? ' folder-row--drop' : '')
              }
              onClick={() => {
                onSelect(null)
                setOpen(false)
              }}
              onDragOver={(e) => onRowDragOver(e, 'all')}
              onDragLeave={() => setOverId((o) => (o === 'all' ? null : o))}
              onDrop={(e) => onRowDrop(e, null)}
            >
              <span className="folder-row__name">All Boards</span>
              <span className="folder-row__count">{boards.length}</span>
            </button>
          </li>

          {items.map((f, i) => (
            <li key={f.id}>
              {editingId === f.id ? (
                <input
                  className="folder-rename"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename(f.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onBlur={() => submitRename(f.id)}
                />
              ) : (
                <div
                  className={
                    'folder-row' +
                    (f.id === activeFolderId ? ' folder-row--active' : '') +
                    (i === dragIndex ? ' folder-row--dragging' : '') +
                    (overId === f.id ? ' folder-row--drop' : '')
                  }
                  onDragOver={(e) => {
                    onRowDragOver(e, f.id)
                    onFolderDragOver(e, i)
                  }}
                  onDragLeave={() => setOverId((o) => (o === f.id ? null : o))}
                  onDrop={(e) => onRowDrop(e, f.id)}
                >
                  <span
                    className="folder-row__grip"
                    draggable
                    onDragStart={(e) => onFolderDragStart(e, i)}
                    onDragEnd={onFolderDragEnd}
                    title="Drag to reorder"
                    aria-hidden="true"
                  >
                    ⠿
                  </span>
                  <button
                    className="folder-row__name folder-row__select"
                    onClick={() => {
                      onSelect(f.id)
                      setOpen(false)
                    }}
                  >
                    {f.name}
                  </button>
                  <span className="folder-row__count">{count(f.id)}</span>
                  <button
                    className="folder-row__act"
                    title="Rename"
                    aria-label="Rename folder"
                    onClick={() => {
                      setEditingId(f.id)
                      setEditName(f.name)
                    }}
                  >
                    ✎
                  </button>
                  <button
                    className="folder-row__act folder-row__act--danger"
                    title="Delete folder (boards are kept)"
                    aria-label="Delete folder"
                    onClick={() => onDelete(f.id)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {creating ? (
          <input
            className="folder-rename folder-new"
            value={newName}
            autoFocus
            placeholder="Folder name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew()
              if (e.key === 'Escape') setCreating(false)
            }}
            onBlur={submitNew}
          />
        ) : (
          <button className="folder-add" onClick={() => setCreating(true)}>
            ＋ New Folder
          </button>
        )}
      </div>
    </div>
  )
}
