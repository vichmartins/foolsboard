// The printable storyboard document. Rendered off-screen (so its images load),
// then it opens the browser print dialog -- the user picks "Save as PDF". Hidden
// from normal screen view; the print stylesheet (App.css, @media print) lays it
// out and isolates it from the rest of the app.
import { Fragment, useEffect, useRef } from 'react'
import { TYPE_FIELDS, typeLabel, type LinkRef, type StoryNode } from '../types'
import type { StoryboardSection } from '../storyboard'

function textFields(node: StoryNode): { label: string; value: string }[] {
  const defs = TYPE_FIELDS[node.type]
  if (defs) {
    return defs
      .filter((f) => f.widget !== 'animations')
      .map((f) => ({ label: f.label, value: node.content?.[f.key] }))
      .filter((r): r is { label: string; value: string } => typeof r.value === 'string' && r.value.trim() !== '')
      .map((r) => ({ label: r.label, value: r.value.trim() }))
  }
  // Unknown / object types: surface any non-empty string fields.
  return Object.entries(node.content ?? {})
    .filter(([k, v]) => typeof v === 'string' && v.trim() !== '' && k !== 'filename' && k !== 'url' && k !== 'thumbnailUrl' && k !== 'assetId')
    .map(([k, v]) => ({ label: k, value: (v as string).trim() }))
}

export default function StoryboardPrint({
  title,
  sections,
  onDone,
}: {
  title: string
  sections: StoryboardSection[]
  onDone: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const after = () => onDone()
    window.addEventListener('afterprint', after)

    // Wait for images to load (or a max of 3s) so the PDF isn't missing media.
    const imgs = ref.current ? Array.from(ref.current.querySelectorAll('img')) : []
    let fired = false
    const go = () => {
      if (fired) return
      fired = true
      window.print()
    }
    const fallback = window.setTimeout(go, 3000)
    if (imgs.length === 0) {
      window.clearTimeout(fallback)
      const t = window.setTimeout(go, 150)
      return () => {
        window.clearTimeout(t)
        window.removeEventListener('afterprint', after)
      }
    }
    let left = imgs.length
    const tick = () => {
      left -= 1
      if (left <= 0) {
        window.clearTimeout(fallback)
        go()
      }
    }
    imgs.forEach((img) => {
      if (img.complete) tick()
      else {
        img.addEventListener('load', tick)
        img.addEventListener('error', tick)
      }
    })
    return () => {
      window.clearTimeout(fallback)
      window.removeEventListener('afterprint', after)
    }
  }, [onDone])

  return (
    <div className="sb-print" ref={ref}>
      <header className="sb-print__cover">
        <h1>{title}</h1>
        <p>
          Storyboard · {sections.length} item{sections.length === 1 ? '' : 's'}
        </p>
      </header>

      {sections.map((s) => {
        const n = s.node
        const rows = textFields(n)
        const img = n.type === 'media' ? (n.content?.url as string | undefined) : undefined
        const refs =
          n.type === 'link' && Array.isArray(n.content?.references)
            ? (n.content.references as LinkRef[])
            : []
        return (
          <section className="sb-print__item" key={n.id}>
            <div className="sb-print__kicker">
              <span className="sb-print__num">{s.num}</span>
              <span className="sb-print__type">{typeLabel(n.type)}</span>
            </div>
            <h2 className="sb-print__title">{n.title || 'Untitled'}</h2>

            {img && <img className="sb-print__img" src={img} alt={n.title} />}

            {rows.length > 0 && (
              <dl className="sb-print__fields">
                {rows.map((r, i) => (
                  <Fragment key={i}>
                    <dt>{r.label}</dt>
                    <dd>{r.value}</dd>
                  </Fragment>
                ))}
              </dl>
            )}

            {refs.length > 0 && (
              <ul className="sb-print__refs">
                {refs.map((r, i) => (
                  <li key={i}>{r.title ? `${r.title} — ${r.url}` : r.url}</li>
                ))}
              </ul>
            )}

            {s.leadsTo.length > 0 && (
              <p className="sb-print__leads">
                <span className="sb-print__leads-label">Leads to</span>
                {s.leadsTo.map((l, i) => (
                  <span key={i}>
                    {i > 0 ? ' · ' : ''}#{l.num} {l.title}
                    {l.label ? <em> ({l.label})</em> : ''}
                  </span>
                ))}
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}
