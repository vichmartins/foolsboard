// A high-friction confirm dialog: the user must type an exact phrase (e.g. the
// board name) before the destructive action is enabled. Pasting is allowed.
import { useEffect, useState } from 'react'

interface Props {
  title: string
  message: string
  requiredText: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function TypeToConfirmDialog({
  title,
  message,
  requiredText,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState('')
  const matches = value.trim() === requiredText

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">{title}</h2>
        <p className="dialog__message">{message}</p>
        <p className="dialog__label">
          Type <strong>{requiredText}</strong> to confirm
        </p>
        <input
          className="dialog__input"
          autoFocus
          value={value}
          placeholder={requiredText}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches) onConfirm()
          }}
        />
        <div className="dialog__actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className={'btn ' + (danger ? 'btn--danger-solid' : 'btn--primary')}
            disabled={!matches}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
