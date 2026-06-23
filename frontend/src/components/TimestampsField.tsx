// Timestamps: a list of time markers for an object (when it appears / happens),
// each an optional note. A universal field, like References. Free-form time text
// so it fits any project (video position, in-story time, real time, etc.).
import { useState } from 'react'

export interface TimeStamp {
  time: string
  label?: string
}

function toStamps(value: unknown): TimeStamp[] {
  if (!Array.isArray(value)) return []
  return value.filter((s): s is TimeStamp => !!s && typeof (s as TimeStamp).time === 'string')
}

interface Props {
  value: unknown
  onChange: (stamps: TimeStamp[]) => void
}

export default function TimestampsField({ value, onChange }: Props) {
  const stamps = toStamps(value)
  const [time, setTime] = useState('')
  const [label, setLabel] = useState('')

  function add() {
    const t = time.trim()
    if (!t) return
    onChange([...stamps, { time: t, label: label.trim() || undefined }])
    setTime('')
    setLabel('')
  }
  const remove = (i: number) => onChange(stamps.filter((_, j) => j !== i))

  return (
    <div className="stamps">
      <div className="stamps__add">
        <input
          className="stamps__time"
          placeholder="Time (e.g. 00:01:23)"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <input
          className="stamps__label"
          placeholder="Note (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button
          type="button"
          className="icon-btn"
          onClick={add}
          disabled={!time.trim()}
          aria-label="Add timestamp"
          title="Add timestamp"
        >
          +
        </button>
      </div>

      {stamps.length > 0 && (
        <div className="stamps__list">
          {stamps.map((s, i) => (
            <div className="stamp" key={i}>
              <span className="stamp__time">{s.time}</span>
              {s.label && <span className="stamp__label">{s.label}</span>}
              <button
                type="button"
                className="icon-btn stamp__remove"
                onClick={() => remove(i)}
                aria-label="Remove timestamp"
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
