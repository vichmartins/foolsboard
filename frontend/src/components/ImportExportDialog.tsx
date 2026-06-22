// Import / Export storyboards as a .zip bundle (board graph + attached media).
// Export the selected boards to a file; import boards from such a bundle via the
// file picker or by dropping it anywhere on the dialog (full-screen drop target).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as api from '../api'
import type { Board, Category, Folder } from '../types'
import { BoardIcon, CategoryIcon, ChevronIcon, FolderIcon } from './icons'

interface Props {
  boards: Board[]
  folders: Folder[]
  categories: Category[]
  orderedTop: string[]
  onClose: () => void
  onImported: (created: Board[]) => void
}

type Tab = 'export' | 'import'

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'board'
}

// Only .zip bundles are importable. Browsers report zip as application/zip or
// application/x-zip-compressed (and sometimes blank), so fall back to extension.
function isZipBundle(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  )
}

// Indeterminate progress bar, shown while exporting or importing.
function ProgressBar() {
  return (
    <div className="impex-progress">
      <div className="impex-progress__bar">
        <div className="impex-progress__fill" />
      </div>
    </div>
  )
}

export default function ImportExportDialog({
  boards,
  folders,
  categories,
  orderedTop,
  onClose,
  onImported,
}: Props) {
  const [tab, setTab] = useState<Tab>('export')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set())
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  // A file is being dragged over the dialog (drives the full-screen drop overlay).
  const [fileDragging, setFileDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const totalSelected = selected.size + selectedFolders.size + selectedCategories.size
  const toggleIn = (setter: typeof setSelected) => (id: string) =>
    setter((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggle = toggleIn(setSelected)
  const toggleFolder = toggleIn(setSelectedFolders)
  const toggleCategory = toggleIn(setSelectedCategories)
  // "Everything" = every category + folder + board selected at once.
  const everythingOn =
    boards.length + folders.length + categories.length > 0 &&
    selected.size === boards.length &&
    selectedFolders.size === folders.length &&
    selectedCategories.size === categories.length
  const toggleEverything = () => {
    if (everythingOn) {
      setSelected(new Set())
      setSelectedFolders(new Set())
      setSelectedCategories(new Set())
    } else {
      setSelected(new Set(boards.map((b) => b.id)))
      setSelectedFolders(new Set(folders.map((f) => f.id)))
      setSelectedCategories(new Set(categories.map((c) => c.id)))
    }
  }
  // --- navigable export tree (mirrors the Merge picker) ---------------------
  const boardById = new Map(boards.map((b) => [b.id, b]))
  const folderById = new Map(folders.map((f) => [f.id, f]))
  const boardsIn = (fid: string) => boards.filter((b) => b.folder_id === fid)
  const toggleOpen = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  function treeRow(
    key: string,
    depth: number,
    icon: ReactNode,
    name: string,
    checked: boolean,
    onToggle: () => void,
    count: number | null,
    expand: { open: boolean; onToggle: () => void } | null,
  ) {
    return (
      <div className="impex-tree__row" key={key} style={{ paddingLeft: depth * 14 }}>
        {expand ? (
          <button
            type="button"
            className={'merge-tree__chev' + (expand.open ? ' merge-tree__chev--open' : '')}
            onClick={expand.onToggle}
            aria-label={expand.open ? 'Collapse' : 'Expand'}
          >
            <ChevronIcon />
          </button>
        ) : (
          <span className="impex-tree__spacer" />
        )}
        <label className="impex-tree__pick">
          <input type="checkbox" checked={checked} onChange={onToggle} />
          <span className="merge-tree__icon">{icon}</span>
          <span className="merge-tree__name">{name}</span>
        </label>
        {count != null && <span className="merge-tree__count">{count}</span>}
      </div>
    )
  }

  const boardRow = (b: Board, depth: number) =>
    treeRow(b.id, depth, <BoardIcon />, b.name, selected.has(b.id), () => toggle(b.id), null, null)

  const folderNode = (f: Folder, depth: number) => {
    const open = !collapsed.has(f.id)
    const inside = boardsIn(f.id)
    return (
      <div key={f.id}>
        {treeRow(f.id, depth, <FolderIcon />, f.name, selectedFolders.has(f.id), () => toggleFolder(f.id), inside.length, { open, onToggle: () => toggleOpen(f.id) })}
        {open && inside.map((b) => boardRow(b, depth + 1))}
      </div>
    )
  }

  const renderItem = (id: string, depth: number) => {
    const f = folderById.get(id)
    if (f) return folderNode(f, depth)
    const b = boardById.get(id)
    if (b) return boardRow(b, depth)
    return null
  }

  const topItems = orderedTop.filter((id) => boardById.has(id) || folderById.has(id))

  function exportFilename(ids: string[], fids: string[]): string {
    if (fids.length === 1 && ids.length === 0) {
      return `${slug(folders.find((f) => f.id === fids[0])?.name ?? 'folder')}.foolsboard.zip`
    }
    if (ids.length === 1 && fids.length === 0) {
      return `${slug(boards.find((b) => b.id === ids[0])?.name ?? 'board')}.foolsboard.zip`
    }
    return 'foolsboard-export.zip'
  }

  async function doExport() {
    if (totalSelected === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const ids = [...selected]
      const fids = [...selectedFolders]
      const cids = [...selectedCategories]
      const blob = await api.exportBoards(ids, fids, cids)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportFilename(ids, fids)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function importFile(file: File) {
    if (!isZipBundle(file)) {
      setResult(null)
      setError('Only .zip bundles exported from foolsboard can be imported.')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const created = await api.importBoards(file)
      setResult(`Imported ${created.length} board${created.length === 1 ? '' : 's'}.`)
      onImported(created)
    } catch (e) {
      setError(api.apiError(e, 'Import failed. Please check the file and try again.'))
    } finally {
      setBusy(false)
    }
  }

  // On the Import tab, make the whole dialog a drop target -- mirroring how
  // dragging media onto the canvas shows a full-screen overlay. The app-level
  // file-drag handler stands down while a modal is open, so there's no clash.
  useEffect(() => {
    if (tab !== 'import') return
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files')
    let depth = 0
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth += 1
      setFileDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault() // required to allow a drop
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setFileDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setFileDragging(false)
      const f = e.dataTransfer?.files?.[0]
      if (f) void importFile(f)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
      setFileDragging(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <div className="overlay" onMouseDown={onClose}>
      {fileDragging && <div className="impex-screen-drop" aria-hidden="true" />}
      <div className="dialog impex" onMouseDown={(e) => e.stopPropagation()}>
        <div className="admin-panel__head">
          <h2 className="dialog__title">Import / Export</h2>
          <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="admin-tabs">
          <button
            className={'admin-tab' + (tab === 'export' ? ' admin-tab--active' : '')}
            onClick={() => setTab('export')}
          >
            Export
          </button>
          <button
            className={'admin-tab' + (tab === 'import' ? ' admin-tab--active' : '')}
            onClick={() => setTab('import')}
          >
            Import
          </button>
        </div>

        <div className="impex__body">
          {error && <div className="auth-error">{error}</div>}

          {tab === 'export' ? (
            <>
              <p className="dialog__text">
                Choose categories, folders, or boards to export to a .zip bundle — graph,
                content, links, and media. Exporting a category or folder includes everything
                inside it.
              </p>
              <label className="impex-all impex-everything">
                <input type="checkbox" checked={everythingOn} onChange={toggleEverything} />
                <span>Everything</span>
              </label>
              <div className="merge-tree impex-tree">
                {topItems.map((id) => renderItem(id, 0))}
                {categories.map((c) => {
                  const open = !collapsed.has(c.id)
                  return (
                    <div key={c.id}>
                      {treeRow(
                        c.id,
                        0,
                        <CategoryIcon />,
                        c.name,
                        selectedCategories.has(c.id),
                        () => toggleCategory(c.id),
                        c.items.length,
                        { open, onToggle: () => toggleOpen(c.id) },
                      )}
                      {open && c.items.map((id) => renderItem(id, 1))}
                    </div>
                  )
                })}
                {topItems.length === 0 && categories.length === 0 && (
                  <p className="impex-tree__empty">Nothing to export yet.</p>
                )}
              </div>
              {busy && <ProgressBar />}
              <div className="dialog__actions">
                <button className="btn" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  disabled={totalSelected === 0 || busy}
                  onClick={() => void doExport()}
                >
                  {busy ? 'Exporting…' : `Export ${totalSelected || ''}`.trim()}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="dialog__text">
                Import a .zip bundle — boards (and any folders or categories they were in) are
                added as new, with their media.
              </p>
              <div
                className={'impex-drop' + (fileDragging ? ' impex-drop--over' : '')}
                onClick={() => fileRef.current?.click()}
              >
                <div className="impex-drop__icon">⬇</div>
                <div className="impex-drop__text">
                  {busy
                    ? 'Importing…'
                    : fileDragging
                      ? 'Drop the bundle to import'
                      : 'Drop a .zip bundle anywhere, or click to browse'}
                </div>
              </div>
              {busy && <ProgressBar />}
              {result && <p className="account-msg">{result}</p>}
              <input
                ref={fileRef}
                type="file"
                accept=".zip,application/zip"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importFile(f)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
