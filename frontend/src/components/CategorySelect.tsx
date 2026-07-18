// Category picker for the top bar, left of the folder picker. Selecting a
// category scopes the folder + board pickers to what's filed in it. Categories
// have folder parity: create, rename, delete, drag-reorder, sort A-Z/Z-A, and
// share. Rows are drop targets -- dragging a board or folder onto one files it
// into that category. Shared-with-me categories are shown read-through.
import { useEffect, useRef, useState } from 'react'
import type { Category } from '../types'
import { CategoryIcon } from './icons'
import OwnerIcon from './OwnerIcon'

const BOARD_DND = 'application/x-foolsboard-board'
const FOLDER_DND = 'application/x-foolsboard-folder'
const CATEGORY_DND = 'application/x-foolsboard-category'

interface Props {
  categories: Category[]
  activeCategoryId: string | null
  onSelect: (categoryId: string | null) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onSort: (dir: 'asc' | 'desc') => void
  onReorder: (orderedIds: string[]) => void
  onShare: (category: Category) => void
  onDropItem: (itemId: string, categoryId: string) => void
}

export default function CategorySelect({
  categories,
  activeCategoryId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onSort,
  onReorder,
  onShare,
  onDropItem,
}: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Category[]>(categories)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overId, setOverId] = useState<string | null>(null) // item-drag hover
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [sortAsc, setSortAsc] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  const active = categories.find((c) => c.id === activeCategoryId)

  useEffect(() => {
    if (dragIndex === null) setItems(categories)
  }, [categories, dragIndex])

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

  // --- category reorder (drag own rows) ---
  function onCatDragStart(e: React.DragEvent, i: number) {
    setDragIndex(i)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(CATEGORY_DND, items[i].id)
  }
  function onCatDragOver(e: React.DragEvent, i: number) {
    if (dragIndex === null) return
    e.preventDefault()
    if (dragIndex === i || items[i].shared) return
    setItems((cur) => {
      const next = [...cur]
      const [m] = next.splice(dragIndex, 1)
      next.splice(i, 0, m)
      return next
    })
    setDragIndex(i)
  }
  function onCatDragEnd() {
    if (dragIndex === null) return
    setDragIndex(null)
    const ids = items.map((c) => c.id)
    if (ids.join() !== categories.map((c) => c.id).join()) onReorder(ids)
  }

  // --- item drop (file a board/folder into a category) ---
  const isItemDrag = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(BOARD_DND) || e.dataTransfer.types.includes(FOLDER_DND)
  function onRowDragOver(e: React.DragEvent, cat: Category) {
    if (cat.shared) return
    if (isItemDrag(e)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setOverId(cat.id)
    }
  }
  function onRowDrop(e: React.DragEvent, cat: Category) {
    if (cat.shared) return
    const itemId = e.dataTransfer.getData(BOARD_DND) || e.dataTransfer.getData(FOLDER_DND)
    if (!itemId) return
    e.preventDefault()
    onDropItem(itemId, cat.id)
    setOverId(null)
  }
  // Auto-open the menu when an item is dragged over the trigger.
  function onTriggerDragOver(e: React.DragEvent) {
    if (isItemDrag(e)) {
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
        title="Categories"
      >
        <span className="folder-select__icon">
          <CategoryIcon />
        </span>
        <span className="board-select__current">{active?.name ?? 'All Categories'}</span>
        {active?.shared_out ? (
          <OwnerIcon solo className="owner-crown" />
        ) : active?.shared ? (
          <span className="pick-owner" title={`Shared by ${active.owner_name ?? 'someone'}`}>
            <span className="pick-dot" />
            {active.owner_name && <span className="pick-owner__name">{active.owner_name}</span>}
          </span>
        ) : null}
        <span className={'board-select__chevron' + (open ? ' board-select__chevron--open' : '')}>
          ▾
        </span>
      </button>

      <div className={'board-select__menu folder-menu' + (open ? ' board-select__menu--open' : '')}>
        <div className="folder-menu__head">
          <span className="folder-menu__title">Categories</span>
          {categories.length > 1 && (
            <button className="folder-sort" onClick={startSort} title="Sort A–Z / Z–A">
              {sortAsc ? 'A→Z' : 'Z→A'}
            </button>
          )}
        </div>

        <ul className="folder-list">
          <li>
            <button
              className={'folder-row folder-row--all' + (activeCategoryId === null ? ' folder-row--active' : '')}
              onClick={() => {
                onSelect(null)
                setOpen(false)
              }}
            >
              <span className="folder-row__name">All Categories</span>
            </button>
          </li>

          {items.map((c, i) => (
            <li key={c.id}>
              {editingId === c.id ? (
                <input
                  className="folder-rename"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename(c.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onBlur={() => submitRename(c.id)}
                />
              ) : (
                <div
                  className={
                    'folder-row' +
                    (c.id === activeCategoryId ? ' folder-row--active' : '') +
                    (i === dragIndex ? ' folder-row--dragging' : '') +
                    (overId === c.id ? ' folder-row--drop' : '') +
                    (c.shared ? ' folder-row--shared' : '')
                  }
                  onDragOver={(e) => {
                    onRowDragOver(e, c)
                    onCatDragOver(e, i)
                  }}
                  onDragLeave={() => setOverId((o) => (o === c.id ? null : o))}
                  onDrop={(e) => onRowDrop(e, c)}
                >
                  {c.shared ? (
                    <span
                      className="folder-row__dot"
                      title={`Shared by ${c.owner_name ?? 'someone'}`}
                      aria-hidden="true"
                    />
                  ) : c.shared_out ? (
                    <span
                      className="folder-row__crown"
                      draggable
                      onDragStart={(e) => onCatDragStart(e, i)}
                      onDragEnd={onCatDragEnd}
                      title="Shared with others — drag to reorder"
                    >
                      <OwnerIcon
                        solo
                        className={
                          c.id === activeCategoryId ? 'owner-crown' : 'owner-crown owner-crown--recipient'
                        }
                      />
                    </span>
                  ) : (
                    <span
                      className="folder-row__grip"
                      draggable
                      onDragStart={(e) => onCatDragStart(e, i)}
                      onDragEnd={onCatDragEnd}
                      title="Drag to reorder"
                      aria-hidden="true"
                    >
                      ⠿
                    </span>
                  )}
                  <button
                    className="folder-row__name folder-row__select"
                    title={c.shared ? `Shared by ${c.owner_name ?? 'someone'}` : undefined}
                    onClick={() => {
                      onSelect(c.id)
                      setOpen(false)
                    }}
                  >
                    {c.name}
                  </button>
                  <span className="folder-row__count">{c.items.length}</span>
                  {!c.shared && (
                    <>
                      <button
                        className="folder-row__act"
                        title="Share Category"
                        aria-label="Share category"
                        onClick={() => onShare(c)}
                      >
                        ⤴
                      </button>
                      <button
                        className="folder-row__act"
                        title="Rename"
                        aria-label="Rename category"
                        onClick={() => {
                          setEditingId(c.id)
                          setEditName(c.name)
                        }}
                      >
                        ✎
                      </button>
                      <button
                        className="folder-row__act folder-row__act--danger"
                        title="Delete Category (items are kept)"
                        aria-label="Delete category"
                        onClick={() => onDelete(c.id)}
                      >
                        ✕
                      </button>
                    </>
                  )}
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
            placeholder="Category name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew()
              if (e.key === 'Escape') setCreating(false)
            }}
            onBlur={submitNew}
          />
        ) : (
          <button className="folder-add" onClick={() => setCreating(true)}>
            ＋ New Category
          </button>
        )}
      </div>
    </div>
  )
}
