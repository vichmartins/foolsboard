// Top-bar light/dark switch. Uses the View Transitions API (Chromium) to reveal
// the new theme with a circular wipe expanding from the button; falls back to an
// instant switch where unsupported or when reduced motion is requested.
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { applyTheme, getInitialTheme, nextTheme, saveTheme, type Theme } from '../theme'

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> }
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 21s-6.7-4.35-9.33-8.07C.9 10.36 1.4 6.9 4.1 5.4c2.04-1.13 4.3-.5 5.6 1.1L12 9l2.3-2.5c1.3-1.6 3.56-2.23 5.6-1.1 2.7 1.5 3.2 4.96 1.43 7.53C18.7 16.65 12 21 12 21z" />
    </svg>
  )
}

const THEME_LABEL: Record<Theme, string> = { dark: 'Dark', light: 'Light', pink: 'Pink' }

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'dark') return <MoonIcon />
  if (theme === 'pink') return <HeartIcon />
  return <SunIcon />
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  // Keep the <html> attribute and saved preference in sync.
  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
  }, [theme])

  function toggle(e: React.MouseEvent) {
    const next: Theme = nextTheme(theme)
    const doc = document as ViewTransitionDoc
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!doc.startViewTransition || reduce) {
      setTheme(next)
      return
    }

    // Origin + radius for the expanding circle, anchored on the button.
    const x = e.clientX
    const y = e.clientY
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    const transition = doc.startViewTransition(() => {
      flushSync(() => setTheme(next))
      applyTheme(next) // ensure the attribute is set for the "new" snapshot
    })

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 450,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      })
      .catch(() => {})
  }

  return (
    <button
      className="icon-btn theme-toggle"
      title={`Theme: ${THEME_LABEL[theme]} — click for ${THEME_LABEL[nextTheme(theme)]}`}
      aria-label="Switch theme"
      onClick={toggle}
    >
      <span key={theme} className="theme-toggle__icon">
        <ThemeIcon theme={theme} />
      </span>
    </button>
  )
}
