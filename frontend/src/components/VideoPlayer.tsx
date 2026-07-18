// A self-contained video player used by media nodes instead of the browser's
// native <video controls>. The native controls include a picture-in-picture
// overlay button the browser positions in screen space, so it drifts outside the
// video while the board is panned (a CSS transform it can't track). Driving a
// controls-less <video> ourselves keeps every control -- play, seek, volume, PiP
// and fullscreen -- inside the object, so they travel with it and stay on theme.
import { useEffect, useRef, useState } from 'react'

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface Props {
  src: string
  poster?: string
  style?: React.CSSProperties
  // Lets the media node measure/resize the player (points at the wrapper).
  rootRef?: (el: HTMLDivElement | null) => void
}

export default function VideoPlayer({ src, poster, style, rootRef }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const ref = useRef<HTMLVideoElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)
  const [muted, setMuted] = useState(false)
  const [full, setFull] = useState(false)
  const [pip, setPip] = useState(false)
  const [err, setErr] = useState(false)
  const canPip = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const onMeta = () => setDur(Number.isFinite(v.duration) ? v.duration : 0)
    const onTime = () => setCur(v.currentTime)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setPlaying(false)
    const onVol = () => setMuted(v.muted)
    const onErr = () => setErr(true)
    const onPipIn = () => setPip(true)
    const onPipOut = () => setPip(false)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('ended', onEnded)
    v.addEventListener('volumechange', onVol)
    v.addEventListener('error', onErr)
    v.addEventListener('enterpictureinpicture', onPipIn)
    v.addEventListener('leavepictureinpicture', onPipOut)
    return () => {
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('ended', onEnded)
      v.removeEventListener('volumechange', onVol)
      v.removeEventListener('error', onErr)
      v.removeEventListener('enterpictureinpicture', onPipIn)
      v.removeEventListener('leavepictureinpicture', onPipOut)
    }
  }, [])

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === wrapRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // A new src (e.g. a background re-encode swapped the file) resets state + reloads.
  useEffect(() => {
    setErr(false)
    setPlaying(false)
    setCur(0)
    setDur(0)
    ref.current?.load()
  }, [src])

  function setWrap(el: HTMLDivElement | null) {
    wrapRef.current = el
    rootRef?.(el)
  }
  function toggle() {
    const v = ref.current
    if (!v) return
    if (v.paused) void v.play().catch(() => setErr(true))
    else v.pause()
  }
  function scrubTo(clientX: number) {
    const v = ref.current
    const bar = barRef.current
    if (!v || !bar || !dur) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    v.currentTime = ratio * dur
    setCur(v.currentTime)
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
  function toggleMute() {
    const v = ref.current
    if (v) v.muted = !v.muted
  }
  async function togglePip() {
    const v = ref.current
    if (!v) return
    try {
      if (document.pictureInPictureElement === v) await document.exitPictureInPicture()
      else await v.requestPictureInPicture()
    } catch {
      /* user cancelled / not allowed */
    }
  }
  async function toggleFull() {
    const w = wrapRef.current
    if (!w) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await w.requestFullscreen()
    } catch {
      /* not allowed */
    }
  }

  const pct = dur > 0 ? (cur / dur) * 100 : 0
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div
      ref={setWrap}
      className={'video-player nodrag' + (full ? ' video-player--full' : '')}
    >
      <video
        ref={ref}
        className="video-player__el"
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        style={style}
        onClick={(e) => {
          stop(e)
          toggle()
        }}
        onDoubleClick={(e) => {
          stop(e)
          void toggleFull()
        }}
      />

      <div className="video-player__bar" onClick={stop} onPointerDown={stop}>
        <button
          type="button"
          className="video-player__btn"
          onClick={(e) => {
            stop(e)
            toggle()
          }}
          aria-label={playing ? 'Pause' : 'Play'}
          disabled={err}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
              <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
            </svg>
          )}
        </button>

        <div
          ref={barRef}
          className="video-player__seek"
          onPointerDown={onBarPointerDown}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={Math.round(cur)}
        >
          <div className="video-player__fill" style={{ width: `${pct}%` }} />
        </div>

        <span className="video-player__time">
          {err ? 'Unavailable' : `${fmt(cur)} / ${fmt(dur)}`}
        </span>

        <button
          type="button"
          className="video-player__btn"
          onClick={(e) => {
            stop(e)
            toggleMute()
          }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
              <line x1="16" y1="9" x2="22" y2="15" />
              <line x1="22" y1="9" x2="16" y2="15" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
              <path d="M16 9a4 4 0 0 1 0 6" />
              <path d="M18.5 6.5a7 7 0 0 1 0 11" />
            </svg>
          )}
        </button>

        {canPip && (
          <button
            type="button"
            className={'video-player__btn' + (pip ? ' video-player__btn--on' : '')}
            onClick={(e) => {
              stop(e)
              void togglePip()
            }}
            aria-label="Play in a separate window (picture-in-picture)"
            title="Picture-in-picture"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="14" rx="2" />
              <rect x="12" y="10" width="7" height="6" rx="1" fill="currentColor" stroke="none" />
            </svg>
          </button>
        )}

        <button
          type="button"
          className="video-player__btn"
          onClick={(e) => {
            stop(e)
            void toggleFull()
          }}
          aria-label={full ? 'Exit fullscreen' : 'Fullscreen'}
          title="Fullscreen"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {full ? (
              <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            ) : (
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            )}
          </svg>
        </button>
      </div>
    </div>
  )
}
