import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import WhatsNewDialog from './WhatsNewDialog'

describe('WhatsNewDialog', () => {
  it('renders the changelog with a version and at least one item', () => {
    const { container } = render(<WhatsNewDialog onClose={() => {}} />)
    expect(screen.getByText("What's New")).toBeInTheDocument()
    expect(container.querySelectorAll('.whatsnew__rel').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.whatsnew__item').length).toBeGreaterThan(0)
  })

  it('gives every entry a category icon (no bare bullets)', () => {
    const { container } = render(<WhatsNewDialog onClose={() => {}} />)
    const items = container.querySelectorAll('.whatsnew__item')
    for (const item of items) {
      expect(item.querySelector('.whatsnew__icon svg')).not.toBeNull()
    }
  })

  it('closes via the Got it button', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
