import { create } from 'zustand'
import type { BattleProfile, TroopKey, WarfrontTactic } from '../game/types'
import type { OnlineBattleReport, OnlinePlayerSearch, WarfrontSnapshot } from './contracts'
import {
  attackWarfront, clearSessionToken, createOnlineSect, fetchWarfront, garrisonWarfront, getSessionToken, guestLogin, joinOnlineSect, marchWarfront, OnlineApiError, recruitSeasonTroops, removeOnlineFriend, renameOnlinePlayer, requestOnlineFriend, respondOnlineFriend, searchOnlinePlayers, syncOnlineBattleProfile, withdrawWarfront,
} from './api'

type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline'

interface OnlineState {
  status: ConnectionStatus
  snapshot: WarfrontSnapshot | null
  error: string
  lastReport: OnlineBattleReport | null
  connect: () => Promise<void>
  refresh: (silent?: boolean) => Promise<void>
  attack: (nodeKey: string, tactic: WarfrontTactic, formation: Record<TroopKey, number>) => Promise<OnlineBattleReport | null>
  march: (nodeKey: string, tactic: WarfrontTactic, formation: Record<TroopKey, number>) => Promise<boolean>
  recruit: () => Promise<boolean>
  garrison: (nodeKey: string, formation: Record<TroopKey, number>) => Promise<boolean>
  withdraw: (nodeKey: string, formation: Record<TroopKey, number>) => Promise<boolean>
  createSect: (name: string) => Promise<boolean>
  joinSect: (sectId: string) => Promise<boolean>
  searchPlayers: (query: string, onlineOnly?: boolean) => Promise<OnlinePlayerSearch[]>
  rename: (displayName: string) => Promise<boolean>
  syncBattleProfile: (profile: BattleProfile) => Promise<boolean>
  requestFriend: (targetPlayerId: string) => Promise<boolean>
  respondFriend: (requestId: string, accept: boolean) => Promise<boolean>
  removeFriend: (friendId: string) => Promise<boolean>
  newIdentity: () => Promise<void>
  clearReport: () => void
}

let connectPromise: Promise<void> | null = null
let refreshPromise: Promise<void> | null = null
let mutationInFlight = 0

function beginOnlineMutation(): () => void {
  mutationInFlight += 1
  return () => { mutationInFlight = Math.max(0, mutationInFlight - 1) }
}

export const useOnline = create<OnlineState>((set, get) => ({
  status: 'idle',
  snapshot: null,
  error: '',
  lastReport: null,

  connect: async () => {
    if (get().status === 'online') return
    if (connectPromise) return connectPromise
    const finishMutation = beginOnlineMutation()
    set({ status: 'connecting', error: '' })
    connectPromise = (async () => {
      try {
        const result = getSessionToken() ? await fetchWarfront() : (await guestLogin()).snapshot
        set({ status: 'online', snapshot: result, error: '' })
      } catch (error) {
        if (error instanceof OnlineApiError && error.status === 401) {
          clearSessionToken()
          try {
            const result = await guestLogin()
            set({ status: 'online', snapshot: result.snapshot, error: '' })
            return
          } catch (retryError) { error = retryError }
        }
        set({ status: 'offline', error: error instanceof Error ? error.message : '无法连接多人服务器' })
      } finally {
        finishMutation()
        connectPromise = null
      }
    })()
    return connectPromise
  },

  refresh: async (silent = false) => {
    if (!getSessionToken()) return get().connect()
    if (mutationInFlight > 0) return
    if (refreshPromise) return refreshPromise
    if (!silent) set({ status: 'connecting', error: '' })
    const run = (async () => {
      try {
        const snapshot = await fetchWarfront()
        const previous = get().snapshot
        const freshReport = previous
          ? snapshot.reports.find(report => report.kind !== 'garrisonLoss' && !previous.reports.some(old => old.id === report.id)) ?? null
          : null
        set({ status: 'online', snapshot, error: '', ...(freshReport ? { lastReport: freshReport } : {}) })
      } catch (error) {
        set({ status: 'offline', error: error instanceof Error ? error.message : '战区同步失败' })
      }
    })()
    refreshPromise = run
    try { await run } finally {
      if (refreshPromise === run) refreshPromise = null
    }
  },

  attack: async (nodeKey, tactic, formation) => {
    const finishMutation = beginOnlineMutation()
    set({ error: '' })
    try {
      const result = await attackWarfront({ requestId: crypto.randomUUID(), nodeKey, tactic, formation })
      set({ status: 'online', snapshot: result.snapshot, lastReport: result.report })
      return result.report
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '出征失败' })
      return null
    } finally { finishMutation() }
  },

  march: async (nodeKey, tactic, formation) => {
    const finishMutation = beginOnlineMutation()
    set({ error: '' })
    try {
      const result = await marchWarfront({ requestId: crypto.randomUUID(), nodeKey, tactic, formation })
      set({ status: 'online', snapshot: result.snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '行军下达失败' })
      return false
    } finally { finishMutation() }
  },

  recruit: async () => {
    const finishMutation = beginOnlineMutation()
    set({ error: '' })
    try {
      const result = await recruitSeasonTroops()
      set({ status: 'online', snapshot: result.snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '征募失败' })
      return false
    } finally { finishMutation() }
  },

  garrison: async (nodeKey, formation) => {
    const finishMutation = beginOnlineMutation()
    set({ error: '' })
    try {
      const result = await garrisonWarfront({ requestId: crypto.randomUUID(), nodeKey, formation })
      set({ status: 'online', snapshot: result.snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '驻防失败' })
      return false
    } finally { finishMutation() }
  },

  withdraw: async (nodeKey, formation) => {
    const finishMutation = beginOnlineMutation()
    set({ error: '' })
    try {
      const result = await withdrawWarfront({ requestId: crypto.randomUUID(), nodeKey, formation })
      set({ status: 'online', snapshot: result.snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '撤防失败' })
      return false
    } finally { finishMutation() }
  },

  createSect: async (name) => {
    const finishMutation = beginOnlineMutation()
    set({ error: '' })
    try {
      const snapshot = await createOnlineSect({ name })
      set({ status: 'online', snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '创建宗门失败' })
      return false
    } finally { finishMutation() }
  },

  joinSect: async (sectId) => {
    const finishMutation = beginOnlineMutation()
    set({ error: '' })
    try {
      const snapshot = await joinOnlineSect(sectId)
      set({ status: 'online', snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加入宗门失败' })
      return false
    } finally { finishMutation() }
  },

  searchPlayers: async (query, onlineOnly = false) => {
    try {
      return (await searchOnlinePlayers(query, onlineOnly)).players
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '搜索玩家失败' })
      return []
    }
  },

  rename: async (displayName) => {
    const finishMutation = beginOnlineMutation()
    set({ error: '' })
    try {
      const snapshot = await renameOnlinePlayer({ displayName })
      set({ status: 'online', snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '改名失败' })
      return false
    } finally { finishMutation() }
  },

  syncBattleProfile: async (profile) => {
    const finishMutation = beginOnlineMutation()
    set({ error: '' })
    try {
      const result = await syncOnlineBattleProfile({ profile })
      set({ status: 'online', snapshot: result.snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '战力档案同步失败' })
      return false
    } finally { finishMutation() }
  },

  requestFriend: async (targetPlayerId) => {
    const finishMutation = beginOnlineMutation()
    set({ error: '' })
    try {
      const snapshot = await requestOnlineFriend({ targetPlayerId })
      set({ status: 'online', snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '好友申请发送失败' })
      return false
    } finally { finishMutation() }
  },

  respondFriend: async (requestId, accept) => {
    const finishMutation = beginOnlineMutation()
    set({ error: '' })
    try {
      const snapshot = await respondOnlineFriend({ requestId, accept })
      set({ status: 'online', snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '好友申请处理失败' })
      return false
    } finally { finishMutation() }
  },

  removeFriend: async (friendId) => {
    const finishMutation = beginOnlineMutation()
    set({ error: '' })
    try {
      const snapshot = await removeOnlineFriend({ friendId })
      set({ status: 'online', snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '删除好友失败' })
      return false
    } finally { finishMutation() }
  },

  newIdentity: async () => {
    const finishMutation = beginOnlineMutation()
    clearSessionToken()
    set({ status: 'connecting', snapshot: null, error: '', lastReport: null })
    try {
      const result = await guestLogin()
      set({ status: 'online', snapshot: result.snapshot })
    } catch (error) {
      set({ status: 'offline', error: error instanceof Error ? error.message : '创建新身份失败' })
    } finally { finishMutation() }
  },

  clearReport: () => set({ lastReport: null }),
}))
