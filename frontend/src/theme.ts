// Theme handling. The active theme is reflected as a `data-theme` attribute on
// <html>, which CSS variables in index.css key off of.
export type Theme = 'light' | 'dark' | 'pink'

const STORAGE_KEY = 'theme'

// Cycle order for the top-bar toggle.
export const THEME_ORDER: Theme[] = ['dark', 'light', 'pink']

export function nextTheme(theme: Theme): Theme {
  return THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]
}

// Saved choice wins; otherwise fall back to the OS preference; default dark.
export function getInitialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark' || saved === 'pink') return saved
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme)
}
