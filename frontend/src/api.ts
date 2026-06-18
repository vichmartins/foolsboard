// Thin typed wrapper around the backend REST API.
import axios from 'axios'
import type {
  Asset,
  Board,
  BoardGraph,
  StoryEdge,
  StoryNode,
} from './types'

const http = axios.create({ baseURL: '/api' })

// --- Boards ----------------------------------------------------------------
export async function listBoards(): Promise<Board[]> {
  return (await http.get('/boards')).data
}

export async function createBoard(name: string, description?: string): Promise<Board> {
  return (await http.post('/boards', { name, description })).data
}

export async function updateBoard(
  boardId: string,
  payload: { name?: string; description?: string },
): Promise<Board> {
  return (await http.patch(`/boards/${boardId}`, payload)).data
}

export async function deleteBoard(boardId: string): Promise<void> {
  await http.delete(`/boards/${boardId}`)
}

export async function getGraph(boardId: string): Promise<BoardGraph> {
  return (await http.get(`/boards/${boardId}/graph`)).data
}

// --- Nodes -----------------------------------------------------------------
export async function createNode(
  boardId: string,
  payload: Partial<StoryNode>,
): Promise<StoryNode> {
  return (await http.post(`/boards/${boardId}/nodes`, payload)).data
}

export async function updateNode(
  boardId: string,
  nodeId: string,
  payload: Partial<StoryNode>,
): Promise<StoryNode> {
  return (await http.patch(`/boards/${boardId}/nodes/${nodeId}`, payload)).data
}

export async function deleteNode(boardId: string, nodeId: string): Promise<void> {
  await http.delete(`/boards/${boardId}/nodes/${nodeId}`)
}

// --- Edges -----------------------------------------------------------------
export async function createEdge(
  boardId: string,
  sourceId: string,
  targetId: string,
  label?: string,
): Promise<StoryEdge> {
  return (
    await http.post(`/boards/${boardId}/edges`, {
      source_id: sourceId,
      target_id: targetId,
      label,
    })
  ).data
}

export async function deleteEdge(boardId: string, edgeId: string): Promise<void> {
  await http.delete(`/boards/${boardId}/edges/${edgeId}`)
}

// --- Assets ----------------------------------------------------------------
export async function listAssets(nodeId: string): Promise<Asset[]> {
  return (await http.get(`/nodes/${nodeId}/assets`)).data
}

export async function uploadAsset(nodeId: string, file: File): Promise<Asset> {
  const form = new FormData()
  form.append('file', file)
  return (await http.post(`/nodes/${nodeId}/assets`, form)).data
}

export async function deleteAsset(nodeId: string, assetId: string): Promise<void> {
  await http.delete(`/nodes/${nodeId}/assets/${assetId}`)
}
