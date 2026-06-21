// Collapsible left "Explorer": a tree of folders (each expandable to its boards)
// plus the ungrouped boards. Click a board to open it; drag a board onto a
// folder (or the Ungrouped header) to file/unfile it. Create/rename/delete
// folders inline. Reuses the workspace's existing folder/board handlers.
import { useState } from 'react'
import type { Board, Folder } from '../types'
import ContextMenu from './ContextMenu'
import {
  ChevronIcon,
  FolderIcon,
  FolderPlusIcon,
  MergeIcon,
  PencilIcon,
  PlusIcon,
  ShareIcon,
  TrashIcon,
} from './icons'

const BOARD_DND = 'application/x-foolsboard-board'
const EXPANDED_KEY = 'foolsboard:sidebar-expanded'

interface Props {
  open: boolean
  boards: Board[]
  folders: Folder[]
  activeId: string | null
  onSelectBoard: (id: string) => void
  onCreateFolder: (name: string) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  onMoveBoardToFolder: (boardId: string, folderId: string | null) => void
  onNewBoard: () => void
  onShareBoard: (board: Board) => void
  onRenameBoard: (id: string, name: string) => void
  onDeleteBoard: (board: Board) => void
  onMergeBoard: (board: Board) => void
}

export default function Sidebar({
  open,
  boards,
  folders,
  activeId,
  onSelectBoard,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveBoardToFolder,
  onNewBoard,
  onShareBoard,
  onRenameBoard,
  onDeleteBoard,
  onMergeBoard,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) || '[]'))
    } catch {
      return new Set()
    }
  })
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editBoardName, setEditBoardName] = useState('')
  const [dropTarget, setDropTarget] = useState<string | null>(null) // folder id or 'root'
  // Right-click menu for a board row.
  const [menu, setMenu] = useState<{ x: number; y: number; board: Board } | null>(null)

  function startRenameBoard(b: Board) {
    setEditingBoardId(b.id)
    setEditBoardName(b.name)
  }

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...n]))
      return n
    })

  // Owned content vs content shared with me. Shared boards get their own section
  // (like Ungrouped), and shared folders aren't shown as folders -- their boards
  // are flattened into "Shared with me".
  const ownedFolders = folders.filter((f) => !f.shared)
  const boardsIn = (fid: string) => boards.filter((b) => b.folder_id === fid && !b.shared)
  const ungrouped = boards.filter((b) => !b.folder_id && !b.shared)
  const sharedBoards = boards.filter((b) => b.shared)

  function submitCreate() {
    const name = newName.trim()
    if (name) onCreateFolder(name)
    setCreating(false)
    setNewName('')
  }
  function submitRename(id: string) {
    const name = editName.trim()
    if (name) onRenameFolder(id, name)
    setEditingId(null)
  }
  function submitRenameBoard(id: string) {
    const name = editBoardName.trim()
    if (name) onRenameBoard(id, name)
    setEditingBoardId(null)
  }

  // --- Drag-and-drop: a board chip can be dropped on a folder (or Ungrouped) --
  const onBoardDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(BOARD_DND, id)
    e.dataTransfer.setData('text/plain', id) // Firefox needs a payload to drag
  }
  const onZoneOver = (e: React.DragEvent, key: string) => {
    if (Array.from(e.dataTransfer.types).includes(BOARD_DND)) {
      e.preventDefault()
      setDropTarget(key)
    }
  }
  const onZoneDrop = (e: React.DragEvent, folderId: string | null) => {
    const id = e.dataTransfer.getData(BOARD_DND)
    setDropTarget(null)
    if (id) {
      e.preventDefault()
      onMoveBoardToFolder(id, folderId)
    }
  }

  const boardRow = (b: Board) => {
    if (editingBoardId === b.id) {
      return (
        <input
          key={b.id}
          className="tree-input"
          autoFocus
          value={editBoardName}
          onChange={(e) => setEditBoardName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitRenameBoard(b.id)
            if (e.key === 'Escape') setEditingBoardId(null)
          }}
          onBlur={() => submitRenameBoard(b.id)}
        />
      )
    }
    return (
      <div
        key={b.id}
        className={'tree-board-row' + (b.id === activeId ? ' tree-board-row--active' : '')}
        onContextMenu={
          b.shared
            ? undefined
            : (e) => {
                e.preventDefault()
                setMenu({ x: e.clientX, y: e.clientY, board: b })
              }
        }
      >
        <button
          className="tree-board"
          draggable
          onDragStart={(e) => onBoardDragStart(e, b.id)}
          onClick={() => onSelectBoard(b.id)}
          title={b.name}
        >
          <span
            className={'tree-board__dot' + (b.shared ? ' tree-board__dot--shared' : '')}
            aria-hidden="true"
          />
          <span className="tree-board__name">{b.name}</span>
          {b.shared && b.owner_name && (
            <span className="tree-board__owner">{b.owner_name}</span>
          )}
        </button>
        {!b.shared && (
          <span className="tree-board__tools">
            <button
              className="icon-btn"
              title="Rename"
              aria-label="Rename board"
              onClick={() => startRenameBoard(b)}
            >
              <PencilIcon />
            </button>
            <button
              className="icon-btn"
              title="Share"
              aria-label="Share board"
              onClick={() => onShareBoard(b)}
            >
              <ShareIcon />
            </button>
            <button
              className="icon-btn"
              title="Merge"
              aria-label="Merge into board"
              onClick={() => onMergeBoard(b)}
            >
              <MergeIcon />
            </button>
            <button
              className="icon-btn icon-btn--danger"
              title="Delete"
              aria-label="Delete board"
              onClick={() => onDeleteBoard(b)}
            >
              <TrashIcon />
            </button>
          </span>
        )}
      </div>
    )
  }

  return (
    <>
    <aside className={'sidebar' + (open ? '' : ' sidebar--collapsed')} aria-hidden={!open}>
      <div className="sidebar__inner">
        <div className="sidebar__head">
          <span className="sidebar__title">Explorer</span>
          <div className="sidebar__actions">
            <button
              className="icon-btn"
              title="New Folder"
              aria-label="New Folder"
              onClick={() => {
                setNewName('')
                setCreating(true)
              }}
            >
              <FolderPlusIcon />
            </button>
            <button className="icon-btn" title="New Board" aria-label="New Board" onClick={onNewBoard}>
              <PlusIcon />
            </button>
          </div>
        </div>

        <div className="sidebar__tree">
          {creating && (
            <input
              className="tree-input"
              autoFocus
              value={newName}
              placeholder="Folder name"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreate()
                if (e.key === 'Escape') setCreating(false)
              }}
              onBlur={submitCreate}
            />
          )}

          {ownedFolders.map((f) => {
            const isOpen = expanded.has(f.id)
            const inside = boardsIn(f.id)
            return (
              <div className="tree-folder" key={f.id}>
                {editingId === f.id ? (
                  <input
                    className="tree-input"
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename(f.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={() => submitRename(f.id)}
                  />
                ) : (
                  <div
                    className={'tree-folder__row' + (dropTarget === f.id ? ' tree-folder__row--drop' : '')}
                    onDragOver={(e) => onZoneOver(e, f.id)}
                    onDragLeave={() => setDropTarget((d) => (d === f.id ? null : d))}
                    onDrop={(e) => onZoneDrop(e, f.id)}
                  >
                    <button
                      className={'tree-chevron' + (isOpen ? ' tree-chevron--open' : '')}
                      onClick={() => toggleExpand(f.id)}
                      aria-label={isOpen ? 'Collapse' : 'Expand'}
                    >
                      <ChevronIcon />
                    </button>
                    <button className="tree-folder__main" onClick={() => toggleExpand(f.id)}>
                      <FolderIcon />
                      <span className="tree-folder__name">{f.name}</span>
                      <span className="tree-folder__count">{inside.length}</span>
                    </button>
                    {!f.shared && (
                      <span className="tree-folder__tools">
                        <button
                          className="icon-btn"
                          title="Rename"
                          aria-label="Rename folder"
                          onClick={() => {
                            setEditingId(f.id)
                            setEditName(f.name)
                          }}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          className="icon-btn icon-btn--danger"
                          title="Delete"
                          aria-label="Delete folder"
                          onClick={() => onDeleteFolder(f.id)}
                        >
                          <TrashIcon />
                        </button>
                      </span>
                    )}
                  </div>
                )}
                {isOpen && (
                  <div className="tree-children">
                    {inside.length === 0 ? (
                      <div className="tree-empty">Empty</div>
                    ) : (
                      inside.map(boardRow)
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <div
            className={'tree-section' + (dropTarget === 'root' ? ' tree-section--drop' : '')}
            onDragOver={(e) => onZoneOver(e, 'root')}
            onDragLeave={() => setDropTarget((d) => (d === 'root' ? null : d))}
            onDrop={(e) => onZoneDrop(e, null)}
          >
            Ungrouped
          </div>
          <div className="tree-children tree-children--root">
            {ungrouped.length === 0 ? (
              <div className="tree-empty">No ungrouped boards</div>
            ) : (
              ungrouped.map(boardRow)
            )}
          </div>

          {sharedBoards.length > 0 && (
            <>
              <div className="tree-section tree-section--shared">Shared with me</div>
              <div className="tree-children tree-children--root">
                {sharedBoards.map(boardRow)}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>

    {menu && (
      <ContextMenu
        x={menu.x}
        y={menu.y}
        items={[
          { label: 'Rename', mnemonic: 'r', onClick: () => startRenameBoard(menu.board) },
          { label: 'Share', mnemonic: 's', onClick: () => onShareBoard(menu.board) },
          { label: 'Merge', mnemonic: 'm', onClick: () => onMergeBoard(menu.board) },
          { label: 'Delete', mnemonic: 'd', danger: true, onClick: () => onDeleteBoard(menu.board) },
        ]}
        onClose={() => setMenu(null)}
      />
    )}
    </>
  )
}
