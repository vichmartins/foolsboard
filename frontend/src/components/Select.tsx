// A small themed, animated dropdown for form fields (replaces native <select>,
// which can't be styled or animated to match the app). Options may carry a
// color shown as a leading dot.
import { useEffect, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
  color?: string
}

interface Props {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  ariaLabel?: string
}

export default function Select({ value, options, onChange, ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onOutside = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const raf = requestAnimationFrame(() => {
      window.addEventListener('pointerdown', onOutside)
      window.addEventListener('keydown', onKey)
    })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onOutside)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="select" ref={ref}>
      <button
        type="button"
        className={'select__button' + (open ? ' select__button--open' : '')}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {current?.color && (
          <span className="select__dot" style={{ background: current.color }} />
        )}
        <span className="select__current">{current?.label ?? ''}</span>
        <span className={'select__chevron' + (open ? ' select__chevron--open' : '')}>▾</span>
      </button>

      <ul className={'select__menu' + (open ? ' select__menu--open' : '')} role="listbox">
        {options.map((o) => (
          <li key={o.value}>
            <button
              type="button"
              className={'select__option' + (o.value === value ? ' select__option--active' : '')}
              role="option"
              aria-selected={o.value === value}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
            >
              {o.color && <span className="select__dot" style={{ background: o.color }} />}
              {o.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
