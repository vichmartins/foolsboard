// "What's New" dialog, shown once after the app updates to a new version. The
// repo CHANGELOG is baked into the bundle at build time (__CHANGELOG__); we parse
// it into releases and list them newest-first, scrollable for the full history.
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
        <div className="whatsnew__body">
          {releases.map((r) => (
            <section className="whatsnew__rel" key={r.version}>
              <h3 className="whatsnew__relver">{r.version}</h3>
              <ul className="whatsnew__list">
                {r.bullets.map((b, i) => (
                  <li key={i}>
                    <Rich text={b} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
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
