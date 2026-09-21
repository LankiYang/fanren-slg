// ═══ 天机远征 · 每日轮换地图 ═══
//
// 远征是单机养成侧的长期循环：地图、路线、敌人和奖励由日期 seed 生成，
// 不依赖随机数，因此可以在浏览器、模拟器和未来服务端得到同一张地图。
// 结算仍由 store 执行；本文件只放领域数据、生成规则和奖励表。

import type {
  ExpeditionChoice, ExpeditionNodeKind, ExpeditionNodeState, ExpeditionRelicKey,
  GameState, ResourceKey, Resources, TroopKey,
} from './types'
import { expectedPower, storageCap } from './balance'

export const EXPEDITION_MAX_ENERGY = 3
export const EXPEDITION_ENERGY_REGEN_MS = 8 * 60 * 60 * 1000
export const EXPEDITION_DEPTHS = 5
export const EXPEDITION_SEASON_DAYS = 28

export interface ExpeditionThemeDef {
  key: string
  name: string
  tagline: string
  sprite: string
  bossName: string
  bossTroop: TroopKey
  difficulty: number
  flavors: string[]
}

export const EXPEDITION_THEMES: ExpeditionThemeDef[] = [
  {
    key: 'star-sea', name: '星坠海', tagline: '潮汐卷走旧日仙舟，星火在海眼下重新燃起。',
    sprite: 'monster/ch2-leviathan.webp', bossName: '吞星海侯', bossTroop: 'yushou', difficulty: 0.98,
    flavors: ['潮声里藏着古老的号角。', '沉船的阵盘仍在微弱运转。', '海雾后有成群灵兽游过。', '海眼正在吞噬附近的灵脉。'],
  },
  {
    key: 'red-ravine', name: '赤霞天堑', tagline: '地火烧穿山脉，只有最快的队伍能带走灵焰。',
    sprite: 'monster/ch3-firebird.webp', bossName: '赤霞焚天雀', bossTroop: 'fuxiu', difficulty: 1.04,
    flavors: ['岩缝中喷出的火舌照亮了古道。', '断桥下埋着一枚未熄的火种。', '热浪让符纸自行燃烧。', '山壁深处传来兵刃交击声。'],
  },
  {
    key: 'poison-mire', name: '万毒迷泽', tagline: '每一处绿意都可能是毒瘴，谨慎与贪婪只隔一念。',
    sprite: 'monster/ch5-hydra.webp', bossName: '九首吞灵蟒', bossTroop: 'kuilei', difficulty: 1.08,
    flavors: ['雾中的脚印比来路多了一倍。', '毒潭边长着难得一见的灵草。', '腐木下有新的巢穴正在成形。', '祭坛上的血色符文突然亮起。'],
  },
  {
    key: 'ancient-city', name: '天南古城', tagline: '千年城阵尚未沉睡，遗宝与守卫同时等待来客。',
    sprite: 'monster/ch7-warpuppet.webp', bossName: '古城镇界傀', bossTroop: 'kuilei', difficulty: 1.12,
    flavors: ['残墙上的城防禁制仍在巡弋。', '废墟商铺里传出灵石碰撞声。', '一座无人操控的傀儡拦住了去路。', '城主府的星图指向地底。'],
  },
  {
    key: 'fallen-star', name: '坠星原', tagline: '星骸改变了天地法则，首领正在等一支敢于深入的军阵。',
    sprite: 'monster/ch8-starbeast.webp', bossName: '坠星天兽', bossTroop: 'yushou', difficulty: 1.16,
    flavors: ['陨石带来的灵压让兵阵短暂失衡。', '星尘落在法宝上，发出清脆回响。', '异兽沿着陨坑边缘窥视队伍。', '远处的天空裂开了一道缝隙。'],
  },
]

export interface ExpeditionWeeklyReward {
  id: string
  name: string
  need: number
  currency: number
  reward: Partial<Resources>
}

export const EXPEDITION_WEEKLY_REWARDS: ExpeditionWeeklyReward[] = [
  { id: 'week-300', name: '踏入天机', need: 300, currency: 60, reward: { lingshi: 900, lingqi: 420 } },
  { id: 'week-720', name: '连破三阵', need: 720, currency: 110, reward: { lingyao: 720, kuanglingcai: 720 } },
  { id: 'week-1280', name: '寻脉有成', need: 1280, currency: 180, reward: { lingshi: 1800, lingqi: 900, lingyao: 900, kuanglingcai: 900 } },
]

export interface ExpeditionSeasonReward {
  id: string
  name: string
  need: number
  currency: number
  reward: Partial<Resources>
  relic?: ExpeditionRelicKey
}

export const EXPEDITION_SEASON_REWARDS: ExpeditionSeasonReward[] = [
  { id: 'season-900', name: '观星客', need: 900, currency: 180, reward: { lingshi: 2600, lingqi: 1100 }, relic: 'starMap' },
  { id: 'season-2400', name: '破阵行者', need: 2400, currency: 300, reward: { lingyao: 1800, kuanglingcai: 1800 }, relic: 'ironBanner' },
  { id: 'season-4600', name: '天机执掌', need: 4600, currency: 500, reward: { lingshi: 5200, lingqi: 2600, lingyao: 2600, kuanglingcai: 2600 }, relic: 'spiritCenser' },
  { id: 'season-7200', name: '星河远征军', need: 7200, currency: 800, reward: { lingshi: 9000, lingqi: 4500, lingyao: 4500, kuanglingcai: 4500 }, relic: 'starMap' },
]

export interface ExpeditionShopItem {
  id: string
  name: string
  desc: string
  cost: number
  maxPurchases: number
  reward: Partial<Resources>
  relic?: ExpeditionRelicKey
}

export const EXPEDITION_SHOP: ExpeditionShopItem[] = [
  { id: 'spirit-cache', name: '灵脉宝匣', desc: '稳定补充四种养成资源。', cost: 80, maxPurchases: 99, reward: { lingshi: 1200, lingqi: 600, lingyao: 600, kuanglingcai: 600 } },
  { id: 'star-map', name: '星图残卷', desc: '远征积分获取提高 8%，最多 3 层。', cost: 260, maxPurchases: 3, reward: {}, relic: 'starMap' },
  { id: 'iron-banner', name: '破阵战旗', desc: '远征战斗战力提高 6%，最多 3 层。', cost: 320, maxPurchases: 3, reward: {}, relic: 'ironBanner' },
  { id: 'spirit-censer', name: '聚灵香炉', desc: '远征资源奖励提高 10%，最多 3 层。', cost: 360, maxPurchases: 3, reward: {}, relic: 'spiritCenser' },
]

const TROOPS: TroopKey[] = ['kuilei', 'yushou', 'fuxiu']
const RESOURCE_KEYS: ResourceKey[] = ['lingshi', 'lingqi', 'lingyao', 'kuanglingcai']

/** 轻量稳定 hash：保证同一个日期在不同浏览器生成同一条路线。 */
export function expeditionSeed(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length]
}

export function expeditionDayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function expeditionDaySerial(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number)
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000)
}

export function expeditionWeekKey(dayKey: string): string {
  return `week-${Math.floor(expeditionDaySerial(dayKey) / 7)}`
}

export function expeditionSeasonKey(dayKey: string): string {
  return `season-${Math.floor(expeditionDaySerial(dayKey) / EXPEDITION_SEASON_DAYS)}`
}

export function expeditionTheme(dayKey: string): ExpeditionThemeDef {
  const week = Math.floor(expeditionDaySerial(dayKey) / 7)
  return EXPEDITION_THEMES[((week % EXPEDITION_THEMES.length) + EXPEDITION_THEMES.length) % EXPEDITION_THEMES.length]
}

function rewardFor(kind: ExpeditionNodeKind, cap: number, branch: number, seed: number): Partial<Resources> {
  const out: Partial<Resources> = {}
  const main = RESOURCE_KEYS[(seed + branch) % RESOURCE_KEYS.length]
  const ratios: Record<ExpeditionNodeKind, number> = {
    battle: 0.16,
    gather: 0.25,
    caravan: 0.21,
    event: 0.18,
    boss: 0.42,
  }
  out[main] = Math.max(1, Math.round(cap * ratios[kind]))
  if (kind === 'battle' || kind === 'caravan' || kind === 'boss') {
    const second = RESOURCE_KEYS[(RESOURCE_KEYS.indexOf(main) + 1 + (seed % 2)) % RESOURCE_KEYS.length]
    out[second] = Math.max(1, Math.round(cap * ratios[kind] * (kind === 'boss' ? 0.7 : 0.55)))
  }
  if (kind === 'boss') {
    for (const key of RESOURCE_KEYS) out[key] = Math.max(out[key] ?? 0, Math.round(cap * 0.16))
  }
  return out
}

function nodeKind(depth: number, branch: 0 | 1, seed: number): ExpeditionNodeKind {
  if (depth === EXPEDITION_DEPTHS - 1) return 'boss'
  const rows: ExpeditionNodeKind[][] = [
    ['battle', 'gather'],
    ['caravan', 'event'],
    ['battle', 'caravan'],
    ['event', 'battle'],
  ]
  const preferred = rows[depth][branch]
  return seed % 5 === 0 ? (preferred === 'battle' ? 'gather' : 'battle') : preferred
}

function kindName(kind: ExpeditionNodeKind): string {
  return ({ battle: '破阵', gather: '采灵', caravan: '护送', event: '天机', boss: '首领' })[kind]
}

export function createExpeditionNodes(dayKey: string, dongfuLevel: number, cycle = 0): ExpeditionNodeState[] {
  const theme = expeditionTheme(dayKey)
  const dayPressure = 1 + ((expeditionDaySerial(dayKey) % EXPEDITION_SEASON_DAYS) / (EXPEDITION_SEASON_DAYS - 1)) * 0.18
  const cap = storageCap(Math.max(1, dongfuLevel))
  const expected = expectedPower(Math.max(1, dongfuLevel))
  const nodes: ExpeditionNodeState[] = []

  for (let depth = 0; depth < EXPEDITION_DEPTHS; depth++) {
    const branches = depth === EXPEDITION_DEPTHS - 1 ? [0] : [0, 1]
    for (const branch of branches) {
      const seed = expeditionSeed(`${dayKey}:${theme.key}:run-${cycle}:${depth}:${branch}`)
      const kind = nodeKind(depth, branch as 0 | 1, seed)
      const enemyTroop = depth === EXPEDITION_DEPTHS - 1
        ? theme.bossTroop
        : pick(TROOPS, seed >>> 4)
      const enemyPower = kind === 'battle' || kind === 'boss'
        ? Math.round(expected * (kind === 'boss' ? 1.02 : 0.34 + depth * 0.15) * theme.difficulty * dayPressure)
        : 0
      const title = kind === 'boss'
        ? theme.bossName
        : `${theme.name}·${kindName(kind)}${branch === 0 ? '左路' : '右路'}`
      const flavor = kind === 'boss'
        ? `${theme.bossName}盘踞在远征终点，击破它可获得本日最高奖励。`
        : theme.flavors[(seed >>> 8) % theme.flavors.length]
      const reward = rewardFor(kind, cap, branch, seed)
      nodes.push({
        id: `${dayKey}-run-${cycle}-${depth}-${branch}`,
        depth,
        branch: branch as 0 | 1,
        kind,
        title,
        desc: flavor,
        enemyName: kind === 'boss' || kind === 'battle' ? (kind === 'boss' ? theme.bossName : `${theme.name}守军`) : '秘境变数',
        enemyTroop,
        enemyPower,
        reward,
        score: 90 + depth * 38 + (kind === 'boss' ? 180 : kind === 'event' ? 18 : 0),
        currency: 26 + depth * 10 + (kind === 'boss' ? 90 : 0),
        resolved: false,
      })
    }
  }
  return nodes
}

export function initialExpeditionState(now = Date.now(), dongfuLevel = 1): Pick<GameState,
  'expeditionDayKey' | 'expeditionMapDayKey' | 'expeditionMapCycle' | 'expeditionEnergy' | 'expeditionEnergyUpdatedAt' | 'expeditionProgress' |
  'expeditionNodes' | 'expeditionScore' | 'expeditionWeekScore' | 'expeditionCurrency' |
  'expeditionWeekKey' | 'expeditionSeasonKey' | 'expeditionWeeklyClaimed' | 'expeditionSeasonRewards' |
  'expeditionRelics' | 'expeditionShopPurchases'> {
  const dayKey = expeditionDayKey(new Date(now))
  return {
    expeditionDayKey: dayKey,
    expeditionMapDayKey: dayKey,
    expeditionMapCycle: 0,
    expeditionEnergy: EXPEDITION_MAX_ENERGY,
    expeditionEnergyUpdatedAt: now,
    expeditionProgress: 0,
    expeditionNodes: createExpeditionNodes(dayKey, dongfuLevel),
    expeditionScore: 0,
    expeditionWeekScore: 0,
    expeditionCurrency: 0,
    expeditionWeekKey: expeditionWeekKey(dayKey),
    expeditionSeasonKey: expeditionSeasonKey(dayKey),
    expeditionWeeklyClaimed: [],
    expeditionSeasonRewards: [],
    expeditionRelics: { starMap: 0, ironBanner: 0, spiritCenser: 0 },
    expeditionShopPurchases: {},
  }
}

/** 由主循环调用，处理跨天换图、周重置和远征令自然恢复。 */
export function refreshExpeditionState(s: GameState, now: number): Partial<GameState> {
  const dayKey = expeditionDayKey(new Date(now))
  const weekKey = expeditionWeekKey(dayKey)
  const seasonKey = expeditionSeasonKey(dayKey)
  const patch: Partial<GameState> = {}
  const dayChanged = s.expeditionDayKey !== dayKey || s.expeditionNodes.length === 0

  if (s.expeditionSeasonKey !== seasonKey) {
    patch.expeditionSeasonKey = seasonKey
    patch.expeditionScore = 0
    patch.expeditionSeasonRewards = []
  }
  if (s.expeditionWeekKey !== weekKey) {
    patch.expeditionWeekKey = weekKey
    patch.expeditionWeekScore = 0
    patch.expeditionWeeklyClaimed = []
  }
  if (dayChanged) {
    patch.expeditionDayKey = dayKey
    // 五层路线需要至少 5 次行动，而每日只给 3 枚令。未完成的地图跨午夜保留，
    // 只有上一张地图已击破首领时才换新图并补满当日远征令。
    if (s.expeditionProgress >= EXPEDITION_DEPTHS || s.expeditionNodes.length === 0) {
      patch.expeditionMapDayKey = dayKey
      patch.expeditionMapCycle = 0
      patch.expeditionNodes = createExpeditionNodes(dayKey, s.buildings.dongfu.level, 0)
      patch.expeditionProgress = 0
      patch.expeditionEnergy = EXPEDITION_MAX_ENERGY
      patch.expeditionEnergyUpdatedAt = now
    }
    return patch
  }

  const energy = Math.max(0, Math.min(EXPEDITION_MAX_ENERGY, s.expeditionEnergy))
  if (energy < EXPEDITION_MAX_ENERGY) {
    const recovered = Math.floor(Math.max(0, now - s.expeditionEnergyUpdatedAt) / EXPEDITION_ENERGY_REGEN_MS)
    if (recovered > 0) {
      const next = Math.min(EXPEDITION_MAX_ENERGY, energy + recovered)
      patch.expeditionEnergy = next
      patch.expeditionEnergyUpdatedAt = next >= EXPEDITION_MAX_ENERGY
        ? now
        : s.expeditionEnergyUpdatedAt + recovered * EXPEDITION_ENERGY_REGEN_MS
    }
  }
  return patch
}

export function expeditionEnergyReadyAt(s: GameState): number {
  if (s.expeditionEnergy >= EXPEDITION_MAX_ENERGY) return 0
  return s.expeditionEnergyUpdatedAt + EXPEDITION_ENERGY_REGEN_MS
}

export function expeditionRelicLevel(s: GameState, key: ExpeditionRelicKey): number {
  return Math.max(0, Math.min(3, s.expeditionRelics[key] ?? 0))
}

export function expeditionBattleMultiplier(s: GameState): number {
  return 1 + expeditionRelicLevel(s, 'ironBanner') * 0.06
}

export function expeditionScoreMultiplier(s: GameState): number {
  return 1 + expeditionRelicLevel(s, 'starMap') * 0.08
}

export function expeditionRewardMultiplier(s: GameState, choice: ExpeditionChoice): number {
  const risk = choice === 'risk' ? 1.35 : 1
  return risk * (1 + expeditionRelicLevel(s, 'spiritCenser') * 0.1)
}

/** 压榨路线的非战斗节点使用稳定 seed 判定风险，避免刷新页面改变结果。 */
export function expeditionRiskSuccess(nodeId: string, kind: ExpeditionNodeKind): boolean {
  if (kind === 'battle' || kind === 'boss') return false
  const threshold: Record<Exclude<ExpeditionNodeKind, 'battle' | 'boss'>, number> = {
    gather: 84,
    caravan: 80,
    event: 76,
  }
  return expeditionSeed(`${nodeId}:risk`) % 100 < threshold[kind]
}

export function scaledExpeditionReward(
  reward: Partial<Resources>,
  multiplier: number,
  win = true,
): Partial<Resources> {
  const out: Partial<Resources> = {}
  const result = win ? multiplier : 0
  for (const key of Object.keys(reward) as ResourceKey[]) out[key] = Math.max(0, Math.round((reward[key] ?? 0) * result))
  return out
}
