// A searchable browser of everything on the current board: objects (nodes),
// media (images/videos/audio/files), reference links, and the connections
// between nodes. Search matches any attribute an item carries. Picking an item
// jumps the canvas to it.
import { useEffect, useMemo, useState } from 'react'
import * as api from '../api'
import Gallery from './Gallery'
import {
  fileExt,
  KIND_COLORS,
  mediaKind,
  nodePreview,
  OBJECT_COLOR,
  typeLabel,
  type Asset,
  type LinkRef,
  type StoryNode,
} from '../types'

export interface GalleryEdge {
  id: string
  source: string
  target: string
  label: string
}

interface Props {
  boardId: string
  nodes: StoryNode[]
  edges: GalleryEdge[]
  onPickNode: (id: string) => void
  onPickEdge: (source: string, target: string) => void
  onClose: () => void
}

type Cat = 'objects' | 'media' | 'links' | 'connections'

// Flatten every string anywhere inside a value so search can match any field.
function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((v) => collectStrings(v, out))
  }
}

function nodeColor(s: StoryNode): string {
  return s.color || (s.type ? KIND_COLORS[s.type] ?? OBJECT_COLOR : OBJECT_COLOR)
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function NodeGallery({
  boardId,
  nodes,
  edges,
  onPickNode,
  onPickEdge,
  onClose,
}: Props) {
  const [cat, setCat] = useState<Cat>('objects')
  const [query, setQuery] = useState('')
  const [assets, setAssets] = useState<Asset[]>([])
  const [loadingMedia, setLoadingMedia] = useState(true)
  // Index into the currently-shown media for the in-place lightbox (null = closed).
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    api
      .listBoardAssets(boardId)
      .then((a) => alive && setAssets(a))
      .finally(() => alive && setLoadingMedia(false))
    return () => {
      alive = false
    }
  }, [boardId])

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const ownerName = (id: string) => nodeById.get(id)?.title || 'Untitled'

  // --- Build each category's searchable rows --------------------------------
  const objectRows = useMemo(
    () =>
      nodes.map((s) => {
        const parts: string[] = [s.type, typeLabel(s.type), s.title]
        collectStrings(s.content, parts)
        return { s, search: parts.join(' ').toLowerCase() }
      }),
    [nodes],
  )

  const mediaRows = useMemo(
    () =>
      assets.map((a) => ({
        a,
        search: `${a.filename} ${a.content_type} ${a.kind} ${ownerName(a.node_id)}`.toLowerCase(),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets, nodeById],
  )

  const linkRows = useMemo(() => {
    const rows: { ref: LinkRef; node: StoryNode; search: string }[] = []
    for (const n of nodes) {
      const refs = n.content?.references
      if (!Array.isArray(refs)) continue
      for (const ref of refs as LinkRef[]) {
        rows.push({
          ref,
          node: n,
          search: `${ref.title ?? ''} ${ref.url} ${n.title}`.toLowerCase(),
        })
      }
    }
    return rows
  }, [nodes])

  const connRows = useMemo(
    () =>
      edges.map((e) => ({
        e,
        search: `${ownerName(e.source)} ${ownerName(e.target)} ${e.label}`.toLowerCase(),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edges, nodeById],
  )

  const q = query.trim().toLowerCase()
  const f = <T extends { search: string }>(rows: T[]) =>
    q ? rows.filter((r) => r.search.includes(q)) : rows

  const tabs: { id: Cat; label: string; count: number }[] = [
    { id: 'objects', label: 'Objects', count: objectRows.length },
    { id: 'media', label: 'Media', count: mediaRows.length },
    { id: 'links', label: 'Links', count: linkRows.length },
    { id: 'connections', label: 'Connections', count: connRows.length },
  ]

  const shownObjects = f(objectRows)
  const shownMedia = f(mediaRows)
  const shownLinks = f(linkRows)
  const shownConns = f(connRows)
  const shownCount =
    cat === 'objects'
      ? shownObjects.length
      : cat === 'media'
        ? shownMedia.length
        : cat === 'links'
          ? shownLinks.length
          : shownConns.length

  const mediaAssets = shownMedia.map((m) => m.a)

  return (
    <>
      <div className="overlay" onMouseDown={onClose}>
        <div className="dialog gallery-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="admin-panel__head">
          <h2 className="dialog__title">Gallery</h2>
          <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="gallery-bar">
          <div className="admin-subtabs gallery-cats">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={'admin-subtab' + (cat === t.id ? ' admin-subtab--active' : '')}
                onClick={() => setCat(t.id)}
              >
                {t.label} <span className="gallery-cat__count">{t.count}</span>
              </button>
            ))}
          </div>
          <input
            className="gallery-search__input"
            type="search"
            autoFocus
            placeholder="Search by any attribute…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="gallery-grid">
          {cat === 'objects' &&
            shownObjects.map(({ s }) => {
              const preview = nodePreview(s.type, s.content)
              return (
                <button
                  key={s.id}
                  className="gallery-item"
                  style={{ '--item-color': nodeColor(s) } as React.CSSProperties}
                  onClick={() => onPickNode(s.id)}
                >
                  <span className="gallery-item__tag">{typeLabel(s.type)}</span>
                  <span className="gallery-item__title">{s.title || 'Untitled'}</span>
                  {preview && <span className="gallery-item__preview">{preview}</span>}
                </button>
              )
            })}

          {cat === 'media' &&
            shownMedia.map(({ a }, i) => {
              const kind = mediaKind(a)
              const thumb = kind === 'image' ? a.url : a.thumbnail_url
              const badge = kind === 'file' ? fileExt(a.filename) || 'FILE' : kind.toUpperCase()
              return (
                <div key={a.id} className="gallery-media">
                  <button
                    type="button"
                    className="gallery-media__open"
                    onClick={() => setLightbox(i)}
                    title={`View ${a.filename}`}
                  >
                    <span className="gallery-media__thumb">
                      {thumb ? (
                        <img src={thumb} loading="lazy" alt="" />
                      ) : (
                        <span className="gallery-media__badge">{badge}</span>
                      )}
                      <span className="gallery-media__kind">{kind}</span>
                    </span>
                    <span className="gallery-media__name">{a.filename}</span>
                  </button>
                  <span className="gallery-media__owner">
                    in
                    <button
                      type="button"
                      className="gallery-media__owner-link"
                      onClick={() => onPickNode(a.node_id)}
                      title={`Go to ${ownerName(a.node_id)}`}
                    >
                      {ownerName(a.node_id)}
                    </button>
                  </span>
                </div>
              )
            })}

          {cat === 'media' && loadingMedia && shownMedia.length === 0 && (
            <p className="gallery-empty">Loading media…</p>
          )}

          {cat === 'links' &&
            shownLinks.map(({ ref, node }, i) => (
              <a
                key={node.id + ':' + i}
                className="gallery-link"
                href={ref.url}
                target="_blank"
                rel="noreferrer noopener"
                title={`Open ${ref.url}`}
              >
                {ref.image ? (
                  <img
                    className="ref-card__img"
                    src={ref.image}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <span className="ref-card__img ref-card__img--blank">🔗</span>
                )}
                <span className="ref-card__body">
                  <span className="ref-card__title">{ref.title || ref.url}</span>
                  {ref.description && <span className="ref-card__desc">{ref.description}</span>}
                  <span className="ref-card__site">
                    {ref.site_name || hostname(ref.url)} · in {node.title || 'Untitled'}
                  </span>
                </span>
              </a>
            ))}

          {cat === 'connections' &&
            shownConns.map(({ e }) => (
              <button
                key={e.id}
                className="gallery-conn"
                onClick={() => onPickEdge(e.source, e.target)}
              >
                <span className="gallery-conn__row">
                  <span className="gallery-conn__node">{ownerName(e.source)}</span>
                  <span className="gallery-conn__arrow">→</span>
                  <span className="gallery-conn__node">{ownerName(e.target)}</span>
                </span>
                {e.label && <span className="gallery-conn__label">{e.label}</span>}
              </button>
            ))}

          {shownCount === 0 && !(cat === 'media' && loadingMedia) && (
            <p className="gallery-empty">
              {query ? 'No matches for your search.' : 'Nothing here yet.'}
            </p>
          )}
          </div>
        </div>
      </div>

      {lightbox !== null && (
        <Gallery
          assets={mediaAssets}
          index={lightbox}
          onIndexChange={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  )
}
