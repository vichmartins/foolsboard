// Full-screen media gallery / lightbox. Browse a node's media, zoom + pan
// images, play video and audio, or see a typed card for other files.
import { useCallback, useEffect, useRef, useState } from 'react'
import { fileExt, mediaKind, type Asset } from '../types'

interface Props {
  assets: Asset[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 6

export default function Gallery({ assets, index, onIndexChange, onClose }: Props) {
  const asset = assets[index]
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + assets.length) % assets.length
      onIndexChange(next)
      resetView()
    },
    [index, assets.length, onIndexChange, resetView],
  )

  const kind = asset ? mediaKind(asset) : 'file'

  // Keyboard: Esc closes, arrows navigate, +/- zoom images.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (kind === 'image' && (e.key === '+' || e.key === '=')) {
        setZoom((z) => Math.min(MAX_ZOOM, z + 0.5))
      } else if (kind === 'image' && e.key === '-') {
        setZoom((z) => Math.max(MIN_ZOOM, z - 0.5))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose, kind])

  if (!asset) return null

  const onWheel = (e: React.WheelEvent) => {
    if (kind !== 'image') return
    e.preventDefault()
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.002))
      if (next === 1) setPan({ x: 0, y: 0 })
      return next
    })
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (kind !== 'image' || zoom === 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setPan({
      x: drag.current.px + (e.clientX - drag.current.x),
      y: drag.current.py + (e.clientY - drag.current.y),
    })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <div className="gallery" onClick={onClose}>
      <button className="gallery__close" onClick={onClose} aria-label="Close">✕</button>

      {assets.length > 1 && (
        <>
          <button
            className="gallery__nav gallery__nav--prev"
            onClick={(e) => { e.stopPropagation(); go(-1) }}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            className="gallery__nav gallery__nav--next"
            onClick={(e) => { e.stopPropagation(); go(1) }}
            aria-label="Next"
          >
            ›
          </button>
        </>
      )}

      <div className="gallery__stage" onClick={(e) => e.stopPropagation()}>
        {kind === 'image' && (
          <img
            className="gallery__image"
            src={asset.url ?? ''}
            alt={asset.filename}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              cursor: zoom > 1 ? 'grab' : 'default',
            }}
            draggable={false}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
        )}

        {kind === 'video' && (
          <video className="gallery__media" src={asset.url ?? ''} controls autoPlay />
        )}

        {kind === 'audio' && (
          <div className="gallery__audio">
            {asset.thumbnail_url ? (
              <img src={asset.thumbnail_url} alt="" className="gallery__cover" />
            ) : (
              <div className="gallery__cover gallery__cover--placeholder">♪</div>
            )}
            <audio src={asset.url ?? ''} controls autoPlay />
          </div>
        )}

        {kind === 'file' && (
          <div className="gallery__file">
            <div className="gallery__file-ext">{fileExt(asset.filename) || 'FILE'}</div>
            <div className="gallery__file-name">{asset.filename}</div>
            <a className="btn btn--primary" href={asset.url ?? '#'} download={asset.filename}>
              Download
            </a>
          </div>
        )}
      </div>

      <div className="gallery__bar" onClick={(e) => e.stopPropagation()}>
        <span className="gallery__caption">{asset.filename}</span>
        {kind === 'image' && (
          <span className="gallery__zoom">
            <button onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.5))} aria-label="Zoom out">−</button>
            <button onClick={resetView} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.5))} aria-label="Zoom in">+</button>
          </span>
        )}
        {assets.length > 1 && (
          <span className="gallery__count">{index + 1} / {assets.length}</span>
        )}
      </div>
    </div>
  )
}
