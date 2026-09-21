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

export const useOnline = create<OnlineState>((set, get) => ({
  status: 'idle',
  snapshot: null,
  error: '',
  lastReport: null,

  connect: async () => {
    if (get().status === 'online') return
    if (connectPromise) return connectPromise
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
        connectPromise = null
      }
    })()
    return connectPromise
  },

  refresh: async (silent = false) => {
    if (!getSessionToken()) return get().connect()
    if (!silent) set({ status: 'connecting', error: '' })
    try {
      const snapshot = await fetchWarfront()
      const previous = get().snapshot
      // garrisonLoss 是补发的驻防阵亡通知，没有真实的对战双方可供演出，
      // 不能当成 lastReport 弹出 WarfrontBattleScene。
      const freshReport = previous
        ? snapshot.reports.find(report => report.kind !== 'garrisonLoss' && !previous.reports.some(old => old.id === report.id)) ?? null
        : null
      set({ status: 'online', snapshot, error: '', ...(freshReport ? { lastReport: freshReport } : {}) })
    } catch (error) {
      set({ status: 'offline', error: error instanceof Error ? error.message : '战区同步失败' })
    }
  },

  attack: async (nodeKey, tactic, formation) => {
    set({ error: '' })
    try {
      const result = await attackWarfront({ requestId: crypto.randomUUID(), nodeKey, tactic, formation })
      set({ status: 'online', snapshot: result.snapshot, lastReport: result.report })
      return result.report
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '出征失败' })
      return null
    }
  },

  march: async (nodeKey, tactic, formation) => {
    set({ error: '' })
    try {
      const result = await marchWarfront({ requestId: crypto.randomUUID(), nodeKey, tactic, formation })
      set({ status: 'online', snapshot: result.snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '行军下达失败' })
      return false
    }
  },

  recruit: async () => {
    set({ error: '' })
    try {
      const result = await recruitSeasonTroops()
      set({ status: 'online', snapshot: result.snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '征募失败' })
      return false
    }
  },

  garrison: async (nodeKey, formation) => {
    set({ error: '' })
    try {
      const result = await garrisonWarfront({ requestId: crypto.randomUUID(), nodeKey, formation })
      set({ status: 'online', snapshot: result.snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '驻防失败' })
      return false
    }
  },

  withdraw: async (nodeKey, formation) => {
    set({ error: '' })
    try {
      const result = await withdrawWarfront({ requestId: crypto.randomUUID(), nodeKey, formation })
      set({ status: 'online', snapshot: result.snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '撤防失败' })
      return false
    }
  },

  createSect: async (name) => {
    set({ error: '' })
    try {
      const snapshot = await createOnlineSect({ name })
      set({ status: 'online', snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '创建宗门失败' })
      return false
    }
  },

  joinSect: async (sectId) => {
    set({ error: '' })
    try {
      const snapshot = await joinOnlineSect(sectId)
      set({ status: 'online', snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加入宗门失败' })
      return false
    }
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
    set({ error: '' })
    try {
      const snapshot = await renameOnlinePlayer({ displayName })
      set({ status: 'online', snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '改名失败' })
      return false
    }
  },

  syncBattleProfile: async (profile) => {
    set({ error: '' })
    try {
      const result = await syncOnlineBattleProfile({ profile })
      set({ status: 'online', snapshot: result.snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '战力档案同步失败' })
      return false
    }
  },

  requestFriend: async (targetPlayerId) => {
    set({ error: '' })
    try {
      const snapshot = await requestOnlineFriend({ targetPlayerId })
      set({ status: 'online', snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '好友申请发送失败' })
      return false
    }
  },

  respondFriend: async (requestId, accept) => {
    set({ error: '' })
    try {
      const snapshot = await respondOnlineFriend({ requestId, accept })
      set({ status: 'online', snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '好友申请处理失败' })
      return false
    }
  },

  removeFriend: async (friendId) => {
    set({ error: '' })
    try {
      const snapshot = await removeOnlineFriend({ friendId })
      set({ status: 'online', snapshot })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '删除好友失败' })
      return false
    }
  },

  newIdentity: async () => {
    clearSessionToken()
    set({ status: 'connecting', snapshot: null, error: '', lastReport: null })
    try {
      const result = await guestLogin()
      set({ status: 'online', snapshot: result.snapshot })
    } catch (error) {
      set({ status: 'offline', error: error instanceof Error ? error.message : '创建新身份失败' })
    }
  },

  clearReport: () => set({ lastReport: null }),
}))
