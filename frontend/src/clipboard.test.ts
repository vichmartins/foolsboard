import { beforeEach, describe, expect, it } from 'vitest'

import type { Portable } from './boardOps'
import { clipboardHasContent, readClipboard, writeClipboard } from './clipboard'

const sample: Portable = {
  sourceBoardId: 'b1',
  nodes: [
    {
      tempId: 'n1', type: 'scene', title: 'A', content: {},
      x: 0, y: 0, width: null, height: null, color: null,
    },
  ],
  edges: [],
}

describe('clipboard', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips through localStorage', () => {
    writeClipboard(sample)
    expect(readClipboard()).toEqual(sample)
    expect(clipboardHasContent()).toBe(true)
  })
  it('is empty by default', () => {
    expect(readClipboard()).toBeNull()
    expect(clipboardHasContent()).toBe(false)
  })
  it('rejects malformed or empty-node payloads', () => {
    localStorage.setItem('foolsboard:clipboard', 'not json')
    expect(readClipboard()).toBeNull()
    localStorage.setItem('foolsboard:clipboard', JSON.stringify({ nodes: [] }))
    expect(readClipboard()).toBeNull()
  })
})
