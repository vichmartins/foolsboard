// Turn a board's branching node/edge graph into an ordered, numbered sequence for
// the printable storyboard. Traversal is depth-first from the "start" nodes (those
// with no incoming connection), in reading order (top-to-bottom, left-to-right);
// branches are preserved as each node's "leads to" list (with the edge label), so
// the document reads like a branching script. Any nodes not reachable from a start
// (disconnected or only in a cycle) are appended at the end so nothing is dropped.
import type { StoryNode } from './types'

export interface StoryboardEdge {
  source: string
  target: string
  label: string
}

export interface StoryboardSection {
  num: number
  node: StoryNode
  leadsTo: { num: number; title: string; label: string }[]
}

export function buildStoryboard(nodes: StoryNode[], edges: StoryboardEdge[]): StoryboardSection[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map<string, StoryboardEdge[]>()
  const indeg = new Map<string, number>()
  for (const n of nodes) {
    out.set(n.id, [])
    indeg.set(n.id, 0)
  }
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    out.get(e.source)!.push(e)
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
  }

  const byPos = (a: string, b: string) => {
    const na = byId.get(a)!
    const nb = byId.get(b)!
    return na.y - nb.y || na.x - nb.x
  }
  for (const list of out.values()) list.sort((p, q) => byPos(p.target, q.target))

  const order: string[] = []
  const numById = new Map<string, number>()
  const visit = (id: string) => {
    if (numById.has(id)) return
    numById.set(id, order.length + 1)
    order.push(id)
    for (const e of out.get(id) ?? []) visit(e.target)
  }

  // Roots first (in reading order), then sweep up anything left (cycles/orphans).
  nodes
    .filter((n) => (indeg.get(n.id) ?? 0) === 0)
    .map((n) => n.id)
    .sort(byPos)
    .forEach(visit)
  ;[...nodes].sort((a, b) => a.y - b.y || a.x - b.x).forEach((n) => visit(n.id))

  return order.map((id) => ({
    num: numById.get(id)!,
    node: byId.get(id)!,
    leadsTo: (out.get(id) ?? []).map((e) => ({
      num: numById.get(e.target) ?? 0,
      title: byId.get(e.target)?.title || 'Untitled',
      label: e.label || '',
    })),
  }))
}
