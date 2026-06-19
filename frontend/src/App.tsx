import { useEffect, useState } from 'react'
import * as api from './api'
import BrandMenu from './components/BrandMenu'
import Canvas from './components/Canvas'
import PromptDialog from './components/PromptDialog'
import MergeDialog from './components/MergeDialog'
import TypeToConfirmDialog from './components/TypeToConfirmDialog'
import ThemeToggle from './components/ThemeToggle'
import { PencilIcon, TrashIcon } from './components/icons'
import type { Board } from './types'
import './App.css'

export default function App() {
  const [boards, setBoards] = useState<Board[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'new' | 'rename' | 'delete' | 'merge' | null>(null)
  // Source boards to merge into the active board; handed to Canvas to import.
  const [mergeSourceIds, setMergeSourceIds] = useState<string[] | null>(null)

  // Load boards; bootstrap a first board if the workspace is empty.
  useEffect(() => {
    api.listBoards().then(async (list) => {
      if (list.length === 0) {
        const first = await api.createBoard('My first storyboard')
        list = [first]
      }
      setBoards(list)
      setActiveId(list[0].id)
    })
  }, [])

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

        <select
          className="board-select"
          value={activeId ?? ''}
          onChange={(e) => setActiveId(e.target.value)}
        >
          {boards.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

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
        </div>

        <button className="btn" onClick={() => setDialog('new')}>+ New board</button>
        <button
          className="btn"
          onClick={() => setDialog('merge')}
          disabled={boards.length < 2}
          title="Merge other boards into this one"
        >
          Merge…
        </button>

        <span className="hint">
          Right-click canvas to add · drag handles to link · right-click a link to edit · Del to remove
        </span>

        <ThemeToggle />
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
    </div>
  )
}
