// A reference card of the app's keyboard shortcuts and mouse gestures. Keyboard
// actions are editable: click one, press a new combo, and it's saved (with a
// conflict warning + one-click resolution). Mouse gestures are shown read-only.
import { Fragment, useEffect, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import {
  ACTIONS,
  eventToCombo,
  findConflict,
  formatCombo,
  getBinding,
  isBindableCode,
  isCustom,
  resetAll,
  resetBinding,
  setBinding,
  unbind,
  useKeymap,
  comboEq,
  type ActionDef,
  type Combo,
} from '../keymap'

interface Props {
  onClose: () => void
}

interface Gesture {
  keys: string[]
  desc: string
  alt?: boolean // keys are alternatives ("Del or Backspace"), not a combo
}

// Read-only reference rows for gestures and system keys that aren't remappable.
const STATIC: Record<string, Gesture[]> = {
  Clipboard: [
    { keys: ['Ctrl', 'C'], desc: 'Copy selection' },
    { keys: ['Ctrl', 'X'], desc: 'Cut selection' },
    { keys: ['Ctrl', 'V'], desc: 'Paste' },
    { keys: ['Ctrl', 'D'], desc: 'Duplicate selection' },
  ],
  History: [
    { keys: ['Ctrl', 'Z'], desc: 'Undo' },
    { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo' },
    { keys: ['Ctrl', 'Y'], desc: 'Redo' },
  ],
  Canvas: [
    { keys: ['Right-click'], desc: 'New object (empty canvas)' },
    { keys: ['Click'], desc: 'Select object' },
    { keys: ['Double-click'], desc: 'Open edit panel' },
    { keys: ['Ctrl', 'S'], desc: 'Save object (in panel)' },
    { keys: ['Shift', 'Drag'], desc: 'Select multiple' },
    { keys: ['Del', 'Backspace'], alt: true, desc: 'Delete selection' },
    { keys: ['Esc'], desc: 'Close edit panel, or clear selection' },
  ],
  Gallery: [
    { keys: ['Click'], desc: 'Open a file in the viewer' },
    { keys: ['←', '→'], alt: true, desc: 'Previous / next file (viewer)' },
    { keys: ['Esc'], desc: 'Close viewer or preview, then collapse the drawer' },
  ],
  Connections: [
    { keys: ['Drag'], desc: 'Link objects (from a node edge)' },
    { keys: ['Drag'], desc: 'Move or reassign a link end' },
    { keys: ['Right-click'], desc: 'Edit or delete a link' },
  ],
  Minimap: [
    { keys: ['Click'], desc: 'Jump to location' },
    { keys: ['Drag'], desc: 'Pan the view' },
    { keys: ['Scroll'], desc: 'Zoom in / out' },
  ],
}

const GROUP_ORDER = [
  'Workspace', 'Board', 'View', 'Object',
  'Clipboard', 'History', 'Canvas', 'Gallery', 'Connections', 'Minimap',
  'Document editor', 'Screenplay mode',
]
const EDITABLE = new Set(['Workspace', 'Board', 'View', 'Object', 'Document editor', 'Screenplay mode'])

function KeyChips({ combo }: { combo: Combo | null }) {
  if (!combo) return <span className="shortcut__none">None</span>
  return (
    <>
      {formatCombo(combo).map((k, i) => (
        <kbd key={i}>{k}</kbd>
      ))}
    </>
  )
}

export default function ShortcutsDialog({ onClose }: Props) {
  useKeymap() // re-render when a binding changes
  // The action currently capturing a keypress, and a pending conflict to resolve.
  const [recording, setRecording] = useState<string | null>(null)
  const [pending, setPending] = useState<{ id: string; combo: Combo; conflict: ActionDef } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  // Close on Escape — but only when not recording (Escape cancels recording) or
  // resolving a conflict.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Defer to the recording capture, an open conflict, or the reset-confirm dialog.
      if (e.key === 'Escape' && !recording && !pending && !confirmReset) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, recording, pending, confirmReset])

  // While recording, capture the next real key combo (ignoring bare modifiers).
  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }
      if (!isBindableCode(e.code)) return // wait for a non-modifier key
      const combo = eventToCombo(e)
      const cur = getBinding(recording)
      if (cur && comboEq(cur, combo)) {
        setRecording(null) // unchanged
        return
      }
      const conflict = findConflict(combo, recording)
      if (conflict) {
        setPending({ id: recording, combo, conflict })
        setRecording(null)
        return
      }
      setBinding(recording, combo)
      setRecording(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording])

  const resolveReplace = () => {
    if (!pending) return
    unbind(pending.conflict.id) // take the key from the other action
    setBinding(pending.id, pending.combo)
    setPending(null)
  }

  const renderEditable = (action: ActionDef) => {
    const { id, label } = action
    const inConflict = pending?.id === id
    return (
      <li key={id} className="shortcut">
        <span className="shortcut__desc">{label}</span>
        {inConflict ? (
          <span className="shortcut__resolve">
            <span className="shortcut__warn">
              Used by “{pending!.conflict.label}”
            </span>
            <button className="shortcut__mini" onClick={resolveReplace}>Replace</button>
            <button className="shortcut__mini" onClick={() => setPending(null)}>Cancel</button>
          </span>
        ) : recording === id ? (
          <span className="shortcut__keys">
            <span className="shortcut__recording">Press keys… (Esc to cancel)</span>
          </span>
        ) : (
          <span className="shortcut__keys">
            <button
              className="shortcut__edit"
              title="Click to reassign"
              onClick={() => {
                setPending(null)
                setRecording(id)
              }}
            >
              <KeyChips combo={getBinding(id)} />
            </button>
            {isCustom(id) && (
              <button
                className="shortcut__reset"
                title="Reset to default"
                onClick={() => resetBinding(id)}
              >
                ↺
              </button>
            )}
          </span>
        )}
      </li>
    )
  }

  const renderStatic = (g: Gesture, i: number) => (
    <li key={i} className="shortcut">
      <span className="shortcut__desc">{g.desc}</span>
      <span className="shortcut__keys">
        {g.keys.map((k, j) => (
          <Fragment key={j}>
            {j > 0 && g.alt && <span className="shortcut__or">or</span>}
            <kbd>{k}</kbd>
          </Fragment>
        ))}
      </span>
    </li>
  )

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Keyboard Shortcuts</h2>
        <p className="shortcuts__hint">Click any keyboard shortcut to reassign it. Mouse gestures are fixed.</p>

        <div className="shortcuts">
          {GROUP_ORDER.map((title) => {
            const editable = EDITABLE.has(title)
            const items = editable ? ACTIONS.filter((a) => a.group === title) : STATIC[title]
            if (!items || items.length === 0) return null
            return (
              <section key={title} className="shortcuts__group">
                <h3 className="shortcuts__heading">{title}</h3>
                <ul className="shortcuts__list">
                  {editable
                    ? (items as ActionDef[]).map(renderEditable)
                    : (items as Gesture[]).map(renderStatic)}
                </ul>
              </section>
            )
          })}
        </div>

        <div className="dialog__actions">
          <button className="btn" onClick={() => setConfirmReset(true)}>Set to Default</button>
          <button className="btn btn--primary" onClick={onClose}>Close</button>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Reset all shortcuts?"
          message="This restores every keyboard shortcut to its default. Any custom bindings you've set will be lost."
          confirmLabel="Reset to defaults"
          cancelLabel="Cancel"
          danger
          onConfirm={() => {
            resetAll()
            setConfirmReset(false)
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  )
}
