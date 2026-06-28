// Vitest global setup: adds jest-dom matchers (toBeInTheDocument, etc.) to expect.
import '@testing-library/jest-dom/vitest'

// This jsdom build doesn't expose a global localStorage; provide a minimal
// in-memory one so storage-backed code (clipboard, auth token) is testable.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}
