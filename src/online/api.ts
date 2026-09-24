import type {
  AccountAuthResponse, ApiError, AttackPayload, AttackResponse, ChatMessagesResponse, CreateSectPayload, FriendRequestPayload, GameCommandRequest, GameCommandResponse, GameSnapshot, GarrisonPayload, GuestAuthResponse, GarrisonResponse, LoginAccountPayload, MarchPayload, MarchResponse, PlayerSearchResponse, RecruitResponse, RegisterAccountPayload, RemoveFriendPayload, RenamePayload, RespondFriendRequestPayload, SendChatPayload, SyncBattleProfilePayload, SyncBattleProfileResponse, WarfrontPreview, WarfrontPreviewPayload, WarfrontSnapshot, WithdrawPayload, WithdrawResponse,
} from './contracts'

const TOKEN_KEY = 'fanren-slg-online-token-v1'

/** HTTP 部署不是 secure context 时，浏览器可能没有 crypto.randomUUID。 */
export function createRequestId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export class OnlineApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message) }
}

export function getSessionToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function clearSessionToken() {
  try { sessionStorage.removeItem(TOKEN_KEY) } catch { /* storage unavailable */ }
}

function saveSessionToken(token: string) {
  try { sessionStorage.setItem(TOKEN_KEY, token) } catch { /* tab remains usable until refresh */ }
}

async function request<T>(path: string, init: RequestInit = {}, token = getSessionToken()): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  const body = await response.json().catch(() => ({ error: '服务器返回了无效数据' })) as T | ApiError
  if (!response.ok) {
    const error = body as ApiError
    throw new OnlineApiError(error.error || '联机请求失败', response.status, error.code)
  }
  return body as T
}

export async function guestLogin(displayName?: string): Promise<GuestAuthResponse> {
  const result = await request<GuestAuthResponse>('/api/auth/guest', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  }, null)
  saveSessionToken(result.token)
  return result
}

export async function registerAccount(payload: RegisterAccountPayload): Promise<AccountAuthResponse> {
  const result = await request<AccountAuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }, null)
  saveSessionToken(result.token)
  return result
}

export async function loginAccount(payload: LoginAccountPayload): Promise<AccountAuthResponse> {
  const result = await request<AccountAuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }, null)
  saveSessionToken(result.token)
  return result
}

export function fetchChatMessages(channel: 'world' | 'sect', after?: string): Promise<ChatMessagesResponse> {
  const params = new URLSearchParams({ channel })
  if (after) params.set('after', after)
  return request(`/api/chat/messages?${params.toString()}`)
}

export function sendChatMessage(payload: SendChatPayload): Promise<ChatMessagesResponse> {
  return request('/api/chat/messages', { method: 'POST', body: JSON.stringify(payload) })
}

export function fetchWarfront(): Promise<WarfrontSnapshot> {
  return request('/api/warfront')
}

export function fetchGameSnapshot(): Promise<GameSnapshot> {
  return request('/api/game/snapshot')
}

export function sendGameCommand(payload: GameCommandRequest): Promise<GameCommandResponse> {
  return request('/api/game/command', { method: 'POST', body: JSON.stringify(payload) })
}

export function attackWarfront(payload: AttackPayload): Promise<AttackResponse> {
  return request('/api/warfront/attack', { method: 'POST', body: JSON.stringify(payload) })
}

export function marchWarfront(payload: MarchPayload): Promise<MarchResponse> {
  return request('/api/warfront/march', { method: 'POST', body: JSON.stringify(payload) })
}

export function previewWarfront(payload: WarfrontPreviewPayload): Promise<WarfrontPreview> {
  return request('/api/warfront/preview', { method: 'POST', body: JSON.stringify(payload) })
}

export function recruitSeasonTroops(): Promise<RecruitResponse> {
  return request('/api/warfront/recruit', { method: 'POST', body: '{}' })
}

export function garrisonWarfront(payload: GarrisonPayload): Promise<GarrisonResponse> {
  return request('/api/warfront/garrison', { method: 'POST', body: JSON.stringify(payload) })
}

export function withdrawWarfront(payload: WithdrawPayload): Promise<WithdrawResponse> {
  return request('/api/warfront/withdraw', { method: 'POST', body: JSON.stringify(payload) })
}

export function createOnlineSect(payload: CreateSectPayload): Promise<WarfrontSnapshot> {
  return request('/api/sect/create', { method: 'POST', body: JSON.stringify(payload) })
}

export function joinOnlineSect(sectId: string): Promise<WarfrontSnapshot> {
  return request('/api/sect/join', { method: 'POST', body: JSON.stringify({ sectId }) })
}

export function searchOnlinePlayers(query: string, onlineOnly = false): Promise<PlayerSearchResponse> {
  const params = new URLSearchParams()
  if (query) params.set('query', query)
  if (onlineOnly) params.set('online', '1')
  return request(`/api/social/players?${params.toString()}`)
}

export function renameOnlinePlayer(payload: RenamePayload): Promise<WarfrontSnapshot> {
  return request('/api/profile/name', { method: 'POST', body: JSON.stringify(payload) })
}

export function syncOnlineBattleProfile(payload: SyncBattleProfilePayload): Promise<SyncBattleProfileResponse> {
  return request('/api/profile/battle', { method: 'POST', body: JSON.stringify(payload) })
}

export function requestOnlineFriend(payload: FriendRequestPayload): Promise<WarfrontSnapshot> {
  return request('/api/social/friends/request', { method: 'POST', body: JSON.stringify(payload) })
}

export function respondOnlineFriend(payload: RespondFriendRequestPayload): Promise<WarfrontSnapshot> {
  return request('/api/social/friends/respond', { method: 'POST', body: JSON.stringify(payload) })
}

export function removeOnlineFriend(payload: RemoveFriendPayload): Promise<WarfrontSnapshot> {
  return request('/api/social/friends/remove', { method: 'POST', body: JSON.stringify(payload) })
}
