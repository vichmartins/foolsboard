import { useEffect, useState } from 'react'
import * as api from './api'
import Canvas from './components/Canvas'
import type { Board } from './types'
import './App.css'

export default function App() {
  const [boards, setBoards] = useState<Board[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

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

  async function newBoard() {
    const name = window.prompt('Name your storyboard:')
    if (!name) return
    const board = await api.createBoard(name)
    setBoards((b) => [board, ...b])
    setActiveId(board.id)
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
        <button className="btn" onClick={newBoard}>+ New board</button>
        <span className="hint">
          Right-click canvas to add · drag handles to link · Del to remove
        </span>
      </header>

      <main className="stage">
        {activeId ? (
          <Canvas key={activeId} boardId={activeId} />
        ) : (
          <div className="loading">Loading…</div>
        )}
      </main>
    </div>
  )
}
