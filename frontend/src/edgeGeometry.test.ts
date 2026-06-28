import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'

import {
  findNodeAt,
  NODE_FALLBACK_H,
  NODE_FALLBACK_W,
  nodeSize,
  snapToBorder,
} from './edgeGeometry'

const node = (id: string, x: number, y: number, w?: number, h?: number): Node =>
  ({
    id,
    position: { x, y },
    data: {},
    measured: w != null ? { width: w, height: h } : undefined,
  }) as Node

describe('nodeSize', () => {
  it('uses measured size when present', () => {
    expect(nodeSize(node('a', 0, 0, 200, 100))).toEqual({ w: 200, h: 100 })
  })
  it('falls back when unmeasured', () => {
    expect(nodeSize(node('a', 0, 0))).toEqual({ w: NODE_FALLBACK_W, h: NODE_FALLBACK_H })
  })
})

describe('snapToBorder', () => {
  // box at (0,0) size 100x100
  it('snaps to the nearest side with t along it', () => {
    expect(snapToBorder(50, 2, 0, 0, 100, 100)).toEqual({ side: 'top', t: 0.5 })
    expect(snapToBorder(50, 98, 0, 0, 100, 100)).toEqual({ side: 'bottom', t: 0.5 })
    expect(snapToBorder(2, 25, 0, 0, 100, 100)).toEqual({ side: 'left', t: 0.25 })
    expect(snapToBorder(98, 75, 0, 0, 100, 100)).toEqual({ side: 'right', t: 0.75 })
  })
  it('clamps t to 0..1', () => {
    expect(snapToBorder(-50, 2, 0, 0, 100, 100).t).toBe(0)
    expect(snapToBorder(500, 2, 0, 0, 100, 100).t).toBe(1)
  })
})

describe('findNodeAt', () => {
  const nodes = [node('a', 0, 0, 100, 100), node('b', 50, 50, 100, 100)]
  it('returns the topmost (last) node containing the point', () => {
    expect(findNodeAt(nodes, { x: 75, y: 75 })?.id).toBe('b')
  })
  it('excludes the given id', () => {
    expect(findNodeAt(nodes, { x: 75, y: 75 }, 'b')?.id).toBe('a')
  })
  it('returns null when nothing matches (outside margin)', () => {
    expect(findNodeAt(nodes, { x: 1000, y: 1000 })).toBeNull()
  })
  it('latches on within the margin', () => {
    // just left of node a's left border, within default margin 24
    expect(findNodeAt([node('a', 100, 100, 100, 100)], { x: 80, y: 150 })?.id).toBe('a')
  })
})
