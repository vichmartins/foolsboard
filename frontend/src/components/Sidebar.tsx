// Collapsible left "Explorer": user-defined Categories (VSCode-style collapsible
// sections) each holding folders and/or boards, plus loose (uncategorized) items
// at the top. Drag a board/folder onto a category to file it; drag a board onto a
// folder to move it inside. The "+" on a category creates a folder or board in it.
import { useState } from 'react'
import type { Board, Category, Folder } from '../types'
import { useGlobalPresence } from '../realtime'
import ContextMenu from './ContextMenu'
import ShareMark from './ShareMark'
import {
  CategoryPlusIcon,
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
const FOLDER_DND = 'application/x-foolsboard-folder'
const EXPANDED_KEY = 'foolsboard:sidebar-expanded'
const COLLAPSED_CATS_KEY = 'foolsboard:sidebar-collapsed-cats'

interface Props {
  open: boolean
  boards: Board[]
  folders: Folder[]
  categories: Category[]
  activeId: string | null
  onSelectBoard: (id: string) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  onShareFolder: (folder: Folder) => void
  onCreateBoardInFolder: (folderId: string, name: string) => void
  onMoveBoardToFolder: (boardId: string, folderId: string | null) => void
  onShareBoard: (board: Board) => void
  onRenameBoard: (id: string, name: string) => void
  onDeleteBoard: (board: Board) => void
  onMergeBoard: (board: Board) => void
  onUnshareBoard: (board: Board) => void
  onCreatePrivateCopy: (board: Board) => void
  onCreateCategory: (name: string) => void
  onRenameCategory: (id: string, name: string) => void
  onDeleteCategory: (id: string) => void
  onReorderCategories: (ids: string[]) => void
  onFileItem: (itemId: string, categoryId: string | null) => void
  onCreateFolderIn: (categoryId: string | null, name: string) => void
  onCreateBoardIn: (categoryId: string | null, name: string) => void
}

// target: 'top' | 'cat:<id>' | 'folder:<id>' (folder target always creates a board)
type Creating = { target: string; kind: 'folder' | 'board' }

function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'))
  } catch {
    return new Set()
  }
}

export default function Sidebar(props: Props) {
  const {
    open,
    boards,
    folders,
    categories,
    activeId,
    onSelectBoard,
    onRenameFolder,
    onDeleteFolder,
    onShareFolder,
    onCreateBoardInFolder,
    onMoveBoardToFolder,
    onShareBoard,
    onRenameBoard,
    onDeleteBoard,
    onMergeBoard,
    onUnshareBoard,
    onCreatePrivateCopy,
    onCreateCategory,
    onRenameCategory,
    onDeleteCategory,
    onFileItem,
    onCreateFolderIn,
    onCreateBoardIn,
  } = props
  useGlobalPresence()

  const [expanded, setExpanded] = useState<Set<string>>(() => loadSet(EXPANDED_KEY))
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => loadSet(COLLAPSED_CATS_KEY))
  const [editingId, setEditingId] = useState<string | null>(null) // folder/category id
  const [editName, setEditName] = useState('')
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editBoardName, setEditBoardName] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)
  const [catName, setCatName] = useState('')
  const [creating, setCreating] = useState<Creating | null>(null)
  const [createName, setCreateName] = useState('')
  const [dropTarget, setDropTarget] = useState<string | null>(null) // folder id / 'cat:<id>' / 'top'
  const [menu, setMenu] = useState<{ x: number; y: number; board: Board } | null>(null)
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number; folder: Folder } | null>(null)
  const [addMenu, setAddMenu] = useState<{ x: number; y: number; catId: string } | null>(null)

  const toggle = (set: Set<string>, key: string, id: string, save: (s: Set<string>) => void) => {
    const n = new Set(set)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    localStorage.setItem(key, JSON.stringify([...n]))
    save(n)
  }
  const toggleFolder = (id: string) => toggle(expanded, EXPANDED_KEY, id, setExpanded)
  const toggleCat = (id: string) => toggle(collapsedCats, COLLAPSED_CATS_KEY, id, setCollapsedCats)

  // --- placement ------------------------------------------------------------
  const folderById = new Map(folders.map((f) => [f.id, f]))
  const boardById = new Map(boards.map((b) => [b.id, b]))
  const myFolderIds = new Set(folders.map((f) => f.id))
  const categorizedIds = new Set(categories.flatMap((c) => c.items))
  // A board grouped under a folder I can see (so it renders inside that folder).
  const isFiled = (b: Board) => !!b.folder_id && myFolderIds.has(b.folder_id)
  const boardsIn = (fid: string) => boards.filter((b) => b.folder_id === fid)
  const topFolders = folders.filter((f) => !categorizedIds.has(f.id))
  const topBoards = boards.filter((b) => !isFiled(b) && !categorizedIds.has(b.id))

  function startRenameBoard(b: Board) {
    setEditingBoardId(b.id)
    setEditBoardName(b.name)
  }
  function submitRenameBoard(id: string) {
    const name = editBoardName.trim()
    if (name) onRenameBoard(id, name)
    setEditingBoardId(null)
  }
  function submitEdit(isCat: boolean, id: string) {
    const name = editName.trim()
    if (name) (isCat ? onRenameCategory : onRenameFolder)(id, name)
    setEditingId(null)
  }
  function submitCreateCat() {
    const name = catName.trim()
    if (name) onCreateCategory(name)
    setCreatingCat(false)
    setCatName('')
  }
  function submitCreate() {
    const name = createName.trim()
    if (name && creating) {
      const { target, kind } = creating
      if (target.startsWith('folder:')) onCreateBoardInFolder(target.slice(7), name)
      else {
        const catId = target.startsWith('cat:') ? target.slice(4) : null
        ;(kind === 'folder' ? onCreateFolderIn : onCreateBoardIn)(catId, name)
      }
    }
    setCreating(null)
    setCreateName('')
  }
  function beginCreate(target: string, kind: 'folder' | 'board') {
    setCreateName('')
    setCreating({ target, kind })
    // Make sure the destination is open so the inline input is visible.
    if (target.startsWith('folder:')) {
      const fid = target.slice(7)
      setExpanded((s) => new Set(s).add(fid))
    } else if (target.startsWith('cat:')) {
      setCollapsedCats((s) => {
        const n = new Set(s)
        n.delete(target.slice(4))
        return n
      })
    }
  }

  // --- drag and drop --------------------------------------------------------
  const startDrag = (e: React.DragEvent, type: typeof BOARD_DND | typeof FOLDER_DND, id: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(type, id)
    e.dataTransfer.setData('text/plain', id)
  }
  const types = (e: React.DragEvent) => Array.from(e.dataTransfer.types)
  const overIf = (e: React.DragEvent, accept: string[], key: string) => {
    if (accept.some((t) => types(e).includes(t))) {
      e.preventDefault()
      setDropTarget(key)
    }
  }
  const getId = (e: React.DragEvent, type: string) => e.dataTransfer.getData(type)
  // Drop on a folder: move a board inside it (and out of any category).
  const dropOnFolder = (e: React.DragEvent, fid: string) => {
    setDropTarget(null)
    const bid = getId(e, BOARD_DND)
    if (bid) {
      e.preventDefault()
      onMoveBoardToFolder(bid, fid)
      onFileItem(bid, null)
    }
  }
  // Drop on a category: file a folder, or a board (pulled out of its folder).
  const dropOnCat = (e: React.DragEvent, catId: string | null) => {
    setDropTarget(null)
    const fid = getId(e, FOLDER_DND)
    const bid = getId(e, BOARD_DND)
    if (fid) {
      e.preventDefault()
      onFileItem(fid, catId)
    } else if (bid) {
      e.preventDefault()
      if (boardById.get(bid)?.folder_id) onMoveBoardToFolder(bid, null)
      onFileItem(bid, catId)
    }
  }

  // --- renderers ------------------------------------------------------------
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
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY, board: b })
        }}
      >
        <button
          className="tree-board"
          draggable
          onDragStart={(e) => startDrag(e, BOARD_DND, b.id)}
          onClick={() => onSelectBoard(b.id)}
          title={b.name}
        >
          <span className="tree-board__dot" aria-hidden="true" />
          <span className="tree-board__name">{b.name}</span>
          {(b.shared || b.shared_out) && (
            <ShareMark
              boardId={b.id}
              memberIds={b.member_ids}
              owner={!!b.shared_out}
              title={b.shared ? `Shared by ${b.owner_name ?? 'someone'}` : 'Shared with others'}
            />
          )}
        </button>
        {!b.shared && (
          <span className="tree-board__tools">
            <button className="icon-btn" title="Rename" aria-label="Rename board" onClick={() => startRenameBoard(b)}>
              <PencilIcon />
            </button>
            <button className="icon-btn" title="Share" aria-label="Share board" onClick={() => onShareBoard(b)}>
              <ShareIcon />
            </button>
            <button className="icon-btn" title="Merge" aria-label="Merge into board" onClick={() => onMergeBoard(b)}>
              <MergeIcon />
            </button>
            <button className="icon-btn icon-btn--danger" title="Delete" aria-label="Delete board" onClick={() => onDeleteBoard(b)}>
              <TrashIcon />
            </button>
          </span>
        )}
      </div>
    )
  }

  const folderNode = (f: Folder) => {
    const isOpen = expanded.has(f.id)
    const inside = boardsIn(f.id)
    if (editingId === f.id) {
      return (
        <input
          key={f.id}
          className="tree-input"
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitEdit(false, f.id)
            if (e.key === 'Escape') setEditingId(null)
          }}
          onBlur={() => submitEdit(false, f.id)}
        />
      )
    }
    return (
      <div className="tree-folder" key={f.id}>
        <div
          className={'tree-folder__row' + (dropTarget === f.id ? ' tree-folder__row--drop' : '')}
          draggable={!f.shared}
          onDragStart={(e) => startDrag(e, FOLDER_DND, f.id)}
          onDragOver={(e) => overIf(e, [BOARD_DND], f.id)}
          onDragLeave={() => setDropTarget((d) => (d === f.id ? null : d))}
          onDrop={(e) => dropOnFolder(e, f.id)}
          onContextMenu={
            f.shared
              ? undefined
              : (e) => {
                  e.preventDefault()
                  setFolderMenu({ x: e.clientX, y: e.clientY, folder: f })
                }
          }
        >
          <button
            className={'tree-chevron' + (isOpen ? ' tree-chevron--open' : '')}
            onClick={() => toggleFolder(f.id)}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            <ChevronIcon />
          </button>
          <button className="tree-folder__main" onClick={() => toggleFolder(f.id)}>
            <FolderIcon />
            <span className="tree-folder__name">{f.name}</span>
            <span className="tree-folder__count">{inside.length}</span>
          </button>
          {!f.shared && (
            <span className="tree-folder__tools">
              <button
                className="icon-btn"
                title="New board in folder"
                aria-label="New board in folder"
                onClick={() => beginCreate('folder:' + f.id, 'board')}
              >
                <PlusIcon />
              </button>
              <button className="icon-btn" title="Share" aria-label="Share folder" onClick={() => onShareFolder(f)}>
                <ShareIcon />
              </button>
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
              <button className="icon-btn icon-btn--danger" title="Delete" aria-label="Delete folder" onClick={() => onDeleteFolder(f.id)}>
                <TrashIcon />
              </button>
            </span>
          )}
        </div>
        {isOpen && (
          <div className="tree-children">
            {createInput('folder:' + f.id)}
            {inside.length === 0 && creating?.target !== 'folder:' + f.id ? (
              <div className="tree-empty">Empty</div>
            ) : (
              inside.map(boardRow)
            )}
          </div>
        )}
      </div>
    )
  }

  const renderItem = (id: string) => {
    const f = folderById.get(id)
    if (f) return folderNode(f)
    const b = boardById.get(id)
    if (b) return boardRow(b)
    return null
  }

  const createInput = (target: string) =>
    creating && creating.target === target ? (
      <input
        className="tree-input"
        autoFocus
        placeholder={creating.kind === 'folder' ? 'Folder name' : 'Board name'}
        value={createName}
        onChange={(e) => setCreateName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submitCreate()
          if (e.key === 'Escape') setCreating(null)
        }}
        onBlur={submitCreate}
      />
    ) : null

  return (
    <>
      <aside className={'sidebar' + (open ? '' : ' sidebar--collapsed')} aria-hidden={!open}>
        <div className="sidebar__inner">
          <div className="sidebar__head">
            <span className="sidebar__title">Explorer</span>
            <div className="sidebar__actions">
              <button
                className="icon-btn"
                title="New Board"
                aria-label="New Board"
                onClick={() => beginCreate('top', 'board')}
              >
                <PlusIcon />
              </button>
              <button
                className="icon-btn"
                title="New Folder"
                aria-label="New Folder"
                onClick={() => beginCreate('top', 'folder')}
              >
                <FolderPlusIcon />
              </button>
              <button
                className="icon-btn"
                title="New Category"
                aria-label="New Category"
                onClick={() => {
                  setCatName('')
                  setCreatingCat(true)
                }}
              >
                <CategoryPlusIcon />
              </button>
            </div>
          </div>

          <div className="sidebar__tree">
            {/* Loose (uncategorized) items at the top -- a drop target to un-file. */}
            <div
              className={'tree-top' + (dropTarget === 'top' ? ' tree-top--drop' : '')}
              onDragOver={(e) => overIf(e, [BOARD_DND, FOLDER_DND], 'top')}
              onDragLeave={() => setDropTarget((d) => (d === 'top' ? null : d))}
              onDrop={(e) => dropOnCat(e, null)}
            >
              {createInput('top')}
              {topFolders.map(folderNode)}
              {topBoards.map(boardRow)}
              {topFolders.length === 0 && topBoards.length === 0 && !creating && (
                <div className="tree-empty">Drag items here to uncategorize</div>
              )}
            </div>

            {creatingCat && (
              <input
                className="tree-input tree-input--cat"
                autoFocus
                placeholder="Category name"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreateCat()
                  if (e.key === 'Escape') setCreatingCat(false)
                }}
                onBlur={submitCreateCat}
              />
            )}

            {categories.map((c) => {
              const isOpen = !collapsedCats.has(c.id)
              return (
                <div className="tree-cat" key={c.id}>
                  {editingId === c.id ? (
                    <input
                      className="tree-input tree-input--cat"
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitEdit(true, c.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onBlur={() => submitEdit(true, c.id)}
                    />
                  ) : (
                    <div
                      className={'tree-cat__row' + (dropTarget === 'cat:' + c.id ? ' tree-cat__row--drop' : '')}
                      onDragOver={(e) => overIf(e, [BOARD_DND, FOLDER_DND], 'cat:' + c.id)}
                      onDragLeave={() => setDropTarget((d) => (d === 'cat:' + c.id ? null : d))}
                      onDrop={(e) => dropOnCat(e, c.id)}
                    >
                      <button
                        className={'tree-chevron' + (isOpen ? ' tree-chevron--open' : '')}
                        onClick={() => toggleCat(c.id)}
                        aria-label={isOpen ? 'Collapse' : 'Expand'}
                      >
                        <ChevronIcon />
                      </button>
                      <button className="tree-cat__name" onClick={() => toggleCat(c.id)}>
                        {c.name}
                      </button>
                      <span className="tree-cat__count">{c.items.length}</span>
                      <span className="tree-cat__tools">
                        <button
                          className="icon-btn"
                          title="Add folder or board"
                          aria-label="Add to category"
                          onClick={(e) => setAddMenu({ x: e.clientX, y: e.clientY, catId: c.id })}
                        >
                          <PlusIcon />
                        </button>
                        <button
                          className="icon-btn"
                          title="Rename"
                          aria-label="Rename category"
                          onClick={() => {
                            setEditingId(c.id)
                            setEditName(c.name)
                          }}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          className="icon-btn icon-btn--danger"
                          title="Delete category"
                          aria-label="Delete category"
                          onClick={() => onDeleteCategory(c.id)}
                        >
                          <TrashIcon />
                        </button>
                      </span>
                    </div>
                  )}
                  {isOpen && (
                    <div className="tree-children">
                      {createInput('cat:' + c.id)}
                      {c.items.map(renderItem)}
                      {c.items.length === 0 && creating?.target !== 'cat:' + c.id && (
                        <div className="tree-empty">Empty — use + or drag items here</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </aside>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={
            menu.board.shared
              ? [
                  { label: 'Unshare', mnemonic: 'u', onClick: () => onUnshareBoard(menu.board) },
                  { label: 'Create Private Copy', mnemonic: 'c', onClick: () => onCreatePrivateCopy(menu.board) },
                ]
              : [
                  { label: 'Rename', mnemonic: 'r', onClick: () => startRenameBoard(menu.board) },
                  { label: 'Share', mnemonic: 's', onClick: () => onShareBoard(menu.board) },
                  { label: 'Merge', mnemonic: 'm', onClick: () => onMergeBoard(menu.board) },
                  ...(menu.board.shared_out
                    ? [
                        { label: 'Create Private Copy', mnemonic: 'c', onClick: () => onCreatePrivateCopy(menu.board) },
                        { label: 'Unshare', mnemonic: 'u', onClick: () => onUnshareBoard(menu.board) },
                      ]
                    : []),
                  { label: 'Delete', mnemonic: 'd', danger: true, onClick: () => onDeleteBoard(menu.board) },
                ]
          }
          onClose={() => setMenu(null)}
        />
      )}

      {addMenu && (
        <ContextMenu
          x={addMenu.x}
          y={addMenu.y}
          items={[
            {
              label: 'New Folder',
              mnemonic: 'f',
              onClick: () => beginCreate('cat:' + addMenu.catId, 'folder'),
            },
            {
              label: 'New Board',
              mnemonic: 'b',
              onClick: () => beginCreate('cat:' + addMenu.catId, 'board'),
            },
          ]}
          onClose={() => setAddMenu(null)}
        />
      )}

      {folderMenu && (
        <ContextMenu
          x={folderMenu.x}
          y={folderMenu.y}
          items={[
            {
              label: 'New Board',
              mnemonic: 'b',
              onClick: () => beginCreate('folder:' + folderMenu.folder.id, 'board'),
            },
            { label: 'Share', mnemonic: 's', onClick: () => onShareFolder(folderMenu.folder) },
            {
              label: 'Rename',
              mnemonic: 'r',
              onClick: () => {
                setEditingId(folderMenu.folder.id)
                setEditName(folderMenu.folder.name)
              },
            },
            {
              label: 'Delete',
              mnemonic: 'd',
              danger: true,
              onClick: () => onDeleteFolder(folderMenu.folder.id),
            },
          ]}
          onClose={() => setFolderMenu(null)}
        />
      )}
    </>
  )
}
