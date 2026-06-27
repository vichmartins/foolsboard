// "What's New" dialog, shown once after the app updates to a new version. The
// repo CHANGELOG is baked into the bundle at build time (__CHANGELOG__); we parse
// it into releases, classify each line (feat / fix / improve) by its prefix, and
// render a matching icon. Releases are listed newest-first, scrollable.
import { useMemo } from 'react'

interface Release {
  version: string
  bullets: string[]
}

function parseChangelog(raw: string): Release[] {
  const releases: Release[] = []
  let cur: Release | null = null
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trimEnd()
    const head = /^##\s+(.+)$/.exec(line)
    if (head) {
      cur = { version: head[1].trim(), bullets: [] }
      releases.push(cur)
      continue
    }
    if (!cur) continue
    const bullet = /^[-*]\s+(.+)$/.exec(line.trim())
    if (bullet) cur.bullets.push(bullet[1].trim())
    else if (line.trim() && cur.bullets.length) {
      // A wrapped continuation line of the previous bullet.
      cur.bullets[cur.bullets.length - 1] += ' ' + line.trim()
    }
  }
  return releases.filter((r) => r.bullets.length > 0)
}

function FeatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.7 4.9 4.8 1.7-4.8 1.7L12 15.2l-1.7-4.9L5.5 8.6l4.8-1.7z" />
      <path d="M18.6 13.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </svg>
  )
}
function FixIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="6" width="8" height="13" rx="4" />
      <path d="M9 6V5a3 3 0 0 1 6 0v1" />
      <path d="M8 11H4m16 0h-4M8 16H4.5m15 0H16M7.5 8 5 6m11.5 2L19 6M7.5 19 5 21m11.5-2L19 21" />
    </svg>
  )
}
function ImproveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="15 7 21 7 21 13" />
    </svg>
  )
}
function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  )
}

const CATS = {
  feat: { Icon: FeatIcon, color: '#10b981', label: 'New' },
  fix: { Icon: FixIcon, color: '#f59e0b', label: 'Fix' },
  improve: { Icon: ImproveIcon, color: '#3b82f6', label: 'Improved' },
  note: { Icon: NoteIcon, color: 'var(--text-dim)', label: '' },
} as const

type Cat = keyof typeof CATS

// Pull a leading `feat:` / `fix:` / `improve:` (and synonyms) off a line and map
// it to a category; lines without a prefix are neutral notes.
function classify(text: string): { cat: Cat; text: string } {
  const m =
    /^(feat|feature|add|added|fix|fixed|bug|improve|improvement|improved|change|changed|docs|doc)\s*[:—-]\s*(.+)$/is.exec(
      text,
    )
  if (!m) return { cat: 'note', text }
  const k = m[1].toLowerCase()
  const cat: Cat =
    k.startsWith('feat') || k.startsWith('add')
      ? 'feat'
      : k.startsWith('fix') || k === 'bug'
        ? 'fix'
        : 'improve'
  return { cat, text: m[2] }
}

// Render **bold** and `code` spans inside a changelog line.
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
        if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

export default function WhatsNewDialog({ onClose }: { onClose: () => void }) {
  // typeof guard: if the Vite dev server hasn't reloaded the config that defines
  // __CHANGELOG__ yet, referencing it directly would throw -- fall back to empty.
  const raw = typeof __CHANGELOG__ === 'string' ? __CHANGELOG__ : ''
  const releases = useMemo(() => parseChangelog(raw), [raw])

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog whatsnew" onMouseDown={(e) => e.stopPropagation()}>
        <div className="whatsnew__head">
          <h2 className="dialog__title">What's New</h2>
          <span className="whatsnew__ver">foolsboard v{__APP_VERSION__}</span>
        </div>
        <div className="whatsnew__legend">
          <span className="whatsnew__key">
            <span className="whatsnew__icon" style={{ color: CATS.feat.color }}>
              <FeatIcon />
            </span>
            New
          </span>
          <span className="whatsnew__key">
            <span className="whatsnew__icon" style={{ color: CATS.fix.color }}>
              <FixIcon />
            </span>
            Fix
          </span>
          <span className="whatsnew__key">
            <span className="whatsnew__icon" style={{ color: CATS.improve.color }}>
              <ImproveIcon />
            </span>
            Improved
          </span>
        </div>
        <div className="whatsnew__body">
          {releases.map((r) => {
            // Every item gets a real icon: an unprefixed line (a sub-bullet/detail)
            // inherits the category of the item above it, falling back to a neutral
            // one if it's the first line in the release.
            let lastCat: Cat = 'improve'
            const items = r.bullets.map((b) => {
              const c = classify(b)
              const cat: Cat = c.cat === 'note' ? lastCat : c.cat
              if (c.cat !== 'note') lastCat = c.cat
              return { cat, text: c.text }
            })
            return (
              <section className="whatsnew__rel" key={r.version}>
                <h3 className="whatsnew__relver">{r.version}</h3>
                <div className="whatsnew__list">
                  {items.map((it, i) => {
                    const C = CATS[it.cat]
                    return (
                      <div className="whatsnew__item" key={i}>
                        <span className="whatsnew__icon" style={{ color: C.color }} title={C.label}>
                          <C.Icon />
                        </span>
                        <span className="whatsnew__text">
                          <Rich text={it.text} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
        <div className="whatsnew__actions">
          <button className="btn btn--primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
