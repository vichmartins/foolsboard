import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  isMediaNodeType,
  KIND_COLORS,
  nodePreview,
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

  // How many nodes are reachable from a node (so the "main" story -- the entry
  // point that leads to the most -- sorts first in the chooser).
  const reachFrom = useCallback(
    (id: string) => {
      const seen = new Set<string>([id])
      const queue = [id]
      while (queue.length) {
        const cur = queue.shift() as string
        for (const c of outgoing.get(cur) ?? []) {
          if (!seen.has(c.to)) {
            seen.add(c.to)
            queue.push(c.to)
          }
        }
      }
      return seen.size
    },
    [outgoing],
  )

  // Candidate starting points: objects that actually lead somewhere. Prefer true
  // beginnings (nothing points at them); fall back to any object with an outgoing
  // connection. Loose objects (standalone media, unconnected notes) are excluded.
  const starts = useMemo(() => {
    const hasIncoming = new Set(edges.map((e) => e.target_id))
    const leadsSomewhere = nodes.filter((n) => (outgoing.get(n.id)?.length ?? 0) > 0)
    const roots = leadsSomewhere.filter((n) => !hasIncoming.has(n.id))
    const pool = roots.length ? roots : leadsSomewhere
    return pool
      .map((n) => ({ n, reach: reachFrom(n.id) }))
      .sort((a, b) => b.reach - a.reach)
      .map((x) => x.n)
  }, [nodes, edges, outgoing, reachFrom])

  // Where we begin: an explicitly-selected object wins; otherwise auto-start only
  // when there's exactly one sensible entry; otherwise show the chooser (null).
  const initialChosen = useMemo<string | null>(() => {
    if (startId && byId.has(startId)) return startId
    return starts.length === 1 ? starts[0].id : null
  }, [startId, starts, byId])

  // A chooser is shown (and reachable via "play again"/back) only when there's a
  // real choice of entry point.
  const canChoose = !startId && starts.length > 1

  const [chosen, setChosen] = useState<string | null>(initialChosen)
  const [current, setCurrent] = useState<string | undefined>(initialChosen ?? undefined)
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    setChosen(initialChosen)
    setCurrent(initialChosen ?? undefined)
    setHistory([])
  }, [initialChosen])

  const begin = useCallback((id: string) => {
    setChosen(id)
    setCurrent(id)
    setHistory([])
  }, [])
  const toChooser = useCallback(() => {
    setChosen(null)
    setCurrent(undefined)
    setHistory([])
  }, [])
  const go = useCallback(
    (to: string) => {
      setHistory((h) => (current ? [...h, current] : h))
      setCurrent(to)
    },
    [current],
  )
  const back = useCallback(() => {
    setHistory((h) => {
      if (!h.length) {
        if (canChoose) toChooser()
        return h
      }
      const copy = h.slice()
      setCurrent(copy.pop())
      return copy
    })
  }, [canChoose, toChooser])

  const node = current ? byId.get(current) : undefined
  const choices = current ? outgoing.get(current) ?? [] : []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (chosen === null) {
        if (/^[1-9]$/.test(e.key)) {
          const pick = starts[Number(e.key) - 1]
          if (pick) {
            e.preventDefault()
            begin(pick.id)
          }
        }
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        if (history.length || canChoose) {
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
  }, [chosen, choices, history.length, canChoose, starts, back, begin, go, onClose])

  const trail = useMemo(
    () =>
      [...history, current]
        .map((id) => (id ? byId.get(id)?.title : undefined))
        .filter((t): t is string => !!t)
        .slice(-4),
    [history, current, byId],
  )

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

      {chosen !== null && trail.length > 1 && (
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
        {chosen === null ? (
          <Chooser starts={starts} onPick={begin} onClose={onClose} />
        ) : !node ? (
          <div className="pt-empty">
            <p>This object no longer exists.</p>
            <button className="pt-btn" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <Scene node={node} choices={choices} onChoose={go} />
        )}
      </div>

      {chosen !== null && node && (
        <div className="pt-foot">
          <div>
            {(history.length > 0 || canChoose) && (
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
            {choices.length === 0 && (
              <button
                className="pt-btn pt-btn--primary"
                onClick={() => (canChoose ? toChooser() : begin(chosen))}
              >
                {canChoose ? 'Choose another start' : 'Play again'}
              </button>
            )}
            {choices.length > 1 && <span className="pt-hint">Pick a path above</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function Chooser({
  starts,
  onPick,
  onClose,
}: {
  starts: StoryNode[]
  onPick: (id: string) => void
  onClose: () => void
}) {
  if (!starts.length) {
    return (
      <div className="pt-empty">
        <p>This board has no connected path to play yet.</p>
        <p className="pt-dim">Link objects together with connections, then press play.</p>
        <button className="pt-btn" onClick={onClose}>
          Close
        </button>
      </div>
    )
  }
  return (
    <div className="pt-card">
      <h2 className="pt-title">Where would you like to start?</h2>
      <p className="pt-dim" style={{ marginTop: '-6px', marginBottom: '6px' }}>
        These objects each begin a path through the board.
      </p>
      <div className="pt-choices">
        {starts.map((n, i) => {
          const preview = nodePreview(n.type, n.content)
          const accent = KIND_COLORS[n.type] ?? 'var(--text-dim)'
          return (
            <button key={n.id} className="pt-choice pt-choice--start" onClick={() => onPick(n.id)}>
              <span className="pt-choice__num">{i + 1}</span>
              <span className="pt-choice__label">
                <span className="pt-choice__top">
                  <span className="pt-tag" style={{ color: accent, borderColor: accent }}>
                    {typeLabel(n.type)}
                  </span>
                  {n.title || 'Untitled'}
                </span>
                {preview && <span className="pt-choice__sub">{preview}</span>}
              </span>
              <span className="pt-choice__arrow">→</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Scene({
  node,
  choices,
  onChoose,
}: {
  node: StoryNode
  choices: Choice[]
  onChoose: (id: string) => void
}) {
  const accent = KIND_COLORS[node.type] ?? 'var(--text-dim)'
  const fields = (TYPE_FIELDS[node.type] ?? [])
    .filter((d) => !d.widget)
    .map((d) => ({ d, v: node.content?.[d.key] }))
    .filter((x): x is { d: (typeof TYPE_FIELDS)[string][number]; v: string } =>
      typeof x.v === 'string' && x.v.trim().length > 0,
    )
  const url =
    isMediaNodeType(node.type) && typeof node.content?.url === 'string'
      ? (node.content.url as string)
      : null

  return (
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
            <button key={i} className="pt-choice" onClick={() => onChoose(c.to)}>
              <span className="pt-choice__num">{i + 1}</span>
              <span className="pt-choice__label">{c.label}</span>
              <span className="pt-choice__arrow">→</span>
            </button>
          ))}
        </div>
      )}
      {choices.length === 0 && <div className="pt-end">The end</div>}
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
