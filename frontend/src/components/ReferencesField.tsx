// Reference links with rich previews (WhatsApp/Telegram style). Paste a URL and
// the backend fetches its Open Graph / meta tags; each link renders as a card.
import { useState } from 'react'
import { fetchLinkPreview } from '../api'
import { safeHref, type LinkRef } from '../types'

interface Props {
  value: unknown
  onChange: (refs: LinkRef[]) => void
}

function toRefs(value: unknown): LinkRef[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (r): r is LinkRef => !!r && typeof (r as LinkRef).url === 'string',
  )
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

export default function ReferencesField({ value, onChange }: Props) {
  const refs = toRefs(value)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  async function add() {
    const u = normalizeUrl(url)
    if (!u || loading) return
    setLoading(true)
    try {
      const meta = await fetchLinkPreview(u)
      onChange([...refs, meta])
    } catch {
      onChange([...refs, { url: u }]) // keep the bare link if preview fails
    } finally {
      setLoading(false)
      setUrl('')
    }
  }

  const remove = (i: number) => onChange(refs.filter((_, j) => j !== i))

  return (
    <div className="refs">
      <div className="refs__add">
        <input
          className="refs__input"
          type="url"
          inputMode="url"
          placeholder="Paste a link…"
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
          aria-label="Add link"
          title="Add link"
        >
          {loading ? '…' : '+'}
        </button>
      </div>

      {refs.length > 0 && (
        <div className="refs__list">
          {refs.map((r, i) => (
            <div className="ref-card" key={i}>
              <a
                className="ref-card__link"
                href={safeHref(r.url)}
                target="_blank"
                rel="noreferrer noopener"
              >
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
                  <span className="ref-card__img ref-card__img--blank">🔗</span>
                )}
                <span className="ref-card__body">
                  <span className="ref-card__title">{r.title || r.url}</span>
                  {r.description && <span className="ref-card__desc">{r.description}</span>}
                  <span className="ref-card__site">{r.site_name || hostname(r.url)}</span>
                </span>
              </a>
              <button
                type="button"
                className="icon-btn ref-card__remove"
                onClick={() => remove(i)}
                aria-label="Remove link"
                title="Remove"
              >
                −
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
