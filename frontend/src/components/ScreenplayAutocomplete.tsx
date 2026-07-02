// Celtx-style autocomplete for screenplay mode. While the caret sits in a
// Character / Scene / Transition / Shot element, a dropdown offers matching values
// you've already used in this document (plus a little built-in vocabulary). It also
// works cross-element: on an Action line, typing a known character name offers it
// and — on accept — converts the line to a Character element (Celtx-style). Picking
// a value fills it in; the element's indentation is applied by screenplay mode.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { SCREEN_ELEMENTS, type ScreenEl } from './screenplay'

// Every element type is completable: its previously-used values are offered in
// place, and it can be suggested from any other line (accepting converts the line
// to that element). Ordered as in the screenplay element list.
const VOCAB: ScreenEl[] = SCREEN_ELEMENTS.map((e) => e.el)
const OWN_VOCAB = new Set<ScreenEl>(VOCAB)

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

// A suggestion. `el` set means accepting it also converts the current paragraph to
// that element (e.g. a character name offered on an Action line).
interface AcItem {
  text: string
  el?: ScreenEl
}

interface Props {
  editor: Editor | null
  active: boolean // true only in screenplay mode
}

interface AcState {
  items: AcItem[]
  index: number
  x: number
  y: number
}

export default function ScreenplayAutocomplete({ editor, active }: Props) {
  const [ac, setAc] = useState<AcState | null>(null)
  const acRef = useRef<AcState | null>(null)
  acRef.current = ac
  // After accepting, don't immediately re-open (the accepted value may still be a
  // prefix of others). Cleared as soon as the user types again.
  const suppress = useRef(false)

  // Distinct values already used for an element type + its seed vocab, filtered by
  // what's typed so far.
  const collectFor = (el: ScreenEl, query: string): string[] => {
    if (!editor) return []
    const q = query.trim().toLowerCase()
    const seen = new Set<string>()
    const out: string[] = []
    const add = (raw: string) => {
      const t = raw.trim()
      if (!t) return
      const key = t.toLowerCase()
      if (key === q || seen.has(key)) return
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
    return out
  }

  // Suggestions for the paragraph the caret is in: this element's own values
  // first (completed in place), then matching values of the other vocabulary
  // element types (accepting converts the line to that element, Celtx-style).
  const buildItems = (el: ScreenEl, query: string): AcItem[] => {
    const items: AcItem[] = []
    const seen = new Set<string>()
    const push = (text: string, convertTo?: ScreenEl) => {
      const key = text.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      items.push(convertTo ? { text, el: convertTo } : { text })
    }
    if (OWN_VOCAB.has(el)) for (const t of collectFor(el, query)) push(t)
    for (const other of VOCAB) {
      if (other === el) continue
      for (const t of collectFor(other, query)) push(t, other)
    }
    return items.slice(0, MAX_ITEMS)
  }

  const accept = (item: AcItem) => {
    if (!editor) return
    const $from = editor.state.selection.$from
    const chain = editor.chain().focus()
    // Convert the paragraph's element first (e.g. Action -> Character), then replace
    // its text — positions are unaffected by the attribute change.
    if (item.el && item.el !== $from.parent.attrs.element) {
      chain.updateAttributes('paragraph', { element: item.el })
    }
    chain.insertContentAt({ from: $from.start(), to: $from.end() }, item.text).run()
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
      if (!sel.empty || sel.$from.parent.type.name !== 'paragraph') {
        setAc(null)
        return
      }
      const para = sel.$from.parent
      // An untagged line in script mode reads as Action (the default), so it can
      // still offer character conversions.
      const el = ((para.attrs.element as ScreenEl | null) ?? 'action') as ScreenEl
      if (!para.textContent.trim()) {
        setAc(null)
        return
      }
      const items = buildItems(el, para.textContent)
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
        <li key={(it.el ?? '') + it.text}>
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
            <span className="sp-ac__text">{it.text}</span>
            {it.el && <span className="sp-ac__tag">{it.el}</span>}
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  )
}
