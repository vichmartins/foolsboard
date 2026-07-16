import { describe, expect, it } from 'vitest'

import {
  fileExt,
  isMediaNodeType,
  KIND_COLORS,
  liveMediaFields,
  mediaKind,
  NODE_TYPES,
  nodePreview,
  OBJECT_COLOR,
  safeHref,
  typeLabel,
  uploadSizeError,
  type Asset,
} from './types'

describe('nodePreview', () => {
  it('returns the first non-empty type field', () => {
    expect(nodePreview('scene', { location: 'Peak', summary: 'x' })).toBe('Peak')
    expect(nodePreview('scene', { location: '', summary: 'Later' })).toBe('Later')
    expect(nodePreview('dialog', { speaker: 'Bob', line: 'Hi' })).toBe('Bob')
  })
  it('trims and ignores blank/non-string values', () => {
    expect(nodePreview('scene', { location: '   spaced  ' })).toBe('spaced')
    expect(nodePreview('scene', { location: 42 as unknown as string })).toBe('')
  })
  it('returns empty string when nothing is filled', () => {
    expect(nodePreview('scene', {})).toBe('')
  })
  it('falls back to note fields for unknown types', () => {
    expect(nodePreview('mystery', { text: 'note body' })).toBe('note body')
  })
})

describe('typeLabel', () => {
  it('maps special cases and capitalizes the rest', () => {
    expect(typeLabel('note')).toBe('Notes')
    expect(typeLabel('')).toBe('Object')
    expect(typeLabel('scene')).toBe('Scene')
    expect(typeLabel('character')).toBe('Character')
  })
})

describe('mediaKind', () => {
  const asset = (content_type: string): Asset =>
    ({ content_type }) as Asset
  it('classifies by content-type prefix', () => {
    expect(mediaKind(asset('image/png'))).toBe('image')
    expect(mediaKind(asset('video/mp4'))).toBe('video')
    expect(mediaKind(asset('audio/ogg'))).toBe('audio')
    expect(mediaKind(asset('application/zip'))).toBe('file')
    expect(mediaKind(asset(''))).toBe('file')
  })
})

describe('liveMediaFields', () => {
  const asset = (over: Partial<Asset>): Asset =>
    ({
      id: 'a1',
      node_id: 'n1',
      kind: 'audio',
      filename: 'clip.ogg',
      content_type: 'audio/ogg',
      size: 1,
      url: '/media/new.ogg',
      thumbnail_url: null,
      processing: false,
      created_at: '',
      ...over,
    }) as Asset

  it('prefers the live asset over the cached content (transcode swap)', () => {
    // Node was uploaded as an m4a; a background re-encode swapped it for an ogg.
    const content = {
      assetId: 'a1',
      url: '/media/old.m4a',
      filename: 'Jobless Jim.m4a',
      mediaKind: 'audio',
      thumbnailUrl: '',
    }
    const byId = new Map([['a1', asset({ filename: 'Jobless Jim.ogg', url: '/media/new.ogg' })]])
    const r = liveMediaFields(content, byId)
    expect(r.url).toBe('/media/new.ogg')
    expect(r.filename).toBe('Jobless Jim.ogg')
    expect(r.mediaKind).toBe('audio')
  })

  it('falls back to cached content when the asset is unknown (e.g. links)', () => {
    const content = { url: 'https://example.com', filename: 'link', mediaKind: '' }
    const r = liveMediaFields(content, new Map())
    expect(r.url).toBe('https://example.com')
    expect(r.filename).toBe('link')
  })

  it('falls back to cached content when the live asset has no url yet', () => {
    const content = { assetId: 'a1', url: '/media/old.m4a', filename: 'x.m4a', mediaKind: 'audio' }
    const byId = new Map([['a1', asset({ url: null })]])
    const r = liveMediaFields(content, byId)
    expect(r.url).toBe('/media/old.m4a')
    expect(r.filename).toBe('x.m4a')
  })
})

describe('fileExt', () => {
  it('returns the uppercased extension or empty', () => {
    expect(fileExt('pic.png')).toBe('PNG')
    expect(fileExt('archive.tar.gz')).toBe('GZ')
    expect(fileExt('noext')).toBe('')
    expect(fileExt('.hidden')).toBe('') // leading dot only -> no extension
  })
})

describe('isMediaNodeType', () => {
  it('is true only for media and link', () => {
    expect(isMediaNodeType('media')).toBe(true)
    expect(isMediaNodeType('link')).toBe(true)
    expect(isMediaNodeType('scene')).toBe(false)
    expect(isMediaNodeType(undefined)).toBe(false)
  })
})

describe('safeHref', () => {
  it('passes through safe URLs and relative paths', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com')
    expect(safeHref('/media/x.png')).toBe('/media/x.png')
  })
  it('blocks dangerous schemes', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined()
    // eslint-disable-next-line no-script-url
    expect(safeHref('  java\tscript:alert(1)')).toBeUndefined() // control chars stripped, still blocked
  })
  it('returns undefined for empty/nullish', () => {
    expect(safeHref('')).toBeUndefined()
    expect(safeHref(null)).toBeUndefined()
    expect(safeHref(undefined)).toBeUndefined()
  })
})

describe('uploadSizeError', () => {
  const fileOfSize = (type: string, size: number): File => {
    const f = new File(['x'], 'f', { type })
    Object.defineProperty(f, 'size', { value: size })
    return f
  }
  it('returns null when within the limit', () => {
    expect(uploadSizeError(fileOfSize('image/png', 1024))).toBeNull()
  })
  it('returns a message when over the limit', () => {
    const msg = uploadSizeError(fileOfSize('image/png', 50 * 1024 * 1024))
    expect(msg).toContain('Images are limited')
  })
})

describe('constants', () => {
  it('NODE_TYPES are the expected kinds', () => {
    expect([...NODE_TYPES]).toEqual(['scene', 'character', 'dialog', 'event', 'note', 'doc'])
  })
  it('every node type has an accent color', () => {
    for (const t of NODE_TYPES) expect(KIND_COLORS[t]).toMatch(/^#[0-9a-f]{6}$/i)
    expect(OBJECT_COLOR).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
