import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import {
  besideOffset,
  graphToPortable,
  portableBox,
  rfNodesBox,
  serializeSelection,
  unionBox,
  type PortableNode,
} from './boardOps'
import type { StoryEdge, StoryNode } from './types'

const pnode = (over: Partial<PortableNode>): PortableNode => ({
  tempId: 'n', type: 'scene', title: '', content: {},
  x: 0, y: 0, width: null, height: null, color: null, ...over,
})

describe('portableBox', () => {
  it('returns null for no nodes', () => {
    expect(portableBox([])).toBeNull()
  })
  it('bounds the nodes (using fallback size when null)', () => {
    const box = portableBox([pnode({ x: 0, y: 0 }), pnode({ x: 100, y: 50 })])
    expect(box).toEqual({ minX: 0, minY: 0, maxX: 280, maxY: 110 }) // 100+180, 50+60
  })
})

describe('rfNodesBox', () => {
  it('bounds RF nodes using measured size', () => {
    const nodes = [
      { id: 'a', position: { x: 0, y: 0 }, data: {}, measured: { width: 100, height: 40 } },
      { id: 'b', position: { x: 20, y: 30 }, data: {}, measured: { width: 100, height: 40 } },
    ] as unknown as Node[]
    expect(rfNodesBox(nodes)).toEqual({ minX: 0, minY: 0, maxX: 120, maxY: 70 })
  })
})

describe('unionBox / besideOffset', () => {
  it('unions two boxes', () => {
    expect(unionBox({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, { minX: 5, minY: -5, maxX: 20, maxY: 8 }))
      .toEqual({ minX: 0, minY: -5, maxX: 20, maxY: 10 })
  })
  it('offsets incoming to the right of existing with a gap', () => {
    const incoming = { minX: 0, minY: 0, maxX: 50, maxY: 50 }
    const existing = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    expect(besideOffset(incoming, existing, 80)).toEqual({ dx: 180, dy: 0 })
  })
})

describe('serializeSelection', () => {
  const story = (over: Partial<StoryNode>): StoryNode =>
    ({ id: '', board_id: 'b', type: 'scene', title: '', content: {}, x: 0, y: 0,
       width: null, height: null, color: null, created_at: '', updated_at: '', ...over })
  const rfNodes = [
    { id: 'a', position: { x: 0, y: 0 }, data: { kind: 'scene', title: 'A', story: story({ id: 'a', title: 'A' }) } },
    { id: 'b', position: { x: 10, y: 0 }, data: { kind: 'dialog', title: 'B', story: story({ id: 'b', title: 'B' }) } },
  ] as unknown as Node[]
  const rfEdges = [
    { id: 'e1', source: 'a', target: 'b', label: 'x', data: {} },
    { id: 'e2', source: 'b', target: 'c', label: null, data: {} }, // c not selected
  ] as unknown as Edge[]

  it('takes only fully-internal edges by default', () => {
    const p = serializeSelection(rfNodes, rfEdges, new Set(['a', 'b']), 'b1')
    expect(p.nodes.map((n) => n.tempId)).toEqual(['a', 'b'])
    expect(p.edges).toHaveLength(1)
    expect(p.edges[0]).toMatchObject({ source: 'a', target: 'b', label: 'x' })
  })
  it('includes half-attached edges when edgesTouching', () => {
    const p = serializeSelection(rfNodes, rfEdges, new Set(['a', 'b']), 'b1', { edgesTouching: true })
    expect(p.edges).toHaveLength(2)
  })
})

describe('graphToPortable', () => {
  it('maps a whole graph', () => {
    const nodes: StoryNode[] = [
      { id: 'n1', board_id: 'b', type: 'scene', title: 'T', content: { x: 1 },
        x: 5, y: 6, width: 10, height: 20, color: '#fff', created_at: '', updated_at: '' },
    ]
    const edges: StoryEdge[] = [
      { id: 'e1', board_id: 'b', source_id: 'n1', target_id: 'n1', label: 'L', data: {}, created_at: '', updated_at: '' },
    ]
    const p = graphToPortable('b', nodes, edges)
    expect(p.sourceBoardId).toBe('b')
    expect(p.nodes[0]).toMatchObject({ tempId: 'n1', title: 'T', x: 5, color: '#fff' })
    expect(p.edges[0]).toMatchObject({ source: 'n1', target: 'n1', label: 'L' })
  })
})
