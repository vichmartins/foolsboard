import { useEffect, useState } from 'react'
import * as api from './api'
import Canvas from './components/Canvas'
import ConfirmDialog from './components/ConfirmDialog'
import PromptDialog from './components/PromptDialog'
import type { Board } from './types'
import './App.css'

export default function App() {
  const [boards, setBoards] = useState<Board[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'new' | 'rename' | 'delete' | null>(null)

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
        <div className="brand">fools<span>board</span></div>

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
            onClick={() => setDialog('rename')}
            disabled={!activeBoard}
          >
            ✎
          </button>
          <button
            className="icon-btn icon-btn--danger"
            title="Delete board"
            onClick={() => setDialog('delete')}
            disabled={!activeBoard}
          >
            🗑
          </button>
        </div>

        <button className="btn" onClick={() => setDialog('new')}>+ New board</button>

        <span className="hint">
          Right-click canvas to add · drag handles to link · right-click a link to edit · Del to remove
        </span>
      </header>

      <main className="stage">
        {activeId ? (
          <Canvas key={activeId} boardId={activeId} />
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
        <ConfirmDialog
          title="Delete storyboard?"
          message={`"${activeBoard.name}" and all of its objects, links, and media will be permanently deleted. This can't be undone.`}
          confirmLabel="Delete board"
          danger
          onConfirm={deleteBoard}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  )
}
