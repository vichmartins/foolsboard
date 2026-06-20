import { useEffect, useRef, useState } from 'react'
import * as api from './api'
import { useAuth } from './auth'
import AccountDialog from './components/AccountDialog'
import AdminPanel from './components/AdminPanel'
import BoardSelect from './components/BoardSelect'
import BrandMenu from './components/BrandMenu'
import Canvas from './components/Canvas'
import FolderSelect from './components/FolderSelect'
import ImportExportDialog from './components/ImportExportDialog'
import LoginScreen from './components/LoginScreen'
import ProfileMenu from './components/ProfileMenu'
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
  TransferIcon,
  TrashIcon,
} from './components/icons'
import type { Board, Folder } from './types'
import './App.css'

type ShareTarget = { type: 'board' | 'folder'; id: string; name: string }

function Workspace() {
  const [boards, setBoards] = useState<Board[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  // Active folder filter for the board list (null = All Boards).
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  // Board awaiting a folder via the Move-to-Folder dialog.
  const [moveFolderBoard, setMoveFolderBoard] = useState<Board | null>(null)
  // Resource being shared (opens the Share dialog).
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'new' | 'rename' | 'delete' | 'merge' | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [impexOpen, setImpexOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  // Source boards to merge into the active board; handed to Canvas to import.
  const [mergeSourceIds, setMergeSourceIds] = useState<string[] | null>(null)
  // Selected object ids awaiting a move destination (opens the move dialog).
  const [moveIds, setMoveIds] = useState<string[] | null>(null)

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

  const activeBoard = boards.find((b) => b.id === activeId) ?? null
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

  async function createFolder(name: string) {
    const folder = await api.createFolder(name)
    setFolders((fs) => [...fs, folder])
    setActiveFolderId(folder.id)
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

  async function deleteBoard() {
    if (!activeId) return
    await api.deleteBoard(activeId)
    const remaining = boards.filter((b) => b.id !== activeId)
    if (remaining.length === 0) {
      // Never leave the workspace empty — bootstrap a fresh board.
      const fresh = await api.createBoard('My first storyboard')
      setBoards([fresh])
      setActiveId(fresh.id)
    } else {
      setBoards(remaining)
      setActiveId(remaining[0].id)
    }
    setDialog(null)
  }

  return (
    <div className="app">
      <header className="topbar">
        <BrandMenu />

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
            title="Rename Board"
            aria-label="Rename Board"
            onClick={() => setDialog('rename')}
            disabled={!activeBoard}
          >
            <PencilIcon />
          </button>
          <button
            className="icon-btn icon-btn--danger"
            title="Delete Board"
            aria-label="Delete Board"
            onClick={() => setDialog('delete')}
            disabled={!activeBoard}
          >
            <TrashIcon />
          </button>
          <button
            className="icon-btn"
            title="Move Board to a Folder"
            aria-label="Move Board to a Folder"
            onClick={() => activeBoard && setMoveFolderBoard(activeBoard)}
            disabled={!activeBoard}
          >
            <FolderIcon />
          </button>
          <button
            className="icon-btn"
            title={activeBoard?.shared ? 'Only the owner can share' : 'Share Board'}
            aria-label="Share Board"
            onClick={() =>
              activeBoard &&
              setShareTarget({ type: 'board', id: activeBoard.id, name: activeBoard.name })
            }
            disabled={!activeBoard || activeBoard.shared}
          >
            <ShareIcon />
          </button>
          {activeBoard?.shared && (
            <button
              className="icon-btn"
              title="Make a Private Copy"
              aria-label="Make a Private Copy"
              onClick={() => activeBoard && void makePrivateCopy(activeBoard)}
            >
              <CopyIcon />
            </button>
          )}
          <button
            className="icon-btn"
            onClick={() => setDialog('new')}
            title="New Board"
            aria-label="New Board"
          >
            <PlusIcon />
          </button>
          <button
            className="icon-btn"
            onClick={() => setDialog('merge')}
            disabled={boards.length < 2}
            title="Merge Other Boards Into This One"
            aria-label="Merge Boards"
          >
            <MergeIcon />
          </button>
          <span className="topbar-sep" aria-hidden="true" />
          <button
            className="icon-btn"
            onClick={() => setGalleryOpen(true)}
            title="Gallery — Browse All Items on This Board"
            aria-label="Open Gallery"
            disabled={!activeBoard}
          >
            <GalleryIcon />
          </button>
          <button
            className="icon-btn"
            onClick={() => setImpexOpen(true)}
            title="Import or Export Boards"
            aria-label="Import or Export Boards"
          >
            <TransferIcon />
          </button>
        </div>

        <ThemeToggle />
        <ProfileMenu
          onOpenAccount={() => setAccountOpen(true)}
          onOpenAdmin={() => setAdminOpen(true)}
        />
      </header>

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
          />
        ) : (
          <div className="loading">Loading…</div>
        )}
      </main>

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

      {dialog === 'delete' && activeBoard && (
        <TypeToConfirmDialog
          title="Delete Storyboard?"
          message={`"${activeBoard.name}" and all of its objects, links, and media will be permanently deleted. This can't be undone.`}
          requiredText={activeBoard.name}
          confirmLabel="Delete board"
          danger
          onConfirm={deleteBoard}
          onCancel={() => setDialog(null)}
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
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      {impexOpen && (
        <ImportExportDialog
          boards={boards}
          onClose={() => setImpexOpen(false)}
          onImported={(created) => {
            setBoards((b) => [...created, ...b])
            if (created.length) setActiveId(created[0].id)
          }}
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
