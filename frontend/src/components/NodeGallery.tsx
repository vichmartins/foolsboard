// A searchable browser of everything across the workspace: objects (nodes),
// media, reference links, and connections. A scope selector switches between
// "All boards" and any single board/folder, so you can find and jump to
// anything without first switching boards. Picking an item on the current board
// jumps the canvas to it; picking one on another board opens that board.
import { useEffect, useMemo, useState } from 'react'
import * as api from '../api'
import Gallery from './Gallery'
import Select from './Select'
import {
  fileExt,
  KIND_COLORS,
  mediaKind,
  nodePreview,
  OBJECT_COLOR,
  safeHref,
  typeLabel,
  type Asset,
  type Board,
  type Folder,
  type GalleryBoard,
  type LinkRef,
  type StoryNode,
} from '../types'

interface Props {
  boardId: string
  boards: Board[]
  folders: Folder[]
  onPickNode: (id: string) => void
  onPickEdge: (source: string, target: string) => void
  onOpenBoard: (boardId: string, nodeId?: string) => void
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
  boards,
  folders,
  onPickNode,
  onPickEdge,
  onOpenBoard,
  onClose,
}: Props) {
  const [data, setData] = useState<GalleryBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<string>(boardId) // 'all' | boardId
  const [cat, setCat] = useState<Cat>('objects')
  const [query, setQuery] = useState('')
  const [lightbox, setLightbox] = useState<number | null>(null)

  // Load every accessible board's contents once.
  useEffect(() => {
    let alive = true
    api
      .getGallery()
      .then((g) => alive && setData(g.boards))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const folderName = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders])
  const boardName = useMemo(() => new Map(boards.map((b) => [b.id, b.name])), [boards])
  const nodeById = useMemo(() => {
    const m = new Map<string, StoryNode>()
    for (const b of data) for (const n of b.nodes) m.set(n.id, n)
    return m
  }, [data])
  const ownerName = (id: string) => nodeById.get(id)?.title || 'Untitled'

  const scopedBoards = useMemo(
    () => (scope === 'all' ? data : data.filter((b) => b.id === scope)),
    [data, scope],
  )
  const showBoardTag = scope === 'all'

  // --- Build each category's searchable, board-tagged rows ------------------
  const objectRows = useMemo(() => {
    const rows: { s: StoryNode; bid: string; search: string }[] = []
    for (const b of scopedBoards)
      for (const s of b.nodes) {
        const parts = [s.type, typeLabel(s.type), s.title, b.name]
        collectStrings(s.content, parts)
        rows.push({ s, bid: b.id, search: parts.join(' ').toLowerCase() })
      }
    return rows
  }, [scopedBoards])

  const mediaRows = useMemo(() => {
    const rows: { a: Asset; bid: string; search: string }[] = []
    for (const b of scopedBoards)
      for (const a of b.assets) {
        rows.push({
          a,
          bid: b.id,
          search: `${a.filename} ${a.content_type} ${a.kind} ${ownerName(a.node_id)} ${b.name}`.toLowerCase(),
        })
      }
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedBoards, nodeById])

  const linkRows = useMemo(() => {
    const rows: { ref: LinkRef; node: StoryNode; bid: string; search: string }[] = []
    for (const b of scopedBoards)
      for (const n of b.nodes) {
        const refs = n.content?.references
        if (!Array.isArray(refs)) continue
        for (const ref of refs as LinkRef[]) {
          rows.push({
            ref,
            node: n,
            bid: b.id,
            search: `${ref.title ?? ''} ${ref.url} ${n.title} ${b.name}`.toLowerCase(),
          })
        }
      }
    return rows
  }, [scopedBoards])

  const connRows = useMemo(() => {
    const rows: {
      e: { id: string; source: string; target: string; label: string }
      bid: string
      search: string
    }[] = []
    for (const b of scopedBoards)
      for (const e of b.edges) {
        const conn = { id: e.id, source: e.source_id, target: e.target_id, label: e.label ?? '' }
        rows.push({
          e: conn,
          bid: b.id,
          search: `${ownerName(conn.source)} ${ownerName(conn.target)} ${conn.label} ${b.name}`.toLowerCase(),
        })
      }
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedBoards, nodeById])

  const q = query.trim().toLowerCase()
  const filt = <T extends { search: string }>(rows: T[]) =>
    q ? rows.filter((r) => r.search.includes(q)) : rows

  const tabs: { id: Cat; label: string; count: number }[] = [
    { id: 'objects', label: 'Objects', count: objectRows.length },
    { id: 'media', label: 'Media', count: mediaRows.length },
    { id: 'links', label: 'Links', count: linkRows.length },
    { id: 'connections', label: 'Connections', count: connRows.length },
  ]

  const shownObjects = filt(objectRows)
  const shownMedia = filt(mediaRows)
  const shownLinks = filt(linkRows)
  const shownConns = filt(connRows)
  const shownCount =
    cat === 'objects'
      ? shownObjects.length
      : cat === 'media'
        ? shownMedia.length
        : cat === 'links'
          ? shownLinks.length
          : shownConns.length
  const mediaAssets = shownMedia.map((m) => m.a)

  // Jump within the current board; otherwise open the item's board, targeting
  // the picked node (the source node, for a connection) so it pans there.
  const pickNode = (bid: string, nodeId: string) =>
    bid === boardId ? onPickNode(nodeId) : onOpenBoard(bid, nodeId)
  const pickEdge = (bid: string, s: string, t: string) =>
    bid === boardId ? onPickEdge(s, t) : onOpenBoard(bid, s)

  const scopeOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All boards' }]
    for (const b of boards) {
      const fn = b.folder_id ? folderName.get(b.folder_id) : null
      opts.push({ value: b.id, label: fn ? `${fn} / ${b.name}` : b.name })
    }
    return opts
  }, [boards, folderName])

  const tag = (bid: string) =>
    showBoardTag ? (
      <span className="gallery-board-tag" title={boardName.get(bid) || ''}>
        {boardName.get(bid) || 'Board'}
      </span>
    ) : null

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
            <div className="gallery-scope">
              <Select
                value={scope}
                options={scopeOptions}
                onChange={setScope}
                ariaLabel="Choose which board to browse"
              />
            </div>
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
              shownObjects.map(({ s, bid }) => {
                const preview = nodePreview(s.type, s.content)
                return (
                  <button
                    key={s.id}
                    className="gallery-item"
                    style={{ '--item-color': nodeColor(s) } as React.CSSProperties}
                    onClick={() => pickNode(bid, s.id)}
                  >
                    <span className="gallery-item__tag">{typeLabel(s.type)}</span>
                    <span className="gallery-item__title">{s.title || 'Untitled'}</span>
                    {preview && <span className="gallery-item__preview">{preview}</span>}
                    {tag(bid)}
                  </button>
                )
              })}

            {cat === 'media' &&
              shownMedia.map(({ a, bid }, i) => {
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
                        onClick={() => pickNode(bid, a.node_id)}
                        title={`Go to ${ownerName(a.node_id)}`}
                      >
                        {ownerName(a.node_id)}
                      </button>
                      {tag(bid)}
                    </span>
                  </div>
                )
              })}

            {cat === 'links' &&
              shownLinks.map(({ ref, node, bid }, i) => (
                <a
                  key={node.id + ':' + i}
                  className="gallery-link"
                  href={safeHref(ref.url)}
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
                      {showBoardTag ? ` · ${boardName.get(bid) || ''}` : ''}
                    </span>
                  </span>
                </a>
              ))}

            {cat === 'connections' &&
              shownConns.map(({ e, bid }) => (
                <button
                  key={e.id}
                  className="gallery-conn"
                  onClick={() => pickEdge(bid, e.source, e.target)}
                >
                  <span className="gallery-conn__row">
                    <span className="gallery-conn__node">{ownerName(e.source)}</span>
                    <span className="gallery-conn__arrow">→</span>
                    <span className="gallery-conn__node">{ownerName(e.target)}</span>
                  </span>
                  {e.label && <span className="gallery-conn__label">{e.label}</span>}
                  {tag(bid)}
                </button>
              ))}

            {loading && <p className="gallery-empty">Loading…</p>}
            {!loading && shownCount === 0 && (
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
