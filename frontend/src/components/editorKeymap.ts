// The document editor's keyboard shortcuts, resolved live from the customizable
// keymap store rather than baked into TipTap extensions (which would freeze the
// bindings at editor-creation time). A single high-priority ProseMirror
// handleKeyDown runs before the built-in keymaps: it runs the command for the
// action whose CURRENT binding matches, and swallows any default key that has
// been remapped away, so a reassignment truly replaces the built-in behavior.
import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { ACTIONS, comboEq, eventToCombo, getBinding, matches } from '../keymap'
import type { ScreenEl } from './screenplay'

const HEADING_LEVEL: Record<string, 1 | 2 | 3 | 4 | 5> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5 }
const ALIGN: Record<string, 'left' | 'center' | 'right' | 'justify'> = {
  'align-left': 'left',
  'align-center': 'center',
  'align-right': 'right',
  'align-justify': 'justify',
}
const SP_ELEMENT: Record<string, ScreenEl> = {
  'sp-scene': 'scene',
  'sp-action': 'action',
  'sp-character': 'character',
  'sp-dialogue': 'dialogue',
  'sp-parenthetical': 'parenthetical',
  'sp-transition': 'transition',
  'sp-shot': 'shot',
}

const DOC_ACTION_IDS = ACTIONS.filter((a) => a.scope === 'editor' && a.id !== 'mode-toggle').map((a) => a.id)
const SP_ACTION_IDS = ACTIONS.filter((a) => a.scope === 'screenplay').map((a) => a.id)
const DEFAULT_OF = new Map(ACTIONS.map((a) => [a.id, a.def]))

export interface EditorKeymapOptions {
  mode: () => 'doc' | 'script'
  fontSizes: string[]
  highlightColor: string
  onLink: () => void
  onImage: () => void
  onModeToggle: () => void
  onToggleNavigator: () => void
}

function stepFont(editor: Editor, sizes: string[], dir: number): boolean {
  if (!sizes.length) return false
  const cur = editor.getAttributes('textStyle').fontSize as string | undefined
  let i = cur ? sizes.indexOf(cur) : -1
  if (i === -1) i = sizes.indexOf('16px')
  if (i === -1) i = 0
  const n = Math.min(sizes.length - 1, Math.max(0, i + dir))
  return editor.chain().focus().setFontSize(sizes[n]).run()
}

function runAction(editor: Editor, opts: EditorKeymapOptions, id: string): boolean {
  const c = editor.chain().focus()
  const lvl = HEADING_LEVEL[id]
  if (lvl) return c.toggleHeading({ level: lvl }).run()
  const align = ALIGN[id]
  if (align) return c.setTextAlign(align).run()
  const el = SP_ELEMENT[id]
  if (el) return c.updateAttributes('paragraph', { element: el }).run()
  switch (id) {
    case 'bold': return c.toggleBold().run()
    case 'italic': return c.toggleItalic().run()
    case 'underline': return c.toggleUnderline().run()
    case 'strike': return c.toggleStrike().run()
    case 'quote': return c.toggleBlockquote().run()
    case 'code-block': return c.toggleCodeBlock().run()
    case 'bullet-list': return c.toggleBulletList().run()
    case 'ordered-list': return c.toggleOrderedList().run()
    case 'task-list': return c.toggleTaskList().run()
    case 'table': return c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    case 'link': opts.onLink(); return true
    case 'image': opts.onImage(); return true
    case 'scene-navigator': opts.onToggleNavigator(); return true
    case 'highlight': {
      const bg = editor.getAttributes('textStyle').backgroundColor
      return bg ? c.unsetBackgroundColor().run() : c.setBackgroundColor(opts.highlightColor).run()
    }
    case 'font-inc': return stepFont(editor, opts.fontSizes, 1)
    case 'font-dec': return stepFont(editor, opts.fontSizes, -1)
  }
  return false
}

export const EditorKeymap = Extension.create<EditorKeymapOptions>({
  name: 'editorKeymap',
  priority: 1000, // run before the built-in mark/node keymaps
  addOptions() {
    return {
      mode: () => 'doc',
      fontSizes: [],
      highlightColor: '#fde047',
      onLink: () => {},
      onImage: () => {},
      onModeToggle: () => {},
      onToggleNavigator: () => {},
    }
  },
  addProseMirrorPlugins() {
    const getEditor = () => this.editor
    const getOpts = () => this.options
    return [
      new Plugin({
        props: {
          handleKeyDown(_view, event: KeyboardEvent): boolean {
            const editor = getEditor()
            const opts = getOpts()
            // The mode toggle works in both Document and Screenplay.
            if (matches('mode-toggle', event)) {
              event.preventDefault()
              opts.onModeToggle()
              return true
            }
            if (opts.mode() === 'script') {
              for (const id of SP_ACTION_IDS) {
                if (matches(id, event)) {
                  event.preventDefault()
                  runAction(editor, opts, id)
                  return true
                }
              }
              return false // Tab / Enter stay with the screenplay keymap
            }
            // Document mode: run the current binding.
            for (const id of DOC_ACTION_IDS) {
              if (matches(id, event)) {
                event.preventDefault()
                runAction(editor, opts, id)
                return true
              }
            }
            // Swallow a default key whose action has been remapped elsewhere, so
            // the built-in (StarterKit / TextAlign) behavior doesn't still fire.
            const combo = eventToCombo(event)
            for (const id of DOC_ACTION_IDS) {
              const def = DEFAULT_OF.get(id)!
              const cur = getBinding(id)
              if (comboEq(combo, def) && (!cur || !comboEq(cur, def))) {
                event.preventDefault()
                return true
              }
            }
            return false
          },
        },
      }),
    ]
  },
})
