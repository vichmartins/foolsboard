// Admin > Storage: reclaim orphaned media — files left in storage that no
// object, thumbnail, or avatar references anymore (e.g. from deletes before the
// cleanup landed). Scanning is a safe read-only dry run; deletion is explicit.
import { useState } from 'react'
import { apiError } from '../api'
import * as api from '../api'
import type { StorageGcResult } from '../api'
import ConfirmDialog from './ConfirmDialog'

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

export default function AdminStorage() {
  const [result, setResult] = useState<StorageGcResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  async function scan() {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      setResult(await api.storageGc(true))
    } catch (e) {
      setError(apiError(e, 'Could not scan storage'))
    } finally {
      setBusy(false)
    }
  }

  async function purge() {
    setConfirm(false)
    setBusy(true)
    setError(null)
    try {
      const r = await api.storageGc(false)
      setDone(`Reclaimed ${r.orphans} file${r.orphans === 1 ? '' : 's'}, freed ${humanBytes(r.freed_bytes)}.`)
      setResult({ ...r, orphans: 0, freed_bytes: 0, sample: [] })
    } catch (e) {
      setError(apiError(e, 'Could not delete orphaned files'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-storage">
      {error && <div className="auth-error">{error}</div>}
      {done && <div className="admin-notice">{done}</div>}
      <p className="admin-storage__intro">
        Find and remove <strong>orphaned media</strong> — files still on disk that no object,
        thumbnail, or avatar references anymore. Scanning is read-only; nothing is deleted until
        you confirm.
      </p>
      <div className="admin-storage__actions">
        <button className="btn btn--primary" disabled={busy} onClick={scan}>
          {busy && !confirm ? 'Scanning…' : 'Scan for orphans'}
        </button>
        {result && result.orphans > 0 && (
          <button
            className="btn admin-action admin-action--delete"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            Delete {result.orphans} file{result.orphans === 1 ? '' : 's'} ({humanBytes(result.freed_bytes)})
          </button>
        )}
      </div>

      {result && (
        <div className="admin-storage__result">
          {result.orphans === 0 ? (
            <p className="admin-storage__clean">✓ No orphaned files — storage is clean.</p>
          ) : (
            <>
              <p>
                <strong>{result.orphans}</strong> orphaned file{result.orphans === 1 ? '' : 's'} ·{' '}
                <strong>{humanBytes(result.freed_bytes)}</strong> reclaimable
              </p>
              {result.sample.length > 0 && (
                <ul className="admin-storage__sample">
                  {result.sample.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                  {result.orphans > result.sample.length && (
                    <li className="admin-storage__more">
                      …and {result.orphans - result.sample.length} more
                    </li>
                  )}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {confirm && result && (
        <ConfirmDialog
          title="Delete orphaned files?"
          message={`${result.orphans} unreferenced file(s) (${humanBytes(result.freed_bytes)}) will be permanently deleted from storage. This cannot be undone.`}
          confirmLabel="Delete files"
          danger
          onConfirm={purge}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  )
}
