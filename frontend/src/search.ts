// Builds a predicate for a search box. The query is treated as a case-insensitive
// regular expression, so users can search by pattern (e.g. "scene|act", "ch.*2",
// "^intro"). A plain word is itself a valid regex that matches as a substring, so
// ordinary searches keep working.
//
// If the query isn't valid regex (e.g. a glob like "*New*", or a half-typed "("),
// we don't just give up: we treat it as a forgiving glob — everything is escaped
// to a literal, then "*" means "any run of characters" and "?" means "any single
// character". So "*New*" finds "New object" and a stray "(" matches a literal
// paren. Only if even that fails do we fall back to a plain substring match.
export function makeMatcher(query: string): (text: string) => boolean {
  const q = query.trim()
  if (!q) return () => true
  try {
    const re = new RegExp(q, 'i')
    return (text) => re.test(text)
  } catch {
    /* not valid regex — fall through to the glob interpretation */
  }
  try {
    const glob = q
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape everything to literals
      .replace(/\\\*/g, '.*') // then let * be a wildcard run
      .replace(/\\\?/g, '.') // and ? a single-char wildcard
    const re = new RegExp(glob, 'i')
    return (text) => re.test(text)
  } catch {
    const lower = q.toLowerCase()
    return (text) => text.toLowerCase().includes(lower)
  }
}
