import { useEffect, useRef, useState } from 'react'
import * as api from './api'
import { useAuth } from './auth'
import AccountDialog from './components/AccountDialog'
import PreferencesDialog from './components/PreferencesDialog'
import AdminPanel from './components/AdminPanel'
import BoardSelect from './components/BoardSelect'
import BrandMenu from './components/BrandMenu'
import Canvas from './components/Canvas'
import ConfirmDialog from './components/ConfirmDialog'
import FolderSelect from './components/FolderSelect'
import ImportExportDialog from './components/ImportExportDialog'
import LoginScreen from './components/LoginScreen'
import PresenceBar from './components/PresenceBar'
import ProfileMenu from './components/ProfileMenu'
import Sidebar from './components/Sidebar'
import UpdateBanner from './components/UpdateBanner'
import PromptDialog from './components/PromptDialog'
import MergeDialog from './components/MergeDialog'
import MoveDialog, { type MoveTarget } from './components/MoveDialog'
import NewBoardDialog, { type NewBoardTarget } from './components/NewBoardDialog'
import MoveToFolderDialog from './components/MoveToFolderDialog'
import ShareBanner from './components/ShareBanner'
import ShareDialog from './components/ShareDialog'
import TypeToConfirmDialog from './components/TypeToConfirmDialog'
import ThemeToggle from './components/ThemeToggle'
import {
  CopyIcon,
  FolderIcon,
  GalleryIcon,
  MergeIcon,
  PencilIcon,
  PlusIcon,
  ShareIcon,
  SidebarIcon,
  TransferIcon,
  TrashIcon,
  UnshareIcon,
} from './components/icons'
import { realtime, useBoardActivity, useBoardPresence } from './realtime'
import { useUpdateAvailable } from './useUpdateAvailable'
import type { Board, Category, Folder } from './types'
import { genId } from './types'
import './App.css'

type ShareTarget = { type: 'board' | 'folder'; id: string; name: string }

function Workspace() {
  const { user } = useAuth()
  const [boards, setBoards] = useState<Board[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  // Active folder filter for the board list (null = All Boards).
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  // Board awaiting a folder via the Move-to-Folder dialog.
  const [moveFolderBoard, setMoveFolderBoard] = useState<Board | null>(null)
  // Resource being shared (opens the Share dialog).
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  // Board awaiting delete confirmation (type-to-confirm dialog).
  const [deleteTarget, setDeleteTarget] = useState<Board | null>(null)
  // Board to merge INTO the active board (pending confirmation).
  const [mergeConfirm, setMergeConfirm] = useState<Board | null>(null)
  // Brief toast message that auto-dismisses with an animation (e.g. "can't merge
  // a board into itself"). The seq counter lets the same message re-trigger.
  const [toast, setToast] = useState<string | null>(null)
  const [toastSeq, setToastSeq] = useState(0)
  const [toastLeaving, setToastLeaving] = useState(false)
  function showToast(message: string) {
    setToast(message)
    setToastSeq((s) => s + 1)
  }
  useEffect(() => {
    if (!toast) return
    setToastLeaving(false)
    const hide = window.setTimeout(() => setToastLeaving(true), 2600)
    const remove = window.setTimeout(() => setToast(null), 2600 + 300)
    return () => {
      window.clearTimeout(hide)
      window.clearTimeout(remove)
    }
  }, [toast, toastSeq])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'new' | 'rename' | 'delete' | 'merge' | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [impexOpen, setImpexOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  // Source boards to merge into the active board; handed to Canvas to import.
  const [mergeSourceIds, setMergeSourceIds] = useState<string[] | null>(null)
  // Selected object ids awaiting a move destination (opens the move dialog).
  const [moveIds, setMoveIds] = useState<string[] | null>(null)
  // Left explorer sidebar open/closed (remembered across reloads).
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => localStorage.getItem('foolsboard:sidebar') === '1',
  )
  useEffect(() => {
    localStorage.setItem('foolsboard:sidebar', sidebarOpen ? '1' : '0')
  }, [sidebarOpen])
  // A node to pan to after switching boards (from the workspace-wide Gallery).
  const [pendingFocus, setPendingFocus] = useState<{ boardId: string; nodeId: string } | null>(
    null,
  )
  // "New version deployed" prompt (production only); dismissible.
  const updateAvailable = useUpdateAvailable()
  const [updateDismissed, setUpdateDismissed] = useState(false)

  // Load boards; bootstrap a first board if the workspace is empty. Restore the
  // board the user last had open (falling back to the first).
  useEffect(() => {
    // Start the last-opened board's graph fetch immediately, in parallel with
    // the board list, so the canvas doesn't wait on a second round trip.
    const saved = localStorage.getItem('foolsboard:activeBoard')
    if (saved) api.prefetchGraph(saved)
    api.listBoards().then(async (list) => {
      if (list.length === 0) {
        const first = await api.createBoard('My first storyboard')
        list = [first]
      }
      setBoards(list)
      setActiveId(saved && list.some((b) => b.id === saved) ? saved : list[0].id)
    })
    api.listFolders().then(setFolders).catch(() => {})
  }, [])

  // Remember the active board so a refresh/restart reopens it.
  useEffect(() => {
    if (activeId) localStorage.setItem('foolsboard:activeBoard', activeId)
  }, [activeId])

  // Open the realtime collaboration channel while signed in.
  useEffect(() => {
    realtime.start()
    return () => realtime.stop()
  }, [])

  // Keep the board/folder lists (and their shared/crown badges) in sync when a
  // share is created, accepted, rejected, or removed anywhere.
  useEffect(() => realtime.subscribeShare(() => refreshLists()), [])

  // Tell realtime my color so my own highlight stays fixed and a collaborator who
  // shares my color is shown to me in a different one.
  useEffect(() => {
    if (user) realtime.setSelf(user.id, user.color)
  }, [user?.id, user?.color])

  const activeBoard = boards.find((b) => b.id === activeId) ?? null
  // Announce the active board (join) and get other collaborators + what each is
  // doing (editing / uploading / viewing). useBoardPresence drives the board join.
  useBoardPresence(activeId)
  const activity = useBoardActivity(activeId)
  // Boards shown in the picker: filtered to the active folder ("All" = every board).
  const visibleBoards =
    activeFolderId === null ? boards : boards.filter((b) => b.folder_id === activeFolderId)

  async function handleNewBoard(name: string, target: NewBoardTarget) {
    let folderId: string | null
    if ('newFolder' in target) {
      const folder = await api.createFolder(target.newFolder)
      setFolders((fs) => [...fs, folder])
      folderId = folder.id
    } else {
      folderId = target.folderId
    }
    const board = await api.createBoard(name, undefined, folderId)
    setBoards((b) => [board, ...b])
    setActiveId(board.id)
    setActiveFolderId(folderId) // surface the new board in the (now-filtered) list
    setDialog(null)
  }

  function moveBoardToFolder(boardId: string, folderId: string | null) {
    setBoards((bs) => bs.map((b) => (b.id === boardId ? { ...b, folder_id: folderId } : b)))
    void api.moveBoardToFolder(boardId, folderId).catch(() => {})
  }
  function moveFolderToFolder(folderId: string, parentFolderId: string | null) {
    setFolders((fs) =>
      fs.map((f) => (f.id === folderId ? { ...f, parent_folder_id: parentFolderId } : f)),
    )
    void api.moveFolder(folderId, parentFolderId).catch(() => {})
  }

  // Re-fetch boards + folders (e.g. after accepting a share, so shared items appear).
  function refreshLists() {
    api.listBoards().then(setBoards).catch(() => {})
    api.listFolders().then(setFolders).catch(() => {})
  }

  async function makePrivateCopy(board: Board) {
    const copy = await api.copyBoard(board.id)
    setBoards((b) => [copy, ...b])
    setActiveId(copy.id)
    setActiveFolderId(null)
  }

  // Stop sharing a board: owner unshares it for everyone, a recipient leaves it.
  // A recipient loses access, so drop it from view if it was open.
  async function unshareBoard(board: Board) {
    await api.unshareBoard(board.id).catch(() => {})
    if (board.shared) {
      setBoards((bs) => bs.filter((b) => b.id !== board.id))
      if (board.id === activeId) setActiveId(null)
    }
    refreshLists()
  }

  async function createFolder(name: string) {
    const folder = await api.createFolder(name)
    setFolders((fs) => [...fs, folder])
    setActiveFolderId(folder.id)
  }

  // --- Explorer layout (user-defined collapsible categories + a manual order
  // for the uncategorized top-level items) ----------------------------------
  const [categories, setCategories] = useState<Category[]>([])
  const [topOrder, setTopOrder] = useState<string[]>([])
  useEffect(() => {
    api
      .getLayout()
      .then(({ categories, top }) => {
        setCategories(categories)
        setTopOrder(top)
      })
      .catch(() => {})
  }, [])
  const catsRef = useRef<Category[]>(categories)
  catsRef.current = categories
  const topRef = useRef<string[]>(topOrder)
  topRef.current = topOrder
  function persistLayout(next: Category[], top: string[]) {
    setCategories(next)
    setTopOrder(top)
    void api.saveLayout({ categories: next, top }).catch(() => {})
  }
  function persistCategories(next: Category[]) {
    persistLayout(next, topRef.current)
  }
  function createCategory(name: string) {
    persistCategories([...catsRef.current, { id: genId(), name, items: [] }])
  }
  function renameCategory(id: string, name: string) {
    persistCategories(catsRef.current.map((c) => (c.id === id ? { ...c, name } : c)))
  }
  function deleteCategory(id: string) {
    persistCategories(catsRef.current.filter((c) => c.id !== id))
  }
  function reorderCategories(ids: string[]) {
    const by = new Map(catsRef.current.map((c) => [c.id, c]))
    persistCategories(ids.map((id) => by.get(id)).filter((c): c is Category => !!c))
  }
  // The complete, ordered list of uncategorized top-level item ids: the saved
  // order first (members only), then any new top items in natural order. Used so
  // reorder indices line up with what's rendered.
  function computeOrderedTop(): string[] {
    const categorized = new Set(catsRef.current.flatMap((c) => c.items))
    const folderIds = new Set(folders.map((f) => f.id))
    const members: string[] = []
    for (const f of folders) if (!categorized.has(f.id)) members.push(f.id)
    for (const b of boards) {
      const filed = !!b.folder_id && folderIds.has(b.folder_id)
      if (!filed && !categorized.has(b.id)) members.push(b.id)
    }
    const order = topRef.current
    const memberSet = new Set(members)
    return [...order.filter((id) => memberSet.has(id)), ...members.filter((id) => !order.includes(id))]
  }
  // Place a folder/board into a category (categoryId=null = uncategorized top),
  // optionally at a position. Removes it from every other category and from the
  // top order first, so it lands in exactly one place.
  function fileItem(itemId: string, categoryId: string | null, index?: number) {
    const cleaned = catsRef.current.map((c) => ({
      ...c,
      items: c.items.filter((i) => i !== itemId),
    }))
    let top = topRef.current.filter((i) => i !== itemId)
    let next = cleaned
    if (categoryId) {
      next = cleaned.map((c) => {
        if (c.id !== categoryId) return c
        const items = [...c.items]
        items.splice(index ?? items.length, 0, itemId)
        return { ...c, items }
      })
    } else {
      top = computeOrderedTop().filter((i) => i !== itemId)
      top.splice(index ?? top.length, 0, itemId)
    }
    persistLayout(next, top)
  }
  async function createFolderIn(categoryId: string | null, name: string) {
    const folder = await api.createFolder(name)
    setFolders((fs) => [...fs, folder])
    if (categoryId) fileItem(folder.id, categoryId)
  }
  async function createBoardIn(categoryId: string | null, name: string) {
    const board = await api.createBoard(name)
    setBoards((b) => [board, ...b])
    setActiveId(board.id)
    if (categoryId) fileItem(board.id, categoryId)
  }
  async function createBoardInFolder(folderId: string, name: string) {
    const board = await api.createBoard(name, undefined, folderId)
    setBoards((b) => [board, ...b])
    setActiveId(board.id)
  }
  function renameFolder(id: string, name: string) {
    setFolders((fs) => fs.map((f) => (f.id === id ? { ...f, name } : f)))
    void api.renameFolder(id, name).catch(() => {})
  }
  function deleteFolder(id: string) {
    setFolders((fs) => fs.filter((f) => f.id !== id))
    setBoards((bs) => bs.map((b) => (b.folder_id === id ? { ...b, folder_id: null } : b)))
    if (activeFolderId === id) setActiveFolderId(null)
    void api.deleteFolder(id).catch(() => {})
  }
  function reorderFolders(ids: string[]) {
    setFolders((fs) => ids.map((id) => fs.find((f) => f.id === id)).filter((f): f is Folder => !!f))
    void api.reorderFolders(ids).catch(() => {})
  }
  function sortFolders(dir: 'asc' | 'desc') {
    const sorted = [...folders].sort((a, b) =>
      dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    )
    setFolders(sorted)
    void api.reorderFolders(sorted.map((f) => f.id)).catch(() => {})
  }

  async function renameBoard(name: string) {
    if (!activeId) return
    const updated = await api.updateBoard(activeId, { name })
    setBoards((b) => b.map((x) => (x.id === updated.id ? updated : x)))
    setDialog(null)
  }
  // Rename a specific board (from the explorer's inline editor).
  function renameBoardById(id: string, name: string) {
    setBoards((bs) => bs.map((b) => (b.id === id ? { ...b, name } : b)))
    void api.updateBoard(id, { name }).catch(() => {})
  }

  // Delete any board (the active one, or one picked in the explorer); gated by
  // the type-to-confirm dialog via `deleteTarget`.
  async function deleteBoardById(id: string) {
    await api.deleteBoard(id)
    const remaining = boards.filter((b) => b.id !== id)
    if (remaining.length === 0) {
      // Never leave the workspace empty — bootstrap a fresh board.
      const fresh = await api.createBoard('My first storyboard')
      setBoards([fresh])
      setActiveId(fresh.id)
    } else {
      setBoards(remaining)
      if (activeId === id) setActiveId(remaining[0].id)
    }
    setDeleteTarget(null)
  }

  return (
    <div className="app">
      <header className="topbar">
        <BrandMenu />
        <button
          className={'icon-btn sidebar-toggle' + (sidebarOpen ? ' icon-btn--active' : '')}
          title={sidebarOpen ? 'Hide Explorer' : 'Show Explorer'}
          aria-label="Toggle Explorer"
          aria-pressed={sidebarOpen}
          onClick={() => setSidebarOpen((o) => !o)}
        >
          <SidebarIcon />
        </button>

        <FolderSelect
          folders={folders}
          boards={boards}
          activeFolderId={activeFolderId}
          onSelect={setActiveFolderId}
          onCreate={createFolder}
          onRename={renameFolder}
          onDelete={deleteFolder}
          onReorder={reorderFolders}
          onSort={sortFolders}
          onDropBoard={moveBoardToFolder}
          onShare={(folder) =>
            setShareTarget({ type: 'folder', id: folder.id, name: folder.name })
          }
        />

        <BoardSelect
          boards={visibleBoards}
          activeId={activeId}
          activeName={activeBoard?.name}
          activeShared={activeBoard?.shared}
          activeSharedOut={activeBoard?.shared_out}
          activeOwnerName={activeBoard?.owner_name}
          activeMemberIds={activeBoard?.member_ids}
          onSelect={setActiveId}
          onReorder={(ids) => {
            setBoards((bs) =>
              ids
                .map((id) => bs.find((b) => b.id === id))
                .filter((b): b is Board => b !== undefined),
            )
            void api.reorderBoards(ids)
          }}
        />

        <div className="board-actions">
          <button
            className="icon-btn"
            onClick={() => setDialog('new')}
            title="Create"
            aria-label="Create"
          >
            <PlusIcon />
          </button>
          <button
            className="icon-btn"
            title="Rename"
            aria-label="Rename"
            onClick={() => setDialog('rename')}
            disabled={!activeBoard}
          >
            <PencilIcon />
          </button>
          <button
            className="icon-btn"
            title="Move"
            aria-label="Move"
            onClick={() => activeBoard && setMoveFolderBoard(activeBoard)}
            disabled={!activeBoard}
          >
            <FolderIcon />
          </button>
          <button
            className="icon-btn"
            onClick={() => setDialog('merge')}
            disabled={boards.length < 2}
            title="Merge"
            aria-label="Merge"
          >
            <MergeIcon />
          </button>
          <button
            className="icon-btn"
            title={activeBoard?.shared ? 'Only the owner can share' : 'Share'}
            aria-label="Share"
            onClick={() =>
              activeBoard &&
              setShareTarget({ type: 'board', id: activeBoard.id, name: activeBoard.name })
            }
            disabled={!activeBoard || activeBoard.shared}
          >
            <ShareIcon />
          </button>
          {activeBoard?.shared && (
            <>
              <button
                className="icon-btn"
                title="Create Private Copy"
                aria-label="Create Private Copy"
                onClick={() => activeBoard && void makePrivateCopy(activeBoard)}
              >
                <CopyIcon />
              </button>
              <button
                className="icon-btn icon-btn--danger"
                title="Unshare"
                aria-label="Unshare"
                onClick={() => activeBoard && void unshareBoard(activeBoard)}
              >
                <UnshareIcon />
              </button>
            </>
          )}
          {!activeBoard?.shared && (
            <button
              className="icon-btn icon-btn--danger"
              title="Delete"
              aria-label="Delete"
              onClick={() => activeBoard && setDeleteTarget(activeBoard)}
              disabled={!activeBoard}
            >
              <TrashIcon />
            </button>
          )}
          <span className="topbar-sep" aria-hidden="true" />
          <button
            className="icon-btn"
            onClick={() => setGalleryOpen(true)}
            title="Gallery"
            aria-label="Gallery"
            disabled={!activeBoard}
          >
            <GalleryIcon />
          </button>
          <button
            className="icon-btn"
            onClick={() => setImpexOpen(true)}
            title="Import/Export"
            aria-label="Import/Export"
          >
            <TransferIcon />
          </button>
        </div>

        <PresenceBar members={activity} />
        <ThemeToggle />
        <ProfileMenu
          onOpenAccount={() => setAccountOpen(true)}
          onOpenPreferences={() => setPrefsOpen(true)}
          onOpenAdmin={() => setAdminOpen(true)}
        />
      </header>

      <div className="workspace-body">
        <Sidebar
          open={sidebarOpen}
          boards={boards}
          folders={folders}
          categories={categories}
          orderedTop={computeOrderedTop()}
          activeId={activeId}
          onSelectBoard={setActiveId}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onShareFolder={(f) => setShareTarget({ type: 'folder', id: f.id, name: f.name })}
          onCreateBoardInFolder={createBoardInFolder}
          onMoveBoardToFolder={moveBoardToFolder}
          onMoveFolderToFolder={moveFolderToFolder}
          onShareBoard={(b) => setShareTarget({ type: 'board', id: b.id, name: b.name })}
          onRenameBoard={renameBoardById}
          onDeleteBoard={(b) => setDeleteTarget(b)}
          onMergeBoard={(b) => {
            if (b.id === activeId) showToast("A board can't merge into itself.")
            else setMergeConfirm(b)
          }}
          onUnshareBoard={unshareBoard}
          onCreatePrivateCopy={makePrivateCopy}
          onCreateCategory={createCategory}
          onRenameCategory={renameCategory}
          onDeleteCategory={deleteCategory}
          onReorderCategories={reorderCategories}
          onFileItem={fileItem}
          onCreateFolderIn={createFolderIn}
          onCreateBoardIn={createBoardIn}
        />
        <main className="stage">
          {activeId ? (
          <Canvas
            key={activeId}
            boardId={activeId}
            mergeSourceIds={mergeSourceIds}
            onMergeHandled={(merged) => {
              const ids = mergeSourceIds
              setMergeSourceIds(null)
              // A successful merge consumes the source boards -- delete them.
              if (merged && ids?.length) {
                void Promise.all(ids.map((id) => api.deleteBoard(id).catch(() => {}))).then(() => {
                  setBoards((bs) => bs.filter((b) => !ids.includes(b.id)))
                })
              }
            }}
            galleryOpen={galleryOpen}
            onCloseGallery={() => setGalleryOpen(false)}
            onMoveSelection={(ids) => setMoveIds(ids)}
            boards={boards}
            folders={folders}
            onOpenBoard={(bid, nid) => {
              setActiveId(bid)
              setPendingFocus(nid ? { boardId: bid, nodeId: nid } : null)
            }}
            focusNodeId={
              pendingFocus && pendingFocus.boardId === activeId ? pendingFocus.nodeId : null
            }
            onFocusHandled={() => setPendingFocus(null)}
          />
        ) : (
          <div className="loading">Loading…</div>
        )}
        </main>
      </div>

      {dialog === 'new' && (
        <NewBoardDialog
          folders={folders}
          defaultFolderId={activeFolderId}
          onCreate={handleNewBoard}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === 'rename' && activeBoard && (
        <PromptDialog
          title="Rename Storyboard"
          label="New name"
          initialValue={activeBoard.name}
          confirmLabel="Rename"
          onSubmit={renameBoard}
          onCancel={() => setDialog(null)}
        />
      )}

      {deleteTarget && (
        <TypeToConfirmDialog
          title="Delete Storyboard?"
          message={
            <>
              <strong>{deleteTarget.name}</strong> and all of its objects, links, and media will
              be permanently deleted. This can't be undone.
            </>
          }
          requiredText={deleteTarget.name}
          confirmLabel="Delete board"
          danger
          onConfirm={() => deleteBoardById(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {dialog === 'merge' && (
        <MergeDialog
          boards={boards.filter((b) => b.id !== activeId)}
          targetName={activeBoard?.name ?? 'this board'}
          onConfirm={(ids) => {
            setMergeSourceIds(ids)
            setDialog(null)
          }}
          onCancel={() => setDialog(null)}
        />
      )}

      {mergeConfirm && activeBoard && (
        <ConfirmDialog
          title="Merge Board?"
          message={
            <>
              <strong>{mergeConfirm.name}</strong> will be merged into{' '}
              <strong>{activeBoard.name}</strong>. After merging,{' '}
              <strong>{mergeConfirm.name}</strong> will be permanently deleted. This can't be
              undone.
            </>
          }
          confirmLabel="Merge"
          onConfirm={() => {
            setMergeSourceIds([mergeConfirm.id])
            setMergeConfirm(null)
          }}
          onCancel={() => setMergeConfirm(null)}
        />
      )}

      {moveIds && (
        <MoveDialog
          boards={boards.filter((b) => b.id !== activeId)}
          count={moveIds.length}
          onCancel={() => setMoveIds(null)}
          onConfirm={async (target: MoveTarget) => {
            const ids = moveIds
            setMoveIds(null)
            if (!ids?.length) return
            let boardId: string
            let createdId: string | null = null
            if ('newName' in target) {
              const board = await api.createBoard(target.newName)
              createdId = board.id
              boardId = board.id
              setBoards((bs) => [board, ...bs])
            } else {
              boardId = target.boardId
            }
            try {
              await api.absorbNodes(boardId, ids)
            } catch (e) {
              if (createdId) {
                const cid = createdId
                await api.deleteBoard(cid).catch(() => {})
                setBoards((bs) => bs.filter((b) => b.id !== cid))
              }
              throw e
            }
            setActiveId(boardId)
          }}
        />
      )}

      {moveFolderBoard && (
        <MoveToFolderDialog
          folders={folders}
          boardName={moveFolderBoard.name}
          currentFolderId={moveFolderBoard.folder_id}
          onCancel={() => setMoveFolderBoard(null)}
          onMove={(folderId) => {
            moveBoardToFolder(moveFolderBoard.id, folderId)
            setMoveFolderBoard(null)
          }}
        />
      )}

      {shareTarget && (
        <ShareDialog
          resourceType={shareTarget.type}
          resourceId={shareTarget.id}
          resourceName={shareTarget.name}
          onClose={() => setShareTarget(null)}
        />
      )}

      <ShareBanner onChanged={refreshLists} />

      {accountOpen && <AccountDialog onClose={() => setAccountOpen(false)} />}
      {prefsOpen && <PreferencesDialog onClose={() => setPrefsOpen(false)} />}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      {impexOpen && (
        <ImportExportDialog
          boards={boards}
          folders={folders}
          onClose={() => setImpexOpen(false)}
          onImported={(created) => {
            setBoards((b) => [...created, ...b])
            if (created.length) setActiveId(created[0].id)
            // Import may have created folders; refresh the folder list.
            api.listFolders().then(setFolders).catch(() => {})
          }}
        />
      )}

      {toast && (
        <div className={'toast' + (toastLeaving ? ' toast--leaving' : '')} role="status">
          {toast}
        </div>
      )}

      {updateAvailable && !updateDismissed && (
        <UpdateBanner
          onReload={() => window.location.reload()}
          onDismiss={() => setUpdateDismissed(true)}
        />
      )}
    </div>
  )
}

type Screen = 'login' | 'app'
const CURTAIN_COVER_MS = 200
const CURTAIN_REVEAL_MS = 260

// Gate the whole app on authentication, with a gradient "curtain" that covers
// the screen, swaps login <-> workspace underneath, then reveals -- so signing
// in or out is a smooth transition rather than an instant cut. The first load
// (token check) swaps without a curtain.
export default function App() {
  const { user, loading } = useAuth()
  const target: Screen = user ? 'app' : 'login'
  const [displayed, setDisplayed] = useState<Screen | null>(null)
  const [curtain, setCurtain] = useState<'none' | 'in' | 'out'>('none')
  const displayedRef = useRef<Screen | null>(null)

  useEffect(() => {
    displayedRef.current = displayed
  }, [displayed])

  useEffect(() => {
    if (loading) return
    if (displayedRef.current === null) {
      setDisplayed(target) // first resolve after the token check: no curtain
      return
    }
    if (target === displayedRef.current) return
    setCurtain('in')
    const cover = window.setTimeout(() => {
      setDisplayed(target)
      setCurtain('out')
    }, CURTAIN_COVER_MS)
    const done = window.setTimeout(
      () => setCurtain('none'),
      CURTAIN_COVER_MS + CURTAIN_REVEAL_MS,
    )
    return () => {
      window.clearTimeout(cover)
      window.clearTimeout(done)
    }
  }, [target, loading])

  if (loading || displayed === null) return <div className="auth-screen" />

  return (
    <>
      {displayed === 'app' ? <Workspace /> : <LoginScreen />}
      {curtain !== 'none' && (
        <div
          className={'auth-curtain' + (curtain === 'out' ? ' auth-curtain--out' : '')}
        />
      )}
    </>
  )
}
