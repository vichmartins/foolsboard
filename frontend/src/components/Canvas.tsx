// The infinite storyboard canvas, backed by React Flow and the REST API.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  reconnectEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import * as api from '../api'
import { KIND_COLORS, nodePreview, type StoryEdge, type StoryNode } from '../types'
import ConfirmDialog from './ConfirmDialog'
import ContextMenu from './ContextMenu'
import ContextPanel from './ContextPanel'
import FloatingEdge from './FloatingEdge'
import PromptDialog from './PromptDialog'
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
const edgeTypes = { floating: FloatingEdge }

function toRFNode(n: StoryNode, boardId: string): Node {
  return {
    id: n.id,
    type: 'story',
    position: { x: n.x, y: n.y },
    data: {
      title: n.title,
      kind: n.type,
      preview: nodePreview(n.type, n.content),
      story: n,
      boardId,
    },
  }
}

function toRFEdge(e: StoryEdge): Edge {
  return {
    id: e.id,
    type: 'floating',
    source: e.source_id,
    target: e.target_id,
    sourceHandle: (e.data?.sourceHandle as string | undefined) ?? 'right',
    targetHandle: (e.data?.targetHandle as string | undefined) ?? 'left',
    label: e.label ?? undefined,
    data: e.data,
  }
}

function CanvasInner({ boardId }: { boardId: string }) {
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [edgeMenu, setEdgeMenu] = useState<{ x: number; y: number; edge: Edge } | null>(null)
  const [editEdge, setEditEdge] = useState<Edge | null>(null)
  // Tracks whether an in-progress endpoint drag landed on a node (reconnect) or
  // on empty space (detach).
  const edgeReconnected = useRef(true)

  // Load the whole board graph whenever the board changes.
  useEffect(() => {
    let active = true
    api.getGraph(boardId).then((g) => {
      if (!active) return
      setNodes(g.nodes.map((n) => toRFNode(n, boardId)))
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

  // Drawing a connection creates a persisted edge, remembering which sides it
  // attaches to.
  const onConnect = useCallback(
    async (conn: Connection) => {
      if (!conn.source || !conn.target) return
      const created = await api.createEdge(
        boardId,
        conn.source,
        conn.target,
        undefined,
        conn.sourceHandle,
        conn.targetHandle,
      )
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
      setNodes((nds) => [...nds, toRFNode(created, boardId)])
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

  // Reflect a panel edit back into the canvas card (including the preview line).
  const applyNodeUpdate = useCallback((updated: StoryNode) => {
    setNodes((nds) => nds.map((n) => (n.id === updated.id ? toRFNode(updated, boardId) : n)))
  }, [boardId])

  // --- Edge editing --------------------------------------------------------
  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault()
    setEdgeMenu({ x: event.clientX, y: event.clientY, edge })
  }, [])

  // Suppress the browser menu on nodes (pane right-click still creates objects).
  const onNodeContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
  }, [])

  const deleteEdgeById = useCallback(
    (edge: Edge) => {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id))
      api.deleteEdge(boardId, edge.id).catch(() => {})
    },
    [boardId],
  )

  const saveEdgeLabel = useCallback(
    async (edge: Edge, label: string) => {
      const updated = await api.updateEdge(boardId, edge.id, { label: label || null })
      setEdges((eds) => eds.map((e) => (e.id === edge.id ? toRFEdge(updated) : e)))
    },
    [boardId],
  )

  // Insert a new object in the middle of a connection: A->B becomes A->new->B.
  const insertNodeOnEdge = useCallback(
    async (edge: Edge) => {
      const s = nodes.find((n) => n.id === edge.source)
      const t = nodes.find((n) => n.id === edge.target)
      if (!s || !t) return
      const mid = {
        x: (s.position.x + t.position.x) / 2,
        y: (s.position.y + t.position.y) / 2,
      }
      const created = await api.createNode(boardId, {
        type: 'note',
        title: 'New step',
        x: mid.x,
        y: mid.y,
      })
      const label = typeof edge.label === 'string' ? edge.label : undefined
      await api.deleteEdge(boardId, edge.id).catch(() => {})
      const [e1, e2] = await Promise.all([
        api.createEdge(boardId, edge.source, created.id, label),
        api.createEdge(boardId, created.id, edge.target),
      ])
      setNodes((nds) => [...nds, toRFNode(created, boardId)])
      setEdges((eds) =>
        eds.filter((e) => e.id !== edge.id).concat(toRFEdge(e1), toRFEdge(e2)),
      )
      setSelectedId(created.id)
    },
    [boardId, nodes],
  )

  // Drag an endpoint onto another node to move the connection; drop it on empty
  // space to detach (remove) it.
  const onReconnectStart = useCallback(() => {
    edgeReconnected.current = false
  }, [])
  const onReconnect = useCallback(
    async (oldEdge: Edge, conn: Connection) => {
      edgeReconnected.current = true
      if (!conn.source || !conn.target) return
      setEdges((eds) => reconnectEdge(oldEdge, conn, eds))
      const label = typeof oldEdge.label === 'string' ? oldEdge.label : undefined
      await api.deleteEdge(boardId, oldEdge.id).catch(() => {})
      const created = await api.createEdge(
        boardId,
        conn.source,
        conn.target,
        label,
        conn.sourceHandle,
        conn.targetHandle,
      )
      setEdges((eds) => eds.map((e) => (e.id === oldEdge.id ? toRFEdge(created) : e)))
    },
    [boardId],
  )
  const onReconnectEnd = useCallback(
    (_: unknown, edge: Edge) => {
      if (!edgeReconnected.current) deleteEdgeById(edge)
      edgeReconnected.current = true
    },
    [deleteEdgeById],
  )

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
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, n) => setSelectedId(n.id)}
        onPaneClick={() => setSelectedId(null)}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
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

      {edgeMenu && (
        <ContextMenu
          x={edgeMenu.x}
          y={edgeMenu.y}
          onClose={() => setEdgeMenu(null)}
          items={[
            { label: 'Edit label…', onClick: () => setEditEdge(edgeMenu.edge) },
            { label: 'Insert node', onClick: () => insertNodeOnEdge(edgeMenu.edge) },
            {
              label: 'Delete connection',
              danger: true,
              onClick: () => deleteEdgeById(edgeMenu.edge),
            },
          ]}
        />
      )}

      {editEdge && (
        <PromptDialog
          title="Connection label"
          label="Annotate this branch (leave empty to clear)"
          placeholder="e.g. if the hero refuses"
          initialValue={typeof editEdge.label === 'string' ? editEdge.label : ''}
          confirmLabel="Save"
          allowEmpty
          onSubmit={(value) => {
            saveEdgeLabel(editEdge, value)
            setEditEdge(null)
          }}
          onCancel={() => setEditEdge(null)}
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
