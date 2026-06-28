import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  isMediaNodeType,
  KIND_COLORS,
  nodePreview,
  safeHref,
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

  // Undirected adjacency: connections are two-way, so each object knows every
  // object it's linked to, with the connection's label (or the neighbour's title
  // when the connection is unlabelled). Self-links are ignored.
  const neighbors = useMemo(() => {
    const m = new Map<string, Choice[]>()
    const add = (from: string, to: string, label: string) => {
      const list = m.get(from) ?? []
      if (!list.some((c) => c.to === to)) list.push({ to, label })
      m.set(from, list)
    }
    for (const e of edges) {
      if (e.source_id === e.target_id) continue
      const s = byId.get(e.source_id)
      const t = byId.get(e.target_id)
      if (!s || !t) continue
      const lbl = e.label && e.label.trim()
      add(e.source_id, e.target_id, lbl || t.title.trim() || 'Continue')
      add(e.target_id, e.source_id, lbl || s.title.trim() || 'Continue')
    }
    return m
  }, [edges, byId])

  // Any connected object can be a starting point (most-connected first, then
  // alphabetical). Loose objects with no connections are excluded.
  const starts = useMemo(
    () =>
      nodes
        .filter((n) => (neighbors.get(n.id)?.length ?? 0) > 0)
        .sort(
          (a, b) =>
            (neighbors.get(b.id)?.length ?? 0) - (neighbors.get(a.id)?.length ?? 0) ||
            a.title.localeCompare(b.title),
        ),
    [nodes, neighbors],
  )

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
  // Choices are every neighbour except the one we just came from (so you don't
  // simply bounce back). No remaining neighbour = an ending.
  const prev = history.length ? history[history.length - 1] : undefined
  const choices = current ? (neighbors.get(current) ?? []).filter((c) => c.to !== prev) : []

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
        Pick any connected object to begin reading from.
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
  const media = isMediaNodeType(node.type)
  const fields = (TYPE_FIELDS[node.type] ?? [])
    .filter((d) => !d.widget)
    .map((d) => ({ d, v: node.content?.[d.key] }))
    .filter((x): x is { d: (typeof TYPE_FIELDS)[string][number]; v: string } =>
      typeof x.v === 'string' && x.v.trim().length > 0,
    )

  return (
    <div className="pt-card">
      <span className="pt-badge" style={{ color: accent, borderColor: accent }}>
        {typeLabel(node.type)}
      </span>
      <h2 className="pt-title">{node.title || 'Untitled'}</h2>

      {media ? (
        <MediaBlock node={node} />
      ) : (
        <>
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
          {!fields.length && (
            <p className="pt-field__body pt-dim">(no details on this object)</p>
          )}
        </>
      )}

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

// Render a media/link object inline (image, video, audio player, file, or a link
// preview) -- everything needed lives in the node's content, like MediaNodeCard.
function MediaBlock({ node }: { node: StoryNode }) {
  const c = node.content ?? {}
  const str = (k: string) => (typeof c[k] === 'string' ? (c[k] as string) : '')
  const url = str('url')

  if (node.type === 'link') {
    if (!url) return <p className="pt-field__body pt-dim">(empty link)</p>
    const image = str('image')
    return (
      <a className="pt-link-card" href={safeHref(url)} target="_blank" rel="noreferrer noopener">
        {image && (
          <img
            className="pt-link-card__img"
            src={image}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        )}
        <span className="pt-link-card__body">
          <span className="pt-link-card__title">{str('title') || url}</span>
          <span className="pt-link-card__site">{str('site_name') || url}</span>
        </span>
      </a>
    )
  }

  if (!url) return <p className="pt-field__body pt-dim">(media not available)</p>
  const mk = str('mediaKind') || 'file'
  const thumb = str('thumbnailUrl')
  const filename = str('filename') || node.title || 'file'

  if (mk === 'image') return <img className="pt-media-img" src={url} alt={filename} />
  if (mk === 'video')
    return (
      <video className="pt-media-video" src={url} poster={thumb || undefined} controls preload="metadata" />
    )
  if (mk === 'audio')
    return (
      <div className="pt-media-audio">
        {thumb && <img className="pt-media-audio__cover" src={thumb} alt="" />}
        <audio src={url} controls preload="metadata" />
      </div>
    )
  return (
    <a
      className="pt-media-file"
      href={safeHref(url)}
      target="_blank"
      rel="noreferrer noopener"
      download={filename}
    >
      <span className="pt-media-file__icon">↓</span>
      {filename}
    </a>
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
