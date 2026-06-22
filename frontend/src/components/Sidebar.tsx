// Collapsible left "Explorer": user-defined Categories (VSCode-style collapsible
// sections) each holding folders and/or boards, plus loose (uncategorized) items
// at the top. Drag a board/folder onto a category to file it; drag a board onto a
// folder to move it inside. The "+" on a category creates a folder or board in it.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Board, Category, Folder } from '../types'
import { useGlobalPresence } from '../realtime'
import ContextMenu from './ContextMenu'
import ShareMark from './ShareMark'
import {
  BoardIcon,
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
const CATEGORY_DND = 'application/x-foolsboard-category'
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
  onMoveFolder: (folder: Folder) => void
  onMoveBoard: (board: Board) => void
  onCreateBoardInFolder: (folderId: string, name: string) => void
  onMoveBoardToFolder: (boardId: string, folderId: string | null) => void
  onMoveFolderToFolder: (folderId: string, parentFolderId: string | null) => void
  orderedTop: string[] // ordered ids of uncategorized top-level items
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
  onFileItem: (itemId: string, categoryId: string | null, index?: number) => void
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

// FLIP: after each render, glide any [data-flip-id] row that changed position to
// its new spot, so reordering/filing animates smoothly instead of snapping.
function useFlipReorder(ref: React.RefObject<HTMLElement | null>) {
  const prev = useRef<Map<string, DOMRect>>(new Map())
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const next = new Map<string, DOMRect>()
    el.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((n) => {
      const id = n.dataset.flipId
      if (!id) return
      const rect = n.getBoundingClientRect()
      next.set(id, rect)
      const p = prev.current.get(id)
      if (!p) return
      const dx = p.left - rect.left
      const dy = p.top - rect.top
      if ((dx || dy) && Math.abs(dx) < 2000 && Math.abs(dy) < 2000) {
        n.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 190, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        )
      }
    })
    prev.current = next
  })
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
    onMoveFolder,
    onMoveBoard,
    onCreateBoardInFolder,
    onMoveBoardToFolder,
    onMoveFolderToFolder,
    orderedTop,
    onShareBoard,
    onRenameBoard,
    onDeleteBoard,
    onMergeBoard,
    onUnshareBoard,
    onCreatePrivateCopy,
    onCreateCategory,
    onRenameCategory,
    onDeleteCategory,
    onReorderCategories,
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
  const [reorderHint, setReorderHint] = useState<{ id: string; after: boolean } | null>(null)
  // Clear the drag indicators whenever any drag ends (drop, Esc, or off-window),
  // so we don't rely on per-row dragleave (which flickers over child elements).
  useEffect(() => {
    const clear = () => {
      setReorderHint(null)
      setDropTarget(null)
    }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])
  const [menu, setMenu] = useState<{ x: number; y: number; board: Board } | null>(null)
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number; folder: Folder } | null>(null)
  const [addMenu, setAddMenu] = useState<{ x: number; y: number; catId: string } | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  useFlipReorder(treeRef)

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
  // The top-level ordering and which items are uncategorized is decided by the
  // parent (App) via `orderedTop`; here we only need lookups and folder contents.
  const folderById = new Map(folders.map((f) => [f.id, f]))
  const boardById = new Map(boards.map((b) => [b.id, b]))
  const boardsIn = (fid: string) => boards.filter((b) => b.folder_id === fid)

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
  const startDrag = (e: React.DragEvent, type: string, id: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(type, id)
    e.dataTransfer.setData('text/plain', id)
  }
  const types = (e: React.DragEvent) => Array.from(e.dataTransfer.types)
  const overIf = (e: React.DragEvent, accept: string[], key: string) => {
    if (accept.some((t) => types(e).includes(t))) {
      e.preventDefault()
      setDropTarget((d) => (d === key ? d : key))
      setReorderHint(null) // hovering a container's empty area, not between rows
    }
  }
  const getId = (e: React.DragEvent, type: string) => e.dataTransfer.getData(type)
  // Drop a board onto a folder: move it inside (and out of any category).
  // Folders don't nest, so a dropped folder is handled as a reorder instead.
  const dropOnFolder = (e: React.DragEvent, fid: string) => {
    setDropTarget(null)
    const bid = getId(e, BOARD_DND)
    if (bid) {
      e.preventDefault()
      onMoveBoardToFolder(bid, fid)
      onFileItem(bid, null)
    }
  }
  // Drop on a category (or the top, catId=null): file the item there, un-nesting
  // folders / un-filing boards from their folder first.
  const dropOnCat = (e: React.DragEvent, catId: string | null) => {
    setDropTarget(null)
    const fid = getId(e, FOLDER_DND)
    const bid = getId(e, BOARD_DND)
    if (fid) {
      e.preventDefault()
      if (folderById.get(fid)?.parent_folder_id) onMoveFolderToFolder(fid, null)
      onFileItem(fid, catId)
    } else if (bid) {
      e.preventDefault()
      if (boardById.get(bid)?.folder_id) onMoveBoardToFolder(bid, null)
      onFileItem(bid, catId)
    }
  }

  // --- reorder (drop between rows) ------------------------------------------
  const clearHints = () => {
    setReorderHint(null)
    setDropTarget(null)
  }
  // Which third of a row the pointer is over. `allowInto` (folders) reserves the
  // middle for nesting; otherwise the row splits in half.
  const rowZone = (e: React.DragEvent, allowInto: boolean): 'before' | 'after' | 'into' => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - r.top
    if (allowInto) {
      if (y < r.height * 0.3) return 'before'
      if (y > r.height * 0.7) return 'after'
      return 'into'
    }
    return y < r.height / 2 ? 'before' : 'after'
  }
  // Reorder the dragged item next to `targetId` within a container ('top' or
  // 'cat:<id>'), pulling it out of any folder/category it was in first.
  const reorderInto = (e: React.DragEvent, targetId: string, container: string, after: boolean) => {
    const dfid = getId(e, FOLDER_DND)
    const bid = getId(e, BOARD_DND)
    const draggedId = dfid || bid
    if (!draggedId || draggedId === targetId) return
    const catId = container === 'top' ? null : container.slice(4)
    if (dfid && folderById.get(dfid)?.parent_folder_id) onMoveFolderToFolder(dfid, null)
    if (bid && boardById.get(bid)?.folder_id) onMoveBoardToFolder(bid, null)
    const siblings = container === 'top' ? orderedTop : categories.find((c) => c.id === catId)?.items ?? []
    let idx = siblings.indexOf(targetId)
    if (idx < 0) idx = siblings.length
    if (after) idx += 1
    const from = siblings.indexOf(draggedId)
    if (from >= 0 && from < idx) idx -= 1
    onFileItem(draggedId, catId, idx)
  }
  const canReorder = (container: string) => container === 'top' || container.startsWith('cat:')
  const insertClass = (id: string) =>
    reorderHint?.id === id ? (reorderHint.after ? ' tree-insert-after' : ' tree-insert-before') : ''
  // Move a category before/after another in the section list.
  const reorderCats = (draggedId: string, targetId: string, after: boolean) => {
    if (draggedId === targetId) return
    const ids = categories.map((c) => c.id).filter((id) => id !== draggedId)
    let idx = ids.indexOf(targetId)
    if (idx < 0) idx = ids.length
    if (after) idx += 1
    ids.splice(idx, 0, draggedId)
    onReorderCategories(ids)
  }

  // --- renderers ------------------------------------------------------------
  const boardRow = (b: Board, container: string) => {
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
    const reorderable = canReorder(container)
    return (
      <div
        key={b.id}
        data-flip-id={b.id}
        className={
          'tree-board-row' + (b.id === activeId ? ' tree-board-row--active' : '') + insertClass(b.id)
        }
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY, board: b })
        }}
        onDragOver={
          reorderable
            ? (e) => {
                if (!types(e).some((t) => t === BOARD_DND || t === FOLDER_DND)) return
                e.preventDefault()
                e.stopPropagation() // don't let the container also flag a drop
                const after = rowZone(e, false) === 'after'
                setDropTarget(null) // clear any folder/container highlight
                // Keep the same object when nothing changed so React skips the
                // re-render (otherwise dragover fires a render storm -> jitter).
                setReorderHint((h) => (h && h.id === b.id && h.after === after ? h : { id: b.id, after }))
              }
            : undefined
        }
        onDrop={
          reorderable
            ? (e) => {
                e.preventDefault()
                e.stopPropagation()
                reorderInto(e, b.id, container, rowZone(e, false) === 'after')
                clearHints()
              }
            : undefined
        }
      >
        <button
          className="tree-board"
          draggable
          onDragStart={(e) => startDrag(e, BOARD_DND, b.id)}
          onClick={() => onSelectBoard(b.id)}
          title={b.name}
        >
          <span className="tree-board__icon" aria-hidden="true">
            <BoardIcon />
          </span>
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

  const folderNode = (f: Folder, container: string) => {
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
      <div className="tree-folder" key={f.id} data-flip-id={f.id}>
        <div
          className={
            'tree-folder__row' +
            (dropTarget === f.id ? ' tree-folder__row--drop' : '') +
            insertClass(f.id)
          }
          draggable={!f.shared}
          onDragStart={(e) => startDrag(e, FOLDER_DND, f.id)}
          onDragOver={(e) => {
            const t = types(e)
            if (!t.some((x) => x === BOARD_DND || x === FOLDER_DND)) return
            e.preventDefault()
            e.stopPropagation() // don't let the container also flag a drop
            // Only a board can drop *into* a folder; a folder always reorders.
            const zone = rowZone(e, t.includes(BOARD_DND))
            if (zone === 'into') {
              setReorderHint(null)
              setDropTarget(f.id)
            } else {
              setDropTarget((d) => (d === f.id ? null : d))
              const after = zone === 'after'
              setReorderHint((h) => (h && h.id === f.id && h.after === after ? h : { id: f.id, after }))
            }
          }}
          onDrop={(e) => {
            e.stopPropagation()
            const zone = rowZone(e, types(e).includes(BOARD_DND))
            if (zone === 'into') dropOnFolder(e, f.id)
            else {
              e.preventDefault()
              reorderInto(e, f.id, container, zone === 'after')
            }
            clearHints()
          }}
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
            {inside.map((b) => boardRow(b, 'folder:' + f.id))}
            {inside.length === 0 && creating?.target !== 'folder:' + f.id && (
              <div className="tree-empty">Empty</div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderItem = (id: string, container: string) => {
    const f = folderById.get(id)
    if (f) return folderNode(f, container)
    const b = boardById.get(id)
    if (b) return boardRow(b, container)
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

          <div className="sidebar__tree" ref={treeRef}>
            {/* Loose (uncategorized) items at the top -- a drop target to un-file. */}
            <div
              className={'tree-top' + (dropTarget === 'top' ? ' tree-top--drop' : '')}
              onDragOver={(e) => overIf(e, [BOARD_DND, FOLDER_DND], 'top')}
              onDragLeave={() => setDropTarget((d) => (d === 'top' ? null : d))}
              onDrop={(e) => dropOnCat(e, null)}
            >
              {createInput('top')}
              {orderedTop.map((id) => renderItem(id, 'top'))}
              {orderedTop.length === 0 && !creating && (
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
              // Only items that still exist (a deleted board/folder leaves a dead
              // id behind); count and render those so they always agree.
              const items = c.items.filter((id) => folderById.has(id) || boardById.has(id))
              return (
                <div className="tree-cat" key={c.id} data-flip-id={c.id}>
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
                      className={
                        'tree-cat__row' +
                        (dropTarget === 'cat:' + c.id ? ' tree-cat__row--drop' : '') +
                        insertClass(c.id)
                      }
                      draggable
                      onDragStart={(e) => startDrag(e, CATEGORY_DND, c.id)}
                      onDragOver={(e) => {
                        const t = types(e)
                        if (t.includes(CATEGORY_DND)) {
                          // reorder this category
                          e.preventDefault()
                          setDropTarget(null)
                          setReorderHint({ id: c.id, after: rowZone(e, false) === 'after' })
                        } else {
                          overIf(e, [BOARD_DND, FOLDER_DND], 'cat:' + c.id)
                        }
                      }}
                      onDragLeave={() => {
                        setDropTarget((d) => (d === 'cat:' + c.id ? null : d))
                        setReorderHint((h) => (h?.id === c.id ? null : h))
                      }}
                      onDrop={(e) => {
                        const catDrag = getId(e, CATEGORY_DND)
                        if (catDrag) {
                          e.preventDefault()
                          e.stopPropagation()
                          reorderCats(catDrag, c.id, rowZone(e, false) === 'after')
                        } else {
                          dropOnCat(e, c.id)
                        }
                        clearHints()
                      }}
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
                      <span className="tree-cat__count">{items.length}</span>
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
                    <div
                      className="tree-children"
                      onDragOver={(e) => {
                        if (types(e).includes(CATEGORY_DND)) return
                        overIf(e, [BOARD_DND, FOLDER_DND], 'cat:' + c.id)
                      }}
                      onDragLeave={() => setDropTarget((d) => (d === 'cat:' + c.id ? null : d))}
                      onDrop={(e) => {
                        if (getId(e, CATEGORY_DND)) return
                        dropOnCat(e, c.id)
                        clearHints()
                      }}
                    >
                      {createInput('cat:' + c.id)}
                      {items.map((id) => renderItem(id, 'cat:' + c.id))}
                      {items.length === 0 && creating?.target !== 'cat:' + c.id && (
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
                  { label: 'Move to…', mnemonic: 'v', onClick: () => onMoveBoard(menu.board) },
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
            { label: 'Move to…', mnemonic: 'v', onClick: () => onMoveFolder(folderMenu.folder) },
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
