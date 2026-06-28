import { describe, expect, it } from 'vitest'

import { collabColor, HIGHLIGHT_PALETTE } from './collab'

describe('collabColor', () => {
  it('is deterministic and returns a palette color', () => {
    const id = '11111111-2222-3333-4444-555555555555'
    const c = collabColor(id)
    expect(HIGHLIGHT_PALETTE).toContain(c)
    expect(collabColor(id)).toBe(c)
  })
  it('falls back to the first palette color on a malformed id', () => {
    expect(collabColor('not-a-uuid!!')).toBe(HIGHLIGHT_PALETTE[0])
  })
  it('palette has the expected size (matches backend)', () => {
    expect(HIGHLIGHT_PALETTE).toHaveLength(12)
    for (const c of HIGHLIGHT_PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
