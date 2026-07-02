// Personal preferences. Currently: the collaborator highlight color (the color
// others see for your cursor and selections). Any color may be picked -- if it
// clashes with a collaborator's, each of you sees the other in a different color.
import { useEffect, useState } from 'react'
import { apiError } from '../api'
import * as api from '../api'
import { useAuth } from '../auth'

export default function PreferencesDialog({ onClose }: { onClose: () => void }) {
  const { user, setUser } = useAuth()
  const [colors, setColors] = useState<api.ColorsInfo | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    api.getColors().then(setColors).catch(() => {})
  }, [])
  if (!user) return null

  async function pick(c: string) {
    setMsg(null)
    try {
      setUser(await api.setMyColor(c))
    } catch (err) {
      setMsg(apiError(err, 'Could not set color'))
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Preferences</h2>

        <div className="account-section">
          <h3 className="account-h3">Highlight Color</h3>
          <p className="account-hint">
            Your preferred color for your cursor and selections, shown to collaborators.
          </p>
          <div className="color-swatches">
            {colors?.palette.map((c) => {
              const isMine = (user.color ?? '').toLowerCase() === c
              return (
                <button
                  key={c}
                  type="button"
                  className={'color-swatch' + (isMine ? ' color-swatch--active' : '')}
                  style={{ background: c }}
                  title={c}
                  aria-label={`Use color ${c}`}
                  onClick={() => pick(c)}
                />
              )
            })}
          </div>
          {msg && <p className="account-msg">{msg}</p>}
        </div>

        <div className="dialog__actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
