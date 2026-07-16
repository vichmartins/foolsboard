// A small, self-contained audio player used by media nodes instead of the
// browser's native <audio controls>. The native control renders inconsistently
// across browsers (and has a habit of getting stuck in a broken/collapsed state
// when its source is swapped), so we drive a hidden <audio> element ourselves and
// draw a compact play / scrubber / time UI that looks the same everywhere.
import { useEffect, useRef, useState } from 'react'

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AudioPlayer({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)
  const [err, setErr] = useState(false)

  useEffect(() => {
    const a = ref.current
    if (!a) return
    const onMeta = () => setDur(Number.isFinite(a.duration) ? a.duration : 0)
    const onTime = () => setCur(a.currentTime)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setPlaying(false)
    const onErr = () => setErr(true)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('ended', onEnded)
    a.addEventListener('error', onErr)
    return () => {
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('ended', onEnded)
      a.removeEventListener('error', onErr)
    }
  }, [])

  // A new src (e.g. a background re-encode swapped the file) resets state and
  // reloads, so the element never lingers in a stale/errored state.
  useEffect(() => {
    setErr(false)
    setPlaying(false)
    setCur(0)
    setDur(0)
    ref.current?.load()
  }, [src])

  function toggle() {
    const a = ref.current
    if (!a) return
    if (a.paused) void a.play().catch(() => setErr(true))
    else a.pause()
  }

  function scrubTo(clientX: number) {
    const a = ref.current
    const bar = barRef.current
    if (!a || !bar || !dur) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    a.currentTime = ratio * dur
    setCur(a.currentTime)
  }

  function onBarPointerDown(e: React.PointerEvent) {
    e.stopPropagation()
    scrubTo(e.clientX)
    const move = (ev: PointerEvent) => scrubTo(ev.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const pct = dur > 0 ? (cur / dur) * 100 : 0

  return (
    <div className={'audio-player nodrag' + (err ? ' audio-player--err' : '')}>
      <button
        type="button"
        className="audio-player__btn"
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
        aria-label={playing ? 'Pause' : 'Play'}
        disabled={err}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div
        ref={barRef}
        className="audio-player__bar"
        onPointerDown={onBarPointerDown}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(dur)}
        aria-valuenow={Math.round(cur)}
      >
        <div className="audio-player__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="audio-player__time">
        {err ? 'Unavailable' : `${fmt(cur)} / ${fmt(dur)}`}
      </span>
      <audio ref={ref} src={src} preload="metadata" />
    </div>
  )
}
