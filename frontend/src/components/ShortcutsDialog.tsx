// A reference card of the app's keyboard shortcuts and mouse gestures.
import { useEffect } from 'react'

interface Props {
  onClose: () => void
}

const GROUPS: { title: string; items: { keys: string[]; desc: string }[] }[] = [
  {
    title: 'Clipboard',
    items: [
      { keys: ['Ctrl', 'C'], desc: 'Copy selection' },
      { keys: ['Ctrl', 'X'], desc: 'Cut selection' },
      { keys: ['Ctrl', 'V'], desc: 'Paste' },
      { keys: ['Ctrl', 'D'], desc: 'Duplicate selection' },
    ],
  },
  {
    title: 'History',
    items: [
      { keys: ['Ctrl', 'Z'], desc: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo' },
      { keys: ['Ctrl', 'Y'], desc: 'Redo' },
    ],
  },
  {
    title: 'Canvas',
    items: [
      { keys: ['Del'], desc: 'Delete selection' },
      { keys: ['Shift', 'drag'], desc: 'Select multiple objects' },
      { keys: ['Right-click'], desc: 'Object / selection menu' },
      { keys: ['Right-click', 'pane'], desc: 'New object' },
    ],
  },
  {
    title: 'Minimap',
    items: [
      { keys: ['Click'], desc: 'Jump to location' },
      { keys: ['Drag'], desc: 'Pan the view' },
      { keys: ['Scroll'], desc: 'Zoom in / out' },
    ],
  },
]

export default function ShortcutsDialog({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Keyboard shortcuts</h2>

        <div className="shortcuts">
          {GROUPS.map((g) => (
            <section key={g.title} className="shortcuts__group">
              <h3 className="shortcuts__heading">{g.title}</h3>
              <ul className="shortcuts__list">
                {g.items.map((it, i) => (
                  <li key={i} className="shortcut">
                    <span className="shortcut__desc">{it.desc}</span>
                    <span className="shortcut__keys">
                      {it.keys.map((k, j) => (
                        <kbd key={j}>{k}</kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="dialog__actions">
          <button className="btn btn--primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
