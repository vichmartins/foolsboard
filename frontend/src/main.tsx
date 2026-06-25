import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth'
import { applyTheme, getInitialTheme } from './theme'

// Set the theme before first paint so there's no flash of the wrong palette.
applyTheme(getInitialTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

// Register the service worker in production only (instant repeat loads + an
// offline app shell). Skipped in dev so it never fights Vite's HMR.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
