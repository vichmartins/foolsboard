import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  isMediaNodeType,
  KIND_COLORS,
  TYPE_FIELDS,
  typeLabel,
  type StoryNode,
} from '../types'

// A connection reduced to what the reader needs: where it goes and its label
// (the label becomes a choice at a branch).
export interface PlayEdge {
  source_id: string
  target_id: string
  label: string | null
}

interface Choice {
  label: string
  to: string
}

// Full-screen "playthrough": walk the board like an interactive story. Each node
// is a scene; its outgoing connections are the choices. A node with no outgoing
// connection is an ending. Read-only -- it never mutates the board.
export default function Playthrough({
  nodes,
  edges,
  startId,
  onClose,
}: {
  nodes: StoryNode[]
  edges: PlayEdge[]
  startId?: string
  onClose: () => void
}) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  // Each node -> its choices (an outgoing connection, labelled by the connection
  // or, when unlabelled, by the destination's title).
  const outgoing = useMemo(() => {
    const m = new Map<string, Choice[]>()
    for (const e of edges) {
      const target = byId.get(e.target_id)
      if (!byId.has(e.source_id) || !target) continue
      const label = (e.label && e.label.trim()) || target.title.trim() || 'Continue'
      const list = m.get(e.source_id) ?? []
      list.push({ label, to: e.target_id })
      m.set(e.source_id, list)
    }
    return m
  }, [edges, byId])

  // Start at the requested node, else the first node with no incoming connection
  // (a natural beginning), else just the first node.
  const initial = useMemo(() => {
    if (startId && byId.has(startId)) return startId
    const hasIncoming = new Set(edges.map((e) => e.target_id))
    const root = nodes.find((n) => !hasIncoming.has(n.id))
    return (root ?? nodes[0])?.id
  }, [startId, nodes, edges, byId])

  const [current, setCurrent] = useState<string | undefined>(initial)
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    setCurrent(initial)
    setHistory([])
  }, [initial])

  const node = current ? byId.get(current) : undefined
  const choices = current ? outgoing.get(current) ?? [] : []

  const go = useCallback(
    (to: string) => {
      setHistory((h) => (current ? [...h, current] : h))
      setCurrent(to)
    },
    [current],
  )
  const back = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h
      const copy = h.slice()
      setCurrent(copy.pop())
      return copy
    })
  }, [])
  const restart = useCallback(() => {
    setCurrent(initial)
    setHistory([])
  }, [initial])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        if (history.length) {
          e.preventDefault()
          back()
        }
        return
      }
      if ((e.key === 'Enter' || e.key === 'ArrowRight') && choices.length === 1) {
        e.preventDefault()
        return go(choices[0].to)
      }
      if (/^[1-9]$/.test(e.key)) {
        const pick = choices[Number(e.key) - 1]
        if (pick) {
          e.preventDefault()
          go(pick.to)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choices, history.length, back, go, onClose])

  const trail = useMemo(
    () =>
      [...history, current]
        .map((id) => (id ? byId.get(id)?.title : undefined))
        .filter((t): t is string => !!t)
        .slice(-4),
    [history, current, byId],
  )

  const accent = node ? KIND_COLORS[node.type] ?? 'var(--text-dim)' : 'var(--text-dim)'
  const fields = node
    ? (TYPE_FIELDS[node.type] ?? [])
        .filter((d) => !d.widget)
        .map((d) => ({ d, v: node.content?.[d.key] }))
        .filter((x): x is { d: (typeof TYPE_FIELDS)[string][number]; v: string } =>
          typeof x.v === 'string' && x.v.trim().length > 0,
        )
    : []
  const url =
    node && isMediaNodeType(node.type) && typeof node.content?.url === 'string'
      ? (node.content.url as string)
      : null

  return (
    <div className="pt-overlay" role="dialog" aria-label="Playthrough">
      <div className="pt-bar">
        <span className="pt-bar__title">
          <PlayGlyph /> Playthrough
        </span>
        <button className="pt-x" onClick={onClose} aria-label="Exit playthrough" title="Exit (Esc)">
          <CloseGlyph />
        </button>
      </div>

      {trail.length > 1 && (
        <div className="pt-path">
          {trail.map((t, i) => (
            <span key={i}>
              {i > 0 && <span className="pt-path__sep">›</span>}
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="pt-stage">
        {!node ? (
          <div className="pt-empty">
            <p>This board has nothing to play yet.</p>
            <button className="pt-btn" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <div className="pt-card">
            <span className="pt-badge" style={{ color: accent, borderColor: accent }}>
              {typeLabel(node.type)}
            </span>
            <h2 className="pt-title">{node.title || 'Untitled'}</h2>
            {url && (
              <a className="pt-link" href={url} target="_blank" rel="noopener noreferrer">
                {url}
              </a>
            )}
            {fields.map(({ d, v }) =>
              d.multiline ? (
                <div key={d.key} className="pt-field">
                  <div className="pt-field__label">{d.label}</div>
                  <p className="pt-field__body">{v}</p>
                </div>
              ) : (
                <div key={d.key} className="pt-meta">
                  <span className="pt-meta__label">{d.label}</span>
                  {v}
                </div>
              ),
            )}
            {!fields.length && !url && <p className="pt-field__body pt-dim">(no details on this object)</p>}

            {choices.length > 1 && (
              <div className="pt-choices">
                {choices.map((c, i) => (
                  <button key={i} className="pt-choice" onClick={() => go(c.to)}>
                    <span className="pt-choice__num">{i + 1}</span>
                    <span className="pt-choice__label">{c.label}</span>
                    <span className="pt-choice__arrow">→</span>
                  </button>
                ))}
              </div>
            )}
            {choices.length === 0 && <div className="pt-end">The end</div>}
          </div>
        )}
      </div>

      <div className="pt-foot">
        <div>
          {history.length > 0 && (
            <button className="pt-btn" onClick={back}>
              ← Back
            </button>
          )}
        </div>
        <div className="pt-foot__right">
          {choices.length === 1 && (
            <button className="pt-btn pt-btn--primary" onClick={() => go(choices[0].to)}>
              Next →
            </button>
          )}
          {node && choices.length === 0 && (
            <button className="pt-btn pt-btn--primary" onClick={restart}>
              Play again
            </button>
          )}
          {choices.length > 1 && <span className="pt-hint">Pick a path above</span>}
        </div>
      </div>
    </div>
  )
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.5-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5z" />
    </svg>
  )
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
