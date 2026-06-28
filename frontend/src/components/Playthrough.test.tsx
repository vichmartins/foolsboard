import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import Playthrough, { type PlayEdge } from './Playthrough'
import type { Asset, StoryNode } from '../types'

const node = (id: string, over: Partial<StoryNode> = {}): StoryNode => ({
  id, board_id: 'b', type: 'scene', title: id.toUpperCase(), content: {},
  x: 0, y: 0, width: null, height: null, color: null, created_at: '', updated_at: '', ...over,
})

function setup(nodes: StoryNode[], edges: PlayEdge[], startId?: string) {
  const onClose = vi.fn()
  render(
    <Playthrough nodes={nodes} edges={edges} assets={new Map<string, Asset[]>()} startId={startId} onClose={onClose} />,
  )
  return { onClose }
}

describe('Playthrough', () => {
  it('shows the start chooser when there are several entry points', () => {
    setup(
      [node('a'), node('b'), node('c'), node('d')],
      [{ source_id: 'a', target_id: 'b', label: null }, { source_id: 'c', target_id: 'd', label: null }],
    )
    expect(screen.getByText('Where would you like to start?')).toBeInTheDocument()
  })

  it('starts at the given object and shows a Next button for a single link', () => {
    setup([node('a'), node('b')], [{ source_id: 'a', target_id: 'b', label: null }], 'a')
    expect(screen.getByRole('heading', { name: 'A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument()
  })

  it('advances with Next and reaches an ending', () => {
    setup([node('a'), node('b')], [{ source_id: 'a', target_id: 'b', label: null }], 'a')
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByRole('heading', { name: 'B' })).toBeInTheDocument()
    // B's only neighbour is where we came from -> ending
    expect(screen.getByText('The end')).toBeInTheDocument()
  })

  it('renders connection labels as choices at a branch and follows the picked one', () => {
    setup(
      [node('a'), node('b'), node('c')],
      [
        { source_id: 'a', target_id: 'b', label: 'go left' },
        { source_id: 'a', target_id: 'c', label: 'go right' },
      ],
      'a',
    )
    expect(screen.getByRole('button', { name: /go left/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /go right/ }))
    expect(screen.getByRole('heading', { name: 'C' })).toBeInTheDocument()
  })

  it('treats connections as two-way (can start mid-chain and walk back)', () => {
    setup(
      [node('a'), node('b'), node('c')],
      [{ source_id: 'a', target_id: 'b', label: null }, { source_id: 'b', target_id: 'c', label: null }],
      'b',
    )
    // From B you can reach both A and C (undirected) -> a branch
    expect(screen.getByRole('heading', { name: 'B' })).toBeInTheDocument()
    expect(screen.getAllByText(/^(A|C)$/, { selector: '.pt-choice__label' })).toHaveLength(2)
  })

  it('calls onClose from the exit button and from Escape', async () => {
    const { onClose } = setup([node('a'), node('b')], [{ source_id: 'a', target_id: 'b', label: null }], 'a')
    fireEvent.click(screen.getByLabelText('Exit playthrough'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2))
  })
})
