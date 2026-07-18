import { describe, expect, it, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'

import VideoPlayer from './VideoPlayer'

beforeAll(() => {
  // jsdom doesn't expose PiP support; pretend it does so the button renders.
  Object.defineProperty(document, 'pictureInPictureEnabled', {
    value: true,
    configurable: true,
  })
})

describe('VideoPlayer', () => {
  it('drives a controls-less <video> so the browser adds no drifting PiP/overlay', () => {
    const { container } = render(<VideoPlayer src="blob:vid" />)
    const video = container.querySelector('video')
    expect(video).toBeTruthy()
    // Native controls (and thus the native PiP overlay that drifts) are off; we
    // never disable PiP either, so our own PiP button still works.
    expect(video?.hasAttribute('controls')).toBe(false)
    expect(video?.hasAttribute('disablePictureInPicture')).toBe(false)
  })

  it('renders in-video play, seek, mute, picture-in-picture and fullscreen controls', () => {
    render(<VideoPlayer src="blob:vid" />)
    expect(screen.getByLabelText('Play')).toBeTruthy()
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeTruthy()
    expect(screen.getByLabelText('Mute')).toBeTruthy()
    expect(screen.getByLabelText(/picture-in-picture/i)).toBeTruthy()
    expect(screen.getByLabelText('Fullscreen')).toBeTruthy()
  })
})
