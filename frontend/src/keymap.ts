// Central, user-customizable keyboard map. Every remappable action is registered
// here with a default binding; user overrides persist to localStorage. Handlers
// (app-level keydown listeners and the editor's TipTap keymap) resolve their keys
// through this store instead of hardcoding them, so the Shortcuts dialog can
// reassign anything with conflict detection.
//
// A binding is a Combo: the primary modifier (Ctrl on Windows/Linux, Cmd on Mac)
// plus Alt/Shift, plus a physical key `code` (e.g. 'KeyB', 'Digit1', 'Period').
// Using `code` keeps bindings layout- and shift-stable.
import { useSyncExternalStore } from 'react'

export type Scope = 'app' | 'editor' | 'screenplay'

export interface Combo {
  mod: boolean // Ctrl or Cmd
  alt: boolean
  shift: boolean
  code: string // KeyboardEvent.code
}

export interface ActionDef {
  id: string
  group: string
  label: string
  scope: Scope
  def: Combo
}

const c = (mod: boolean, alt: boolean, shift: boolean, code: string): Combo => ({
  mod,
  alt,
  shift,
  code,
})

// The registry. Order within a group is the display order in the dialog.
export const ACTIONS: ActionDef[] = [
  // Workspace
  { id: 'sidebar', group: 'Workspace', label: 'Toggle the Explorer sidebar', scope: 'app', def: c(true, false, false, 'KeyB') },
  { id: 'search', group: 'Workspace', label: 'Search across all boards', scope: 'app', def: c(true, false, false, 'KeyK') },
  // Board
  { id: 'board-create', group: 'Board', label: 'Create board', scope: 'app', def: c(true, true, false, 'KeyN') },
  { id: 'board-rename', group: 'Board', label: 'Rename board', scope: 'app', def: c(true, true, false, 'KeyR') },
  { id: 'board-move', group: 'Board', label: 'Move board', scope: 'app', def: c(true, true, false, 'KeyM') },
  { id: 'board-merge', group: 'Board', label: 'Merge boards', scope: 'app', def: c(true, true, false, 'KeyG') },
  { id: 'board-share', group: 'Board', label: 'Share board', scope: 'app', def: c(true, true, false, 'KeyS') },
  { id: 'board-delete', group: 'Board', label: 'Delete board', scope: 'app', def: c(true, true, false, 'KeyD') },
  { id: 'board-io', group: 'Board', label: 'Import / Export', scope: 'app', def: c(true, true, false, 'KeyE') },
  // View (single keys, active only outside inputs)
  { id: 'zoom-in', group: 'View', label: 'Zoom in', scope: 'app', def: c(false, false, false, 'Equal') },
  { id: 'zoom-out', group: 'View', label: 'Zoom out', scope: 'app', def: c(false, false, false, 'Minus') },
  { id: 'fit', group: 'View', label: 'Fit board to screen', scope: 'app', def: c(false, false, false, 'KeyF') },
  { id: 'play', group: 'View', label: 'Play through the story', scope: 'app', def: c(false, false, false, 'KeyP') },
  { id: 'export-image', group: 'View', label: 'Export board as image (PNG)', scope: 'app', def: c(false, false, false, 'KeyE') },
  { id: 'new-doc', group: 'View', label: 'New document', scope: 'app', def: c(false, false, false, 'KeyD') },
  // Object (act on the selected object(s) on the canvas)
  { id: 'bring-to-front', group: 'Object', label: 'Bring to front', scope: 'app', def: c(true, false, true, 'BracketRight') },
  { id: 'send-to-back', group: 'Object', label: 'Send to back', scope: 'app', def: c(true, false, true, 'BracketLeft') },
  { id: 'object-move', group: 'Object', label: 'Move to board / folder', scope: 'app', def: c(true, false, true, 'KeyM') },
  // Document editor
  { id: 'bold', group: 'Document editor', label: 'Bold', scope: 'editor', def: c(true, false, false, 'KeyB') },
  { id: 'italic', group: 'Document editor', label: 'Italic', scope: 'editor', def: c(true, false, false, 'KeyI') },
  { id: 'underline', group: 'Document editor', label: 'Underline', scope: 'editor', def: c(true, false, false, 'KeyU') },
  { id: 'strike', group: 'Document editor', label: 'Strikethrough', scope: 'editor', def: c(true, false, true, 'KeyS') },
  { id: 'highlight', group: 'Document editor', label: 'Highlight (toggle)', scope: 'editor', def: c(true, false, true, 'KeyH') },
  { id: 'font-inc', group: 'Document editor', label: 'Increase font size', scope: 'editor', def: c(true, false, true, 'Period') },
  { id: 'font-dec', group: 'Document editor', label: 'Decrease font size', scope: 'editor', def: c(true, false, true, 'Comma') },
  { id: 'h1', group: 'Document editor', label: 'Heading 1', scope: 'editor', def: c(true, true, false, 'Digit1') },
  { id: 'h2', group: 'Document editor', label: 'Heading 2', scope: 'editor', def: c(true, true, false, 'Digit2') },
  { id: 'h3', group: 'Document editor', label: 'Heading 3', scope: 'editor', def: c(true, true, false, 'Digit3') },
  { id: 'h4', group: 'Document editor', label: 'Heading 4', scope: 'editor', def: c(true, true, false, 'Digit4') },
  { id: 'h5', group: 'Document editor', label: 'Heading 5', scope: 'editor', def: c(true, true, false, 'Digit5') },
  { id: 'align-left', group: 'Document editor', label: 'Align left', scope: 'editor', def: c(true, false, true, 'KeyL') },
  { id: 'align-center', group: 'Document editor', label: 'Align center', scope: 'editor', def: c(true, false, true, 'KeyE') },
  { id: 'align-right', group: 'Document editor', label: 'Align right', scope: 'editor', def: c(true, false, true, 'KeyR') },
  { id: 'align-justify', group: 'Document editor', label: 'Justify', scope: 'editor', def: c(true, false, true, 'KeyJ') },
  { id: 'bullet-list', group: 'Document editor', label: 'Bullet list', scope: 'editor', def: c(true, false, true, 'Digit8') },
  { id: 'ordered-list', group: 'Document editor', label: 'Numbered list', scope: 'editor', def: c(true, false, true, 'Digit7') },
  { id: 'task-list', group: 'Document editor', label: 'Checklist', scope: 'editor', def: c(true, false, true, 'Digit9') },
  { id: 'quote', group: 'Document editor', label: 'Quote', scope: 'editor', def: c(true, false, true, 'KeyB') },
  { id: 'code-block', group: 'Document editor', label: 'Code block', scope: 'editor', def: c(true, true, false, 'KeyC') },
  { id: 'link', group: 'Document editor', label: 'Link', scope: 'editor', def: c(true, false, true, 'KeyK') },
  { id: 'image', group: 'Document editor', label: 'Image by URL', scope: 'editor', def: c(true, true, false, 'KeyI') },
  { id: 'table', group: 'Document editor', label: 'Insert table', scope: 'editor', def: c(true, true, false, 'KeyT') },
  { id: 'mode-toggle', group: 'Document editor', label: 'Switch Document / Screenplay', scope: 'editor', def: c(true, false, true, 'KeyM') },
  // Screenplay
  { id: 'sp-scene', group: 'Screenplay mode', label: 'Element: Scene', scope: 'screenplay', def: c(true, false, false, 'Digit1') },
  { id: 'sp-action', group: 'Screenplay mode', label: 'Element: Action', scope: 'screenplay', def: c(true, false, false, 'Digit2') },
  { id: 'sp-character', group: 'Screenplay mode', label: 'Element: Character', scope: 'screenplay', def: c(true, false, false, 'Digit3') },
  { id: 'sp-dialogue', group: 'Screenplay mode', label: 'Element: Dialogue', scope: 'screenplay', def: c(true, false, false, 'Digit4') },
  { id: 'sp-parenthetical', group: 'Screenplay mode', label: 'Element: Parenthetical', scope: 'screenplay', def: c(true, false, false, 'Digit5') },
  { id: 'sp-transition', group: 'Screenplay mode', label: 'Element: Transition', scope: 'screenplay', def: c(true, false, false, 'Digit6') },
  { id: 'sp-shot', group: 'Screenplay mode', label: 'Element: Shot', scope: 'screenplay', def: c(true, false, false, 'Digit7') },
]

const BY_ID = new Map(ACTIONS.map((a) => [a.id, a]))

// --- persistence -----------------------------------------------------------
const STORAGE_KEY = 'foolsboard:keymap'
// An override of `null` means the action is deliberately unbound (no shortcut) —
// used when a conflict is resolved by taking the key away from the other action.
let overrides: Record<string, Combo | null> = load()

function load(): Record<string, Combo | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Combo | null>
    const out: Record<string, Combo | null> = {}
    for (const [id, combo] of Object.entries(parsed)) {
      if (!BY_ID.has(id)) continue
      if (combo === null) out[id] = null
      else if (combo && typeof combo.code === 'string') {
        out[id] = { mod: !!combo.mod, alt: !!combo.alt, shift: !!combo.shift, code: combo.code }
      }
    }
    return out
  } catch {
    return {}
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    /* ignore quota / unavailable storage */
  }
}

// --- change notification ---------------------------------------------------
const listeners = new Set<() => void>()
let version = 0
function emit() {
  version++
  listeners.forEach((l) => l())
}

// --- combo helpers ---------------------------------------------------------
export function comboEq(a: Combo, b: Combo): boolean {
  return a.mod === b.mod && a.alt === b.alt && a.shift === b.shift && a.code === b.code
}

export function eventToCombo(e: KeyboardEvent): Combo {
  return { mod: e.ctrlKey || e.metaKey, alt: e.altKey, shift: e.shiftKey, code: e.code }
}

// A key press that is only a modifier isn't a valid binding on its own.
const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight',
  'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight',
])
export function isBindableCode(code: string): boolean {
  return !!code && !MODIFIER_CODES.has(code)
}

const CODE_LABELS: Record<string, string> = {
  Equal: '=', Minus: '−', Period: '.', Comma: ',', Slash: '/', Backslash: '\\',
  Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backquote: '`',
  Space: 'Space', Enter: 'Enter', Tab: 'Tab', Escape: 'Esc', Backspace: 'Backspace', Delete: 'Del',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
}
function codeLabel(code: string): string {
  if (CODE_LABELS[code]) return CODE_LABELS[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6)
  return code
}

// Display parts for a combo, e.g. ['Ctrl', 'Shift', 'B'].
export function formatCombo(combo: Combo): string[] {
  const parts: string[] = []
  if (combo.mod) parts.push('Ctrl')
  if (combo.alt) parts.push('Alt')
  if (combo.shift) parts.push('Shift')
  parts.push(codeLabel(combo.code))
  return parts
}

const TIPTAP_KEYS: Record<string, string> = {
  Equal: '=', Minus: '-', Period: '.', Comma: ',', Slash: '/', Backslash: '\\',
  Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backquote: '`',
  Space: ' ', Enter: 'Enter', Tab: 'Tab', Escape: 'Escape', Backspace: 'Backspace', Delete: 'Delete',
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
}
function tiptapKey(code: string): string {
  if (code.startsWith('Key')) return code.slice(3).toLowerCase()
  if (code.startsWith('Digit')) return code.slice(5)
  return TIPTAP_KEYS[code] ?? code
}

// ProseMirror/TipTap keymap string, e.g. 'Mod-Shift-b'.
export function toTiptap(combo: Combo): string {
  const parts: string[] = []
  if (combo.mod) parts.push('Mod')
  if (combo.alt) parts.push('Alt')
  if (combo.shift) parts.push('Shift')
  parts.push(tiptapKey(combo.code))
  return parts.join('-')
}

// --- public API ------------------------------------------------------------
// The action's current binding, or null if it's been left unbound.
export function getBinding(id: string): Combo | null {
  const a = BY_ID.get(id)
  if (!a) throw new Error(`Unknown action: ${id}`)
  return id in overrides ? overrides[id] : a.def
}

export function isCustom(id: string): boolean {
  return id in overrides
}

// Two actions conflict when they share a combo and their scopes can both be
// active at once. App shortcuts skip editable targets, so app never overlaps the
// editor; document (editor) and screenplay never run at the same time. Hence a
// conflict is simply "same combo within the same scope".
export function findConflict(combo: Combo, exceptId: string): ActionDef | null {
  const self = BY_ID.get(exceptId)
  if (!self) return null
  for (const a of ACTIONS) {
    if (a.id === exceptId) continue
    if (a.scope !== self.scope) continue
    const b = getBinding(a.id)
    if (b && comboEq(b, combo)) return a
  }
  return null
}

export function setBinding(id: string, combo: Combo | null): void {
  const a = BY_ID.get(id)
  if (!a) return
  if (combo && comboEq(combo, a.def)) delete overrides[id]
  else overrides[id] = combo
  persist()
  emit()
}

// Leave an action with no shortcut (used to resolve a conflict).
export function unbind(id: string): void {
  setBinding(id, null)
}

export function resetBinding(id: string): void {
  if (id in overrides) {
    delete overrides[id]
    persist()
    emit()
  }
}

export function resetAll(): void {
  if (Object.keys(overrides).length === 0) return
  overrides = {}
  persist()
  emit()
}

// The action's current binding as a display string ("Ctrl+Shift+M"), or '' if
// unbound. The single source of truth for every shortcut hint shown in the UI —
// tooltips, menus, labels — so they always match the real (customizable) keymap.
export function hint(id: string): string {
  const b = getBinding(id)
  return b ? formatCombo(b).join('+') : ''
}

// Same, formatted as a tooltip suffix: " (Ctrl+Shift+M)", or '' if unbound.
export function hintSuffix(id: string): string {
  const h = hint(id)
  return h ? ` (${h})` : ''
}

// Does an event match an action's current binding?
export function matches(id: string, e: KeyboardEvent): boolean {
  const b = getBinding(id)
  return b ? comboEq(eventToCombo(e), b) : false
}

// True when the event targets a text input / textarea / rich-text editor, where
// app-level shortcuts should stand down and let typing (and the editor's own
// keymap) win.
export function isTypingTarget(e: Event): boolean {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

// React hook: re-render when any binding changes. Returns a version counter.
export function useKeymap(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => version,
    () => version,
  )
}
