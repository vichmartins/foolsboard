// Timestamps: YouTube (or any) links that point at a specific moment via a ?t=
// parameter. Like References, we fetch a rich preview; we also parse the time out
// of the URL and show it as a badge. A universal field, on every object type.
import { useState } from 'react'
import { fetchLinkPreview } from '../api'
import { safeHref, type LinkRef } from '../types'

interface Props {
  value: unknown
  onChange: (stamps: LinkRef[]) => void
}

function toStamps(value: unknown): LinkRef[] {
  if (!Array.isArray(value)) return []
  return value.filter((r): r is LinkRef => !!r && typeof (r as LinkRef).url === 'string')
}

function normalizeUrl(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  return /^https?:\/\//i.test(s) ? s : 'https://' + s
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Seconds the link points to, from ?t= / &start= (plain seconds or 1h2m3s).
function parseTime(url: string): number | null {
  let t: string | null = null
  try {
    const u = new URL(url)
    t = u.searchParams.get('t') ?? u.searchParams.get('start')
  } catch {
    return null
  }
  if (!t) return null
  if (/^\d+$/.test(t)) return Number(t)
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t)
  if (!m) return null
  const total = (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + +(m[3] || 0)
  return total || null
}

function fmt(sec: number): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`
}

export default function TimestampsField({ value, onChange }: Props) {
  const stamps = toStamps(value)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  async function add() {
    const u = normalizeUrl(url)
    if (!u || loading) return
    setLoading(true)
    try {
      const meta = await fetchLinkPreview(u)
      // Keep the URL the user pasted (preview may canonicalize away the ?t=).
      onChange([...stamps, { ...meta, url: u }])
    } catch {
      onChange([...stamps, { url: u }])
    } finally {
      setLoading(false)
      setUrl('')
    }
  }

  const remove = (i: number) => onChange(stamps.filter((_, j) => j !== i))

  return (
    <div className="refs">
      <div className="refs__add">
        <input
          className="refs__input"
          type="url"
          inputMode="url"
          placeholder="Paste a YouTube link (with a time)…"
          value={url}
          disabled={loading}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void add()
            }
          }}
        />
        <button
          type="button"
          className="icon-btn"
          onClick={() => void add()}
          disabled={loading || !url.trim()}
          aria-label="Add timestamp"
          title="Add timestamp"
        >
          {loading ? '…' : '+'}
        </button>
      </div>

      {stamps.length > 0 && (
        <div className="refs__list">
          {stamps.map((r, i) => {
            const t = parseTime(r.url)
            return (
              <div className="ref-card" key={i}>
                <a
                  className="ref-card__link"
                  href={safeHref(r.url)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span className="ref-card__thumb">
                    {r.image ? (
                      <img
                        className="ref-card__img"
                        src={r.image}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <span className="ref-card__img ref-card__img--blank">▶</span>
                    )}
                    {t != null && <span className="stamp-time">{fmt(t)}</span>}
                  </span>
                  <span className="ref-card__body">
                    <span className="ref-card__title">{r.title || r.url}</span>
                    {r.description && <span className="ref-card__desc">{r.description}</span>}
                    <span className="ref-card__site">
                      {t != null ? `▶ at ${fmt(t)} · ` : ''}
                      {r.site_name || hostname(r.url)}
                    </span>
                  </span>
                </a>
                <button
                  type="button"
                  className="icon-btn ref-card__remove"
                  onClick={() => remove(i)}
                  aria-label="Remove timestamp"
                  title="Remove"
                >
                  −
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
