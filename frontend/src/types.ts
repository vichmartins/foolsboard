// Mirrors the backend Pydantic schemas (app/schemas.py).

export interface Board {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface StoryNode {
  id: string
  board_id: string
  type: string
  title: string
  content: Record<string, unknown>
  x: number
  y: number
  width: number | null
  height: number | null
  color: string | null
  created_at: string
  updated_at: string
}

export interface StoryEdge {
  id: string
  board_id: string
  source_id: string
  target_id: string
  label: string | null
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Asset {
  id: string
  node_id: string
  kind: string
  filename: string
  content_type: string
  size: number
  storage_key: string
  url: string | null
  thumbnail_url: string | null
  processing: boolean
  created_at: string
}

// Coarse media category used to pick a tile/gallery renderer.
export type MediaKind = 'image' | 'video' | 'audio' | 'file'

export function mediaKind(a: Asset): MediaKind {
  const main = (a.content_type || '').split('/', 1)[0]
  if (main === 'image') return 'image'
  if (main === 'video') return 'video'
  if (main === 'audio') return 'audio'
  return 'file'
}

export function fileExt(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i > 0 ? filename.slice(i + 1).toUpperCase() : ''
}

export interface BoardGraph {
  board: Board
  nodes: StoryNode[]
  edges: StoryEdge[]
}

export type Side = 'top' | 'right' | 'bottom' | 'left'

// The kinds of objects you can drop on the canvas.
export const NODE_TYPES = ['scene', 'character', 'dialog', 'event', 'note'] as const
export type NodeKind = (typeof NODE_TYPES)[number]

// Default accent color per object kind.
export const KIND_COLORS: Record<string, string> = {
  scene: '#0ea5e9',
  character: '#10b981',
  dialog: '#f59e0b',
  event: '#ef4444',
  note: '#64748b',
}

// Structured fields shown in the context panel, per object kind. All values are
// stored inside the node's `content` JSON, so adding a field needs no migration.
export interface FieldDef {
  key: string
  label: string
  multiline?: boolean
  placeholder?: string
  // Custom editor instead of a plain text input. 'animations' is a repeatable
  // list of { id, name } rows (a numeric identifier + the animation it performs).
  widget?: 'animations'
}

// One row of a Character's Animations field.
export interface AnimationRow {
  id: string
  name: string
}

export const TYPE_FIELDS: Record<string, FieldDef[]> = {
  scene: [
    { key: 'location', label: 'Location', placeholder: 'Where does it happen?' },
    { key: 'time', label: 'Time', placeholder: 'When? (day/night, era…)' },
    { key: 'summary', label: 'Summary', multiline: true, placeholder: 'What happens in this scene?' },
  ],
  character: [
    { key: 'role', label: 'Role', placeholder: 'Protagonist, villain, mentor…' },
    { key: 'traits', label: 'Traits', placeholder: 'Brave, cunning, anxious…' },
    { key: 'description', label: 'Description', multiline: true, placeholder: 'Who are they?' },
    { key: 'animations', label: 'Animations', widget: 'animations' },
  ],
  dialog: [
    { key: 'speaker', label: 'Speaker', placeholder: 'Who is talking?' },
    { key: 'line', label: 'Line', multiline: true, placeholder: 'What is said?' },
  ],
  event: [
    { key: 'trigger', label: 'Trigger', placeholder: 'What causes it?' },
    { key: 'outcome', label: 'Outcome', multiline: true, placeholder: 'What changes as a result?' },
  ],
  note: [{ key: 'text', label: 'Notes', multiline: true, placeholder: 'Free-form notes…' }],
}

// A short preview string for a node card: the first non-empty type field.
export function nodePreview(type: string, content: Record<string, unknown>): string {
  const fields = TYPE_FIELDS[type] ?? TYPE_FIELDS.note
  for (const f of fields) {
    const v = content?.[f.key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}
