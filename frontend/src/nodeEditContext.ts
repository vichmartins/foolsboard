// Lets custom React Flow nodes (which render in RF's own subtree, outside the
// normal prop tree) report a committed edit so the canvas can make it undoable —
// the same before/after path the object panel uses. See Canvas `handleNodeEdited`.
import { createContext, useContext } from 'react'

export interface NodeEditSnapshot {
  title: string
  type: string
  content: Record<string, unknown>
}
export type RegisterNodeEdit = (
  nodeId: string,
  before: NodeEditSnapshot,
  after: NodeEditSnapshot,
) => void

export const NodeEditContext = createContext<RegisterNodeEdit | null>(null)
export const useRegisterNodeEdit = () => useContext(NodeEditContext)
