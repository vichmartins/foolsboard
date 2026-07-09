// Celtx-style screenplay support for the doc editor. Rather than a separate
// schema, screenplay elements are just paragraphs carrying an `element`
// attribute (data-element); the formatting (Courier, indents, caps) is CSS keyed
// on that attribute, applied only when the editor is in script mode. A keymap
// provides the Celtx flow: Ctrl+1..7 to set an element, Tab to cycle, and Enter
// to auto-advance to the next logical element. All keys no-op (return false, so
// the default rich-text behavior runs) unless the editor is in script mode.
import { Extension } from '@tiptap/core'

export type ScreenEl =
  | 'scene'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'

// Display order (also the Tab cycle order) + labels + Ctrl+N shortcut number.
export const SCREEN_ELEMENTS: { el: ScreenEl; label: string; key: string }[] = [
  { el: 'scene', label: 'Scene', key: '1' },
  { el: 'action', label: 'Action', key: '2' },
  { el: 'character', label: 'Character', key: '3' },
  { el: 'dialogue', label: 'Dialogue', key: '4' },
  { el: 'parenthetical', label: 'Paren.', key: '5' },
  { el: 'transition', label: 'Transition', key: '6' },
  { el: 'shot', label: 'Shot', key: '7' },
]

const ORDER = SCREEN_ELEMENTS.map((e) => e.el)

// What each element becomes when you press Enter (industry-standard flow).
const ENTER_NEXT: Record<ScreenEl, ScreenEl> = {
  scene: 'action',
  action: 'action',
  character: 'dialogue',
  dialogue: 'action',
  parenthetical: 'dialogue',
  transition: 'scene',
  shot: 'action',
}

// Adds the `element` attribute to paragraphs (rendered as data-element).
export const ScreenplayElement = Extension.create({
  name: 'screenplayElement',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          element: {
            default: null,
            parseHTML: (el) => el.getAttribute('data-element'),
            renderHTML: (attrs) =>
              attrs.element ? { 'data-element': attrs.element } : {},
          },
        },
      },
    ]
  },
})

export interface ScreenplayKeysOptions {
  // Live check — the editor is shared between doc + script modes, so these keys
  // must only act while the user is in script mode.
  isScript: () => boolean
}

export const ScreenplayKeys = Extension.create<ScreenplayKeysOptions>({
  name: 'screenplayKeys',
  addOptions() {
    return { isScript: () => false }
  },
  // Only the structural Tab (cycle) / Enter (auto-advance) keys live here; the
  // per-element shortcuts (Ctrl+1..7) are owned by the customizable editor keymap.
  addKeyboardShortcuts() {
    const active = () => this.options.isScript()
    const curEl = (): ScreenEl =>
      (this.editor.getAttributes('paragraph').element as ScreenEl) || 'action'
    return {
      Tab: () => {
        if (!active()) return false
        const next = ORDER[(ORDER.indexOf(curEl()) + 1) % ORDER.length]
        return this.editor.chain().focus().updateAttributes('paragraph', { element: next }).run()
      },
      Enter: () => {
        if (!active()) return false
        const next = ENTER_NEXT[curEl()]
        return this.editor
          .chain()
          .splitBlock()
          .updateAttributes('paragraph', { element: next })
          .run()
      },
    }
  },
})
