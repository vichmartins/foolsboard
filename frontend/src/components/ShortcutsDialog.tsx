// A reference card of the app's keyboard shortcuts and mouse gestures.
import { Fragment, useEffect } from 'react'

interface Props {
  onClose: () => void
}

interface Shortcut {
  keys: string[]
  desc: string
  // When true the keys are alternatives ("Del or Backspace"), not a combo.
  alt?: boolean
}

const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'Workspace',
    items: [{ keys: ['Ctrl', 'B'], desc: 'Toggle the Explorer sidebar' }],
  },
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
    title: 'Objects',
    items: [
      { keys: ['Right-click'], desc: 'New object (empty canvas)' },
      { keys: ['Click'], desc: 'Select object' },
      { keys: ['Double-click'], desc: 'Open edit panel' },
      { keys: ['Ctrl', 'S'], desc: 'Save object (in panel)' },
      { keys: ['Shift', 'Drag'], desc: 'Select multiple' },
      { keys: ['Right-click'], desc: 'Object / selection menu' },
      { keys: ['Del', 'Backspace'], alt: true, desc: 'Delete selection' },
      { keys: ['Esc'], desc: 'Close edit panel, or clear selection' },
    ],
  },
  {
    title: 'Gallery',
    items: [
      { keys: ['Click'], desc: 'Open a file in the viewer' },
      { keys: ['Click'], desc: 'Expand / collapse drawer (◀ arrow)' },
      { keys: ['←', '→'], alt: true, desc: 'Previous / next file (viewer)' },
      { keys: ['Esc'], desc: 'Close viewer or preview, then collapse the drawer' },
    ],
  },
  {
    title: 'Connections',
    items: [
      { keys: ['Drag'], desc: 'Link objects (from a node edge)' },
      { keys: ['Drag'], desc: 'Move or reassign a link end' },
      { keys: ['Drag'], desc: 'Delete a link (drop on empty)' },
      { keys: ['Right-click'], desc: 'Edit or delete a link' },
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
        <h2 className="dialog__title">Keyboard Shortcuts</h2>

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
                        <Fragment key={j}>
                          {j > 0 && it.alt && <span className="shortcut__or">or</span>}
                          <kbd>{k}</kbd>
                        </Fragment>
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
