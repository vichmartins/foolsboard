// Celtx-style autocomplete for screenplay mode. While the caret sits in a
// Scene / Character / Transition / Shot element, a dropdown offers matching values
// you've already used in this document (plus a little built-in vocabulary). Picking
// a value fills it in; the element's indentation is applied by screenplay mode.
// Free-prose elements (Action, Dialogue, Parenthetical) never autocomplete, exactly
// as in Celtx.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { type ScreenEl } from './screenplay'

// Only elements with a repeatable, enumerable vocabulary autocomplete (Celtx-style);
// free-prose elements — action, dialogue, parenthetical — never suggest.
const COMPLETABLE = new Set<ScreenEl>(['scene', 'character', 'transition', 'shot'])

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

// Smart scene-heading parts + character extensions (Celtx-style).
const SCENE_PREFIXES = ['INT. ', 'EXT. ', 'INT./EXT. ', 'EST. ']
const TIME_OF_DAY = [
  'DAY', 'NIGHT', 'MORNING', 'AFTERNOON', 'EVENING', 'DUSK', 'DAWN',
  'CONTINUOUS', 'LATER', 'MOMENTS LATER', 'SAME TIME',
]
const CHAR_EXT = [' (V.O.)', ' (O.S.)', " (CONT'D)"]

// The location part of a scene heading: strip a known prefix and the trailing
// " - TIME" so remembered locations can be re-offered.
function extractLocation(heading: string): string {
  let s = heading.toUpperCase().trim()
  for (const p of SCENE_PREFIXES) {
    const pt = p.trim()
    if (s.startsWith(pt)) {
      s = s.slice(pt.length).trim()
      break
    }
  }
  const d = s.lastIndexOf(' - ')
  if (d !== -1) s = s.slice(0, d).trim()
  return s
}

interface AcItem {
  text: string
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

  // Distinct prior values written for an element type (unfiltered), for the smart
  // scene / character completions below.
  const priorValues = (el: ScreenEl): string[] => {
    if (!editor) return []
    const seen = new Set<string>()
    const out: string[] = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'paragraph' && node.attrs.element === el) {
        const t = node.textContent.trim()
        const k = t.toLowerCase()
        if (t && !seen.has(k)) {
          seen.add(k)
          out.push(t)
        }
      }
      return true
    })
    return out
  }

  // Scene headings complete in the Celtx pattern PREFIX -> LOCATION -> TIME: detect
  // which part is being typed and offer prefixes, remembered locations, or the
  // time-of-day vocabulary accordingly (plus any matching full prior heading).
  const sceneItems = (text: string): AcItem[] => {
    const upper = text.toUpperCase()
    const headings = priorValues('scene').filter((h) => h.toUpperCase() !== upper)
    const out: AcItem[] = []
    const seen = new Set<string>()
    const push = (s: string) => {
      const k = s.toLowerCase()
      if (s.trim() && !seen.has(k)) {
        seen.add(k)
        out.push({ text: s })
      }
    }
    const matchHeadings = () => {
      for (const h of headings) if (h.toUpperCase().includes(upper)) push(h)
    }

    const dash = upper.lastIndexOf(' - ')
    if (dash !== -1) {
      const before = text.slice(0, dash + 3) // keep the " - " separator
      const frag = upper.slice(dash + 3).trim()
      for (const t of TIME_OF_DAY) if (!frag || t.startsWith(frag)) push(before + t)
      matchHeadings()
      return out.slice(0, MAX_ITEMS)
    }

    const prefix = SCENE_PREFIXES.find((p) => upper.startsWith(p.trim()))
    if (!prefix) {
      for (const p of SCENE_PREFIXES) if (!upper || p.toUpperCase().startsWith(upper)) push(p)
      matchHeadings()
      return out.slice(0, MAX_ITEMS)
    }

    const locFrag = upper.slice(prefix.trim().length).trim()
    const locations = Array.from(new Set(priorValues('scene').map(extractLocation).filter(Boolean)))
    for (const loc of locations) if (!locFrag || loc.includes(locFrag)) push(prefix + loc)
    matchHeadings()
    return out.slice(0, MAX_ITEMS)
  }

  // Character names complete from prior names; once a name is in place (an exact
  // match, or a trailing space / "(") the (V.O.) / (O.S.) / (CONT'D) extensions
  // are offered too.
  const characterItems = (text: string): AcItem[] => {
    const out: AcItem[] = []
    const seen = new Set<string>()
    const push = (s: string) => {
      const k = s.toLowerCase()
      if (s.trim() && !seen.has(k)) {
        seen.add(k)
        out.push({ text: s })
      }
    }
    for (const n of collectFor('character', text)) push(n)
    const base = text.replace(/[ (]+$/, '').trim()
    const known = new Set(priorValues('character').map((v) => v.toUpperCase()))
    const wantsExt = !!base && !base.includes('(') && (known.has(base.toUpperCase()) || /[ (]$/.test(text))
    if (wantsExt) for (const e of CHAR_EXT) push(base + e)
    return out.slice(0, MAX_ITEMS)
  }

  // Free-prose elements (action / dialogue / parenthetical) aren't completable, so
  // they get nothing and no dropdown appears.
  const buildItems = (el: ScreenEl, text: string): AcItem[] => {
    if (el === 'scene') return sceneItems(text)
    if (el === 'character') return characterItems(text)
    if (!COMPLETABLE.has(el)) return []
    const items: AcItem[] = []
    const seen = new Set<string>()
    for (const t of collectFor(el, text)) {
      const key = t.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      items.push({ text: t })
    }
    return items.slice(0, MAX_ITEMS)
  }

  const accept = (item: AcItem) => {
    if (!editor) return
    const $from = editor.state.selection.$from
    // Replace the paragraph's text with the picked value; its element (and thus
    // indentation) is unchanged.
    editor
      .chain()
      .focus()
      .insertContentAt({ from: $from.start(), to: $from.end() }, item.text)
      .run()
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
      const el = ((para.attrs.element as ScreenEl | null) ?? 'action') as ScreenEl
      // An empty line stays quiet, except a Scene line offers its INT./EXT. prefixes.
      if (!para.textContent.trim() && el !== 'scene') {
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
        <li key={it.text}>
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
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  )
}
