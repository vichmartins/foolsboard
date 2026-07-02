// Editor for a Character's "Animations": a repeatable list of rows, each a
// numeric identifier plus the animation the character performs for that id.
import type { AnimationRow } from '../types'

interface Props {
  value: unknown
  onChange: (rows: AnimationRow[]) => void
}

function toRows(value: unknown): AnimationRow[] {
  if (!Array.isArray(value)) return []
  return value.map((r) => ({
    id: String((r as AnimationRow)?.id ?? ''),
    name: String((r as AnimationRow)?.name ?? ''),
  }))
}

export default function AnimationsField({ value, onChange }: Props) {
  const rows = toRows(value)

  const update = (i: number, patch: Partial<AnimationRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const add = () => onChange([...rows, { id: '', name: '' }])
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i))

  return (
    <div className="anim-field">
      {rows.length > 0 && (
        <div className="anim-list">
          {rows.map((r, i) => (
            <div className="anim-row" key={i}>
              <input
                className="anim-row__id"
                type="number"
                inputMode="numeric"
                value={r.id}
                placeholder="#"
                aria-label="Animation id"
                onChange={(e) => update(i, { id: e.target.value })}
              />
              <input
                className="anim-row__name"
                value={r.name}
                placeholder="Animation (e.g. Wave, Jump)"
                aria-label="Animation"
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn anim-row__remove"
                onClick={() => remove(i)}
                aria-label="Remove animation"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn anim-field__add" onClick={add}>
        + Add Animation
      </button>
    </div>
  )
}
