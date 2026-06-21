// Themed, animated board picker — a custom dropdown replacing the native
// <select> (which can't be styled or animated to match the app). Rows can be
// dragged to reorder the board list, which is persisted per user.
import { useEffect, useRef, useState } from 'react'
import type { Board } from '../types'
import { realtime, useGlobalPresence } from '../realtime'
import OwnerIcon from './OwnerIcon'

interface Props {
  boards: Board[]
  activeId: string | null
  activeName?: string // active board's name (it may be filtered out of `boards`)
  activeShared?: boolean // active board is shared with me
  activeSharedOut?: boolean // I own the active board and have shared it out
  activeOwnerName?: string | null // who owns the active board, when shared with me
  activeMemberIds?: string[] // collaborators on the active board, for the presence dot
  onSelect: (id: string) => void
  onReorder: (orderedIds: string[]) => void
}

const BOARD_DND = 'application/x-foolsboard-board'

export default function BoardSelect({
  boards,
  activeId,
  activeName,
  activeShared,
  activeSharedOut,
  activeOwnerName,
  activeMemberIds,
  onSelect,
  onReorder,
}: Props) {
  useGlobalPresence() // re-render presence dots on collaborator move/leave
  const [open, setOpen] = useState(false)
  // Local copy so rows can shuffle live during a drag; resynced from props when
  // not dragging.
  const [items, setItems] = useState<Board[]>(boards)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const active = boards.find((b) => b.id === activeId)

  useEffect(() => {
    if (dragIndex === null) setItems(boards)
  }, [boards, dragIndex])

  useEffect(() => {
    if (!open) return
    const onOutside = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Defer a frame so the opening click doesn't immediately close it.
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

  function handleDragStart(e: React.DragEvent, i: number) {
    setDragIndex(i)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(i)) // required for Firefox to drag
    // Lets the folder picker accept this board as a drop (move into a folder).
    e.dataTransfer.setData(BOARD_DND, items[i].id)
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragIndex === null || dragIndex === i) return
    setItems((cur) => {
      const next = [...cur]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(i, 0, moved)
      return next
    })
    setDragIndex(i)
  }

  function handleDragEnd() {
    if (dragIndex === null) return
    setDragIndex(null)
    const newIds = items.map((b) => b.id)
    if (newIds.join() !== boards.map((b) => b.id).join()) onReorder(newIds)
  }

  return (
    <div className="board-select" ref={ref}>
      <button
        className="board-select__button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="board-select__current">
          {active?.name ?? activeName ?? 'Select board'}
        </span>
        {activeSharedOut ? (
          <span className="pick-owner">
            <OwnerIcon className="owner-crown" />
            {activeId && (
              <span
                className={'pick-dot pick-dot--' + realtime.boardStatus(activeId, activeMemberIds)}
              />
            )}
          </span>
        ) : activeShared ? (
          <span className="pick-owner" title={`Shared by ${activeOwnerName ?? 'someone'}`}>
            <span
              className={
                'pick-dot pick-dot--' +
                (activeId ? realtime.boardStatus(activeId, activeMemberIds) : 'offline')
              }
            />
            {activeOwnerName && <span className="pick-owner__name">{activeOwnerName}</span>}
          </span>
        ) : null}
        <span className={'board-select__chevron' + (open ? ' board-select__chevron--open' : '')}>
          ▾
        </span>
      </button>

      <ul className={'board-select__menu' + (open ? ' board-select__menu--open' : '')} role="listbox">
        {items.map((b, i) => (
          <li key={b.id}>
            <button
              className={
                'board-select__option' +
                (b.id === activeId ? ' board-select__option--active' : '') +
                (i === dragIndex ? ' board-select__option--dragging' : '')
              }
              role="option"
              aria-selected={b.id === activeId}
              tabIndex={open ? 0 : -1}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={handleDragEnd}
              onClick={() => {
                onSelect(b.id)
                setOpen(false)
              }}
            >
              {b.shared ? (
                <span
                  className={'board-select__dot board-select__dot--' + realtime.boardStatus(b.id, b.member_ids)}
                  title={`Shared by ${b.owner_name ?? 'someone'}`}
                  aria-hidden="true"
                />
              ) : b.shared_out ? (
                <span className="board-select__ownermark">
                  <OwnerIcon className="owner-crown" />
                  <span
                    className={'board-select__dot board-select__dot--' + realtime.boardStatus(b.id, b.member_ids)}
                  />
                </span>
              ) : (
                <span className="board-select__grip" aria-hidden="true">
                  ⠿
                </span>
              )}
              <span className="board-select__name">{b.name}</span>
              {b.shared && b.owner_name && (
                <span className="board-select__owner">{b.owner_name}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
