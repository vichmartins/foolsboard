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
