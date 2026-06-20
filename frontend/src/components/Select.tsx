// A small themed, animated dropdown for form fields (replaces native <select>,
// which can't be styled or animated to match the app). Options may carry a
// color shown as a leading dot. The menu renders in a portal positioned over
// the trigger, so it's never clipped by a scrolling/overflow container.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
  placeholder?: string
}

export default function Select({ value, options, onChange, ariaLabel, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const current = options.find((o) => o.value === value)

  function place() {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setCoords({ top: r.bottom + 6, left: r.left, width: r.width })
  }

  function toggle() {
    if (!open) place()
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const onOutside = (e: Event) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onReflow = () => place()
    const raf = requestAnimationFrame(() => {
      window.addEventListener('pointerdown', onOutside)
      window.addEventListener('keydown', onKey)
      window.addEventListener('resize', onReflow)
      window.addEventListener('scroll', onReflow, true)
    })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onOutside)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [open])

  return (
    <div className="select" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={'select__button' + (open ? ' select__button--open' : '')}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {current?.color && (
          <span className="select__dot" style={{ background: current.color }} />
        )}
        <span className={'select__current' + (current ? '' : ' select__current--placeholder')}>
          {current?.label ?? placeholder ?? ''}
        </span>
        <span className={'select__chevron' + (open ? ' select__chevron--open' : '')}>▾</span>
      </button>

      {createPortal(
        <ul
          ref={menuRef}
          className={'select__menu select__menu--portal' + (open ? ' select__menu--open' : '')}
          role="listbox"
          style={coords ? { top: coords.top, left: coords.left, width: coords.width } : undefined}
        >
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
        </ul>,
        document.body,
      )}
    </div>
  )
}
