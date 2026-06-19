// Light/dark theme handling. The active theme is reflected as a `data-theme`
// attribute on <html>, which CSS variables in index.css key off of.
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

// Saved choice wins; otherwise fall back to the OS preference; default dark.
export function getInitialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme)
}
