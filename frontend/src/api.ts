// Thin typed wrapper around the backend REST API.
import axios from 'axios'
import type {
  ActivityLog,
  AdminUser,
  Asset,
  Board,
  BoardGraph,
  Category,
  ErrorLog,
  Folder,
  GalleryBoard,
  Invite,
  LinkRef,
  RequestLog,
  Share,
  StoryEdge,
  StoryNode,
  User,
} from './types'

const http = axios.create({ baseURL: '/api' })

// --- Auth tokens -----------------------------------------------------------
const TOKEN_KEY = 'foolsboard:token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Pull a human-readable message out of a FastAPI error response.
export function apiError(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  // Pydantic prefixes custom validator messages with "Value error, " — strip it.
  const clean = (m: string) => m.replace(/^Value error,\s*/i, '')
  if (typeof detail === 'string') return clean(detail)
  if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return clean(detail[0].msg as string)
  return fallback
}

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn
}
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      setToken(null)
      onUnauthorized?.()
    }
    return Promise.reject(err)
  },
)

interface AuthResult {
  access_token: string
  user: User
}

export async function register(data: {
  email: string
  username: string
  password: string
  invite_code?: string
}): Promise<User> {
  const res = await http.post<AuthResult>('/auth/register', data)
  setToken(res.data.access_token)
  return res.data.user
}

export async function login(identifier: string, password: string): Promise<User> {
  const res = await http.post<AuthResult>('/auth/login', { identifier, password })
  setToken(res.data.access_token)
  return res.data.user
}

export async function getMe(): Promise<User> {
  return (await http.get('/auth/me')).data
}
export async function updateProfile(data: { email?: string; username?: string }): Promise<User> {
  return (await http.patch('/auth/me', data)).data
}
export async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
  await http.patch('/auth/me/password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}
export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData()
  form.append('file', file)
  return (await http.post('/auth/me/avatar', form)).data
}
export async function deleteAvatar(): Promise<User> {
  return (await http.delete('/auth/me/avatar')).data
}
export interface ColorsInfo {
  palette: string[]
  current: string | null
}
export async function getColors(): Promise<ColorsInfo> {
  return (await http.get('/auth/colors')).data
}
export async function setMyColor(color: string): Promise<User> {
  return (await http.patch('/auth/me/color', { color })).data
}
export interface Layout {
  categories: Category[]
  top: string[] // ordered ids of uncategorized top-level items
}
export async function getLayout(): Promise<Layout> {
  const d = (await http.get('/auth/me/categories')).data
  return { categories: d.categories ?? [], top: d.top ?? [] }
}
export async function saveLayout(layout: Layout): Promise<void> {
  await http.put('/auth/me/categories', layout)
}
// Remember the last-opened board server-side (so a new browser reopens it).
export async function setLastBoard(boardId: string | null): Promise<void> {
  await http.put('/auth/me/last-board', { board_id: boardId })
}
export async function logout(): Promise<void> {
  // Record the sign-out server-side (best effort), then drop the token.
  await http.post('/auth/logout').catch(() => {})
  setToken(null)
}

// --- Invites (admin) -------------------------------------------------------
export async function listInvites(): Promise<Invite[]> {
  return (await http.get('/invites')).data
}
export async function createInvite(expiresInMinutes: number): Promise<Invite> {
  return (await http.post('/invites', { expires_in_minutes: expiresInMinutes })).data
}
export async function deleteInvite(id: string): Promise<void> {
  await http.delete(`/invites/${id}`)
}

// --- Admin -----------------------------------------------------------------
export async function listUsers(): Promise<AdminUser[]> {
  return (await http.get('/admin/users')).data
}
export async function updateUser(
  id: string,
  patch: { is_admin?: boolean; is_active?: boolean },
): Promise<AdminUser> {
  return (await http.patch(`/admin/users/${id}`, patch)).data
}
export async function deleteUser(id: string): Promise<void> {
  await http.delete(`/admin/users/${id}`)
}
export async function listActivityLogs(params: {
  limit?: number
  offset?: number
  action?: string
  user_id?: string
}): Promise<ActivityLog[]> {
  return (await http.get('/admin/logs/events', { params })).data
}
export async function listRequestLogs(params: {
  limit?: number
  offset?: number
  status_code?: number
  status_class?: number
  user_id?: string
}): Promise<RequestLog[]> {
  return (await http.get('/admin/logs/requests', { params })).data
}
export async function listErrorLogs(params: {
  limit?: number
  offset?: number
  user_id?: string
}): Promise<ErrorLog[]> {
  return (await http.get('/admin/logs/errors', { params })).data
}
export async function listLogActions(): Promise<string[]> {
  return (await http.get('/admin/logs/actions')).data
}

export interface StorageGcResult {
  dry_run: boolean
  orphans: number
  freed_bytes: number
  sample: string[]
}
// Reclaim orphaned media files. dryRun=true only reports; false deletes.
export async function storageGc(dryRun: boolean): Promise<StorageGcResult> {
  return (await http.post('/admin/storage/gc', null, { params: { dry_run: dryRun } })).data
}

export interface AdminSettings {
  orphan_retention_days: number
}
export async function getAdminSettings(): Promise<AdminSettings> {
  return (await http.get('/admin/settings')).data
}
export async function updateAdminSettings(patch: AdminSettings): Promise<AdminSettings> {
  return (await http.patch('/admin/settings', patch)).data
}

export interface BackupItem {
  name: string
  kind: string // "snapshot" (restic) | "database" | "media" (legacy)
  size: number
  created_at: string
}
export interface BackupStatus {
  dir: string
  exists: boolean
  last_run: string | null
  retention: string | null // restic keep policy, e.g. "7 daily / 6 weekly / 12 monthly"
  retention_days: number | null // legacy
  total_bytes: number
  items: BackupItem[]
}
export async function getBackups(): Promise<BackupStatus> {
  return (await http.get('/admin/backups')).data
}
export async function runBackup(): Promise<BackupStatus> {
  return (await http.post('/admin/backups/run')).data
}

export interface SystemStats {
  cpu: {
    count: number | null
    percent: number | null
    load: { '1': number; '5': number; '15': number } | null
  }
  memory: { total: number; used: number; available: number; percent: number } | null
  disk: { total: number; used: number; free: number; percent: number } | null
  storage: { bytes: number; files: number } | null
  db_bytes: number | null
  uptime: { system: number | null; process: number }
  app: { users: number; boards: number; nodes: number; assets: number }
  host: { hostname: string; python: string; platform: string } | null
}
export async function getSystemStats(): Promise<SystemStats> {
  return (await http.get('/admin/stats')).data
}

// --- Links -----------------------------------------------------------------
// Fetch Open Graph / meta preview for a URL (server-side, to dodge CORS).
export async function fetchLinkPreview(url: string): Promise<LinkRef> {
  return (await http.get('/links/preview', { params: { url } })).data
}

// --- Boards ----------------------------------------------------------------
export async function listBoards(): Promise<Board[]> {
  return (await http.get('/boards')).data
}

export async function createBoard(
  name: string,
  description?: string,
  folderId?: string | null,
): Promise<Board> {
  return (await http.post('/boards', { name, description, folder_id: folderId ?? null })).data
}

export async function moveBoardToFolder(
  boardId: string,
  folderId: string | null,
): Promise<Board> {
  return (await http.patch(`/boards/${boardId}/folder`, { folder_id: folderId })).data
}

// --- Folders ---------------------------------------------------------------
export async function listFolders(): Promise<Folder[]> {
  return (await http.get('/folders')).data
}
export async function createFolder(name: string): Promise<Folder> {
  return (await http.post('/folders', { name })).data
}
export async function renameFolder(id: string, name: string): Promise<Folder> {
  return (await http.patch(`/folders/${id}`, { name })).data
}
export async function deleteFolder(id: string): Promise<void> {
  await http.delete(`/folders/${id}`)
}
// Nest a folder under another (parentFolderId=null makes it top-level).
export async function moveFolder(id: string, parentFolderId: string | null): Promise<void> {
  await http.patch(`/folders/${id}/parent`, { parent_folder_id: parentFolderId })
}
export async function reorderFolders(folderIds: string[]): Promise<void> {
  await http.patch('/folders/reorder', { folder_ids: folderIds })
}

export async function updateBoard(
  boardId: string,
  payload: { name?: string; description?: string; is_template?: boolean },
): Promise<Board> {
  return (await http.patch(`/boards/${boardId}`, payload)).data
}

export async function deleteBoard(boardId: string): Promise<void> {
  await http.delete(`/boards/${boardId}`)
}

// Persist a manual board ordering (top to bottom). Ids not owned are ignored.
export async function reorderBoards(boardIds: string[]): Promise<void> {
  await http.patch('/boards/reorder', { board_ids: boardIds })
}

// Every media asset attached to any node on the board (for the gallery).
export async function listBoardAssets(boardId: string): Promise<Asset[]> {
  return (await http.get(`/boards/${boardId}/assets`)).data
}

// Move objects (and their internal edges) into a board -- a true move that keeps
// positions, content, and attached media. Used to extract a selection.
export async function absorbNodes(boardId: string, nodeIds: string[]): Promise<void> {
  await http.post(`/boards/${boardId}/absorb`, { node_ids: nodeIds })
}

// Make a private, unshared copy of a board the caller can access.
export async function copyBoard(boardId: string): Promise<Board> {
  return (await http.post(`/boards/${boardId}/copy`)).data
}

// Every accessible board with its nodes/edges/assets, for the workspace-wide Gallery.
export async function getGallery(): Promise<{ boards: GalleryBoard[] }> {
  return (await http.get('/boards/gallery')).data
}

// --- Sharing ---------------------------------------------------------------
export async function createShare(payload: {
  recipient: string
  board_id?: string
  folder_id?: string
}): Promise<Share> {
  return (await http.post('/shares', payload)).data
}
export async function listIncomingShares(status?: string): Promise<Share[]> {
  return (await http.get('/shares/incoming', { params: status ? { status } : {} })).data
}
export async function listOutgoingShares(): Promise<Share[]> {
  return (await http.get('/shares/outgoing')).data
}
export async function acceptShare(id: string): Promise<Share> {
  return (await http.post(`/shares/${id}/accept`)).data
}
export async function rejectShare(id: string): Promise<void> {
  await http.post(`/shares/${id}/reject`)
}
// The invite's countdown ran out without a decision -> owner sees "No response".
export async function lapseShare(id: string): Promise<void> {
  await http.post(`/shares/${id}/no_response`)
}
export async function removeShare(id: string): Promise<void> {
  await http.delete(`/shares/${id}`)
}
// Unshare a board without a share id: owner stops sharing it; recipient leaves.
export async function unshareBoard(boardId: string): Promise<void> {
  await http.delete(`/shares/by-board/${boardId}`)
}

// Export selected boards as a .zip bundle (manifest + media). Returns the raw
// archive bytes for the browser to download. The archive streams as it's built,
// so `onProgress` ticks with the running byte count for a live indicator.
export async function exportBoards(
  boardIds: string[],
  folderIds: string[] = [],
  categoryIds: string[] = [],
  onProgress?: (loadedBytes: number) => void,
): Promise<Blob> {
  return (
    await http.post(
      '/boards/export',
      { board_ids: boardIds, folder_ids: folderIds, category_ids: categoryIds },
      {
        responseType: 'blob',
        onDownloadProgress: (e) => onProgress?.(e.loaded),
      },
    )
  ).data
}

// Import boards from a .zip bundle; the server creates them and returns them.
export async function importBoards(file: File): Promise<Board[]> {
  const form = new FormData()
  form.append('file', file)
  return (await http.post('/boards/import', form)).data
}

// Prefetched graph requests, consumed once. Lets the app kick off the
// last-opened board's graph in parallel with the board list (no load waterfall).
const prefetchedGraphs = new Map<string, Promise<BoardGraph>>()

export function prefetchGraph(boardId: string): void {
  if (prefetchedGraphs.has(boardId)) return
  const p = http.get(`/boards/${boardId}/graph`).then((r) => r.data as BoardGraph)
  // Drop the entry if it fails, so a rejected/stale promise can't be handed to a
  // later getGraph() and leave the canvas permanently blank; the caller re-fetches.
  p.catch(() => prefetchedGraphs.delete(boardId))
  prefetchedGraphs.set(boardId, p)
}

export async function getGraph(boardId: string): Promise<BoardGraph> {
  const pre = prefetchedGraphs.get(boardId)
  if (pre) {
    prefetchedGraphs.delete(boardId)
    return pre
  }
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
  sourceHandle?: string | null,
  targetHandle?: string | null,
  sourceT = 0.5,
  targetT = 0.5,
): Promise<StoryEdge> {
  return (
    await http.post(`/boards/${boardId}/edges`, {
      source_id: sourceId,
      target_id: targetId,
      label,
      // Which side of each node the link attaches to, and where along that side
      // (t in 0..1). Persisted in edge.data, restored on reload.
      data: {
        sourceHandle: sourceHandle ?? null,
        targetHandle: targetHandle ?? null,
        sourceT,
        targetT,
      },
    })
  ).data
}

export async function updateEdge(
  boardId: string,
  edgeId: string,
  payload: { label?: string | null; data?: Record<string, unknown> },
): Promise<StoryEdge> {
  return (await http.patch(`/boards/${boardId}/edges/${edgeId}`, payload)).data
}

export async function deleteEdge(boardId: string, edgeId: string): Promise<void> {
  await http.delete(`/boards/${boardId}/edges/${edgeId}`)
}

// --- Assets ----------------------------------------------------------------
export async function listAssets(nodeId: string): Promise<Asset[]> {
  return (await http.get(`/nodes/${nodeId}/assets`)).data
}

export async function uploadAsset(
  nodeId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<Asset> {
  const form = new FormData()
  form.append('file', file)
  return (
    await http.post(`/nodes/${nodeId}/assets`, form, {
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((100 * e.loaded) / e.total))
      },
    })
  ).data
}

export async function deleteAsset(nodeId: string, assetId: string): Promise<void> {
  await http.delete(`/nodes/${nodeId}/assets/${assetId}`)
}
export async function renameAsset(nodeId: string, assetId: string, filename: string): Promise<Asset> {
  return (await http.patch(`/nodes/${nodeId}/assets/${assetId}`, { filename })).data
}

// Attach existing media (by id, e.g. from a nearby node) to a node, sharing the
// stored file via dedup. Returns the newly-created assets on the target node.
export async function referenceAssets(nodeId: string, assetIds: string[]): Promise<Asset[]> {
  return (await http.post(`/nodes/${nodeId}/assets/reference`, { asset_ids: assetIds })).data
}
