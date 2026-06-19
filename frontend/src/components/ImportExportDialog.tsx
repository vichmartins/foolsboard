// Import / Export storyboards as a .zip bundle (board graph + attached media).
// Export the selected boards to a file; import boards from such a bundle via the
// file picker or by dropping it on the drop zone.
import { useRef, useState } from 'react'
import * as api from '../api'
import type { Board } from '../types'

interface Props {
  boards: Board[]
  onClose: () => void
  onImported: (created: Board[]) => void
}

type Tab = 'export' | 'import'

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'board'
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function ImportExportDialog({ boards, onClose, onImported }: Props) {
  const [tab, setTab] = useState<Tab>('export')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  // Bytes streamed so far during an export (null when not exporting).
  const [exportBytes, setExportBytes] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const allSelected = boards.length > 0 && selected.size === boards.length
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(boards.map((b) => b.id)))

  async function doExport() {
    if (selected.size === 0 || busy) return
    setBusy(true)
    setError(null)
    setExportBytes(0)
    try {
      const ids = [...selected]
      const blob = await api.exportBoards(ids, (loaded) => setExportBytes(loaded))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download =
        ids.length === 1
          ? `${slug(boards.find((b) => b.id === ids[0])?.name ?? 'board')}.foolsboard.zip`
          : `foolsboard-${ids.length}-boards.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed. Please try again.')
    } finally {
      setBusy(false)
      setExportBytes(null)
    }
  }

  async function importFile(file: File) {
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

  return (
    <div className="overlay" onMouseDown={onClose}>
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
                Choose boards to export to a .zip bundle — graph, content, links, and media.
              </p>
              {boards.length > 0 && (
                <label className="impex-all">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  <span>Select all</span>
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
              {exportBytes !== null && (
                <div className="impex-progress">
                  <div className="impex-progress__bar">
                    <div className="impex-progress__fill" />
                  </div>
                  <div className="impex-progress__label">
                    {exportBytes > 0
                      ? `Packaging… ${formatBytes(exportBytes)}`
                      : 'Preparing bundle…'}
                  </div>
                </div>
              )}
              <div className="dialog__actions">
                <button className="btn" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  disabled={selected.size === 0 || busy}
                  onClick={() => void doExport()}
                >
                  {busy ? 'Exporting…' : `Export ${selected.size || ''}`.trim()}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="dialog__text">
                Import boards from a .zip bundle — added as new boards, with their media.
              </p>
              <div
                className={'impex-drop' + (dragging ? ' impex-drop--over' : '')}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragging(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) void importFile(f)
                }}
              >
                <div className="impex-drop__icon">⬇</div>
                <div className="impex-drop__text">
                  {busy ? 'Importing…' : 'Drop a .zip bundle here, or click to browse'}
                </div>
              </div>
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
