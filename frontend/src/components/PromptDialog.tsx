// A modal text-prompt dialog with an animated gradient overlay.
// Reusable for any "ask for a short value" interaction (e.g. naming a board).
import { useEffect, useRef, useState } from 'react'

interface Props {
  title: string
  label?: string
  placeholder?: string
  initialValue?: string
  confirmLabel?: string
  allowEmpty?: boolean
  onSubmit: (value: string) => void
  onCancel: () => void
}

export default function PromptDialog({
  title,
  label,
  placeholder,
  initialValue = '',
  confirmLabel = 'Create',
  allowEmpty = false,
  onSubmit,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the input on open and close on Escape.
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function submit() {
    const v = value.trim()
    if (v || allowEmpty) onSubmit(v)
  }

  return (
    // Click on the gradient backdrop cancels; clicks inside the card do not.
    <div className="overlay" onMouseDown={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="dialog__title">{title}</h2>
        {label && (
          <label className="dialog__label" htmlFor="prompt-input">
            {label}
          </label>
        )}
        <input
          id="prompt-input"
          ref={inputRef}
          className="dialog__input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <div className="dialog__actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={submit}
            disabled={!allowEmpty && !value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
