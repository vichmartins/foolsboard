// Category picker for the top bar, sitting left of the folder picker. Selecting
// a category scopes the folder + board pickers to what's filed in it. Categories
// can be created, renamed, and deleted here too (parity with the folder picker).
import { useEffect, useRef, useState } from 'react'
import type { Category } from '../types'

interface Props {
  categories: Category[]
  activeCategoryId: string | null
  onSelect: (categoryId: string | null) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export default function CategorySelect({
  categories,
  activeCategoryId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const active = categories.find((c) => c.id === activeCategoryId)

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
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Categories"
      >
        <span className="folder-select__icon">▤</span>
        <span className="board-select__current">{active?.name ?? 'All Categories'}</span>
        <span className={'board-select__chevron' + (open ? ' board-select__chevron--open' : '')}>
          ▾
        </span>
      </button>

      <div className={'board-select__menu folder-menu' + (open ? ' board-select__menu--open' : '')}>
        <div className="folder-menu__head">
          <span className="folder-menu__title">Categories</span>
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

          {categories.map((c) => (
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
                <div className={'folder-row' + (c.id === activeCategoryId ? ' folder-row--active' : '')}>
                  <button
                    className="folder-row__name folder-row__select"
                    onClick={() => {
                      onSelect(c.id)
                      setOpen(false)
                    }}
                  >
                    {c.name}
                  </button>
                  <span className="folder-row__count">{c.items.length}</span>
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
                    title="Delete category (items are kept)"
                    aria-label="Delete category"
                    onClick={() => onDelete(c.id)}
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
