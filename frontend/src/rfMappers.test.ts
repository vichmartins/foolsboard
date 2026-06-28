import { describe, expect, it } from 'vitest'

import { toRFEdge } from './rfMappers'
import type { StoryEdge } from './types'

const base: StoryEdge = {
  id: 'e1', board_id: 'b1', source_id: 's', target_id: 't',
  label: null, data: {}, created_at: '', updated_at: '',
}

describe('toRFEdge', () => {
  it('maps ids and defaults the handles', () => {
    const e = toRFEdge(base)
    expect(e).toMatchObject({
      id: 'e1', type: 'floating', source: 's', target: 't',
      sourceHandle: 'right', targetHandle: 'left', label: undefined,
    })
  })
  it('keeps the label and handle overrides from data', () => {
    const e = toRFEdge({
      ...base, label: 'Cat Calls',
      data: { sourceHandle: 'top', targetHandle: 'bottom' },
    })
    expect(e.label).toBe('Cat Calls')
    expect(e.sourceHandle).toBe('top')
    expect(e.targetHandle).toBe('bottom')
  })
})
