// The infinite storyboard canvas, backed by React Flow and the REST API.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  besideOffset,
  graphToPortable,
  portableBox,
  rfNodesBox,
  serializeSelection,
  unionBox,
  type Box,
  type Portable,
} from '../boardOps'
import { clipboardHasContent, readClipboard, writeClipboard } from '../clipboard'
import { findNodeAt, nodeSize, snapToBorder } from '../edgeGeometry'
import { toRFEdge } from '../rfMappers'
import {
  KIND_COLORS,
  nodePreview,
  type LinkRef,
  type NearbyNode,
  type Side,
  type StoryEdge,
  type StoryNode,
} from '../types'
import ConfirmDialog from './ConfirmDialog'
import ContextMenu from './ContextMenu'
import ContextPanel from './ContextPanel'
import FloatingEdge from './FloatingEdge'
import MinimapSelection from './MinimapSelection'
import PromptDialog from './PromptDialog'
import StoryNodeCard from './StoryNodeCard'

interface UndoEntry {
  undo: () => Promise<void> | void
  redo: () => Promise<void> | void
}

interface CanvasProps {
  boardId: string
  mergeSourceIds?: string[] | null
  onMergeHandled?: () => void
}

const PASTE_OFFSET = 48 // px nudge when pasting/duplicating within the same board

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

function CanvasInner({ boardId, mergeSourceIds, onMergeHandled }: CanvasProps) {
  const { screenToFlowPosition, getNodes, getEdges, getZoom, setCenter } = useReactFlow()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelClosing, setPanelClosing] = useState(false)
  const panelCloseTimer = useRef<number | null>(null)
  // File drag-and-drop: 'ready' = a panel is open (drop uploads), 'blocked' =
  // none open (hint only). droppedFiles are handed to the panel to upload.
  const [dragKind, setDragKind] = useState<'none' | 'ready' | 'blocked'>('none')
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null)
  const hasPanelRef = useRef(false)
  // Live shift-drag selection rectangle (flow coords), mirrored on the minimap.
  const [selectionRect, setSelectionRect] = useState<Box | null>(null)
  const selStart = useRef<{ x: number; y: number } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [edgeMenu, setEdgeMenu] = useState<{ x: number; y: number; edge: Edge } | null>(null)
  const [nodeMenu, setNodeMenu] = useState<{ x: number; y: number } | null>(null)
  const [editEdge, setEditEdge] = useState<Edge | null>(null)
  // The node + side a freshly drawn connection started from, captured on
  // connect-start so connect-end can build the edge from drop geometry.
  const connectStart = useRef<{ nodeId: string; side: Side } | null>(null)
  // Undo/redo stacks of invertible operations; opLock serializes async ops.
  const undoStack = useRef<UndoEntry[]>([])
  const redoStack = useRef<UndoEntry[]>([])
  const opLock = useRef(false)
  // Positions captured at drag start, so a finished move can be undone.
  const dragStartPos = useRef<Map<string, { x: number; y: number }> | null>(null)

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

  // --- Undo / redo ---------------------------------------------------------
  const pushUndo = useCallback((entry: UndoEntry) => {
    undoStack.current.push(entry)
    redoStack.current = []
  }, [])

  const undo = useCallback(async () => {
    if (opLock.current) return
    const entry = undoStack.current.pop()
    if (!entry) return
    opLock.current = true
    try {
      await entry.undo()
    } finally {
      opLock.current = false
    }
    redoStack.current.push(entry)
  }, [])

  const redo = useCallback(async () => {
    if (opLock.current) return
    const entry = redoStack.current.pop()
    if (!entry) return
    opLock.current = true
    try {
      await entry.redo()
    } finally {
      opLock.current = false
    }
    undoStack.current.push(entry)
  }, [])

  // Run a mutating op exclusively (prevents overlap with undo/redo or each other).
  const runOp = useCallback(async (fn: () => Promise<void>) => {
    if (opLock.current) return
    opLock.current = true
    try {
      await fn()
    } finally {
      opLock.current = false
    }
  }, [])

  // --- Create / remove primitives (used by paste, duplicate, merge, undo) ---
  // Create a Portable's nodes+edges translated by (dx,dy); returns created ids.
  const importPortableAt = useCallback(
    async (p: Portable, dx: number, dy: number, select: boolean) => {
      const createdNodes = await Promise.all(
        p.nodes.map((pn) =>
          api.createNode(boardId, {
            type: pn.type,
            title: pn.title,
            content: pn.content,
            x: pn.x + dx,
            y: pn.y + dy,
            width: pn.width ?? undefined,
            height: pn.height ?? undefined,
            color: pn.color ?? undefined,
          }),
        ),
      )
      const idMap = new Map<string, string>()
      p.nodes.forEach((pn, i) => idMap.set(pn.tempId, createdNodes[i].id))

      const edgeResults = await Promise.all(
        p.edges.map(async (pe) => {
          const s = idMap.get(pe.source) ?? pe.source
          const t = idMap.get(pe.target) ?? pe.target
          try {
            return await api.createEdge(
              boardId,
              s,
              t,
              pe.label ?? undefined,
              pe.data.sourceHandle as string | undefined,
              pe.data.targetHandle as string | undefined,
              typeof pe.data.sourceT === 'number' ? pe.data.sourceT : 0.5,
              typeof pe.data.targetT === 'number' ? pe.data.targetT : 0.5,
            )
          } catch {
            return null
          }
        }),
      )
      const createdEdges = edgeResults.filter((e): e is StoryEdge => e !== null)

      const rfNew = createdNodes.map(toRFNode)
      const rfNewEdges = createdEdges.map(toRFEdge)
      setNodes((nds) => {
        const base = select ? nds.map((n) => (n.selected ? { ...n, selected: false } : n)) : nds
        return [...base, ...rfNew.map((n) => (select ? { ...n, selected: true } : n))]
      })
      setEdges((eds) => [...eds, ...rfNewEdges])
      return {
        nodeIds: createdNodes.map((n) => n.id),
        edgeIds: createdEdges.map((e) => e.id),
      }
    },
    [boardId],
  )

  const removeByIds = useCallback(
    async (nodeIds: string[], edgeIds: string[]) => {
      const nodeSet = new Set(nodeIds)
      setNodes((nds) => nds.filter((n) => !nodeSet.has(n.id)))
      setEdges((eds) =>
        eds.filter(
          (e) => !edgeIds.includes(e.id) && !nodeSet.has(e.source) && !nodeSet.has(e.target),
        ),
      )
      await Promise.all([
        ...edgeIds.map((id) => api.deleteEdge(boardId, id).catch(() => {})),
        ...nodeIds.map((id) => api.deleteNode(boardId, id).catch(() => {})),
      ])
    },
    [boardId],
  )

  // Select exactly the given nodes (deselecting the rest).
  const selectNodes = useCallback((ids: string[]) => {
    const set = new Set(ids)
    setNodes((nds) =>
      nds.map((n) => (n.selected === set.has(n.id) ? n : { ...n, selected: set.has(n.id) })),
    )
  }, [])

  // --- Node moves (drag) become undoable -----------------------------------
  const applyPositions = useCallback(
    (positions: Map<string, { x: number; y: number }>) => {
      setNodes((nds) =>
        nds.map((n) => (positions.has(n.id) ? { ...n, position: { ...positions.get(n.id)! } } : n)),
      )
      positions.forEach((pos, id) => api.updateNode(boardId, id, pos).catch(() => {}))
    },
    [boardId],
  )

  const onNodeDragStart = useCallback(
    (_: unknown, node: Node) => {
      const moving = getNodes().filter((n) => n.selected || n.id === node.id)
      dragStartPos.current = new Map(moving.map((n) => [n.id, { x: n.position.x, y: n.position.y }]))
    },
    [getNodes],
  )

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      const before = dragStartPos.current
      dragStartPos.current = null
      const ids = before ? [...before.keys()] : [node.id]
      const after = new Map<string, { x: number; y: number }>()
      getNodes().forEach((n) => {
        if (ids.includes(n.id)) after.set(n.id, { x: n.position.x, y: n.position.y })
      })
      after.forEach((pos, id) => api.updateNode(boardId, id, pos).catch(() => {}))
      if (before) {
        const moved = [...after].some(([id, pos]) => {
          const b = before.get(id)
          return b && (b.x !== pos.x || b.y !== pos.y)
        })
        if (moved) {
          const beforeSnap = before
          pushUndo({
            undo: () => applyPositions(beforeSnap),
            redo: () => applyPositions(after),
          })
        }
      }
    },
    [boardId, getNodes, pushUndo, applyPositions],
  )

  // --- Clipboard actions (copy / cut / paste / duplicate) ------------------
  const selectedIds = useCallback(
    () => new Set(getNodes().filter((n) => n.selected).map((n) => n.id)),
    [getNodes],
  )

  const doCopy = useCallback(() => {
    const ids = selectedIds()
    if (!ids.size) return
    writeClipboard(serializeSelection(getNodes(), getEdges(), ids, boardId))
  }, [boardId, getNodes, getEdges, selectedIds])

  // Where to drop pasted/merged content so it never lands on top of existing.
  const placementFor = useCallback(
    (p: Portable, sameBoard: boolean) => {
      const incBox = portableBox(p.nodes)
      if (!incBox) return { dx: 0, dy: 0 }
      const existing = getNodes()
      if (!existing.length) return { dx: -incBox.minX, dy: -incBox.minY }
      if (sameBoard) return { dx: PASTE_OFFSET, dy: PASTE_OFFSET }
      return besideOffset(incBox, rfNodesBox(existing)!)
    },
    [getNodes],
  )

  const doPaste = useCallback(
    () =>
      runOp(async () => {
        const p = readClipboard()
        if (!p) return
        const { dx, dy } = placementFor(p, p.sourceBoardId === boardId)
        let live = await importPortableAt(p, dx, dy, true)
        pushUndo({
          undo: () => removeByIds(live.nodeIds, live.edgeIds),
          redo: async () => {
            live = await importPortableAt(p, dx, dy, true)
          },
        })
      }),
    [runOp, boardId, placementFor, importPortableAt, removeByIds, pushUndo],
  )

  const doDuplicate = useCallback(
    () =>
      runOp(async () => {
        const ids = selectedIds()
        if (!ids.size) return
        const p = serializeSelection(getNodes(), getEdges(), ids, boardId)
        let live = await importPortableAt(p, PASTE_OFFSET, PASTE_OFFSET, true)
        pushUndo({
          undo: () => removeByIds(live.nodeIds, live.edgeIds),
          redo: async () => {
            live = await importPortableAt(p, PASTE_OFFSET, PASTE_OFFSET, true)
          },
        })
      }),
    [runOp, selectedIds, getNodes, getEdges, boardId, importPortableAt, removeByIds, pushUndo],
  )

  const doCut = useCallback(
    () =>
      runOp(async () => {
        const ids = selectedIds()
        if (!ids.size) return
        // Clipboard keeps internal edges; undo capture keeps touching edges too.
        writeClipboard(serializeSelection(getNodes(), getEdges(), ids, boardId))
        const capture = serializeSelection(getNodes(), getEdges(), ids, boardId, {
          edgesTouching: true,
        })
        await removeByIds([...ids], [])
        const live = { nodeIds: [...ids], edgeIds: [] as string[] }
        pushUndo({
          undo: async () => {
            const r = await importPortableAt(capture, 0, 0, false)
            live.nodeIds = r.nodeIds
            live.edgeIds = r.edgeIds
          },
          redo: () => removeByIds(live.nodeIds, live.edgeIds),
        })
      }),
    [runOp, selectedIds, getNodes, getEdges, boardId, importPortableAt, removeByIds, pushUndo],
  )

  // Merge whole boards: place each beside the (growing) content, one undo step.
  const doMerge = useCallback(
    (portables: Portable[]) =>
      runOp(async () => {
        const place = async () => {
          let runBox = rfNodesBox(getNodes())
          const acc = { nodeIds: [] as string[], edgeIds: [] as string[] }
          for (const p of portables) {
            const incBox = portableBox(p.nodes)
            let dx = 0
            let dy = 0
            if (incBox && runBox) {
              const o = besideOffset(incBox, runBox)
              dx = o.dx
              dy = o.dy
            } else if (incBox) {
              dx = -incBox.minX
              dy = -incBox.minY
            }
            const r = await importPortableAt(p, dx, dy, false)
            acc.nodeIds.push(...r.nodeIds)
            acc.edgeIds.push(...r.edgeIds)
            if (incBox) {
              const placed = {
                minX: incBox.minX + dx,
                minY: incBox.minY + dy,
                maxX: incBox.maxX + dx,
                maxY: incBox.maxY + dy,
              }
              runBox = runBox ? unionBox(runBox, placed) : placed
            }
          }
          return acc
        }
        let live = await place()
        selectNodes(live.nodeIds) // highlight the just-merged content
        pushUndo({
          undo: () => removeByIds(live.nodeIds, live.edgeIds),
          redo: async () => {
            live = await place()
            selectNodes(live.nodeIds)
          },
        })
      }),
    [runOp, getNodes, importPortableAt, removeByIds, pushUndo, selectNodes],
  )

  // Click anywhere on the minimap to recenter the canvas there (keeping zoom).
  const onMinimapClick = useCallback(
    (_: MouseEvent, position: { x: number; y: number }) => {
      setCenter(position.x, position.y, { zoom: getZoom(), duration: 200 })
    },
    [setCenter, getZoom],
  )

  // Shift-drag selection rectangle -> track in flow coords to mirror on the minimap.
  const onSelectionStart = useCallback(
    (e: React.MouseEvent) => {
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      selStart.current = p
      setSelectionRect({ minX: p.x, minY: p.y, maxX: p.x, maxY: p.y })
    },
    [screenToFlowPosition],
  )
  const onSelectionEnd = useCallback(() => {
    selStart.current = null
    setSelectionRect(null)
  }, [])

  const isSelecting = selectionRect !== null
  useEffect(() => {
    if (!isSelecting) return
    const onMove = (e: MouseEvent) => {
      const s = selStart.current
      if (!s) return
      const c = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setSelectionRect({
        minX: Math.min(s.x, c.x),
        minY: Math.min(s.y, c.y),
        maxX: Math.max(s.x, c.x),
        maxY: Math.max(s.y, c.y),
      })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [isSelecting, screenToFlowPosition])

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

  // Gate every deletion (objects and/or connections) behind a confirm dialog.
  const onBeforeDelete = useCallback(
    ({ nodes: delNodes, edges: delEdges }: { nodes: Node[]; edges: Edge[] }) => {
      if (delNodes.length === 0 && delEdges.length === 0) return Promise.resolve(true)
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

  // Right-click a node -> clipboard menu. If it isn't part of the current
  // selection, select just it so the action targets what was clicked.
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      const isSelected = getNodes().find((n) => n.id === node.id)?.selected
      if (!isSelected) {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })))
      }
      setNodeMenu({ x: event.clientX, y: event.clientY })
    },
    [getNodes],
  )

  // Right-click the multi-selection bounding box -> same menu (acts on the
  // whole selection). React Flow's overlay intercepts the per-node handler.
  const onSelectionContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setNodeMenu({ x: event.clientX, y: event.clientY })
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

  // Merge requested from the top bar: fetch each source board and import it.
  useEffect(() => {
    if (!mergeSourceIds || !mergeSourceIds.length) return
    let cancelled = false
    ;(async () => {
      try {
        const graphs = await Promise.all(mergeSourceIds.map((sid) => api.getGraph(sid)))
        if (cancelled) return
        const portables = graphs.map((g) => graphToPortable(g.board.id, g.nodes, g.edges))
        await doMerge(portables)
      } finally {
        if (!cancelled) onMergeHandled?.()
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeSourceIds])

  // Global keyboard shortcuts (read latest action closures via a ref).
  const actionsRef = useRef({ doCopy, doCut, doPaste, doDuplicate, undo, redo })
  useEffect(() => {
    actionsRef.current = { doCopy, doCut, doPaste, doDuplicate, undo, redo }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      const a = actionsRef.current
      if (k === 'c') {
        a.doCopy()
      } else if (k === 'x') {
        e.preventDefault()
        a.doCut()
      } else if (k === 'v') {
        e.preventDefault()
        a.doPaste()
      } else if (k === 'd') {
        e.preventDefault()
        a.doDuplicate()
      } else if (k === 'z') {
        e.preventDefault()
        if (e.shiftKey) a.redo()
        else a.undo()
      } else if (k === 'y') {
        e.preventDefault()
        a.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Open/close the edit panel with a slide animation. Close keeps the panel
  // mounted briefly so its exit animation can play before it unmounts.
  const openPanel = useCallback((nodeId: string) => {
    if (panelCloseTimer.current !== null) {
      clearTimeout(panelCloseTimer.current)
      panelCloseTimer.current = null
    }
    setPanelClosing(false)
    setSelectedId(nodeId)
  }, [])

  const closePanel = useCallback(() => {
    if (panelCloseTimer.current !== null) return
    setPanelClosing(true)
    panelCloseTimer.current = window.setTimeout(() => {
      setSelectedId(null)
      setPanelClosing(false)
      panelCloseTimer.current = null
    }, 210)
  }, [])

  useEffect(
    () => () => {
      if (panelCloseTimer.current !== null) clearTimeout(panelCloseTimer.current)
    },
    [],
  )

  // Esc cascade: the gallery drawer (handled in ContextPanel, which stops the
  // event) takes priority; otherwise close the open panel; otherwise clear any
  // node selection.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Let any open dialog, context menu, dropdown, or lightbox consume Esc first.
      if (document.querySelector('.overlay, .ctx-menu, .gallery, [aria-expanded="true"]'))
        return
      if (hasPanelRef.current) {
        closePanel()
        return
      }
      if (getNodes().some((n) => n.selected)) selectNodes([])
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [closePanel, selectNodes, getNodes])

  // File drag-and-drop onto the app. While a panel is open, dropping uploads to
  // that object; otherwise we only show a hint and never upload.
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files')
    let depth = 0
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth += 1
      setDragKind(hasPanelRef.current ? 'ready' : 'blocked')
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault() // required to allow a drop
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragKind('none')
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault() // stop the browser from opening the file
      depth = 0
      setDragKind('none')
      if (hasPanelRef.current && e.dataTransfer?.files.length) {
        setDroppedFiles(Array.from(e.dataTransfer.files))
      }
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  const removeSelected = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedId(null)
  }, [])

  const selectedStory =
    (nodes.find((n) => n.id === selectedId)?.data?.story as StoryNode | undefined) ?? null
  // Tracked in a ref so the (mount-once) drag listeners read the latest value.
  hasPanelRef.current = selectedStory !== null

  // Nearby nodes for the panel drawer: linked nodes first, then nearest by
  // canvas distance, capped so the list stays browsable.
  const nearby = useMemo<NearbyNode[]>(() => {
    if (!selectedId) return []
    const cur = nodes.find((n) => n.id === selectedId)
    if (!cur) return []
    const connected = new Set<string>()
    for (const e of edges) {
      if (e.source === selectedId) connected.add(e.target)
      if (e.target === selectedId) connected.add(e.source)
    }
    const dist = (n: Node) => {
      const dx = n.position.x - cur.position.x
      const dy = n.position.y - cur.position.y
      return dx * dx + dy * dy
    }
    const others = nodes.filter((n) => n.id !== selectedId)
    const linked = others.filter((n) => connected.has(n.id)).sort((a, b) => dist(a) - dist(b))
    const rest = others.filter((n) => !connected.has(n.id)).sort((a, b) => dist(a) - dist(b))
    return [...linked, ...rest].slice(0, 10).map((n) => {
      const story = n.data?.story as StoryNode | undefined
      const refs = story?.content?.references
      return {
        id: n.id,
        title: story?.title ?? '',
        type: story?.type ?? 'note',
        connected: connected.has(n.id),
        references: Array.isArray(refs) ? (refs as LinkRef[]) : [],
      }
    })
  }, [nodes, edges, selectedId])

  return (
    <BoardIdContext.Provider value={boardId}>
    <div className="canvas-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={['Delete', 'Backspace']}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onSelectionStart={onSelectionStart}
        onSelectionEnd={onSelectionEnd}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={(_, n) => openPanel(n.id)}
        onPaneClick={() => {
          if (selectedId) closePanel()
        }}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onSelectionContextMenu={onSelectionContextMenu}
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
          onClick={onMinimapClick}
          nodeColor={(n) =>
            n.selected
              ? '#818cf8'
              : KIND_COLORS[(n.data?.kind as string) ?? 'note'] ?? '#64748b'
          }
          nodeStrokeColor={(n) => (n.selected ? '#ffffff' : 'transparent')}
          nodeStrokeWidth={4}
        />
      </ReactFlow>

      {selectionRect && <MinimapSelection rect={selectionRect} />}

      {!nodes.length && (
        <div className="canvas-hint">Right-click anywhere to create your first object</div>
      )}

      {selectedStory && (
        <ContextPanel
          boardId={boardId}
          node={selectedStory}
          nearby={nearby}
          closing={panelClosing}
          droppedFiles={droppedFiles}
          onDroppedConsumed={() => setDroppedFiles(null)}
          onChange={applyNodeUpdate}
          onDelete={removeSelected}
          onClose={closePanel}
        />
      )}

      {dragKind !== 'none' && (
        <div className={'drop-overlay drop-overlay--' + dragKind}>
          <div className="drop-overlay__card">
            <div className="drop-overlay__icon">{dragKind === 'ready' ? '⬆' : '🚫'}</div>
            {dragKind === 'ready' ? (
              <div className="drop-overlay__text">
                Drop to add media to “{selectedStory?.title || 'Untitled'}”
              </div>
            ) : (
              <>
                <div className="drop-overlay__text">Open an object to add media</div>
                <div className="drop-overlay__sub">
                  Double-click an object first, then drop your file
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {edgeMenu && (
        <ContextMenu
          x={edgeMenu.x}
          y={edgeMenu.y}
          onClose={() => setEdgeMenu(null)}
          items={[
            { label: 'Edit label…', mnemonic: 'E', onClick: () => setEditEdge(edgeMenu.edge) },
            {
              label: 'Insert node',
              mnemonic: 'I',
              onClick: () => insertNodeOnEdge(edgeMenu.edge),
            },
            {
              label: 'Delete connection',
              mnemonic: 'D',
              danger: true,
              onClick: () => deleteEdgeById(edgeMenu.edge),
            },
          ]}
        />
      )}

      {nodeMenu && (
        <ContextMenu
          x={nodeMenu.x}
          y={nodeMenu.y}
          onClose={() => setNodeMenu(null)}
          items={[
            { label: 'Copy', mnemonic: 'C', onClick: () => doCopy() },
            { label: 'Cut', mnemonic: 't', onClick: () => void doCut() },
            { label: 'Duplicate', mnemonic: 'D', onClick: () => void doDuplicate() },
            ...(clipboardHasContent()
              ? [{ label: 'Paste', mnemonic: 'P', onClick: () => void doPaste() }]
              : []),
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

      {pendingDelete &&
        (() => {
          const nCount = pendingDelete.nodes.length
          const eCount = pendingDelete.edges.length
          const title =
            nCount > 0
              ? nCount === 1
                ? 'Delete object?'
                : `Delete ${countLabel(nCount, 'object')}?`
              : eCount === 1
                ? 'Delete connection?'
                : `Delete ${countLabel(eCount, 'connection')}?`
          const message =
            nCount > 0
              ? eCount > 0
                ? `This will permanently delete ${countLabel(nCount, 'object')} and ${countLabel(eCount, 'link')}, including their media. This can't be undone.`
                : `This will permanently delete ${countLabel(nCount, 'object')} and their media. This can't be undone.`
              : `This will permanently delete ${countLabel(eCount, 'connection')}. This can't be undone.`
          return (
            <ConfirmDialog
              title={title}
              message={message}
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
          )
        })()}
    </div>
    </BoardIdContext.Provider>
  )
}

export default function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
