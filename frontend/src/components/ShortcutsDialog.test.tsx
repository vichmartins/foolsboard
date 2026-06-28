import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import ShortcutsDialog from './ShortcutsDialog'

describe('ShortcutsDialog', () => {
  it('lists the View shortcuts we added', () => {
    render(<ShortcutsDialog onClose={() => {}} />)
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('View')).toBeInTheDocument()
    expect(screen.getByText('Zoom in')).toBeInTheDocument()
    expect(screen.getByText(/Play through the story/)).toBeInTheDocument()
    expect(screen.getByText('Export board as image (PNG)')).toBeInTheDocument()
  })

  it('closes on Escape and on the Close button', () => {
    const onClose = vi.fn()
    render(<ShortcutsDialog onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
