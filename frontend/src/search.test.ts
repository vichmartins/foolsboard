import { describe, expect, it } from 'vitest'

import { makeMatcher } from './search'

describe('makeMatcher', () => {
  it('matches everything for an empty query', () => {
    const m = makeMatcher('   ')
    expect(m('anything')).toBe(true)
  })
  it('does case-insensitive substring matching', () => {
    const m = makeMatcher('scene')
    expect(m('The Scene opens')).toBe(true)
    expect(m('nope')).toBe(false)
  })
  it('supports regex queries', () => {
    const m = makeMatcher('scene|act')
    expect(m('act one')).toBe(true)
    expect(m('a wild scene')).toBe(true)
    expect(m('nothing')).toBe(false)
    expect(makeMatcher('^intro')('intro: hello')).toBe(true)
    expect(makeMatcher('^intro')('the intro')).toBe(false)
  })
  it('falls back to substring on an invalid regex', () => {
    const m = makeMatcher('(') // invalid regex
    expect(m('a ( paren')).toBe(true)
    expect(m('no parens')).toBe(false)
  })
})
