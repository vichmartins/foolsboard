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
  useReactFlow,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import * as api from '../api'
import { BoardIdContext } from '../boardContext'
import { findNodeAt, nodeSize, snapToBorder } from '../edgeGeometry'
import { toRFEdge } from '../rfMappers'
import { KIND_COLORS, nodePreview, type Side, type StoryNode } from '../types'
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

function toRFNode(n: StoryNode): Node {
  return {
    id: n.id,
    type: 'story',
    position: { x: n.x, y: n.y },
    data: {
      title: n.title,
      kind: n.type,
      preview: nodePreview(n.type, n.content),
      story: n,
    },
  }
}

function CanvasInner({ boardId }: { boardId: string }) {
  const { screenToFlowPosition, getNodes } = useReactFlow()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [edgeMenu, setEdgeMenu] = useState<{ x: number; y: number; edge: Edge } | null>(null)
  const [editEdge, setEditEdge] = useState<Edge | null>(null)
  // The node + side a freshly drawn connection started from, captured on
  // connect-start so connect-end can build the edge from drop geometry.
  const connectStart = useRef<{ nodeId: string; side: Side } | null>(null)

  // Load the whole board graph whenever the board changes.
  useEffect(() => {
    let active = true
    api.getGraph(boardId).then((g) => {
      if (!active) return
      setNodes(g.nodes.map((n) => toRFNode(n)))
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

  // Drawing a connection: remember where it started...
  const onConnectStart = useCallback(
    (
      _: unknown,
      params: { nodeId: string | null; handleId: string | null },
    ) => {
      connectStart.current = params.nodeId
        ? { nodeId: params.nodeId, side: (params.handleId as Side) ?? 'right' }
        : null
    },
    [],
  )

  // ...and on release, attach it to the exact border point under the cursor.
  // Dropping on empty space (no node) leaves nothing — the link just vanishes.
  const onConnectEnd = useCallback(
    async (event: MouseEvent | TouchEvent) => {
      const start = connectStart.current
      connectStart.current = null
      if (!start) return

      const point =
        'changedTouches' in event ? event.changedTouches[0] : event
      const flow = screenToFlowPosition({ x: point.clientX, y: point.clientY })
      const target = findNodeAt(getNodes(), flow, start.nodeId)
      if (!target) return

      const { w, h } = nodeSize(target)
      const snap = snapToBorder(
        flow.x, flow.y, target.position.x, target.position.y, w, h,
      )
      const created = await api.createEdge(
        boardId,
        start.nodeId,
        target.id,
        undefined,
        start.side,
        snap.side,
        0.5,
        snap.t,
      )
      setEdges((eds) => addEdge(toRFEdge(created), eds))
    },
    [boardId, screenToFlowPosition, getNodes],
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

  // Reflect a panel edit back into the canvas card (including the preview line).
  const applyNodeUpdate = useCallback((updated: StoryNode) => {
    setNodes((nds) => nds.map((n) => (n.id === updated.id ? toRFNode(updated) : n)))
  }, [])

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
      setNodes((nds) => [...nds, toRFNode(created)])
      setEdges((eds) =>
        eds.filter((e) => e.id !== edge.id).concat(toRFEdge(e1), toRFEdge(e2)),
      )
      setSelectedId(created.id)
    },
    [boardId, nodes],
  )

  const removeSelected = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedId(null)
  }, [])

  const selectedStory =
    (nodes.find((n) => n.id === selectedId)?.data?.story as StoryNode | undefined) ?? null

  return (
    <BoardIdContext.Provider value={boardId}>
    <div className="canvas-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, n) => setSelectedId(n.id)}
        onPaneClick={() => setSelectedId(null)}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
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
    </BoardIdContext.Provider>
  )
}

export default function Canvas({ boardId }: { boardId: string }) {
  return (
    <ReactFlowProvider>
      <CanvasInner boardId={boardId} />
    </ReactFlowProvider>
  )
}
