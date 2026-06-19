import { useEffect, useRef, useState } from 'react'
import * as api from './api'
import { useAuth } from './auth'
import AccountDialog from './components/AccountDialog'
import AdminPanel from './components/AdminPanel'
import BoardSelect from './components/BoardSelect'
import BrandMenu from './components/BrandMenu'
import Canvas from './components/Canvas'
import ImportExportDialog from './components/ImportExportDialog'
import LoginScreen from './components/LoginScreen'
import ProfileMenu from './components/ProfileMenu'
import PromptDialog from './components/PromptDialog'
import MergeDialog from './components/MergeDialog'
import TypeToConfirmDialog from './components/TypeToConfirmDialog'
import ThemeToggle from './components/ThemeToggle'
import { MergeIcon, PencilIcon, PlusIcon, TransferIcon, TrashIcon } from './components/icons'
import type { Board } from './types'
import './App.css'

function Workspace() {
  const [boards, setBoards] = useState<Board[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'new' | 'rename' | 'delete' | 'merge' | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [impexOpen, setImpexOpen] = useState(false)
  // Source boards to merge into the active board; handed to Canvas to import.
  const [mergeSourceIds, setMergeSourceIds] = useState<string[] | null>(null)

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
  }, [])

  // Remember the active board so a refresh/restart reopens it.
  useEffect(() => {
    if (activeId) localStorage.setItem('foolsboard:activeBoard', activeId)
  }, [activeId])

  const activeBoard = boards.find((b) => b.id === activeId) ?? null

  async function createBoard(name: string) {
    const board = await api.createBoard(name)
    setBoards((b) => [board, ...b])
    setActiveId(board.id)
    setDialog(null)
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

        <BoardSelect boards={boards} activeId={activeId} onSelect={setActiveId} />

        <div className="board-actions">
          <button
            className="icon-btn"
            title="Rename board"
            aria-label="Rename board"
            onClick={() => setDialog('rename')}
            disabled={!activeBoard}
          >
            <PencilIcon />
          </button>
          <button
            className="icon-btn icon-btn--danger"
            title="Delete board"
            aria-label="Delete board"
            onClick={() => setDialog('delete')}
            disabled={!activeBoard}
          >
            <TrashIcon />
          </button>
          <span className="topbar-sep" aria-hidden="true" />
          <button
            className="icon-btn"
            onClick={() => setDialog('new')}
            title="New board"
            aria-label="New board"
          >
            <PlusIcon />
          </button>
          <button
            className="icon-btn"
            onClick={() => setDialog('merge')}
            disabled={boards.length < 2}
            title="Merge other boards into this one"
            aria-label="Merge boards"
          >
            <MergeIcon />
          </button>
          <button
            className="icon-btn"
            onClick={() => setImpexOpen(true)}
            title="Import or export boards"
            aria-label="Import or export boards"
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
            onMergeHandled={() => setMergeSourceIds(null)}
          />
        ) : (
          <div className="loading">Loading…</div>
        )}
      </main>

      {dialog === 'new' && (
        <PromptDialog
          title="Create a new storyboard"
          label="What should we call it?"
          placeholder="e.g. Episode 1: The Fork"
          confirmLabel="Create board"
          onSubmit={createBoard}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === 'rename' && activeBoard && (
        <PromptDialog
          title="Rename storyboard"
          label="New name"
          initialValue={activeBoard.name}
          confirmLabel="Rename"
          onSubmit={renameBoard}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === 'delete' && activeBoard && (
        <TypeToConfirmDialog
          title="Delete storyboard?"
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
          onConfirm={(ids) => {
            setMergeSourceIds(ids)
            setDialog(null)
          }}
          onCancel={() => setDialog(null)}
        />
      )}

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
