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
import ConfirmDialog from './ConfirmDialog'
import ContextPanel from './ContextPanel'
import StoryNodeCard from './StoryNodeCard'

// What React Flow hands to onBeforeDelete, plus a resolver we keep so the
// confirm dialog's buttons can answer the (async) deletion request.
interface PendingDelete {
  nodes: Node[]
  edges: Edge[]
  resolve: (confirmed: boolean) => void
}

function countLabel(n: number, singular: string) {
  return `${n} ${singular}${n === 1 ? '' : 's'}`
}

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
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

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

  // Gate keyboard/programmatic deletion behind a confirm dialog when objects
  // are involved. Edge-only deletions stay instant (low-risk, easily redrawn).
  const onBeforeDelete = useCallback(
    ({ nodes: delNodes, edges: delEdges }: { nodes: Node[]; edges: Edge[] }) => {
      if (delNodes.length === 0) return Promise.resolve(true)
      return new Promise<boolean>((resolve) =>
        setPendingDelete({ nodes: delNodes, edges: delEdges, resolve }),
      )
    },
    [],
  )

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      // Deleting a node cascades its edges on the backend, so ignore 404s.
      deleted.forEach((n) => api.deleteNode(boardId, n.id).catch(() => {}))
      if (deleted.some((n) => n.id === selectedId)) setSelectedId(null)
    },
    [boardId, selectedId],
  )
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) =>
      deleted.forEach((e) => api.deleteEdge(boardId, e.id).catch(() => {})),
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
        onBeforeDelete={onBeforeDelete}
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

      {pendingDelete && (
        <ConfirmDialog
          title={
            pendingDelete.nodes.length === 1
              ? 'Delete object?'
              : `Delete ${countLabel(pendingDelete.nodes.length, 'object')}?`
          }
          message={
            pendingDelete.edges.length > 0
              ? `This will permanently delete ${countLabel(
                  pendingDelete.nodes.length,
                  'object',
                )} and ${countLabel(pendingDelete.edges.length, 'link')}, including their media. This can't be undone.`
              : `This will permanently delete ${countLabel(
                  pendingDelete.nodes.length,
                  'object',
                )} and their media. This can't be undone.`
          }
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            pendingDelete.resolve(true)
            setPendingDelete(null)
          }}
          onCancel={() => {
            pendingDelete.resolve(false)
            setPendingDelete(null)
          }}
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
