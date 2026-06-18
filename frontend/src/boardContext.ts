// Makes the active board id available to deeply-nested canvas children
// (notably custom edges, which React Flow renders in its own subtree).
import { createContext, useContext } from 'react'

export const BoardIdContext = createContext<string>('')
export const useBoardId = () => useContext(BoardIdContext)
