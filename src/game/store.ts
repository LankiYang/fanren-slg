import { create } from 'zustand'
import type {
  BossReport, BuildingKey, EquipmentSlot, ExpeditionChoice, ExpeditionReport,
  FloatEvent, GameState, Gender, OfflineReport, ResourceKey, Resources, SeekDrop,
  TroopKey, WarfrontReport, WarfrontTactic,
} from './types'
import { PRODUCER_KEYS } from './data'
import { DONGFU_PREREQ_COUNT, canUpgradeDongfu, dongfuPrereqLevel } from './balance'
import {
  battlePower, busyQueues, computeRates, currentCap, currentMarchCap,
  currentTroopCap, totalPower, totalTroops, troopPower, counterBonus,
  realmOutputBonus, realmPowerBonus, buildCostFactor, buildSpeedFactor,
} from './compute'
import { createInitialGameState } from './defaults'
import { FEATURE_INTRO, GUIDE_TOURS, TUTORIAL } from './tutorial'
import { sendGameCommand, fetchGameSnapshot, getSessionToken, clearSessionToken, OnlineApiError } from '../online/api'
import type { GameCommandName, GameDerivedSnapshot, GameSnapshot } from '../online/contracts'

const UI_PREFS_KEY = 'fanren-slg-ui-preferences-v1'
let floatSeq = 0

type Result = { ok: boolean; reason?: string }
type CommandResult<T extends object = Record<string, never>> = Promise<Result & T>

const EMPTY_DERIVED: GameDerivedSnapshot = {
  rates: { lingshi: 0, lingqi: 0, lingyao: 0, kuanglingcai: 0 },
  storageCap: 0,
  troopCap: 0,
  marchCap: 0,
  totalTroops: 0,
  totalPower: 0,
  formationUsed: 0,
  busyQueues: 0,
  maxTrainable: { kuilei: 0, yushou: 0, fuxiu: 0 },
  buildingCosts: {},
  buildingTimes: {},
  stagePower: {},
  battlePowerByEnemy: { kuilei: 0, yushou: 0, fuxiu: 0 },
  recommendedFormationByEnemy: {
    kuilei: { kuilei: 0, yushou: 0, fuxiu: 0 },
    yushou: { kuilei: 0, yushou: 0, fuxiu: 0 },
    fuxiu: { kuilei: 0, yushou: 0, fuxiu: 0 },
  },
  buildingDetails: {} as GameDerivedSnapshot['buildingDetails'],
  troopDetails: {} as GameDerivedSnapshot['troopDetails'],
  cultivatorDetails: {} as GameDerivedSnapshot['cultivatorDetails'],
  gongfaDetails: {} as GameDerivedSnapshot['gongfaDetails'],
  pillDetails: {} as GameDerivedSnapshot['pillDetails'],
  artifactDetails: {} as GameDerivedSnapshot['artifactDetails'],
  artifactBonusPercent: { kuilei: 0, yushou: 0, fuxiu: 0 },
  seekTemperCosts: { weapon: 0, armor: 0, accessory: 0 },
  questDetails: {} as GameDerivedSnapshot['questDetails'],
  realm: {
    currentName: '炼气一层',
    currentOutputBonus: 1,
    currentPowerBonus: 1,
    cultivation: 0,
    cultivationNeed: 220,
    dongfuReady: false,
    cultivationReady: false,
    resourcesReady: false,
    next: null,
    canBreakthrough: false,
  },
  boss: { hp: 0, myPower: 0, readyAt: 0, canChallenge: false },
  bossReadyAt: 0,
  expeditionEnergyReadyAt: 0,
}

interface UiPreferences {
  tutorialStep: number
  tutorialDone: boolean
  seenIntros: string[]
}

function readUiPreferences(): UiPreferences {
  const fallback: UiPreferences = { tutorialStep: 0, tutorialDone: false, seenIntros: [] }
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<UiPreferences>
    return {
      tutorialStep: Number.isInteger(parsed.tutorialStep) ? parsed.tutorialStep! : fallback.tutorialStep,
      tutorialDone: parsed.tutorialDone === true,
      seenIntros: Array.isArray(parsed.seenIntros) ? parsed.seenIntros.filter(item => typeof item === 'string') : [],
    }
  } catch {
    return fallback
  }
}

function saveUiPreferences(state: Pick<GameState, 'tutorialStep' | 'tutorialDone' | 'seenIntros'>): void {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
      tutorialStep: state.tutorialStep,
      tutorialDone: state.tutorialDone,
      seenIntros: state.seenIntros,
    }))
  } catch {
    // UI 偏好不可写时不影响服务端游戏存档。
  }
}

function makeFloats(previous: Resources, next: Resources): FloatEvent[] {
  const floats: FloatEvent[] = []
  for (const key of Object.keys(next) as ResourceKey[]) {
    const amount = Math.round(next[key] - previous[key])
    if (amount > 0) floats.push({ id: ++floatSeq, key, amount })
  }
  return floats
}

function localInitialState(): GameState {
  const game = createInitialGameState()
  const prefs = readUiPreferences()
  return {
    ...game,
    tutorialStep: prefs.tutorialStep,
    tutorialDone: prefs.tutorialDone,
    seenIntros: prefs.seenIntros,
    activeIntro: null,
    introStep: 0,
  }
}

export function dongfuPrereqStatus(s: GameState): { ok: boolean; need: number; have: number; level: number } {
  const target = s.buildings.dongfu.level + 1
  const need = dongfuPrereqLevel(target)
  const levels = PRODUCER_KEYS.map(key => s.buildings[key].level)
  return { ok: canUpgradeDongfu(levels, target), need: DONGFU_PREREQ_COUNT, have: levels.filter(level => level >= need).length, level: need }
}

interface Store extends GameState {
  derived: GameDerivedSnapshot
  offlineReport: OfflineReport | null
  floats: FloatEvent[]
  activeGuide: string | null
  guideStep: number
  connectionError: string
  connect: () => Promise<void>
  tick: () => Promise<void>
  clearOfflineReport: () => void
  popFloat: (id: number) => void
  startUpgrade: (key: BuildingKey) => CommandResult<{ key?: string; target?: number; upgradingUntil?: number }>
  finishUpgrade: (key: BuildingKey) => CommandResult<{ key?: string; level?: number }>
  breakthrough: () => CommandResult<{ realm?: string }>
  chooseGender: (gender: Gender) => CommandResult
  seekNow: () => CommandResult<{ report?: SeekDrop }>
  temperEquipment: (slot: EquipmentSlot) => CommandResult
  claimSeekMilestone: (id: string) => CommandResult
  trainTroop: (key: TroopKey, count: number) => CommandResult
  maxTrainable: (key: TroopKey) => number
  levelUpCultivator: (key: string) => CommandResult
  challengeStage: (id: number) => CommandResult<{ win: boolean; myPower: number; enemyPower: number; deployed?: number; losses?: number; formation?: Record<TroopKey, number>; firstClear?: boolean; unlockCultivator?: string; name?: string; sprite?: string }>
  unlockQueue: () => CommandResult
  challengeBoss: () => CommandResult<{ report?: BossReport }>
  bossReadyAt: () => number
  claimQuest: (id: string) => CommandResult
  researchGongfa: (key: string) => CommandResult
  craftPill: (key: 'qi' | 'body' | 'mind') => CommandResult
  collectPill: () => CommandResult
  usePill: (key: 'qi' | 'body' | 'mind') => CommandResult
  forgeArtifact: (key: string) => CommandResult
  setFormation: (formation: Record<TroopKey, number>) => CommandResult
  setWarfrontTactic: (tactic: WarfrontTactic) => void
  syncOnlineWarfrontIncome: (income: Resources) => void
  claimOnlineWarfrontReward: (reportId: string, reward: Partial<Resources>) => void
  attackWarfront: (nodeKey: string) => CommandResult<{ report?: WarfrontReport }>
  refreshExpedition: () => Promise<void>
  expeditionEnergyReadyAt: () => number
  exploreExpeditionNode: (nodeId: string, choice?: ExpeditionChoice) => CommandResult<{ report?: ExpeditionReport }>
  claimExpeditionWeekly: (id: string) => CommandResult
  claimExpeditionSeason: (id: string) => CommandResult
  buyExpeditionShop: (id: string) => CommandResult
  nextTutorialStep: () => void
  skipTutorial: () => void
  startGuide: (id: string) => void
  nextGuideStep: () => void
  skipGuide: () => void
  maybeStartIntro: (id: string) => void
  nextIntroStep: () => void
  skipIntro: () => void
  markGuideFlag: (flag: string) => Promise<Result>
  reset: () => void
}

let connectPromise: Promise<void> | null = null
let refreshPromise: Promise<void> | null = null

function errorResult(error: unknown): Result {
  return { ok: false, reason: error instanceof Error ? error.message : '服务器暂时不可用' }
}

function applySnapshot(set: (patch: Partial<Store>) => void, get: () => Store, snapshot: GameSnapshot): void {
  const previous = get()
  const prefs = readUiPreferences()
  const floats = [...previous.floats, ...makeFloats(previous.resources, snapshot.game.resources)].slice(-24)
  set({
    ...snapshot.game,
    derived: snapshot.derived,
    offlineReport: snapshot.offlineReport ?? previous.offlineReport,
    floats,
    activeGuide: previous.activeGuide,
    guideStep: previous.guideStep,
    activeIntro: previous.activeIntro,
    introStep: previous.introStep,
    tutorialStep: prefs.tutorialStep,
    tutorialDone: prefs.tutorialDone,
    seenIntros: prefs.seenIntros,
    guideFlags: snapshot.game.guideFlags,
    journeyStartedAt: snapshot.game.journeyStartedAt,
    connectionError: '',
  })
}

async function fetchAndApply(set: (patch: Partial<Store>) => void, get: () => Store): Promise<void> {
  if (!getSessionToken()) throw new Error('请先登录账号')
  try {
    applySnapshot(set, get, await fetchGameSnapshot())
  } catch (error) {
    if (error instanceof OnlineApiError && error.status === 401) {
      clearSessionToken()
      throw new Error('登录已失效，请重新登录')
    }
    throw error
  }
}

export const useGame = create<Store>((set, get) => {
  const initial = localInitialState()
  return {
    ...initial,
    derived: EMPTY_DERIVED,
    offlineReport: null,
    floats: [],
    activeGuide: null,
    guideStep: 0,
    connectionError: '',

    connect: async () => {
      if (connectPromise) return connectPromise
      connectPromise = fetchAndApply(set, get).catch(error => {
        set({ connectionError: error instanceof Error ? error.message : '无法连接游戏服务器' })
      }).finally(() => { connectPromise = null })
      return connectPromise
    },

    tick: async () => {
      if (refreshPromise) return refreshPromise
      refreshPromise = (async () => {
        try {
          await fetchAndApply(set, get)
        } catch (error) {
          set({ connectionError: error instanceof Error ? error.message : '游戏同步失败' })
        }
      })().finally(() => { refreshPromise = null })
      return refreshPromise
    },

    clearOfflineReport: () => set({ offlineReport: null }),
    popFloat: id => set(state => ({ floats: state.floats.filter(item => item.id !== id) })),

    startUpgrade: key => command('building.start', { key }, set, get),
    finishUpgrade: key => command('building.claim', { key }, set, get),
    breakthrough: () => command('realm.breakthrough', {}, set, get),
    chooseGender: gender => command('character.choose', { gender }, set, get),
    seekNow: () => command('seek.draw', {}, set, get),
    temperEquipment: slot => command('seek.temper', { slot }, set, get),
    claimSeekMilestone: id => command('seek.milestone.claim', { id }, set, get),
    trainTroop: (key, count) => command('troops.train', { key, count }, set, get),
    maxTrainable: key => get().derived.maxTrainable[key] ?? 0,
    levelUpCultivator: key => command('cultivator.level', { key }, set, get),
    challengeStage: id => command('stage.attack', { id }, set, get),
    unlockQueue: () => command('queue.unlock', {}, set, get),
    challengeBoss: () => command('boss.challenge', {}, set, get),
    bossReadyAt: () => get().derived.bossReadyAt,
    claimQuest: id => command('quest.claim', { id }, set, get),
    researchGongfa: key => command('gongfa.research', { key }, set, get),
    craftPill: key => command('pill.craft', { key }, set, get),
    collectPill: () => command('pill.collect', {}, set, get),
    usePill: key => command('pill.use', { key }, set, get),
    forgeArtifact: key => command('artifact.forge', { key }, set, get),
    setFormation: formation => command('formation.set', { formation }, set, get),
    setWarfrontTactic: tactic => set({ warfrontTactic: tactic }),
    syncOnlineWarfrontIncome: () => undefined,
    claimOnlineWarfrontReward: () => undefined,
    attackWarfront: () => Promise.resolve({ ok: false, reason: '请在战区地图下达出征命令' }),
    refreshExpedition: async () => { await get().tick() },
    expeditionEnergyReadyAt: () => get().derived.expeditionEnergyReadyAt,
    exploreExpeditionNode: (nodeId, choice = 'steady') => command('expedition.explore', { nodeId, choice }, set, get),
    claimExpeditionWeekly: id => command('expedition.weekly.claim', { id }, set, get),
    claimExpeditionSeason: id => command('expedition.season.claim', { id }, set, get),
    buyExpeditionShop: id => command('expedition.shop.buy', { id }, set, get),

    nextTutorialStep: () => {
      const next = get().tutorialStep + 1
      const tutorialDone = next >= TUTORIAL.length
      set({ tutorialStep: tutorialDone ? get().tutorialStep : next, tutorialDone })
      saveUiPreferences({ ...get(), tutorialStep: tutorialDone ? get().tutorialStep : next, tutorialDone })
    },
    skipTutorial: () => {
      set({ tutorialDone: true })
      saveUiPreferences({ ...get(), tutorialDone: true })
    },
    startGuide: id => {
      if (!GUIDE_TOURS[id]?.length) return
      set({ activeGuide: id, guideStep: 0, activeIntro: null, introStep: 0 })
    },
    nextGuideStep: () => {
      const state = get()
      if (!state.activeGuide) return
      const steps = GUIDE_TOURS[state.activeGuide] ?? []
      set(steps.length > state.guideStep + 1 ? { guideStep: state.guideStep + 1 } : { activeGuide: null, guideStep: 0 })
    },
    skipGuide: () => set({ activeGuide: null, guideStep: 0 }),
    maybeStartIntro: id => {
      const state = get()
      if (!state.tutorialDone || state.activeIntro || state.activeGuide || state.seenIntros.includes(id)) return
      if (!FEATURE_INTRO[id as keyof typeof FEATURE_INTRO]?.length) return
      set({ activeIntro: id, introStep: 0 })
    },
    nextIntroStep: () => {
      const state = get()
      if (!state.activeIntro) return
      const steps = FEATURE_INTRO[state.activeIntro as keyof typeof FEATURE_INTRO] ?? []
      if (steps.length > state.introStep + 1) set({ introStep: state.introStep + 1 })
      else {
        const seenIntros = [...state.seenIntros, state.activeIntro]
        set({ seenIntros, activeIntro: null, introStep: 0 })
        saveUiPreferences({ ...get(), seenIntros })
      }
    },
    skipIntro: () => {
      const state = get()
      if (!state.activeIntro) return
      const seenIntros = [...state.seenIntros, state.activeIntro]
      set({ seenIntros, activeIntro: null, introStep: 0 })
      saveUiPreferences({ ...get(), seenIntros })
    },
    markGuideFlag: flag => {
      const state = get()
      if (state.guideFlags.includes(flag)) return Promise.resolve({ ok: true })
      return command('guide.flag', { flag }, set, get)
    },
    reset: () => {
      try { localStorage.removeItem(UI_PREFS_KEY) } catch { /* no-op */ }
      clearSessionToken()
      set({ ...localInitialState(), derived: EMPTY_DERIVED, offlineReport: null, floats: [], activeGuide: null, guideStep: 0, connectionError: '' })
      void get().connect()
    },
  }
})

async function command<T extends object>(
  name: GameCommandName,
  payload: Record<string, unknown>,
  set: (patch: Partial<Store>) => void,
  get: () => Store,
): Promise<Result & T> {
  try {
    if (!getSessionToken()) throw new Error('请先登录账号')
    const response = await sendGameCommand({ requestId: crypto.randomUUID(), command: name, payload })
    applySnapshot(set, get, response.snapshot)
    return response.result as Result & T
  } catch (error) {
    const result = errorResult(error) as Result & T
    set({ connectionError: result.reason ?? '' })
    return result
  }
}

export {
  realmOutputBonus, realmPowerBonus, computeRates, currentCap, currentTroopCap,
  currentMarchCap, totalTroops, troopPower, totalPower, battlePower, busyQueues,
  counterBonus, buildCostFactor, buildSpeedFactor,
}

