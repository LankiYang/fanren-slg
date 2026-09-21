// ═══ 纯计算函数 ═══
//
// 只依赖 data/balance/systems，不依赖 store。
// 单独拆出来是为了打破 store ↔ quests 的循环依赖：
// quests 要算战力来判定任务达成，store 又要用 quests 来发奖。
// 所有函数都是「给定 GameState 算出一个数」，无副作用。
//
// 加成的叠加顺序（改动前先看清，顺序错了数值会差很多）：
//   产出 = 建筑基础 × 境界乘区 × (1+功法) × 丹药倍率
//   战力 = 兵种基础 × (1+修士+法宝) × 境界乘区 × (1+功法) × 丹药倍率
// 功法与修士/法宝是「相加后一次性乘上」，不是各自独立连乘。

import type { BattleProfile, GameState, ResourceKey, Resources, TroopKey } from './types'
import { BUILDINGS, CULTIVATORS, COUNTER_BONUS, REALMS, TROOP_MAP, buildingOutput, cultivatorBonus } from './data'
import { storageCap, troopCap, marchCap } from './balance'
import { ARTIFACT_MAP, GONGFA_MAP, PILL_MAP, gongfaBonus, pillEffect, artifactBonus } from './systems'
import { warfrontIncome } from './warfront'
import { equipmentPower } from './seek'

export function emptyResources(): Resources {
  return { lingshi: 0, lingqi: 0, lingyao: 0, kuanglingcai: 0 }
}

/** 当前境界的产出乘区 */
export function realmOutputBonus(realm: number): number {
  return REALMS[Math.min(realm, REALMS.length - 1)].outputBonus
}

/** 当前境界的战力乘区 */
export function realmPowerBonus(realm: number): number {
  return REALMS[Math.min(realm, REALMS.length - 1)].powerBonus
}

/** 每秒各资源产量（境界 × 功法 × 丹药） */
export function computeRates(s: GameState, now = Date.now()): Resources {
  const rates = emptyResources()
  const mult = realmOutputBonus(s.realm)
    * (1 + gongfaBonus(s, 'g_output'))
    * pillEffect(s, 'qi', now)
  for (const def of BUILDINGS) {
    if (!def.produces) continue
    rates[def.produces] += buildingOutput(s.buildings[def.key].level) * mult
  }
  // 战区据点是洞府外的长期资源来源。它不吃洞府/丹药乘区，避免后期滚雪球失控。
  const occupiedIncome = warfrontIncome(s)
  for (const k of Object.keys(rates) as ResourceKey[]) rates[k] += occupiedIncome[k]
  for (const k of Object.keys(rates) as ResourceKey[]) rates[k] += s.onlineWarfrontIncome?.[k] ?? 0
  return rates
}

/** 当前仓库上限（含功法加成） */
export function currentCap(s: GameState): number {
  return Math.round(storageCap(s.buildings.dongfu.level) * (1 + gongfaBonus(s, 'g_cap')))
}

/** 当前兵力上限（含功法加成） */
export function currentTroopCap(s: GameState): number {
  return Math.round(troopCap(s.buildings.yanwu.level) * (1 + gongfaBonus(s, 'w_cap')))
}

/** 已有兵力总数 */
export function totalTroops(s: GameState): number {
  return (Object.keys(s.troops) as TroopKey[]).reduce((n, k) => n + s.troops[k], 0)
}

/** 某兵种的单位战力（修士 + 法宝 → 境界 → 功法 → 丹药） */
export function troopPower(s: GameState, key: TroopKey, now = Date.now()): number {
  const def = TROOP_MAP[key]
  let inner = 1
  for (const c of CULTIVATORS) {
    const st = s.cultivators[c.key]
    if (st?.owned && c.spec === key) inner += cultivatorBonus(c, st.level)
  }
  inner += artifactBonus(s, key)
  // 寻道所得灵装是全局角色战力的小乘区：能明显缩短推图卡点，但不会替代兵种编队。
  const gearBonus = Math.min(0.35, equipmentPower(s.seek?.equipmentLoadout) / 1400)
  return def.power
    * inner
    * realmPowerBonus(s.realm)
    * (1 + gongfaBonus(s, 'w_power'))
    * pillEffect(s, 'body', now)
    * (1 + gearBonus)
}

/** 把本地洞府养成投影成服务端可校验的战斗档案。 */
export function battleProfileFromGameState(s: GameState, now = Date.now()): BattleProfile {
  const cultivators: BattleProfile['cultivators'] = {}
  for (const def of CULTIVATORS) {
    const state = s.cultivators?.[def.key]
    cultivators[def.key] = { owned: Boolean(state?.owned), level: Math.max(0, Math.floor(state?.level ?? 0)) }
  }
  return {
    version: 1,
    dongfuLevel: Math.max(0, Math.floor(s.buildings.dongfu.level)),
    yanwuLevel: Math.max(0, Math.floor(s.buildings.yanwu.level)),
    realm: Math.max(0, Math.floor(s.realm)),
    troops: { kuilei: s.troops.kuilei, yushou: s.troops.yushou, fuxiu: s.troops.fuxiu },
    cultivators,
    gongfa: { ...(s.gongfa ?? {}) },
    artifacts: { ...(s.artifacts ?? {}) },
    equipmentPower: Math.max(0, Math.round(equipmentPower(s.seek?.equipmentLoadout))),
    activePills: {
      qi: pillEffect(s, 'qi', now) > 1,
      body: pillEffect(s, 'body', now) > 1,
      mind: pillEffect(s, 'mind', now) > 1,
    },
  }
}

/** 新玩家或旧服务端存档没有战斗档案时使用的安全基线。 */
export function defaultBattleProfile(): BattleProfile {
  return {
    version: 1,
    dongfuLevel: 1,
    yanwuLevel: 0,
    realm: 0,
    troops: { kuilei: 0, yushou: 0, fuxiu: 0 },
    cultivators: Object.fromEntries(CULTIVATORS.map(def => [def.key, { owned: false, level: 0 }])) as BattleProfile['cultivators'],
    gongfa: {},
    artifacts: {},
    equipmentPower: 0,
    activePills: { qi: false, body: false, mind: false },
  }
}

function profileGongfaBonus(profile: BattleProfile, key: string): number {
  const def = GONGFA_MAP[key]
  return def ? (profile.gongfa[key] ?? 0) * def.perLevel : 0
}

function profileArtifactBonus(profile: BattleProfile, troop: TroopKey): number {
  return Object.values(ARTIFACT_MAP).reduce((sum, def) => {
    const level = profile.artifacts[def.key] ?? 0
    return sum + (level > 0 && (def.spec === troop || def.spec === null) ? level * def.perLevel : 0)
  }, 0)
}

function profilePillEffect(profile: BattleProfile, key: 'body' | 'qi' | 'mind'): number {
  return profile.activePills[key] ? PILL_MAP[key].effect : 1
}

/** 服务端和前端共同使用的单位战力公式。 */
export function troopPowerFromBattleProfile(profile: BattleProfile, key: TroopKey): number {
  let inner = 1
  for (const def of CULTIVATORS) {
    const state = profile.cultivators[def.key]
    if (state?.owned && def.spec === key) inner += cultivatorBonus(def, state.level)
  }
  inner += profileArtifactBonus(profile, key)
  const gearBonus = Math.min(0.35, Math.max(0, profile.equipmentPower) / 1400)
  return TROOP_MAP[key].power
    * inner
    * realmPowerBonus(profile.realm)
    * (1 + profileGongfaBonus(profile, 'w_power'))
    * profilePillEffect(profile, 'body')
    * (1 + gearBonus)
}

/** 不考虑克制的编队战力，用于据点驻防和玩家战力展示。 */
export function formationPowerFromBattleProfile(profile: BattleProfile, formation: Record<TroopKey, number>): number {
  return (Object.keys(formation) as TroopKey[]).reduce((sum, key) => sum + Math.max(0, formation[key]) * troopPowerFromBattleProfile(profile, key), 0)
}

/** 统一的战区交战公式；客户端只用于预估，服务器仍会再次调用。 */
export function battlePowerFromBattleProfile(profile: BattleProfile, formation: Record<TroopKey, number>, enemyTroop: TroopKey): number {
  const cb = COUNTER_BONUS * (1 + profileGongfaBonus(profile, 'w_counter'))
  return (Object.keys(formation) as TroopKey[]).reduce((total, key) => {
    let power = Math.max(0, formation[key]) * troopPowerFromBattleProfile(profile, key)
    if (TROOP_MAP[key].counters === enemyTroop) power *= cb
    else if (TROOP_MAP[enemyTroop].counters === key) power /= cb
    return total + power
  }, 0)
}

/** 总战力（不计编队，用于展示「全部家底」） */
export function totalPower(s: GameState, now = Date.now()): number {
  return (Object.keys(s.troops) as TroopKey[])
    .reduce((sum, k) => sum + s.troops[k] * troopPower(s, k, now), 0)
}

/** 当前克制系数（含功法加成） */
export function counterBonus(s: GameState): number {
  return COUNTER_BONUS * (1 + gongfaBonus(s, 'w_counter'))
}

/** 单次出战的兵力上限（统兵上限） */
export function currentMarchCap(s: GameState): number {
  return marchCap(s.buildings.yanwu.level)
}

/** 当前编队已占用的名额 */
export function formationUsed(s: GameState): number {
  return (Object.keys(s.troops) as TroopKey[])
    .reduce((n, k) => n + Math.min(s.formation?.[k] ?? 0, s.troops[k]), 0)
}

/**
 * 对某关卡的战力结算。
 *
 * formation 记录各兵种实际派出的人数，总数受统兵上限约束 ——
 * 正因为带不走全部兵力，「用克制兵种顶替被克兵种」才是有收益的决策。
 * 克制关系：我方兵种克制敌方兵种时该兵种战力 ×系数；被克制则 ÷系数。
 * 敌方兵种是公开信息，玩家可据此针对性编队，这是战斗里唯一的真决策点。
 */
export function battlePower(s: GameState, enemyTroop: TroopKey, now = Date.now()): number {
  const cb = counterBonus(s)
  const cap = currentMarchCap(s)
  let remaining = cap
  let total = 0
  for (const k of Object.keys(s.troops) as TroopKey[]) {
    // 实际出战数 = min(编队设定, 实际拥有, 剩余名额)
    const count = Math.min(s.formation?.[k] ?? 0, s.troops[k], remaining)
    if (count <= 0) continue
    remaining -= count
    let p = count * troopPower(s, k, now)
    if (TROOP_MAP[k].counters === enemyTroop) p *= cb
    else if (TROOP_MAP[enemyTroop].counters === k) p /= cb
    total += p
  }
  return total
}

/** 针对某敌方兵种的最优编队：优先克制方，其次中立，最后被克方 */
export function optimalFormation(s: GameState, enemyTroop: TroopKey): Record<TroopKey, number> {
  const rank = (k: TroopKey) => {
    if (TROOP_MAP[k].counters === enemyTroop) return 0        // 克制敌方，优先
    if (TROOP_MAP[enemyTroop].counters === k) return 2        // 被敌方克制，垫底
    return 1
  }
  const order = (Object.keys(s.troops) as TroopKey[])
    .sort((a, b) => rank(a) - rank(b) || troopPower(s, b) - troopPower(s, a))

  let remaining = currentMarchCap(s)
  const out = { kuilei: 0, yushou: 0, fuxiu: 0 } as Record<TroopKey, number>
  for (const k of order) {
    const take = Math.min(s.troops[k], remaining)
    out[k] = take
    remaining -= take
  }
  return out
}

/** 正在升级中的建筑数 */
export function busyQueues(s: GameState, now: number): number {
  return Object.values(s.buildings)
    .filter(b => b.upgradingUntil !== null && now < b.upgradingUntil).length
}

/** 建造耗时倍率（功法加速 + 丹药加速，越小越快） */
export function buildSpeedFactor(s: GameState, now = Date.now()): number {
  return 1 / ((1 + gongfaBonus(s, 'b_speed')) * pillEffect(s, 'mind', now))
}

/** 建造消耗倍率（功法减免，越小越省） */
export function buildCostFactor(s: GameState): number {
  return Math.max(0.3, 1 - gongfaBonus(s, 'b_cost'))
}

export function canAfford(res: Resources, cost: Partial<Resources>): boolean {
  return (Object.keys(cost) as ResourceKey[]).every(k => res[k] >= (cost[k] ?? 0))
}

export function pay(res: Resources, cost: Partial<Resources>): Resources {
  const next = { ...res }
  for (const k of Object.keys(cost) as ResourceKey[]) next[k] -= cost[k] ?? 0
  return next
}

/** 按倍率缩放一份消耗表 */
export function scaleCost(cost: Partial<Resources>, factor: number): Partial<Resources> {
  const out: Partial<Resources> = {}
  for (const k of Object.keys(cost) as ResourceKey[]) {
    out[k] = Math.round((cost[k] ?? 0) * factor)
  }
  return out
}
