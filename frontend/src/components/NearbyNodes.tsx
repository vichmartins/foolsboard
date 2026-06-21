// Browse the galleries of nearby nodes (linked or spatially close) from inside
// the drawer, select media files and/or reference links, and pull them into the
// node being edited (media -> Media via dedup, links -> References).
import { useState } from 'react'
import { listAssets } from '../api'
import { fileExt, KIND_COLORS, mediaKind } from '../types'
import type { Asset, LinkRef, NearbyNode } from '../types'
import { makeMatcher } from '../search'

interface Props {
  nodes: NearbyNode[]
  onAddMedia: (assetIds: string[]) => Promise<void>
  onAddLinks: (links: LinkRef[]) => void
}

export default function NearbyNodes({ nodes, onAddMedia, onAddLinks }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [mediaByNode, setMediaByNode] = useState<Record<string, Asset[]>>({})
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [selMedia, setSelMedia] = useState<Set<string>>(new Set())
  const [selLinks, setSelLinks] = useState<Record<string, LinkRef>>({})
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(() => Math.min(10, nodes.length))

  // Search (regex-capable) filters across all nodes by their text; otherwise show
  // the closest `limit` (slider) of the ranked list.
  const trimmed = query.trim()
  const match = makeMatcher(trimmed)
  const shown = trimmed ? nodes.filter((n) => match(n.search)) : nodes.slice(0, limit)
  const sliderMax = Math.max(1, nodes.length)
  const sliderVal = Math.min(limit, sliderMax)

  async function toggleOpen(id: string) {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    if (!(id in mediaByNode)) {
      setLoading((s) => new Set(s).add(id))
      try {
        const assets = await listAssets(id)
        setMediaByNode((m) => ({ ...m, [id]: assets }))
      } catch {
        setMediaByNode((m) => ({ ...m, [id]: [] }))
      } finally {
        setLoading((s) => {
          const n = new Set(s)
          n.delete(id)
          return n
        })
      }
    }
  }

  const toggleMedia = (id: string) =>
    setSelMedia((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const toggleLink = (ref: LinkRef) =>
    setSelLinks((m) => {
      const n = { ...m }
      if (n[ref.url]) delete n[ref.url]
      else n[ref.url] = ref
      return n
    })

  const selectedCount = selMedia.size + Object.keys(selLinks).length

  async function add() {
    if (!selectedCount || busy) return
    setBusy(true)
    try {
      const ids = [...selMedia]
      if (ids.length) await onAddMedia(ids)
      const links = Object.values(selLinks)
      if (links.length) onAddLinks(links)
      setSelMedia(new Set())
      setSelLinks({})
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="nearby">
      <div className="nearby__controls">
        <input
          className="nearby__search"
          type="search"
          placeholder="Search nodes…"
          title="Supports regular expressions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="nearby__slider" title="How many nearby nodes to show">
          <input
            type="range"
            min={1}
            max={sliderMax}
            value={sliderVal}
            disabled={!!trimmed}
            aria-label="Number of nearby nodes to show"
            onChange={(e) => setLimit(Number(e.target.value))}
          />
          <span className="nearby__slider-val">{trimmed ? `${shown.length}` : sliderVal}</span>
        </div>
      </div>
      <div className="nearby__list">
        {shown.length === 0 && (
          <p className="nearby-node__empty">No matching nodes</p>
        )}
        {shown.map((n) => {
          const open = openId === n.id
          const media = mediaByNode[n.id] ?? []
          const isLoading = loading.has(n.id)
          return (
            <div className="nearby-node" key={n.id}>
              <button
                type="button"
                className="nearby-node__head"
                onClick={() => toggleOpen(n.id)}
              >
                <span className="nearby-node__chevron">{open ? '▾' : '▸'}</span>
                <span
                  className="nearby-node__tag"
                  style={{ background: KIND_COLORS[n.type] ?? KIND_COLORS.note }}
                >
                  {n.type}
                </span>
                <span className="nearby-node__title" title={n.title}>
                  {n.title || 'Untitled'}
                </span>
                {n.connected && <span className="nearby-node__linked">linked</span>}
              </button>

              {open && (
                <div className="nearby-node__body">
                  {isLoading && <p className="nearby-node__empty">Loading…</p>}
                  {!isLoading && media.length === 0 && n.references.length === 0 && (
                    <p className="nearby-node__empty">No media or references</p>
                  )}

                  {media.length > 0 && (
                    <div className="nearby-grid">
                      {media.map((a) => {
                        const k = mediaKind(a)
                        const sel = selMedia.has(a.id)
                        const thumb = a.thumbnail_url ?? (k === 'image' ? a.url : null)
                        return (
                          <button
                            type="button"
                            key={a.id}
                            className={
                              'nearby-tile' + (sel ? ' nearby-tile--selected' : '')
                            }
                            onClick={() => toggleMedia(a.id)}
                            title={a.filename}
                          >
                            {thumb ? (
                              <img
                                className="nearby-tile__img"
                                src={thumb}
                                alt=""
                                loading="lazy"
                              />
                            ) : (
                              <span className="nearby-tile__ph">
                                {k === 'audio' ? '♪' : fileExt(a.filename) || 'FILE'}
                              </span>
                            )}
                            {k === 'video' && <span className="nearby-tile__badge">▶</span>}
                            {sel && <span className="nearby-tile__check">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {n.references.length > 0 && (
                    <div className="nearby-refs">
                      {n.references.map((r, i) => {
                        const sel = !!selLinks[r.url]
                        return (
                          <button
                            type="button"
                            key={r.url + i}
                            className={'nearby-ref' + (sel ? ' nearby-ref--selected' : '')}
                            onClick={() => toggleLink(r)}
                            title={r.url}
                          >
                            {r.image ? (
                              <img
                                className="nearby-ref__img"
                                src={r.image}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            ) : (
                              <span className="nearby-ref__img nearby-ref__img--blank">🔗</span>
                            )}
                            <span className="nearby-ref__title">{r.title || r.url}</span>
                            {sel && <span className="nearby-ref__check">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selectedCount > 0 && (
        <button
          type="button"
          className="btn btn--primary nearby__add"
          onClick={() => void add()}
          disabled={busy}
        >
          {busy ? 'Adding…' : `Add ${selectedCount} to this node`}
        </button>
      )}
    </div>
  )
}
