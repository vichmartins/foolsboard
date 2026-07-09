import { afterEach, describe, expect, it } from 'vitest'
import {
  ACTIONS,
  comboEq,
  eventToCombo,
  findConflict,
  formatCombo,
  getBinding,
  isCustom,
  matches,
  resetAll,
  resetBinding,
  setBinding,
  toTiptap,
  type Combo,
} from './keymap'

const combo = (mod: boolean, alt: boolean, shift: boolean, code: string): Combo => ({ mod, alt, shift, code })

afterEach(() => resetAll())

describe('keymap combo helpers', () => {
  it('formats a combo for display', () => {
    expect(formatCombo(combo(true, false, true, 'KeyB'))).toEqual(['Ctrl', 'Shift', 'B'])
    expect(formatCombo(combo(true, true, false, 'Digit1'))).toEqual(['Ctrl', 'Alt', '1'])
    expect(formatCombo(combo(false, false, false, 'Equal'))).toEqual(['='])
    expect(formatCombo(combo(true, false, true, 'Period'))).toEqual(['Ctrl', 'Shift', '.'])
  })

  it('converts a combo to a TipTap keymap string', () => {
    expect(toTiptap(combo(true, false, true, 'KeyB'))).toBe('Mod-Shift-b')
    expect(toTiptap(combo(true, true, false, 'Digit1'))).toBe('Mod-Alt-1')
    expect(toTiptap(combo(true, false, true, 'Comma'))).toBe('Mod-Shift-,')
    expect(toTiptap(combo(false, false, false, 'KeyF'))).toBe('f')
  })

  it('reads a combo from a keyboard event (mod = ctrl or meta)', () => {
    const e = { ctrlKey: false, metaKey: true, altKey: false, shiftKey: true, code: 'KeyK' } as KeyboardEvent
    expect(eventToCombo(e)).toEqual(combo(true, false, true, 'KeyK'))
  })

  it('compares combos', () => {
    expect(comboEq(combo(true, false, false, 'KeyB'), combo(true, false, false, 'KeyB'))).toBe(true)
    expect(comboEq(combo(true, false, false, 'KeyB'), combo(true, false, true, 'KeyB'))).toBe(false)
  })
})

describe('keymap bindings + persistence', () => {
  it('returns defaults until overridden, then persists', () => {
    expect(getBinding('bold')).toEqual(combo(true, false, false, 'KeyB'))
    expect(isCustom('bold')).toBe(false)
    setBinding('bold', combo(true, true, false, 'KeyB'))
    expect(getBinding('bold')).toEqual(combo(true, true, false, 'KeyB'))
    expect(isCustom('bold')).toBe(true)
    resetBinding('bold')
    expect(getBinding('bold')).toEqual(combo(true, false, false, 'KeyB'))
    expect(isCustom('bold')).toBe(false)
  })

  it('setting a binding back to its default clears the override', () => {
    setBinding('italic', combo(true, false, true, 'KeyI'))
    expect(isCustom('italic')).toBe(true)
    const def = ACTIONS.find((a) => a.id === 'italic')!.def
    setBinding('italic', def)
    expect(isCustom('italic')).toBe(false)
  })

  it('matches an event against the current binding', () => {
    const e = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, code: 'KeyB' } as KeyboardEvent
    expect(matches('bold', e)).toBe(true)
    setBinding('bold', combo(true, true, false, 'KeyB'))
    expect(matches('bold', e)).toBe(false)
  })

  it('supports an unbound (null) binding that matches nothing', () => {
    const e = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, code: 'KeyB' } as KeyboardEvent
    setBinding('bold', null)
    expect(getBinding('bold')).toBeNull()
    expect(isCustom('bold')).toBe(true)
    expect(matches('bold', e)).toBe(false)
    // An unbound action is skipped by conflict detection.
    expect(findConflict(combo(true, false, false, 'KeyB'), 'italic')).toBeNull()
  })
})

describe('keymap conflict detection', () => {
  it('flags a duplicate within the same scope', () => {
    // bold's default is Ctrl+B (editor scope); assigning it to italic conflicts.
    const conflict = findConflict(combo(true, false, false, 'KeyB'), 'italic')
    expect(conflict?.id).toBe('bold')
  })

  it('does NOT flag the same combo in a different scope', () => {
    // 'sidebar' (app) is also Ctrl+B, but italic is editor scope → not a conflict.
    const conflict = findConflict(combo(true, false, false, 'KeyB'), 'italic')
    expect(conflict?.id).not.toBe('sidebar')
  })

  it('returns null for an unused combo', () => {
    expect(findConflict(combo(true, true, true, 'KeyZ'), 'bold')).toBeNull()
  })

  it('has no conflicts among its own defaults', () => {
    for (const a of ACTIONS) {
      expect(findConflict(a.def, a.id)).toBeNull()
    }
  })
})
