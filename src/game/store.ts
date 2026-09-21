// ═══ 游戏状态管理（zustand）═══
// 所有数值结算 100% 本地确定，无随机数参与战斗判定。
// 曲线全部来自 balance.ts —— 与 sim/simulate.ts 验证过的是同一套函数。
import { create } from 'zustand'
import type {
  BossReport, BuildingKey, EquipmentSlot, ExpeditionChoice, ExpeditionReport, FloatEvent, GameState,
  Gender, OfflineReport, ResourceKey, Resources, SeekDrop, TroopKey, WarfrontReport, WarfrontTactic,
} from './types'
import {
  BUILDINGS, BUILDING_MAP, CULTIVATORS, CULTIVATOR_MAP,
  INITIAL_RESOURCES, PRODUCER_KEYS, REALMS, STAGES, TROOP_MAP,
  buildingCost, buildingTime, cultivatorCost, CULTIVATOR_MAX_LEVEL,
} from './data'
import {
  TUNE, INITIAL_BUILDING_LEVEL, canUpgradeDongfu,
  DONGFU_PREREQ_COUNT, dongfuPrereqLevel,
  BOSS, bossHp, bossTier, bossReward,
} from './balance'
import {
  emptyResources, computeRates, currentCap, currentTroopCap, totalTroops, totalPower,
  battlePower, busyQueues, canAfford, pay, scaleCost,
  buildCostFactor, buildSpeedFactor,
} from './compute'
import { QUESTS, questReward } from './quests'
import { TUTORIAL } from './tutorial'
import {
  GONGFA_MAP, gongfaCost, gongfaTimeMs,
  PILL_MAP, pillCost, type PillKey,
  ARTIFACT_MAP, artifactCost,
} from './systems'
import { initialWarfrontNodes, WARFRONT_NODE_MAP, WARFRONT_TACTICS } from './warfront'
import { formationUsed } from './compute'
import {
  EXPEDITION_DEPTHS, EXPEDITION_MAX_ENERGY, EXPEDITION_SHOP, EXPEDITION_SEASON_REWARDS, EXPEDITION_WEEKLY_REWARDS,
  createExpeditionNodes,
  expeditionBattleMultiplier, expeditionEnergyReadyAt, expeditionRewardMultiplier,
  expeditionRiskSuccess, expeditionScoreMultiplier, initialExpeditionState, refreshExpeditionState, scaledExpeditionReward,
} from './expedition'
import {
  SEEK_COMBO_WINDOW_MS, SEEK_MAX_ENERGY, SEEK_MILESTONES, cultivationRequirement,
  initialSeekState, refreshSeekState, resolveSeekDrop,
} from './seek'
import { calculateBattleLosses } from './penalty'

const SAVE_KEY = 'fanren-slg-save-v2'

// 顶栏飘字的自增 id，纯 UI 反馈用，不需要进存档，模块级变量就够
let floatSeq = 0

/** 把「到账了多少资源」转成飘字事件列表，四舍五入、过滤掉太小可忽略的量 */
function makeFloats(gained: Partial<Resources>): FloatEvent[] {
  const out: FloatEvent[] = []
  for (const k of Object.keys(gained) as ResourceKey[]) {
    const amount = Math.round(gained[k] ?? 0)
    if (amount > 0) out.push({ id: ++floatSeq, key: k, amount })
  }
  return out
}

function applyFormationLosses(
  troops: Record<TroopKey, number>,
  formation: Record<TroopKey, number>,
  losses: number,
  deployed: number,
): { troops: Record<TroopKey, number>; formation: Record<TroopKey, number> } {
  const nextTroops = { ...troops }
  const nextFormation = { ...formation }
  let remaining = losses
  const order = (Object.keys(nextFormation) as TroopKey[])
    .filter(key => nextFormation[key] > 0)
    .sort((a, b) => nextFormation[b] - nextFormation[a])
  for (const key of order) {
    if (remaining <= 0) break
    const share = Math.min(
      nextTroops[key],
      nextFormation[key],
      Math.ceil(losses * nextFormation[key] / Math.max(1, deployed)),
      remaining,
    )
    nextTroops[key] -= share
    nextFormation[key] = Math.min(nextFormation[key], nextTroops[key])
    remaining -= share
  }
  return { troops: nextTroops, formation: nextFormation }
}

function addCappedReward(
  resources: Resources,
  reward: Partial<Resources>,
  cap: number,
): { resources: Resources; gained: Partial<Resources> } {
  const next = { ...resources }
  const gained: Partial<Resources> = {}
  for (const key of Object.keys(reward) as ResourceKey[]) {
    const before = next[key]
    next[key] = Math.min(cap, before + (reward[key] ?? 0))
    gained[key] = next[key] - before
  }
  return { resources: next, gained }
}

// 纯计算函数住在 compute.ts（打破 store ↔ quests 的循环依赖），
// 这里原样再导出一次，UI 层继续从 store 引入即可。
export {
  realmOutputBonus, realmPowerBonus, computeRates, currentCap, currentTroopCap,
  totalTroops, troopPower, totalPower, battlePower, busyQueues, counterBonus,
  buildCostFactor, buildSpeedFactor,
} from './compute'

function initialState(): GameState {
  const now = Date.now()
  const buildings = Object.fromEntries(
    BUILDINGS.map(b => [b.key, {
      level: INITIAL_BUILDING_LEVEL[b.key] ?? 0,
      upgradingUntil: null,
    }]),
  ) as GameState['buildings']

  const cultivators = Object.fromEntries(
    CULTIVATORS.map(c => [c.key, { level: c.key === 'hanli' ? 1 : 0, owned: c.key === 'hanli' }]),
  ) as GameState['cultivators']

  return {
    resources: { ...emptyResources(), ...INITIAL_RESOURCES },
    buildings,
    realm: 0,
    character: { gender: null },
    seek: initialSeekState(now),
    troops: { kuilei: 0, yushou: 0, fuxiu: 0 },
    cultivators,
    clearedStage: 0,
    lastTick: now,
    queueSlots: 1,
    lastBossAt: 0,
    claimedQuests: [],
    gongfa: {},
    gongfaResearching: null,
    pills: {},
    pillActive: {},
    pillCrafting: null,
    artifacts: {},
    // 初始为 0；首次进入编队界面时由「一键择优」或滑杆填充
    formation: { kuilei: 0, yushou: 0, fuxiu: 0 },
    tutorialStep: 0,
    tutorialDone: false,
    warfrontNodes: initialWarfrontNodes(),
    warfrontScore: 0,
    warfrontSectScore: 0,
    onlineWarfrontIncome: emptyResources(),
    warfrontClaimedReportIds: [],
    warfrontCooldownUntil: 0,
    warfrontTactic: 'raid',
    ...initialExpeditionState(now, INITIAL_BUILDING_LEVEL.dongfu ?? 1),
  }
}

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return initialState()
    const parsed = JSON.parse(raw) as GameState
    // 补齐新增字段，避免旧存档缺 key 导致崩溃
    const base = initialState()
    return {
      ...base,
      ...parsed,
      resources: { ...base.resources, ...parsed.resources },
      buildings: { ...base.buildings, ...parsed.buildings },
      character: { ...base.character, ...(parsed.character ?? {}) },
      seek: {
        ...base.seek,
        ...(parsed.seek ?? {}),
        cultivation: parsed.seek?.cultivation ?? base.seek.cultivation,
        equipmentLoadout: { ...base.seek.equipmentLoadout, ...(parsed.seek?.equipmentLoadout ?? {}) },
        equipmentInventory: parsed.seek?.equipmentInventory ?? base.seek.equipmentInventory,
        recentDrops: parsed.seek?.recentDrops ?? base.seek.recentDrops,
      },
      cultivators: { ...base.cultivators, ...parsed.cultivators },
      troops: { ...base.troops, ...parsed.troops },
      queueSlots: parsed.queueSlots ?? base.queueSlots,
      claimedQuests: parsed.claimedQuests ?? base.claimedQuests,
      gongfa: { ...base.gongfa, ...parsed.gongfa },
      gongfaResearching: parsed.gongfaResearching ?? null,
      pills: { ...base.pills, ...parsed.pills },
      pillActive: { ...base.pillActive, ...parsed.pillActive },
      pillCrafting: parsed.pillCrafting ?? null,
      artifacts: { ...base.artifacts, ...parsed.artifacts },
      formation: { ...base.formation, ...parsed.formation },
      tutorialStep: parsed.tutorialStep ?? base.tutorialStep,
      tutorialDone: parsed.tutorialDone ?? base.tutorialDone,
      warfrontNodes: { ...base.warfrontNodes, ...(parsed.warfrontNodes ?? {}) },
      warfrontScore: parsed.warfrontScore ?? base.warfrontScore,
      warfrontSectScore: parsed.warfrontSectScore ?? base.warfrontSectScore,
      onlineWarfrontIncome: { ...base.onlineWarfrontIncome, ...(parsed.onlineWarfrontIncome ?? {}) },
      warfrontClaimedReportIds: parsed.warfrontClaimedReportIds ?? base.warfrontClaimedReportIds,
      warfrontCooldownUntil: parsed.warfrontCooldownUntil ?? base.warfrontCooldownUntil,
      warfrontTactic: parsed.warfrontTactic ?? base.warfrontTactic,
      expeditionDayKey: parsed.expeditionDayKey ?? base.expeditionDayKey,
      expeditionMapDayKey: parsed.expeditionMapDayKey ?? parsed.expeditionDayKey ?? base.expeditionMapDayKey,
      expeditionMapCycle: parsed.expeditionMapCycle ?? base.expeditionMapCycle,
      expeditionEnergy: parsed.expeditionEnergy ?? base.expeditionEnergy,
      expeditionEnergyUpdatedAt: parsed.expeditionEnergyUpdatedAt ?? base.expeditionEnergyUpdatedAt,
      expeditionProgress: parsed.expeditionProgress ?? base.expeditionProgress,
      expeditionNodes: parsed.expeditionNodes ?? base.expeditionNodes,
      expeditionScore: parsed.expeditionScore ?? base.expeditionScore,
      expeditionWeekScore: parsed.expeditionWeekScore ?? base.expeditionWeekScore,
      expeditionCurrency: parsed.expeditionCurrency ?? base.expeditionCurrency,
      expeditionWeekKey: parsed.expeditionWeekKey ?? base.expeditionWeekKey,
      expeditionSeasonKey: parsed.expeditionSeasonKey ?? base.expeditionSeasonKey,
      expeditionWeeklyClaimed: parsed.expeditionWeeklyClaimed ?? base.expeditionWeeklyClaimed,
      expeditionSeasonRewards: parsed.expeditionSeasonRewards ?? base.expeditionSeasonRewards,
      expeditionRelics: { ...base.expeditionRelics, ...(parsed.expeditionRelics ?? {}) },
      expeditionShopPurchases: { ...base.expeditionShopPurchases, ...(parsed.expeditionShopPurchases ?? {}) },
    }
  } catch {
    return initialState()
  }
}


/** 洞府升级前置是否满足；不满足时返回还差什么 */
export function dongfuPrereqStatus(s: GameState): { ok: boolean; need: number; have: number; level: number } {
  const target = s.buildings.dongfu.level + 1
  const need = dongfuPrereqLevel(target)
  const levels = PRODUCER_KEYS.map(k => s.buildings[k].level)
  return {
    ok: canUpgradeDongfu(levels, target),
    need: DONGFU_PREREQ_COUNT,
    have: levels.filter(l => l >= need).length,
    level: need,
  }
}

type Result = { ok: boolean; reason?: string }

interface Store extends GameState {
  /** 离线收益报告，进游戏时结算一次，展示后由 UI 清掉 */
  offlineReport: OfflineReport | null
  clearOfflineReport: () => void
  /** 顶栏飘字队列（不入存档，纯瞬时 UI 反馈） */
  floats: FloatEvent[]
  popFloat: (id: number) => void

  tick: () => void
  startUpgrade: (key: BuildingKey) => Result
  finishUpgrade: (key: BuildingKey) => void
  breakthrough: () => Result
  chooseGender: (gender: Gender) => Result
  seekNow: () => { ok: boolean; report?: SeekDrop; reason?: string }
  temperEquipment: (slot: EquipmentSlot) => Result
  claimSeekMilestone: (id: string) => Result
  trainTroop: (key: TroopKey, count: number) => Result
  maxTrainable: (key: TroopKey) => number
  levelUpCultivator: (key: string) => Result
  challengeStage: (id: number) => { ok: boolean; win: boolean; myPower: number; enemyPower: number; deployed?: number; losses?: number; reason?: string }
  unlockQueue: () => Result
  challengeBoss: () => { ok: boolean; report?: BossReport; reason?: string }
  bossReadyAt: () => number
  claimQuest: (id: string) => Result
  researchGongfa: (key: string) => Result
  craftPill: (key: PillKey) => Result
  collectPill: () => void
  usePill: (key: PillKey) => Result
  forgeArtifact: (key: string) => Result
  setFormation: (f: Record<TroopKey, number>) => void
  setWarfrontTactic: (tactic: WarfrontTactic) => void
  syncOnlineWarfrontIncome: (income: Resources) => void
  claimOnlineWarfrontReward: (reportId: string, reward: Partial<Resources>) => void
  attackWarfront: (nodeKey: string) => { ok: boolean; report?: WarfrontReport; reason?: string }
  refreshExpedition: () => void
  expeditionEnergyReadyAt: () => number
  exploreExpeditionNode: (nodeId: string, choice?: ExpeditionChoice) => { ok: boolean; report?: ExpeditionReport; reason?: string }
  claimExpeditionWeekly: (id: string) => Result
  claimExpeditionSeason: (id: string) => Result
  buyExpeditionShop: (id: string) => Result
  nextTutorialStep: () => void
  skipTutorial: () => void
  reset: () => void
}

export const useGame = create<Store>((set, get) => ({
  ...loadState(),
  offlineReport: null,
  floats: [],

  clearOfflineReport: () => set({ offlineReport: null }),
  popFloat: (id) => set(s => ({ floats: s.floats.filter(f => f.id !== id) })),

  tick: () => {
    const now = Date.now()
    const before = get()
    const refreshedSeek = refreshSeekState(before.seek, now)
    if (refreshedSeek !== before.seek) {
      set({ seek: refreshedSeek })
      persist(get())
    }
    const expeditionPatch = refreshExpeditionState(before, now)
    if (Object.keys(expeditionPatch).length > 0) {
      set(expeditionPatch)
      persist(get())
    }
    const s = get()
    const elapsed = (now - s.lastTick) / 1000
    if (elapsed < 0.05) return

    const cap = currentCap(s)
    const rates = computeRates(s)

    // 离线判定：超过 60 秒没结算就算作离线，按折损率并封顶
    const isOffline = elapsed > 60
    const capSec = TUNE.offlineCapHours * 3600
    const effective = isOffline ? Math.min(elapsed, capSec) : elapsed
    const factor = isOffline ? TUNE.offlineRate : 1

    const resources = { ...s.resources }
    const gained = emptyResources()
    for (const k of Object.keys(rates) as ResourceKey[]) {
      const before = resources[k]
      // 仓库满了就不再累积 —— 这是驱动「每天多次上线」的核心留存杠杆
      resources[k] = Math.min(cap, before + rates[k] * effective * factor)
      gained[k] = resources[k] - before
    }

    // 结算已完成的升级
    const buildings = { ...s.buildings }
    for (const key of Object.keys(buildings) as BuildingKey[]) {
      const b = buildings[key]
      if (b.upgradingUntil !== null && now >= b.upgradingUntil) {
        buildings[key] = { level: b.level + 1, upgradingUntil: null }
      }
    }

    const patch: Partial<Store> = { resources, buildings, lastTick: now }

    // 结算功法研究完成（自动入账，不需要玩家再点一次）
    if (s.gongfaResearching && now >= s.gongfaResearching.until) {
      const k = s.gongfaResearching.key
      patch.gongfa = { ...s.gongfa, [k]: (s.gongfa[k] ?? 0) + 1 }
      patch.gongfaResearching = null
    }
    if (isOffline && Object.values(gained).some(v => v > 1)) {
      patch.offlineReport = {
        seconds: effective,
        truncatedSeconds: Math.max(0, elapsed - capSec),
        gained,
      }
    }
    set(patch)
    persist(get())
  },

  startUpgrade: (key) => {
    const s = get()
    const now = Date.now()
    const b = s.buildings[key]
    const def = BUILDING_MAP[key]
    if (b.upgradingUntil !== null) return { ok: false, reason: '该建筑正在升级中' }

    if (busyQueues(s, now) >= s.queueSlots) {
      return { ok: false, reason: `建造队列已满（${s.queueSlots} 条）` }
    }

    const dongfuLv = s.buildings.dongfu.level
    if (b.level === 0 && dongfuLv < def.unlockAt) {
      return { ok: false, reason: `需洞府 ${def.unlockAt} 级才能兴建` }
    }
    if (key === 'dongfu') {
      if (b.level >= TUNE.dongfuMax) return { ok: false, reason: '洞府已达当前版本上限' }
      const pre = dongfuPrereqStatus(s)
      if (!pre.ok) {
        return { ok: false, reason: `需 ${pre.need} 座产出建筑达到 ${pre.level} 级（当前 ${pre.have} 座）` }
      }
    } else if (b.level >= dongfuLv) {
      // 洞府等级封顶其他建筑（对应无尽冬日熔炉机制）
      return { ok: false, reason: '不可超过洞府等级，请先升级洞府' }
    }

    // 功法「俭物诀」减免消耗，「神行诀」+ 凝神丹加速
    const cost = scaleCost(buildingCost(key, b.level + 1), buildCostFactor(s))
    if (!canAfford(s.resources, cost)) return { ok: false, reason: '资源不足' }

    const duration = buildingTime(key, b.level + 1) * buildSpeedFactor(s, now)

    set({
      resources: pay(s.resources, cost),
      buildings: {
        ...s.buildings,
        [key]: { ...b, upgradingUntil: now + duration },
      },
    })
    persist(get())
    return { ok: true }
  },

  finishUpgrade: (key) => {
    const s = get()
    const b = s.buildings[key]
    if (b.upgradingUntil === null) return
    set({
      buildings: { ...s.buildings, [key]: { level: b.level + 1, upgradingUntil: null } },
    })
    persist(get())
  },

  breakthrough: () => {
    const s = get()
    const next = REALMS[s.realm + 1]
    if (!next) return { ok: false, reason: '已至当前版本最高境界' }
    if (s.buildings.dongfu.level < next.requiresDongfu) {
      return { ok: false, reason: `需洞府 ${next.requiresDongfu} 级` }
    }
    const insightNeed = cultivationRequirement(s.realm)
    if (s.seek.cultivation < insightNeed) {
      return { ok: false, reason: `修为不足，还需参悟 ${Math.max(0, insightNeed - s.seek.cultivation)} 点` }
    }
    if (!canAfford(s.resources, next.cost)) return { ok: false, reason: '资源不足' }
    set({
      resources: pay(s.resources, next.cost),
      realm: s.realm + 1,
      seek: { ...s.seek, cultivation: Math.max(0, s.seek.cultivation - insightNeed) },
    })
    persist(get())
    return { ok: true }
  },

  chooseGender: (gender) => {
    const s = get()
    if (s.character.gender !== null) return { ok: false, reason: '身份已经确定' }
    set({ character: { gender } })
    persist(get())
    return { ok: true }
  },

  seekNow: () => {
    const now = Date.now()
    const before = get()
    const refreshed = refreshSeekState(before.seek, now)
    if (refreshed !== before.seek) {
      set({ seek: refreshed })
      persist(get())
    }
    const s = get()
    const id = `seek-${now}-${s.seek.total + 1}`
    const raw = resolveSeekDrop(s.seek, s.realm, id)
    const current = raw.equipment ? s.seek.equipmentLoadout[raw.equipment.slot] : null
    const shouldEquip = !!raw.equipment && (!current || raw.equipment.power > current.power)
    const dustGained = raw.equipment && !shouldEquip
      ? Math.max(1, Math.round(raw.equipment.power * 0.22))
      : 0
    const report: SeekDrop = { ...raw, equipmentEquipped: shouldEquip, dustGained }
    const credited = addCappedReward(s.resources, raw.reward, currentCap(s))
    const equipmentLoadout = { ...s.seek.equipmentLoadout }
    if (raw.equipment && shouldEquip) equipmentLoadout[raw.equipment.slot] = raw.equipment
    const equipmentInventory = raw.equipment
      ? [raw.equipment, ...s.seek.equipmentInventory].slice(0, 24)
      : s.seek.equipmentInventory
    const combo = now - s.seek.lastAt <= SEEK_COMBO_WINDOW_MS ? s.seek.combo + 1 : 1
    const rare = raw.rarity === 'epic' || raw.rarity === 'legendary'
    const legendary = raw.rarity === 'legendary'
    const energy = Math.max(0, s.seek.energy - 1)
    const seek: GameState['seek'] = {
      ...s.seek,
      energy,
      energyUpdatedAt: s.seek.energy >= SEEK_MAX_ENERGY ? now : s.seek.energyUpdatedAt,
      cultivation: s.seek.cultivation + raw.cultivation,
      total: s.seek.total + 1,
      dailyCount: s.seek.dailyCount + 1,
      combo,
      bestCombo: Math.max(s.seek.bestCombo, combo),
      lastAt: now,
      pity: rare ? 0 : s.seek.pity + 1,
      legendaryPity: legendary ? 0 : s.seek.legendaryPity + 1,
      equipmentInventory,
      equipmentLoadout,
      equipmentDust: s.seek.equipmentDust + dustGained,
      lastDrop: report,
      recentDrops: [report, ...s.seek.recentDrops].slice(0, 5),
    }
    set(st => ({
      resources: credited.resources,
      seek,
      floats: [...st.floats, ...makeFloats(credited.gained)],
    }))
    persist(get())
    return { ok: true, report }
  },

  temperEquipment: (slot) => {
    const s = get()
    const item = s.seek.equipmentLoadout[slot]
    if (!item) return { ok: false, reason: '该部位还没有灵装' }
    const cost = Math.max(12, Math.round(item.power * 0.16))
    if (s.seek.equipmentDust < cost) return { ok: false, reason: `炼器尘不足，还需 ${cost - s.seek.equipmentDust}` }
    const boost = Math.max(5, Math.round(item.power * 0.08))
    const nextItem = {
      ...item,
      id: `${item.id}-temper-${Date.now()}`,
      power: item.power + boost,
      affix: `${item.affix} · 淬炼+${boost}`,
    }
    set({
      seek: {
        ...s.seek,
        equipmentDust: s.seek.equipmentDust - cost,
        equipmentLoadout: { ...s.seek.equipmentLoadout, [slot]: nextItem },
        equipmentInventory: s.seek.equipmentInventory.map(entry => entry.id === item.id ? nextItem : entry),
      },
    })
    persist(get())
    return { ok: true }
  },

  claimSeekMilestone: (id) => {
    const s = get()
    const milestone = SEEK_MILESTONES.find(item => item.id === id)
    if (!milestone) return { ok: false, reason: '寻道里程碑不存在' }
    if (s.seek.claimedMilestones.includes(id)) return { ok: false, reason: '该里程碑已领取' }
    if (s.seek.total < milestone.need) return { ok: false, reason: '寻道次数尚未达标' }
    const credited = addCappedReward(s.resources, milestone.reward, currentCap(s))
    set(st => ({
      resources: credited.resources,
      seek: {
        ...s.seek,
        equipmentDust: s.seek.equipmentDust + milestone.dust,
        claimedMilestones: [...s.seek.claimedMilestones, id],
      },
      floats: [...st.floats, ...makeFloats(credited.gained)],
    }))
    persist(get())
    return { ok: true }
  },

  /** 在兵力上限与资源之间，最多还能练多少个该兵种 */
  maxTrainable: (key) => {
    const s = get()
    const def = TROOP_MAP[key]
    const room = currentTroopCap(s) - totalTroops(s)
    if (room <= 0) return 0
    const byRes = Math.min(
      ...(Object.keys(def.cost) as ResourceKey[])
        .filter(k => (def.cost[k] ?? 0) > 0)
        .map(k => Math.floor(s.resources[k] / (def.cost[k] ?? 1))),
    )
    return Math.max(0, Math.min(room, Number.isFinite(byRes) ? byRes : 0))
  },

  trainTroop: (key, count) => {
    const s = get()
    if (s.buildings.yanwu.level <= 0) return { ok: false, reason: '需先兴建演武场' }
    if (count <= 0) return { ok: false, reason: '数量无效' }

    const room = currentTroopCap(s) - totalTroops(s)
    if (room <= 0) return { ok: false, reason: '已达兵力上限，请先升级演武场' }
    if (count > room) return { ok: false, reason: `超出兵力上限，最多还能练 ${room}` }

    const def = TROOP_MAP[key]
    const cost = Object.fromEntries(
      Object.entries(def.cost).map(([k, v]) => [k, (v ?? 0) * count]),
    ) as Partial<Resources>
    if (!canAfford(s.resources, cost)) return { ok: false, reason: '资源不足' }

    set({
      resources: pay(s.resources, cost),
      troops: { ...s.troops, [key]: s.troops[key] + count },
    })
    persist(get())
    return { ok: true }
  },

  levelUpCultivator: (key) => {
    const s = get()
    const st = s.cultivators[key]
    if (!st?.owned) return { ok: false, reason: '尚未招募该修士' }
    if (st.level >= CULTIVATOR_MAX_LEVEL) return { ok: false, reason: '已至最高等级' }
    const cost = cultivatorCost(st.level + 1)
    if (!canAfford(s.resources, cost)) return { ok: false, reason: '资源不足' }
    set({
      resources: pay(s.resources, cost),
      cultivators: { ...s.cultivators, [key]: { ...st, level: st.level + 1 } },
    })
    persist(get())
    return { ok: true }
  },

  challengeStage: (id) => {
    const s = get()
    const stage = STAGES.find(x => x.id === id)
    if (!stage) return { ok: false, win: false, myPower: 0, enemyPower: 0, reason: '关卡不存在' }
    if (id > s.clearedStage + 1) {
      return { ok: false, win: false, myPower: 0, enemyPower: 0, reason: '请先通关前置关卡' }
    }

    const myPower = battlePower(s, stage.enemyTroop)
    const deployed = formationUsed(s)
    if (deployed <= 0) {
      return { ok: false, win: false, myPower, enemyPower: stage.enemyPower, reason: '请先在演武场配置出战编队' }
    }
    const win = myPower >= stage.enemyPower
    const losses = calculateBattleLosses({
      deployed,
      myPower,
      enemyPower: stage.enemyPower,
      win,
      winBase: 0.07,
      winMin: 0.04,
      winMax: 0.18,
      failBase: 0.22,
      failMin: 0.16,
      failMax: 0.42,
    })
    const injured = applyFormationLosses(s.troops, s.formation, losses, deployed)

    if (win && id > s.clearedStage) {
      // 首通：发奖 + 解锁修士。奖励同样受仓库上限约束，否则会凭空突破上限。
      const cap = currentCap(s)
      const resources = { ...s.resources }
      const gained = emptyResources()
      for (const k of Object.keys(stage.reward) as ResourceKey[]) {
        const before = resources[k]
        resources[k] = Math.min(cap, before + (stage.reward[k] ?? 0))
        gained[k] = resources[k] - before
      }
      const cultivators = { ...s.cultivators }
      if (stage.unlockCultivator && CULTIVATOR_MAP[stage.unlockCultivator]) {
        cultivators[stage.unlockCultivator] = { owned: true, level: 1 }
      }
      set(st => ({
        resources,
        cultivators,
        troops: injured.troops,
        formation: injured.formation,
        clearedStage: id,
        floats: [...st.floats, ...makeFloats(gained)],
      }))
      persist(get())
    } else {
      // 失败不推进、不发首通奖励，但必须支付真实兵损，避免无成本无限试错。
      set({ troops: injured.troops, formation: injured.formation })
      persist(get())
    }

    return { ok: true, win, myPower, enemyPower: stage.enemyPower, deployed, losses }
  },

  unlockQueue: () => {
    const s = get()
    if (s.queueSlots >= 2) return { ok: false, reason: '已解锁全部队列' }
    set({ queueSlots: 2 })
    persist(get())
    return { ok: true }
  },

  bossReadyAt: () => {
    const s = get()
    if (s.lastBossAt === 0) return 0
    return s.lastBossAt + BOSS.cooldownHours * 3600 * 1000
  },

  /**
   * 合围妖兽。单机版里同门贡献由 NPC 按固定比例补上，
   * 联机版应换成真实盟友的累计伤害（见 README 二期）。
   */
  challengeBoss: () => {
    const s = get()
    if (s.buildings.zongmen.level <= 0) return { ok: false, reason: '需先兴建宗门大殿' }
    const now = Date.now()
    if (s.lastBossAt > 0 && now < s.lastBossAt + BOSS.cooldownHours * 3600 * 1000) {
      return { ok: false, reason: '妖兽尚未再次现身' }
    }

    const dongfuLv = s.buildings.dongfu.level
    const hp = bossHp(dongfuLv)
    // 妖兽不吃兵种克制（它不是三兵种之一），直接用总战力
    const myDamage = totalPower(s)
    const npcDamage = hp * BOSS.npcContribution
    const totalDamage = myDamage + npcDamage
    const tier = bossTier(totalDamage / hp)

    const reward = bossReward(dongfuLv, tier.mult)
    const cap = currentCap(s)
    const resources = { ...s.resources }
    const gained = emptyResources()
    for (const k of Object.keys(reward) as ResourceKey[]) {
      const before = resources[k]
      resources[k] = Math.min(cap, before + (reward[k] ?? 0))
      gained[k] = resources[k] - before
    }

    set(st => ({ resources, lastBossAt: now, floats: [...st.floats, ...makeFloats(gained)] }))
    persist(get())
    return {
      ok: true,
      report: { bossHp: hp, myDamage, npcDamage, totalDamage, tierName: tier.name, gained },
    }
  },

  claimQuest: (id) => {
    const s = get()
    if (s.claimedQuests.includes(id)) return { ok: false, reason: '已领取' }
    const q = QUESTS.find(x => x.id === id)
    if (!q) return { ok: false, reason: '任务不存在' }
    if (!q.done(s)) return { ok: false, reason: '尚未达成' }

    const reward = questReward(s, q)
    const cap = currentCap(s)
    const resources = { ...s.resources }
    const gained = emptyResources()
    for (const k of Object.keys(reward) as ResourceKey[]) {
      const before = resources[k]
      resources[k] = Math.min(cap, before + (reward[k] ?? 0))
      gained[k] = resources[k] - before
    }
    set(st => ({
      resources, claimedQuests: [...s.claimedQuests, id],
      floats: [...st.floats, ...makeFloats(gained)],
    }))
    persist(get())
    return { ok: true }
  },

  // ── 功法（藏经阁）──
  researchGongfa: (key) => {
    const s = get()
    const def = GONGFA_MAP[key]
    if (!def) return { ok: false, reason: '功法不存在' }
    const cangjing = s.buildings.cangjing.level
    if (cangjing <= 0) return { ok: false, reason: '需先兴建藏经阁' }
    if (cangjing < def.requires) return { ok: false, reason: `需藏经阁 ${def.requires} 级` }
    if (s.gongfaResearching) return { ok: false, reason: '已有功法在参研中' }

    const cur = s.gongfa[key] ?? 0
    if (cur >= def.maxLevel) return { ok: false, reason: '已至最高层' }

    const cost = gongfaCost(cur + 1)
    if (!canAfford(s.resources, cost)) return { ok: false, reason: '资源不足' }

    set({
      resources: pay(s.resources, cost),
      gongfaResearching: { key, until: Date.now() + gongfaTimeMs(cur + 1) },
    })
    persist(get())
    return { ok: true }
  },

  // ── 丹药（炼丹房）──
  craftPill: (key) => {
    const s = get()
    const liandan = s.buildings.liandan.level
    if (liandan <= 0) return { ok: false, reason: '需先兴建炼丹房' }
    if (s.pillCrafting) return { ok: false, reason: '丹炉正忙' }

    const cost = pillCost(liandan)
    if (!canAfford(s.resources, cost)) return { ok: false, reason: '资源不足' }

    set({
      resources: pay(s.resources, cost),
      pillCrafting: { key, until: Date.now() + PILL_MAP[key].craftMinutes * 60 * 1000 },
    })
    persist(get())
    return { ok: true }
  },

  collectPill: () => {
    const s = get()
    if (!s.pillCrafting || Date.now() < s.pillCrafting.until) return
    const k = s.pillCrafting.key
    set({
      pills: { ...s.pills, [k]: (s.pills[k] ?? 0) + 1 },
      pillCrafting: null,
    })
    persist(get())
  },

  usePill: (key) => {
    const s = get()
    if ((s.pills[key] ?? 0) <= 0) return { ok: false, reason: '没有这种丹药' }
    const now = Date.now()
    // 同种丹药可叠加时长，不覆盖
    const base = Math.max(now, s.pillActive[key] ?? 0)
    set({
      pills: { ...s.pills, [key]: s.pills[key] - 1 },
      pillActive: { ...s.pillActive, [key]: base + PILL_MAP[key].hours * 3600 * 1000 },
    })
    persist(get())
    return { ok: true }
  },

  // ── 法宝（炼器阁）──
  forgeArtifact: (key) => {
    const s = get()
    const def = ARTIFACT_MAP[key]
    if (!def) return { ok: false, reason: '法宝不存在' }
    const lianqi = s.buildings.lianqi.level
    if (lianqi <= 0) return { ok: false, reason: '需先兴建炼器阁' }
    if (lianqi < def.requires) return { ok: false, reason: `需炼器阁 ${def.requires} 级` }

    const cur = s.artifacts[key] ?? 0
    if (cur >= def.maxLevel) return { ok: false, reason: '已至最高阶' }

    const cost = artifactCost(cur + 1)
    if (!canAfford(s.resources, cost)) return { ok: false, reason: '资源不足' }

    set({
      resources: pay(s.resources, cost),
      artifacts: { ...s.artifacts, [key]: cur + 1 },
    })
    persist(get())
    return { ok: true }
  },

  setFormation: (f) => {
    set({ formation: f })
    persist(get())
  },

  setWarfrontTactic: (tactic) => {
    set({ warfrontTactic: tactic })
    persist(get())
  },

  syncOnlineWarfrontIncome: (income) => {
    const current = get().onlineWarfrontIncome
    const next = { ...emptyResources(), ...income }
    const changed = (Object.keys(next) as ResourceKey[]).some(key => Math.abs(next[key] - current[key]) > 0.000001)
    if (!changed) return
    set({ onlineWarfrontIncome: next })
    persist(get())
  },

  claimOnlineWarfrontReward: (reportId, reward) => {
    const s = get()
    if (!reportId || s.warfrontClaimedReportIds.includes(reportId)) return
    const credited = addCappedReward(s.resources, reward, currentCap(s))
    set(st => ({
      resources: credited.resources,
      warfrontClaimedReportIds: [...st.warfrontClaimedReportIds, reportId].slice(-160),
      floats: [...st.floats, ...makeFloats(credited.gained)],
    }))
    persist(get())
  },

  attackWarfront: (nodeKey) => {
    const s = get()
    const node = WARFRONT_NODE_MAP[nodeKey]
    if (!node) return { ok: false, reason: '据点不存在' }
    if (s.buildings.yanwu.level <= 0) return { ok: false, reason: '需先兴建演武场' }
    if (s.warfrontNodes[nodeKey]?.owner === 'player') return { ok: false, reason: '此据点已由我方驻守' }
    const now = Date.now()
    if (now < s.warfrontCooldownUntil) return { ok: false, reason: '部队正在整备，请稍候再出征' }

    const deployed = formationUsed(s)
    if (deployed <= 0) return { ok: false, reason: '请先在演武场配置出征编队' }

    const tactic = WARFRONT_TACTICS[s.warfrontTactic]
    // 战报必须冻结出征瞬间的编队；结算兵损后再读 state 会把演出中的部队数量读错。
    const committedFormation = { ...s.formation }
    const rawPower = battlePower(s, node.enemyTroop, now)
    const myPower = Math.round(rawPower * tactic.powerFactor)
    const win = myPower >= node.enemyPower
    const losses = calculateBattleLosses({
      deployed,
      myPower,
      enemyPower: node.enemyPower,
      win,
      lossFactor: tactic.lossFactor,
      winBase: 0.1,
      winMin: 0.04,
      winMax: 0.22,
      failBase: 0.24,
      failMin: 0.16,
      failMax: 0.45,
    })

    const troops = { ...s.troops }
    const formation = { ...s.formation }
    let remainingLosses = losses
    const order = (Object.keys(formation) as TroopKey[])
      .filter(key => formation[key] > 0)
      .sort((a, b) => formation[b] - formation[a])
    for (const key of order) {
      if (remainingLosses <= 0) break
      const share = Math.min(troops[key], Math.min(formation[key], Math.ceil(losses * formation[key] / deployed), remainingLosses))
      troops[key] -= share
      formation[key] = Math.min(formation[key], troops[key])
      remainingLosses -= share
    }

    const gained: Partial<Resources> = {}
    const resources = { ...s.resources }
    const cap = currentCap(s)
    if (win) {
      for (const key of Object.keys(node.reward) as ResourceKey[]) {
        const before = resources[key]
        resources[key] = Math.min(cap, before + (node.reward[key] ?? 0))
        gained[key] = resources[key] - before
      }
    }
    const scoreGained = win ? 20 + Math.round(node.enemyPower / 80) : 4
    const nodes: GameState['warfrontNodes'] = {
      ...s.warfrontNodes,
      [nodeKey]: { owner: win ? 'player' : s.warfrontNodes[nodeKey].owner },
    }
    const report: WarfrontReport = {
      nodeKey, nodeName: node.name, enemyName: node.enemyName, enemyTroop: node.enemyTroop,
      tactic: s.warfrontTactic, win, myPower, enemyPower: node.enemyPower,
      formation: committedFormation, deployed, losses,
      scoreGained, captured: win, gained,
    }
    set(st => ({
      troops, formation, resources, warfrontNodes: nodes,
      warfrontScore: s.warfrontScore + scoreGained,
      warfrontSectScore: s.warfrontSectScore + scoreGained,
      warfrontCooldownUntil: now + 45_000,
      floats: [...st.floats, ...makeFloats(gained)],
    }))
    persist(get())
    return { ok: true, report }
  },

  refreshExpedition: () => {
    const now = Date.now()
    const patch = refreshExpeditionState(get(), now)
    if (Object.keys(patch).length === 0) return
    set(patch)
    persist(get())
  },

  expeditionEnergyReadyAt: () => expeditionEnergyReadyAt(get()),

  exploreExpeditionNode: (nodeId, choice = 'steady') => {
    const now = Date.now()
    const refreshed = refreshExpeditionState(get(), now)
    if (Object.keys(refreshed).length > 0) {
      set(refreshed)
      persist(get())
    }
    const s = get()
    const node = s.expeditionNodes.find(item => item.id === nodeId)
    if (!node) return { ok: false, reason: '远征节点不存在' }
    if (node.depth !== s.expeditionProgress || node.resolved) return { ok: false, reason: '该节点当前不可行军' }
    if (s.expeditionEnergy <= 0) return { ok: false, reason: '远征令不足，等待恢复或完成其他长期目标' }

    const committedFormation = { ...s.formation }
    const deployed = formationUsed(s)
    let myPower = 0
    let enemyPower = node.enemyPower
    let win = true
    let losses = 0
    let outcome = ''

    if (node.kind === 'battle' || node.kind === 'boss') {
      if (s.buildings.yanwu.level <= 0) return { ok: false, reason: '需先兴建演武场' }
      if (deployed <= 0) return { ok: false, reason: '请先在演武场配置出战编队' }
      const expeditionTactic = choice === 'risk' ? 1.08 : 0.96
      myPower = Math.round(battlePower(s, node.enemyTroop, now) * expeditionTactic * expeditionBattleMultiplier(s))
      win = myPower >= enemyPower
      const baseLoss = choice === 'risk' ? 0.12 : 0.07
      const failedLoss = choice === 'risk' ? 0.28 : 0.20
      losses = calculateBattleLosses({
        deployed,
        myPower,
        enemyPower,
        win,
        winBase: baseLoss,
        winMin: 0.03,
        winMax: 0.24,
        failBase: failedLoss,
        failMin: 0.14,
        failMax: 0.5,
      })
      outcome = win
        ? (node.kind === 'boss' ? '首领伏诛，远征军带着星火凯旋' : '阵线击穿，路线向前推进')
        : '敌阵未破，幸存部队收拢撤离'
    } else {
      const riskSucceeded = choice === 'steady' || expeditionRiskSuccess(node.id, node.kind)
      win = riskSucceeded
      const riskLoss = choice === 'risk' && deployed > 0
        ? Math.max(1, Math.round(deployed * (riskSucceeded ? (node.kind === 'event' ? 0.03 : 0.045) : 0.08)))
        : 0
      losses = Math.min(deployed, riskLoss)
      outcome = riskSucceeded
        ? node.kind === 'gather'
          ? (choice === 'risk' ? '深入灵脉，带回一批高纯度灵材' : '稳妥采集，队伍平安归来')
          : node.kind === 'caravan'
            ? (choice === 'risk' ? '加速穿过险道，商队额外送来谢礼' : '护送商队抵达，获得约定酬金')
            : (choice === 'risk' ? '解开禁制，天机回响落入识海' : '绕开禁制，带走可辨认的遗物')
        : '风险判断失误，队伍带伤撤回，路线暂未推进'
    }

    const rewardMultiplier = expeditionRewardMultiplier(s, choice)
    const reward = scaledExpeditionReward(node.reward, rewardMultiplier, win)
    const cap = currentCap(s)
    const credited = addCappedReward(s.resources, reward, cap)
    const scoreGained = win ? Math.max(1, Math.round(node.score * (choice === 'risk' ? 1.18 : 1) * expeditionScoreMultiplier(s))) : 0
    const currencyGained = win ? Math.max(1, Math.round(node.currency * (choice === 'risk' ? 1.15 : 1))) : 0
    const injured = losses > 0
      ? applyFormationLosses(s.troops, s.formation, losses, deployed)
      : { troops: { ...s.troops }, formation: { ...s.formation } }
    const nodes = s.expeditionNodes.map(item => item.id === node.id ? { ...item, resolved: win } : item)
    const nextEnergy = s.expeditionEnergy - 1
    const mapComplete = win && s.expeditionProgress + 1 >= EXPEDITION_DEPTHS
    // 首领击破后若仍有远征令，立即开下一张同主题路线，避免剩余行动令变成空转。
    const continueSameDay = mapComplete && nextEnergy > 0
    const nextMapCycle = continueSameDay ? s.expeditionMapCycle + 1 : s.expeditionMapCycle
    const nextNodes = continueSameDay
      ? createExpeditionNodes(s.expeditionMapDayKey, s.buildings.dongfu.level, nextMapCycle)
      : nodes
    const report: ExpeditionReport = {
      nodeId: node.id,
      kind: node.kind,
      title: node.title,
      choice,
      outcome,
      win,
      enemyTroop: node.enemyTroop,
      myPower,
      enemyPower,
      formation: committedFormation,
      deployed,
      losses,
      progressed: win,
      penalty: win
        ? (losses > 0 ? `行动令 -1 · 兵损 ${losses}` : '行动令 -1')
        : `行动令 -1 · 兵损 ${losses} · 路线未推进 · 奖励为 0`,
      scoreGained,
      currencyGained,
      gained: credited.gained,
    }

    set(st => ({
      resources: credited.resources,
      troops: injured.troops,
      formation: injured.formation,
      expeditionNodes: nextNodes,
      expeditionProgress: continueSameDay ? 0 : (win ? s.expeditionProgress + 1 : s.expeditionProgress),
      expeditionMapCycle: nextMapCycle,
      expeditionEnergy: nextEnergy,
      expeditionEnergyUpdatedAt: s.expeditionEnergy >= EXPEDITION_MAX_ENERGY ? now : s.expeditionEnergyUpdatedAt,
      expeditionScore: s.expeditionScore + scoreGained,
      expeditionWeekScore: s.expeditionWeekScore + scoreGained,
      expeditionCurrency: s.expeditionCurrency + currencyGained,
      floats: [...st.floats, ...makeFloats(credited.gained)],
    }))
    persist(get())
    return { ok: true, report }
  },

  claimExpeditionWeekly: (id) => {
    get().refreshExpedition()
    const s = get()
    const reward = EXPEDITION_WEEKLY_REWARDS.find(item => item.id === id)
    if (!reward) return { ok: false, reason: '周里程碑不存在' }
    if (s.expeditionWeeklyClaimed.includes(id)) return { ok: false, reason: '该里程碑已领取' }
    if (s.expeditionWeekScore < reward.need) return { ok: false, reason: '本周远征积分尚未达标' }
    const credited = addCappedReward(s.resources, reward.reward, currentCap(s))
    set(st => ({
      resources: credited.resources,
      expeditionCurrency: s.expeditionCurrency + reward.currency,
      expeditionWeeklyClaimed: [...s.expeditionWeeklyClaimed, id],
      floats: [...st.floats, ...makeFloats(credited.gained)],
    }))
    persist(get())
    return { ok: true }
  },

  claimExpeditionSeason: (id) => {
    get().refreshExpedition()
    const s = get()
    const reward = EXPEDITION_SEASON_REWARDS.find(item => item.id === id)
    if (!reward) return { ok: false, reason: '赛季里程碑不存在' }
    if (s.expeditionSeasonRewards.includes(id)) return { ok: false, reason: '该赛季奖励已领取' }
    if (s.expeditionScore < reward.need) return { ok: false, reason: '赛季远征积分尚未达标' }
    const credited = addCappedReward(s.resources, reward.reward, currentCap(s))
    const relics = { ...s.expeditionRelics }
    if (reward.relic) relics[reward.relic] = Math.min(3, (relics[reward.relic] ?? 0) + 1)
    set(st => ({
      resources: credited.resources,
      expeditionCurrency: s.expeditionCurrency + reward.currency,
      expeditionSeasonRewards: [...s.expeditionSeasonRewards, id],
      expeditionRelics: relics,
      floats: [...st.floats, ...makeFloats(credited.gained)],
    }))
    persist(get())
    return { ok: true }
  },

  buyExpeditionShop: (id) => {
    const s = get()
    const item = EXPEDITION_SHOP.find(entry => entry.id === id)
    if (!item) return { ok: false, reason: '远征商店商品不存在' }
    const bought = s.expeditionShopPurchases[id] ?? 0
    if (bought >= item.maxPurchases) return { ok: false, reason: '该商品已达购买上限' }
    if (s.expeditionCurrency < item.cost) return { ok: false, reason: '远征币不足' }
    const credited = addCappedReward(s.resources, item.reward, currentCap(s))
    const purchases = { ...s.expeditionShopPurchases, [id]: bought + 1 }
    const relics = { ...s.expeditionRelics }
    if (item.relic) relics[item.relic] = Math.min(3, (relics[item.relic] ?? 0) + 1)
    set(st => ({
      resources: credited.resources,
      expeditionCurrency: s.expeditionCurrency - item.cost,
      expeditionShopPurchases: purchases,
      expeditionRelics: relics,
      floats: [...st.floats, ...makeFloats(credited.gained)],
    }))
    persist(get())
    return { ok: true }
  },

  nextTutorialStep: () => {
    const s = get()
    const next = s.tutorialStep + 1
    if (next >= TUTORIAL.length) set({ tutorialDone: true })
    else set({ tutorialStep: next })
    persist(get())
  },

  skipTutorial: () => {
    set({ tutorialDone: true })
    persist(get())
  },

  reset: () => {
    localStorage.removeItem(SAVE_KEY)
    set({ ...initialState(), offlineReport: null })
  },
}))

function persist(s: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      resources: s.resources, buildings: s.buildings, realm: s.realm,
      character: s.character, seek: s.seek,
      troops: s.troops, cultivators: s.cultivators,
      clearedStage: s.clearedStage, lastTick: s.lastTick,
      queueSlots: s.queueSlots, lastBossAt: s.lastBossAt,
      claimedQuests: s.claimedQuests,
      // ⚠️ 新增状态字段务必同步加到这里，否则刷新即丢。
      // 功法/丹药/法宝/编队曾经全部漏掉，面板显示「参研中」但存档里没有。
      gongfa: s.gongfa, gongfaResearching: s.gongfaResearching,
      pills: s.pills, pillActive: s.pillActive, pillCrafting: s.pillCrafting,
      artifacts: s.artifacts, formation: s.formation,
      tutorialStep: s.tutorialStep, tutorialDone: s.tutorialDone,
      warfrontNodes: s.warfrontNodes, warfrontScore: s.warfrontScore,
      warfrontSectScore: s.warfrontSectScore, warfrontCooldownUntil: s.warfrontCooldownUntil,
      warfrontTactic: s.warfrontTactic,
      onlineWarfrontIncome: s.onlineWarfrontIncome,
      warfrontClaimedReportIds: s.warfrontClaimedReportIds,
      expeditionDayKey: s.expeditionDayKey, expeditionEnergy: s.expeditionEnergy,
      expeditionMapDayKey: s.expeditionMapDayKey,
      expeditionMapCycle: s.expeditionMapCycle,
      expeditionEnergyUpdatedAt: s.expeditionEnergyUpdatedAt, expeditionProgress: s.expeditionProgress,
      expeditionNodes: s.expeditionNodes, expeditionScore: s.expeditionScore,
      expeditionWeekScore: s.expeditionWeekScore, expeditionCurrency: s.expeditionCurrency,
      expeditionWeekKey: s.expeditionWeekKey, expeditionSeasonKey: s.expeditionSeasonKey,
      expeditionWeeklyClaimed: s.expeditionWeeklyClaimed, expeditionSeasonRewards: s.expeditionSeasonRewards,
      expeditionRelics: s.expeditionRelics, expeditionShopPurchases: s.expeditionShopPurchases,
    }))
  } catch { /* 忽略写入失败（隐私模式等） */ }
}
