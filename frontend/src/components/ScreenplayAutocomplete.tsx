// Celtx-style autocomplete for screenplay mode. While the caret sits in a
// Character / Scene / Transition / Shot element, a small dropdown offers matching
// values you've already used in this document (plus a little built-in vocabulary
// for transitions, shots, and scene prefixes). Tab/Enter or click fills it in;
// the element's own indentation is applied automatically by screenplay mode.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import type { ScreenEl } from './screenplay'

// Element types that have reusable, named values worth completing (free-form
// Action/Dialogue/Parenthetical are excluded — a "pick a past value" list is noise there).
const AC_ELEMENTS = new Set<ScreenEl>(['character', 'scene', 'transition', 'shot'])

// A little starter vocabulary, merged with what you've actually written.
const SEED: Partial<Record<ScreenEl, string[]>> = {
  transition: [
    'CUT TO:',
    'DISSOLVE TO:',
    'SMASH CUT TO:',
    'MATCH CUT TO:',
    'FADE OUT:',
    'FADE IN:',
    'FADE TO BLACK:',
  ],
  shot: ['ANGLE ON', 'CLOSE ON', 'CLOSE UP', 'WIDE SHOT', 'POV', 'INSERT', 'TWO SHOT', 'AERIAL SHOT'],
  scene: ['INT. ', 'EXT. ', 'INT./EXT. '],
}
const MAX_ITEMS = 6
const NAV_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'])

interface Props {
  editor: Editor | null
  active: boolean // true only in screenplay mode
}

interface AcState {
  items: string[]
  index: number
  x: number
  y: number
}

export default function ScreenplayAutocomplete({ editor, active }: Props) {
  const [ac, setAc] = useState<AcState | null>(null)
  const acRef = useRef<AcState | null>(null)
  acRef.current = ac
  // After accepting a suggestion, don't immediately re-open (the accepted value
  // may still be a prefix of others). Cleared as soon as the user types again.
  const suppress = useRef(false)

  // Collect candidate values for an element type: distinct texts of that element
  // already in the doc + the seed vocabulary, filtered by what's typed so far.
  const collect = (el: ScreenEl, query: string): string[] => {
    if (!editor) return []
    const q = query.trim().toLowerCase()
    const seen = new Set<string>()
    const out: string[] = []
    const add = (raw: string) => {
      const t = raw.trim()
      if (!t) return
      const key = t.toLowerCase()
      if (key === q || seen.has(key)) return // skip exact-typed + dupes
      if (q && !key.includes(q)) return
      seen.add(key)
      out.push(t)
    }
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'paragraph' && node.attrs.element === el) add(node.textContent)
      return true
    })
    for (const s of SEED[el] ?? []) add(s)
    out.sort((a, b) => {
      const ap = a.toLowerCase().startsWith(q) ? 0 : 1
      const bp = b.toLowerCase().startsWith(q) ? 0 : 1
      return ap - bp || a.localeCompare(b)
    })
    return out.slice(0, MAX_ITEMS)
  }

  const accept = (value: string) => {
    if (!editor) return
    const $from = editor.state.selection.$from
    // Replace the current paragraph's text with the chosen value (keeps its
    // element attribute, so the screenplay indentation stays put).
    editor.chain().focus().insertContentAt({ from: $from.start(), to: $from.end() }, value).run()
    suppress.current = true
    setAc(null)
  }
  const acceptRef = useRef(accept)
  acceptRef.current = accept

  // Recompute the suggestions whenever the caret moves or the doc changes.
  useEffect(() => {
    if (!editor) return
    const update = () => {
      if (!active || suppress.current) {
        setAc(null)
        return
      }
      const sel = editor.state.selection
      if (!sel.empty) {
        setAc(null)
        return
      }
      const para = sel.$from.parent
      const el = para.type.name === 'paragraph' ? (para.attrs.element as ScreenEl | null) : null
      if (!el || !AC_ELEMENTS.has(el) || !para.textContent.trim()) {
        setAc(null)
        return
      }
      const items = collect(el, para.textContent)
      if (!items.length) {
        setAc(null)
        return
      }
      let coords: { left: number; bottom: number }
      try {
        coords = editor.view.coordsAtPos(sel.from)
      } catch {
        setAc(null)
        return
      }
      setAc({ items, index: 0, x: coords.left, y: coords.bottom })
    }
    const onBlur = () => setAc(null)
    editor.on('selectionUpdate', update)
    editor.on('update', update)
    editor.on('blur', onBlur)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('update', update)
      editor.off('blur', onBlur)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, active])

  // Intercept navigation keys in the capture phase so they act on the dropdown
  // before the editor / screenplay keymap sees them. Any other key means the user
  // is typing again, which lifts the post-accept suppression.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!NAV_KEYS.has(e.key)) {
        suppress.current = false
        return
      }
      const s = acRef.current
      if (!s) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setAc(null)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setAc((v) => (v ? { ...v, index: (v.index + 1) % v.items.length } : v))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setAc((v) => (v ? { ...v, index: (v.index - 1 + v.items.length) % v.items.length } : v))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        acceptRef.current(s.items[s.index])
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  if (!ac) return null
  return createPortal(
    <ul className="sp-ac" style={{ left: ac.x, top: ac.y + 4 }} role="listbox">
      {ac.items.map((it, i) => (
        <li key={it}>
          <button
            type="button"
            className={'sp-ac__item' + (i === ac.index ? ' sp-ac__item--active' : '')}
            role="option"
            aria-selected={i === ac.index}
            onMouseDown={(e) => {
              e.preventDefault() // keep editor focus
              accept(it)
            }}
          >
            {it}
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  )
}
