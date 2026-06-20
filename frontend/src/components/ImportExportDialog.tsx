// Import / Export storyboards as a .zip bundle (board graph + attached media).
// Export the selected boards to a file; import boards from such a bundle via the
// file picker or by dropping it anywhere on the dialog (full-screen drop target).
import { useEffect, useRef, useState } from 'react'
import * as api from '../api'
import type { Board, Folder } from '../types'

interface Props {
  boards: Board[]
  folders: Folder[]
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

export default function ImportExportDialog({ boards, folders, onClose, onImported }: Props) {
  const [tab, setTab] = useState<Tab>('export')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  // A file is being dragged over the dialog (drives the full-screen drop overlay).
  const [fileDragging, setFileDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const allSelected = boards.length > 0 && selected.size === boards.length
  const totalSelected = selected.size + selectedFolders.size
  const toggleIn = (setter: typeof setSelected) => (id: string) =>
    setter((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggle = toggleIn(setSelected)
  const toggleFolder = toggleIn(setSelectedFolders)
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(boards.map((b) => b.id)))

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
      const blob = await api.exportBoards(ids, fids)
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
                Choose folders or boards to export to a .zip bundle — graph, content, links,
                and media. Exporting a folder includes every board inside it.
              </p>
              {folders.length > 0 && (
                <>
                  <div className="impex-group">Folders</div>
                  <ul className="impex-list">
                    {folders.map((f) => {
                      const count = boards.filter((b) => b.folder_id === f.id).length
                      return (
                        <li key={f.id}>
                          <label className="impex-item">
                            <input
                              type="checkbox"
                              checked={selectedFolders.has(f.id)}
                              onChange={() => toggleFolder(f.id)}
                            />
                            <span className="impex-item__name">🗀 {f.name}</span>
                            <span className="impex-item__count">
                              {count} board{count === 1 ? '' : 's'}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="impex-group">Boards</div>
                </>
              )}
              {boards.length > 0 && (
                <label className="impex-all">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  <span>Select all boards</span>
                </label>
              )}
              <ul className="impex-list">
                {boards.map((b) => (
                  <li key={b.id}>
                    <label className="impex-item">
                      <input
                        type="checkbox"
                        checked={selected.has(b.id)}
                        onChange={() => toggle(b.id)}
                      />
                      <span className="impex-item__name">{b.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
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
                Import a .zip bundle — boards (and any folders they were in) are added as new,
                with their media.
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
