// Builds a predicate for a search box. The query is treated as a case-insensitive
// regular expression, so users can search by pattern (e.g. "scene|act", "ch.*2",
// "^intro"). A plain word is itself a valid regex that matches as a substring, so
// ordinary searches keep working. If the query isn't a valid regex yet (e.g. a
// half-typed "("), it falls back to a case-insensitive substring match.
export function makeMatcher(query: string): (text: string) => boolean {
  const q = query.trim()
  if (!q) return () => true
  try {
    const re = new RegExp(q, 'i')
    return (text) => re.test(text)
  } catch {
    const lower = q.toLowerCase()
    return (text) => text.toLowerCase().includes(lower)
  }
}
