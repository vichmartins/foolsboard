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
  created_at: string
}

export interface BoardGraph {
  board: Board
  nodes: StoryNode[]
  edges: StoryEdge[]
}

// The kinds of objects you can drop on the canvas.
export const NODE_TYPES = ['scene', 'character', 'dialog', 'event', 'note'] as const
export type NodeKind = (typeof NODE_TYPES)[number]

// Default accent color per object kind.
export const KIND_COLORS: Record<string, string> = {
  scene: '#6366f1',
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
