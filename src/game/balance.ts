// ═══ 数值模型 · 单一数据源 ═══
//
// 所有曲线集中在这里，游戏逻辑与节奏模拟器（sim/simulate.ts）共用同一套函数，
// 保证「模拟器验证过的数值」和「线上跑的数值」不会各算各的。
//
// 调参方法：改 TUNE 里的常数 → 跑 `npm run sim` → 看里程碑是否落在目标区间。
// 目标区间定义在 sim/simulate.ts 的 TARGETS 里。

import type { ResourceKey, TroopKey } from './types'

// ──────────────────────────────────────────────
// 可调参数
// ──────────────────────────────────────────────
export const TUNE = {
  /** 洞府（主建筑）最高等级 —— 一期内容边界 */
  dongfuMax: 24,

  // ── 建造时间（秒）T(n) = base * r^(n-1)，n 为目标等级 ──
  // 洞府比其他建筑慢，形成「主线卡点」，这是 SLG 加速道具的付费位。
  // r=1.42 使 L24 单次约 36h、L1→24 累计约 5 天，与「后期按天等」的品类惯例一致。
  dongfuTimeBase: 35,
  dongfuTimeR: 1.62,
  bldTimeBase: 20,
  bldTimeR: 1.54,
  /**
   * 单次建造时长上限（小时）。
   * 有了上限才敢把增速 r 调陡去压中期节奏，否则 r=1.56 到洞府 24 级
   * 单次要等 8 天，属于劝退级体验。真实 SLG 普遍设这个封顶。
   */
  maxBuildHours: 48,

  // ── 建造消耗 C(n) = base * r^(n-1) ──
  //
  // 标定口径：「升一级 ≈ 攒多少小时的产出」记作 H(L)，
  //   H(L) = cost(L+1) / (prodPerSec(L) * 3600)
  // 设计意图 H(1)≈0.9h（前期几十分钟一级，手感快）→ H(24)≈40h（后期按天等，付费位）。
  // 跨度 ≈ 44 倍，故 costR/prodR = 44^(1/23) ≈ 1.18，取 costR = 1.40*1.18 ≈ 1.66。
  // 若把 costR 调回接近 prodR，后期会资源过剩、关卡失去约束（首版 1.50 就是这么垮的）。
  dongfuCostBase: 720,
  dongfuCostR: 1.81,
  bldCostBase: 360,
  bldCostR: 1.77,

  // ── 新手期折扣 ──
  // 前几级建造成本打折，线性回归到原价。SLG 通用做法：开局半小时要能连升好几级，
  // 否则第一次会话就没有正反馈。指数曲线的头几级本来就贵得不成比例（base 已被后期拉高）。
  newbieDiscountUntil: 6,
  newbieDiscountMin: 0.42,

  // ── 产出建筑 P(level) = base * r^(level-1)，单位：个/秒 ──
  // prodR 与 costR(1.81) 的差值决定后期资源压力。
  // 1.40 时资源几乎不构成约束（模拟里资源不足仅 113 次 vs 队列占满 1227 次），
  // 玩家全程只是在等建造，采集循环形同虚设；降到 1.34 让资源重新有分量。
  prodBase: 0.60,
  prodR: 1.34,

  // ── 仓库上限 ──
  // 满仓后产出停止，这是驱动「每天多次上线」的核心留存杠杆。
  //
  // ⚠️ 仓库不再独立配曲线，而是由「下一级洞府的开销」推导（见 storageCap）。
  // 教训：曾经把 cap 和 cost 各配一条指数曲线，后来只调了 costR 没动 capR，
  // 到洞府 21 级时 cost(9292万) 超过 cap(9216万)，玩家满仓也买不起 → 永久卡死，
  // 模拟报告里表现为「资源不足 1010 次」和「满仓 73%」同时出现这对矛盾信号。
  // 定义成倍数关系后，两者不可能再背离。
  capMultiplier: 2.6,

  // ── 离线产出 ──
  /** 离线最多累计多少小时的产出（超出部分不计，驱动回流） */
  offlineCapHours: 8,
  /** 离线产出效率（低于在线，给在线时长一个理由） */
  offlineRate: 0.7,

  // ── 战斗 ──
  /** 克制方战力倍率 */
  counterBonus: 1.5,
  /** 兵力上限 = base * r^(演武场等级-1) */
  troopCapBase: 120,
  troopCapR: 1.38,

  // ── 关卡难度 ──
  /** 关卡敌方战力 = 该关期望玩家战力 * stageDifficulty */
  stageDifficulty: 0.82,
} as const

// ──────────────────────────────────────────────
// 建筑解锁与初始状态
// ──────────────────────────────────────────────

/**
 * 各建筑解锁所需的洞府等级。
 *
 * ⚠️ 四座产出建筑必须全部为 0：洞府升级要吃灵石+矿灵材+灵气，
 * 若把产这些资源的建筑锁在洞府 2 级之后，就会形成
 * 「升洞府要资源 → 资源要建筑 → 建筑要升洞府」的死锁，
 * 开局资源花完即永久卡死。节奏模拟器第二轮就是这么卡在洞府 1 级 30 天的。
 */
export const BUILDING_UNLOCK: Record<string, number> = {
  dongfu: 0,
  juling: 0, lingtian: 0, kuangmai: 0, fangshi: 0,
  yanwu: 3, liandan: 4, lianqi: 5, cangjing: 6, zongmen: 7,
}

/**
 * 开局白送的建筑等级。
 *
 * ⚠️ 四座产出建筑必须全部为 1 级，不能让玩家自己去建第一座。
 * 否则会出现死锁的第二种形态：洞府升级吃光开局资源 → 没钱建产出建筑
 * → 对应资源零产出 → 永远攒不回来。仅仅把解锁等级放开到 0 挡不住这个，
 * 因为「能建」不等于「买得起」。让四种资源从第一秒起都有进账，
 * 才是结构上消除这类死锁，而不是靠调参绕开。
 */
export const INITIAL_BUILDING_LEVEL: Record<string, number> = {
  dongfu: 1, juling: 1, lingtian: 1, kuangmai: 1, fangshi: 1,
}

/**
 * 开局资源：够付洞府升 2 级的首笔开销，留一点缓冲。
 * ⚠️ 每一项都必须 ≤ 1 级仓库上限，否则一进游戏就被截断、白送的资源当场蒸发。
 * 由 sim 的不变量自检把关。
 */
export const INITIAL_RESOURCES: Record<ResourceKey, number> = {
  lingshi: 1700,
  lingqi: 800,
  lingyao: 500,
  kuanglingcai: 1000,
}

// ──────────────────────────────────────────────
// 建筑曲线
// ──────────────────────────────────────────────

/** 建筑升级耗时（毫秒）。n = 目标等级。受 maxBuildHours 封顶 */
export function buildTimeMs(isDongfu: boolean, n: number): number {
  const { dongfuTimeBase, dongfuTimeR, bldTimeBase, bldTimeR, maxBuildHours } = TUNE
  const raw = isDongfu
    ? dongfuTimeBase * Math.pow(dongfuTimeR, n - 1)
    : bldTimeBase * Math.pow(bldTimeR, n - 1)
  return Math.round(Math.min(raw, maxBuildHours * 3600) * 1000)
}

/** 新手期折扣系数：目标等级 n 越低越便宜，到 newbieDiscountUntil 级回归原价 */
export function newbieDiscount(n: number): number {
  const { newbieDiscountUntil: until, newbieDiscountMin: min } = TUNE
  if (n >= until) return 1
  return min + (1 - min) * ((n - 1) / (until - 1))
}

/** 建筑升级消耗。n = 目标等级 */
export function buildCost(isDongfu: boolean, n: number): Partial<Record<ResourceKey, number>> {
  const { dongfuCostBase, dongfuCostR, bldCostBase, bldCostR } = TUNE
  const raw = isDongfu
    ? dongfuCostBase * Math.pow(dongfuCostR, n - 1)
    : bldCostBase * Math.pow(bldCostR, n - 1)
  const f = raw * newbieDiscount(n)
  return isDongfu
    ? {
        lingshi: Math.round(f),
        kuanglingcai: Math.round(f * 0.55),
        lingqi: Math.round(f * 0.40),
      }
    : {
        lingshi: Math.round(f),
        kuanglingcai: Math.round(f * 0.45),
      }
}

/** 产出建筑每秒产量（未计境界加成） */
export function prodPerSec(level: number): number {
  if (level <= 0) return 0
  return TUNE.prodBase * Math.pow(TUNE.prodR, level - 1)
}

/**
 * 单种资源的仓库上限。
 *
 * 定义为「下一级洞府主资源开销」的固定倍数，而不是独立的指数曲线 ——
 * 这样仓库永远装得下一次大额升级，结构上排除「满仓仍买不起」的死锁。
 * 取 lingshi 是因为它是洞府开销里最大的一项，按它定最保守。
 */
export function storageCap(dongfuLevel: number): number {
  // 不要把 next 钳到 dongfuMax：那样 23 级和 24 级会算出同一个仓库值，
  // 满级玩家的仓库反而不涨（审计报「仓库非递增于 24 级」）。
  // 成本公式对任意 n 都成立，直接外推一级即可。
  const mainCost = buildCost(true, dongfuLevel + 1).lingshi ?? 0
  return Math.round(mainCost * TUNE.capMultiplier)
}

/** 兵力上限（演武场等级决定） */
export function troopCap(yanwuLevel: number): number {
  if (yanwuLevel <= 0) return 0
  return Math.round(TUNE.troopCapBase * Math.pow(TUNE.troopCapR, yanwuLevel - 1))
}

// ──────────────────────────────────────────────
// 洞府升级前置
// ──────────────────────────────────────────────

/**
 * 洞府升到 n 级，需要至少这么多座产出建筑达到 n-1 级。
 * 取 2 而非 3：要求 3 座（即四座里的三座）会把资源过度导向产出建筑，
 * 反而抬高总产出、加快中期节奏，与「用前置拖慢主线」的初衷相反。
 */
export const DONGFU_PREREQ_COUNT = 2

/**
 * 洞府升级的前置门槛。
 *
 * 这是无尽冬日/万国觉醒 gate 主建筑的标准做法：主建筑不能单独狂飙，
 * 必须先把配套建筑拉起来。作用有二 ——
 *   1. 玩法上强迫玩家全面发育，而不是无脑堆主建筑；
 *   2. 数值上精准拖慢主线节奏，不用去动全局的成本/时间曲线（一动就会牵连所有里程碑）。
 */
export function dongfuPrereqLevel(targetLevel: number): number {
  return Math.max(0, targetLevel - 1)
}

/** 给定各产出建筑等级，判断洞府能否升到 targetLevel */
export function canUpgradeDongfu(producerLevels: number[], targetLevel: number): boolean {
  const need = dongfuPrereqLevel(targetLevel)
  return producerLevels.filter(l => l >= need).length >= DONGFU_PREREQ_COUNT
}

// ──────────────────────────────────────────────
// 境界
// ──────────────────────────────────────────────
// ⚠️ 境界命名的核实状态见 README「世界观/人设/剧情核实状态」：
//    炼气/筑基为高置信；「结丹」为中置信（部分同类作品用「金丹」），联网核实前不得当最终设定。

export interface RealmSpec {
  tier: number
  name: string
  /** 突破所需洞府等级 */
  gate: number
  /** 全局产出乘区 */
  output: number
  /** 全军战力乘区 */
  power: number
}

/** 境界表：洞府等级作为唯一前置门槛，乘区随 tier 复利增长 */
export const REALM_SPECS: RealmSpec[] = [
  { tier: 0, name: '炼气一层', gate: 1 },
  { tier: 1, name: '炼气三层', gate: 2 },
  { tier: 2, name: '炼气五层', gate: 3 },
  { tier: 3, name: '炼气七层', gate: 4 },
  { tier: 4, name: '炼气九层', gate: 5 },
  { tier: 5, name: '炼气大圆满', gate: 6 },
  { tier: 6, name: '筑基初期', gate: 8 },
  { tier: 7, name: '筑基中期', gate: 10 },
  { tier: 8, name: '筑基后期', gate: 12 },
  { tier: 9, name: '结丹初期', gate: 15 },
  { tier: 10, name: '结丹中期', gate: 18 },
  { tier: 11, name: '结丹后期', gate: 21 },
  { tier: 12, name: '结丹大圆满', gate: 24 },
].map(r => ({
  ...r,
  // 产出每档 +12% 复利，战力每档 +18% 复利
  output: Number(Math.pow(1.12, r.tier).toFixed(4)),
  power: Number(Math.pow(1.18, r.tier).toFixed(4)),
}))

/**
 * 突破到第 tier 境界的消耗。
 *
 * 以该境界门槛处的仓库容量为锚。系数随 tier 爬升（0.35 → 0.90）：
 * 前期突破要便宜，否则玩家洞府都升到 4 级了还卡在炼气三层，
 * 白白错过境界的产出乘区，越落越远（首版用固定 0.85 就是这个毛病）。
 */
export function realmCost(tier: number): Partial<Record<ResourceKey, number>> {
  if (tier <= 0) return {}
  const anchor = storageCap(REALM_SPECS[tier].gate)
  const ramp = 0.30 + 0.05 * tier
  return {
    lingqi: Math.round(anchor * ramp),
    lingyao: Math.round(anchor * ramp * 0.65),
    lingshi: Math.round(anchor * ramp * 0.40),
  }
}

// ──────────────────────────────────────────────
// 兵种与战力
// ──────────────────────────────────────────────

export interface TroopSpec {
  key: TroopKey
  power: number
  cost: Partial<Record<ResourceKey, number>>
  counters: TroopKey
}

/** 三角克制：傀儡克御兽、御兽克符修、符修克傀儡 */
export const TROOP_SPECS: TroopSpec[] = [
  { key: 'kuilei', power: 10, cost: { kuanglingcai: 45, lingshi: 25 }, counters: 'yushou' },
  { key: 'yushou', power: 12, cost: { lingyao: 45, lingshi: 30 }, counters: 'fuxiu' },
  { key: 'fuxiu', power: 11, cost: { lingqi: 45, lingshi: 30 }, counters: 'kuilei' },
]

/** 单个兵的平均造价（用于模拟器估算「资源→战力」转化率） */
export function avgTroopCost(): number {
  const total = TROOP_SPECS.reduce(
    (s, t) => s + Object.values(t.cost).reduce((a, b) => a + (b ?? 0), 0), 0,
  )
  return total / TROOP_SPECS.length
}

/** 修士升级消耗（level = 目标等级） */
export function cultivatorUpCost(level: number): Partial<Record<ResourceKey, number>> {
  const f = Math.pow(1.52, level - 1)
  return { lingyao: Math.round(220 * f), lingshi: Math.round(300 * f) }
}

/** 修士最高等级 */
export const CULTIVATOR_MAX_LEVEL = 20

// ──────────────────────────────────────────────
// 关卡曲线
// ──────────────────────────────────────────────

/**
 * 单次出战能带的兵力占「兵力上限」的比例（统兵上限）。
 *
 * 对应万国觉醒/无尽冬日的行军队列容量：拥有的兵远多于一次能带走的兵。
 * 这条约束是编队玩法成立的前提 —— 没有它，被克制的兵种虽然战力打折但仍是正贡献，
 * 「全军压上」永远最优，编队就退化成没有选择的摆设（实测过：留守被克兵种反而从
 * 8.8 万掉到 7.1 万）。有了容量上限，用克制兵种顶替被克兵种才真正划算。
 *
 * 同时它也是关卡难度锚点里「玩家能投入多少战力」的取值，
 * 所以改这个数会直接影响 expectedPower，进而影响全部 40 关的难度。
 */
export const TROOP_FILL_RATE = 0.55

/** 单次出战的兵力上限 */
export function marchCap(yanwuLevel: number): number {
  return Math.floor(troopCap(yanwuLevel) * TROOP_FILL_RATE)
}

/**
 * 期望战力：玩家在洞府等级 L 时「正常发育」应有的战力。
 * = 兵力上限 × 实装率 × 平均单位战力 × 境界乘区 × 修士加成
 * 关卡难度按这个锚点定，避免出现卡死或碾压。
 */
export function expectedPower(dongfuLevel: number): number {
  // 演武场等级通常紧跟洞府（受洞府封顶），取 L-1 作保守估计
  const yanwu = Math.max(1, dongfuLevel - 1)
  const cap = troopCap(yanwu) * TROOP_FILL_RATE
  const avgUnitPower = TROOP_SPECS.reduce((s, t) => s + t.power, 0) / TROOP_SPECS.length
  // 该洞府等级下玩家通常已达到的境界
  const realm = [...REALM_SPECS].reverse().find(r => r.gate <= dongfuLevel) ?? REALM_SPECS[0]
  // 修士加成：假定玩家把已解锁修士练到洞府等级的一半
  const cultivatorBonus = 1 + 0.06 * Math.floor(dongfuLevel / 2)
  return cap * avgUnitPower * realm.power * cultivatorBonus
}

/** 关卡在第几个洞府等级档位解锁（关卡 id 从 1 开始） */
export function stageDongfuAnchor(stageId: number): number {
  // 40 关铺满洞府 1→24，前期密后期疏
  return Math.min(TUNE.dongfuMax, 1 + Math.floor((stageId - 1) * 0.6))
}

/** 关卡敌方战力 */
export function stageEnemyPower(stageId: number): number {
  return Math.round(expectedPower(stageDongfuAnchor(stageId)) * TUNE.stageDifficulty)
}

/** 关卡奖励（按该关期望产出规模给） */
export function stageReward(stageId: number): Partial<Record<ResourceKey, number>> {
  const cap = storageCap(stageDongfuAnchor(stageId))
  return {
    lingshi: Math.round(cap * 0.22),
    lingqi: Math.round(cap * 0.12),
    lingyao: Math.round(cap * 0.12),
    kuanglingcai: Math.round(cap * 0.12),
  }
}

// ──────────────────────────────────────────────
// 合围妖兽（对应无尽冬日的熊出没）
// ──────────────────────────────────────────────

export const BOSS = {
  /** 冷却（小时）—— 定时开放是这类玩法的留存钩子 */
  cooldownHours: 4,
  /** 妖兽血量 = 玩家期望战力 × 这个倍数。远超单人战力，逼出「宗门协作」的叙事 */
  hpMultiplier: 6.5,
  /** 单机版里 NPC 同门贡献的伤害占比（联机版换成真实盟友伤害） */
  npcContribution: 0.55,
  /** 奖励按「造成伤害 / 总血量」分档 */
  tiers: [
    { minRatio: 1.00, name: '击杀', mult: 1.0 },
    { minRatio: 0.60, name: '重创', mult: 0.55 },
    { minRatio: 0.30, name: '挫敌', mult: 0.28 },
    { minRatio: 0.00, name: '未竟', mult: 0.10 },
  ],
} as const

/** 妖兽血量随玩家洞府等级成长 */
export function bossHp(dongfuLevel: number): number {
  return Math.round(expectedPower(dongfuLevel) * BOSS.hpMultiplier)
}

/** 按伤害占比结算奖励档位 */
export function bossTier(damageRatio: number) {
  return BOSS.tiers.find(t => damageRatio >= t.minRatio) ?? BOSS.tiers[BOSS.tiers.length - 1]
}

/** 合围妖兽奖励（比普通关卡丰厚，因为有冷却限制） */
export function bossReward(dongfuLevel: number, mult: number): Partial<Record<ResourceKey, number>> {
  const cap = storageCap(dongfuLevel)
  return {
    lingshi: Math.round(cap * 0.40 * mult),
    lingqi: Math.round(cap * 0.25 * mult),
    lingyao: Math.round(cap * 0.25 * mult),
    kuanglingcai: Math.round(cap * 0.25 * mult),
  }
}
