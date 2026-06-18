// The infinite storyboard canvas, backed by React Flow and the REST API.
import { useCallback, useEffect, useState } from 'react'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import * as api from '../api'
import { KIND_COLORS, type StoryEdge, type StoryNode } from '../types'
import ContextPanel from './ContextPanel'
import StoryNodeCard from './StoryNodeCard'

const nodeTypes = { story: StoryNodeCard }

function toRFNode(n: StoryNode): Node {
  return {
    id: n.id,
    type: 'story',
    position: { x: n.x, y: n.y },
    data: { title: n.title, kind: n.type, story: n },
  }
}

function toRFEdge(e: StoryEdge): Edge {
  return { id: e.id, source: e.source_id, target: e.target_id, label: e.label ?? undefined }
}

function CanvasInner({ boardId }: { boardId: string }) {
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Load the whole board graph whenever the board changes.
  useEffect(() => {
    let active = true
    api.getGraph(boardId).then((g) => {
      if (!active) return
      setNodes(g.nodes.map(toRFNode))
      setEdges(g.edges.map(toRFEdge))
      setSelectedId(null)
    })
    return () => {
      active = false
    }
  }, [boardId])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  )

  // Persist position only when a drag finishes (not on every frame).
  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      api.updateNode(boardId, node.id, { x: node.position.x, y: node.position.y })
    },
    [boardId],
  )

  // Drawing a connection creates a persisted edge.
  const onConnect = useCallback(
    async (conn: { source: string | null; target: string | null }) => {
      if (!conn.source || !conn.target) return
      const created = await api.createEdge(boardId, conn.source, conn.target)
      setEdges((eds) => addEdge(toRFEdge(created), eds))
    },
    [boardId],
  )

  // Right-click on empty canvas -> create a new object there (Agar.io style).
  const onPaneContextMenu = useCallback(
    async (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault()
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const created = await api.createNode(boardId, {
        type: 'note',
        title: 'New object',
        x: pos.x,
        y: pos.y,
      })
      setNodes((nds) => [...nds, toRFNode(created)])
      setSelectedId(created.id)
    },
    [boardId, screenToFlowPosition],
  )

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      deleted.forEach((n) => api.deleteNode(boardId, n.id))
      if (deleted.some((n) => n.id === selectedId)) setSelectedId(null)
    },
    [boardId, selectedId],
  )
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => deleted.forEach((e) => api.deleteEdge(boardId, e.id)),
    [boardId],
  )

  // Reflect a panel edit back into the canvas card.
  const applyNodeUpdate = useCallback((updated: StoryNode) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === updated.id
          ? { ...n, data: { title: updated.title, kind: updated.type, story: updated } }
          : n,
      ),
    )
  }, [])

  const removeSelected = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedId(null)
  }, [])

  const selectedStory =
    (nodes.find((n) => n.id === selectedId)?.data?.story as StoryNode | undefined) ?? null

  return (
    <div className="canvas-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, n) => setSelectedId(n.id)}
        onPaneClick={() => setSelectedId(null)}
        onPaneContextMenu={onPaneContextMenu}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => KIND_COLORS[(n.data?.kind as string) ?? 'note'] ?? '#64748b'}
        />
      </ReactFlow>

      {!nodes.length && (
        <div className="canvas-hint">Right-click anywhere to create your first object</div>
      )}

      {selectedStory && (
        <ContextPanel
          boardId={boardId}
          node={selectedStory}
          onChange={applyNodeUpdate}
          onDelete={removeSelected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

export default function Canvas({ boardId }: { boardId: string }) {
  return (
    <ReactFlowProvider>
      <CanvasInner boardId={boardId} />
    </ReactFlowProvider>
  )
}
