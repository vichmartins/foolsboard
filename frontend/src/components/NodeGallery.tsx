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
  downloadAsset,
  isMediaNodeType,
  nodePreview,
  OBJECT_COLOR,
  safeHref,
  setAssetDragData,
  typeLabel,
  type Asset,
  type Board,
  type Category,
  type Folder,
  type GalleryBoard,
  type LinkRef,
  type StoryNode,
} from '../types'
import { makeMatcher } from '../search'

interface Props {
  boardId: string
  boards: Board[]
  folders: Folder[]
  categories: Category[]
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
  categories,
  onPickNode,
  onPickEdge,
  onOpenBoard,
  onClose,
}: Props) {
  const [data, setData] = useState<GalleryBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<string>(boardId) // 'all' | boardId
  const [catScope, setCatScope] = useState<string>('') // '' (none) | categoryId
  const [folderScope, setFolderScope] = useState<string>('') // '' (none) | folderId
  const [cat, setCat] = useState<Cat>('objects')
  const [query, setQuery] = useState('')
  const [lightbox, setLightbox] = useState<number | null>(null)
  // While dragging a media tile to the canvas, fade the gallery and let pointers
  // through so the drop lands on the board behind it.
  const [dragging, setDragging] = useState(false)
  // Inline rename of a media tile. `renames` overrides the shown filename so we
  // don't have to refetch the whole gallery after renaming one asset.
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [renames, setRenames] = useState<Record<string, string>>({})
  const displayName = (a: Asset) => renames[a.id] ?? a.filename
  function startRename(a: Asset) {
    const name = displayName(a)
    const dot = name.lastIndexOf('.')
    setRenameVal(dot > 0 ? name.slice(0, dot) : name)
    setRenamingId(a.id)
  }
  async function submitRename(a: Asset) {
    const v = renameVal.trim()
    setRenamingId(null)
    if (!v) return
    try {
      const updated = await api.renameAsset(a.node_id, a.id, v)
      setRenames((r) => ({ ...r, [a.id]: updated.filename }))
    } catch {
      /* ignore */
    }
  }

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

  // Board ids that match the category + folder narrowing (the pool the board
  // picker chooses from). With neither filter set we keep the pool to just the
  // active board, so the picker isn't a dump of every board in the workspace.
  const filterBoardIds = useMemo(() => {
    if (!catScope && !folderScope) return new Set([boardId])
    let bs = boards
    if (catScope) {
      const cat = categories.find((c) => c.id === catScope)
      const catFolderIds = new Set(
        (cat?.items ?? []).filter((id) => folders.some((f) => f.id === id)),
      )
      const ids = new Set<string>([
        ...(cat?.items ?? []).filter((id) => boards.some((b) => b.id === id)),
        ...boards.filter((b) => b.folder_id && catFolderIds.has(b.folder_id)).map((b) => b.id),
      ])
      bs = bs.filter((b) => ids.has(b.id))
    }
    if (folderScope) bs = bs.filter((b) => b.folder_id === folderScope)
    return new Set(bs.map((b) => b.id))
  }, [boards, folders, categories, catScope, folderScope, boardId])

  const scopedBoards = useMemo(
    () =>
      scope === 'all'
        ? data.filter((b) => filterBoardIds.has(b.id))
        : data.filter((b) => b.id === scope),
    [data, scope, filterBoardIds],
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

  const trimmed = query.trim()
  const match = makeMatcher(trimmed)
  const filt = <T extends { search: string }>(rows: T[]) =>
    trimmed ? rows.filter((r) => match(r.search)) : rows

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
  const mediaAssets = shownMedia.map((m) =>
    renames[m.a.id] ? { ...m.a, filename: renames[m.a.id] } : m.a,
  )

  // Jump within the current board; otherwise open the item's board, targeting
  // the picked node (the source node, for a connection) so it pans there.
  const pickNode = (bid: string, nodeId: string) =>
    bid === boardId ? onPickNode(nodeId) : onOpenBoard(bid, nodeId)
  const pickEdge = (bid: string, s: string, t: string) =>
    bid === boardId ? onPickEdge(s, t) : onOpenBoard(bid, s)

  const catOptions = useMemo(
    () => [{ value: '', label: 'Category…' }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
    [categories],
  )
  // Folder options narrow to the chosen category (its folders) when one is set.
  const folderOptions = useMemo(() => {
    let fs = folders
    if (catScope) {
      const cat = categories.find((c) => c.id === catScope)
      const ids = new Set((cat?.items ?? []).filter((id) => folders.some((f) => f.id === id)))
      fs = fs.filter((f) => ids.has(f.id))
    }
    return [{ value: '', label: 'Folder…' }, ...fs.map((f) => ({ value: f.id, label: f.name }))]
  }, [folders, categories, catScope])
  const scopeOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All boards' }]
    for (const b of boards) {
      if (!filterBoardIds.has(b.id)) continue
      const fn = b.folder_id ? folderName.get(b.folder_id) : null
      opts.push({ value: b.id, label: fn ? `${fn} / ${b.name}` : b.name })
    }
    return opts
  }, [boards, folderName, filterBoardIds])

  const tag = (bid: string) =>
    showBoardTag ? (
      <span className="gallery-board-tag" title={boardName.get(bid) || ''}>
        {boardName.get(bid) || 'Board'}
      </span>
    ) : null

  return (
    <>
      <div className={'overlay' + (dragging ? ' overlay--drag' : '')} onMouseDown={onClose}>
        <div className="dialog gallery-dialog" onMouseDown={(e) => e.stopPropagation()}>
          <div className="admin-panel__head">
            <h2 className="dialog__title">Gallery</h2>
            <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close">
              ✕
            </button>
          </div>

          <div className="gallery-bar">
            <div className="gallery-scopes">
              {categories.length > 0 && (
                <div className="gallery-scope">
                  <Select
                    value={catScope}
                    options={catOptions}
                    onChange={(v) => {
                      setCatScope(v)
                      setFolderScope('')
                      setScope('all')
                    }}
                    ariaLabel="Filter by category"
                  />
                </div>
              )}
              {folderOptions.length > 1 && (
                <div className="gallery-scope">
                  <Select
                    value={folderScope}
                    options={folderOptions}
                    onChange={(v) => {
                      setFolderScope(v)
                      setScope('all')
                    }}
                    ariaLabel="Filter by folder"
                  />
                </div>
              )}
              <div className="gallery-scope">
                <Select
                  value={scope}
                  options={scopeOptions}
                  onChange={setScope}
                  ariaLabel="Choose which board to browse"
                />
              </div>
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
              title="Supports regular expressions"
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
                    {a.url && (
                      <button
                        type="button"
                        className="gallery-media__dl"
                        title="Download"
                        aria-label="Download"
                        onClick={() => downloadAsset({ url: a.url, filename: displayName(a) })}
                      >
                        ⬇
                      </button>
                    )}
                    <button
                      type="button"
                      className="gallery-media__open"
                      onClick={() => setLightbox(i)}
                      draggable
                      onDragStart={(e) => {
                        setAssetDragData(e.dataTransfer, a)
                        setDragging(true)
                      }}
                      onDragEnd={() => {
                        setDragging(false)
                        onClose()
                      }}
                      title={`View ${a.filename} · drag onto the canvas to place it`}
                    >
                      <span className="gallery-media__thumb">
                        {thumb ? (
                          <img src={thumb} loading="lazy" alt="" />
                        ) : (
                          <span className="gallery-media__badge">{badge}</span>
                        )}
                        <span className="gallery-media__kind">{kind}</span>
                      </span>
                    </button>
                    {renamingId === a.id ? (
                      <input
                        className="gallery-media__name gallery-media__name--edit"
                        autoFocus
                        value={renameVal}
                        onChange={(e) => setRenameVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void submitRename(a)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onBlur={() => void submitRename(a)}
                      />
                    ) : (
                      <span
                        className="gallery-media__name"
                        title="Double-click to rename"
                        onDoubleClick={() => startRename(a)}
                      >
                        {displayName(a)}
                      </span>
                    )}
                    {isMediaNodeType(nodeById.get(a.node_id)?.type) ? (
                      // Standalone media placed straight on a board (not inside an
                      // object): show which board it lives on.
                      <span className="gallery-media__owner">
                        on
                        <button
                          type="button"
                          className="gallery-media__owner-link"
                          onClick={() => pickNode(bid, a.node_id)}
                          title={`Go to ${boardName.get(bid) || 'board'}`}
                        >
                          {boardName.get(bid) || 'Board'}
                        </button>
                      </span>
                    ) : (
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
                    )}
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
