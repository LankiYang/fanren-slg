// ═══ 核心类型定义 ═══

/** 四种资源。对应 README 映射表：灵石=通货 / 灵气=修炼 / 灵药=炼丹 / 矿灵材=炼器 */
export type ResourceKey = 'lingshi' | 'lingqi' | 'lingyao' | 'kuanglingcai'

export type Resources = Record<ResourceKey, number>

/** 建筑标识 */
export type BuildingKey =
  | 'dongfu'        // 洞府（主建筑，等级决定其他建筑上限 —— 对应无尽冬日的熔炉）
  | 'juling'        // 聚灵阵 → 产灵气
  | 'lingtian'      // 灵田 → 产灵药
  | 'kuangmai'      // 矿脉 → 产矿灵材
  | 'fangshi'       // 坊市 → 产灵石
  | 'liandan'       // 炼丹房 → 解锁丹药加成
  | 'lianqi'        // 炼器阁 → 解锁法宝
  | 'yanwu'         // 演武场 → 练兵
  | 'cangjing'      // 藏经阁 → 功法研究（科技树）
  | 'zongmen'       // 宗门大殿 → 宗门系统

/** 兵种。三角克制：傀儡(步)克御兽(骑)、御兽克符修(弓)、符修克傀儡 */
export type TroopKey = 'kuilei' | 'yushou' | 'fuxiu'

/** 服务端认可的限时丹药类型；布尔值表示同步瞬间是否正在生效。 */
export type BattlePillKey = 'qi' | 'body' | 'mind'

/**
 * 洞府养成映射到多人战区的唯一战斗档案。
 *
 * 档案只携带可校验的成长状态，不携带客户端计算出的战力。
 * 服务器会依据自己的兵团、编队和这份档案重新计算战斗结果。
 */
export interface BattleProfile {
  version: 1
  dongfuLevel: number
  yanwuLevel: number
  realm: number
  troops: Record<TroopKey, number>
  cultivators: Record<string, { owned: boolean; level: number }>
  gongfa: Record<string, number>
  artifacts: Record<string, number>
  equipmentPower: number
  activePills: Record<BattlePillKey, boolean>
}

/** 战区据点当前归属。正式联机版由服务端权威维护。 */
export type WarfrontOwner = 'neutral' | 'player' | 'rival'

/** 出征策略。选择策略会在战力和兵损之间做取舍。 */
export type WarfrontTactic = 'assault' | 'cautious' | 'raid'

/** 天机远征的节点类型。每一层会给出两条不同风险的路线。 */
export type ExpeditionNodeKind = 'battle' | 'gather' | 'caravan' | 'event' | 'boss'

/** 远征节点的处理方式；risk 会提高收益，也会提高战斗/事件代价。 */
export type ExpeditionChoice = 'steady' | 'risk'

export type ExpeditionRelicKey = 'starMap' | 'ironBanner' | 'spiritCenser'

/** 玩家在开局选择的身份。身份只改变叙事与外观，不制造数值职业差异。 */
export type Gender = 'male' | 'female'

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory'
export type EquipmentRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type SeekDropKind = 'cultivation' | 'equipment' | 'fortune'

export interface CharacterState {
  gender: Gender | null
}

export interface EquipmentItem {
  id: string
  slot: EquipmentSlot
  rarity: EquipmentRarity
  name: string
  affix: string
  /** 用于自动比较、淬炼和战力换算的统一评分。 */
  power: number
}

export interface SeekDrop {
  id: string
  kind: SeekDropKind
  rarity: EquipmentRarity
  title: string
  desc: string
  cultivation: number
  reward: Partial<Resources>
  equipment: EquipmentItem | null
  equipmentEquipped: boolean
  dustGained: number
  critical: boolean
  /** 本次是否由保底规则触发，用于让玩家看懂掉落。 */
  pityTriggered: boolean
}

export interface SeekState {
  /** 机缘只影响高品质掉落；耗尽后仍可免费静心参悟，不会把主线锁死。 */
  energy: number
  energyUpdatedAt: number
  /** 当前境界积累的点击修为，满足门槛后与资源一起突破。 */
  cultivation: number
  total: number
  dailyCount: number
  dailyKey: string
  combo: number
  bestCombo: number
  lastAt: number
  /** 连续未出史诗/传说的点击数，用于透明保底。 */
  pity: number
  legendaryPity: number
  equipmentInventory: EquipmentItem[]
  equipmentLoadout: Record<EquipmentSlot, EquipmentItem | null>
  equipmentDust: number
  lastDrop: SeekDrop | null
  recentDrops: SeekDrop[]
  claimedMilestones: string[]
}

export interface WarfrontNodeState {
  owner: WarfrontOwner
}

/** 修士（英雄）专精，与兵种对应 */
export type CultivatorSpec = 'kuilei' | 'yushou' | 'fuxiu'

export interface BuildingDef {
  key: BuildingKey
  name: string
  desc: string
  /** 该建筑的产出资源（无产出则为 null） */
  produces: ResourceKey | null
  /** 精灵图路径 */
  sprite: string
  /** 在主城背景上的位置（百分比坐标） */
  pos: { x: number; y: number }
  /** 渲染尺寸（相对宽度百分比） */
  scale: number
  /** 解锁所需的洞府等级 */
  unlockAt: number
}

export interface BuildingState {
  level: number
  /** 升级完成的时间戳；null 表示不在升级中 */
  upgradingUntil: number | null
}

export interface RealmDef {
  /** 境界索引 */
  tier: number
  name: string
  /** 突破到该境界所需的洞府等级 */
  requiresDongfu: number
  /** 突破消耗 */
  cost: Partial<Resources>
  /** 该境界提供的全局产出加成（乘区） */
  outputBonus: number
  /** 该境界提供的全军战力加成（乘区） */
  powerBonus: number
}

export interface TroopDef {
  key: TroopKey
  name: string
  desc: string
  sprite: string
  /** 基础战力 */
  power: number
  /** 训练消耗（每个单位） */
  cost: Partial<Resources>
  /** 克制的兵种 */
  counters: TroopKey
}

export interface CultivatorDef {
  key: string
  name: string
  spec: CultivatorSpec
  desc: string
  sprite: string
  /** 品阶：3=金丹级 2=筑基级 1=炼气级 */
  rarity: 1 | 2 | 3
  /** 基础战力加成（对应专精兵种的乘区） */
  baseBonus: number
}

export interface CultivatorState {
  level: number
  /** 已招募 */
  owned: boolean
}

/** 秘境关卡 */
export interface StageDef {
  id: number
  chapter: number
  chapterName: string
  /** 该章节的妖兽立绘 */
  sprite: string
  name: string
  desc: string
  /** 敌方战力 */
  enemyPower: number
  /** 敌方兵种构成（用于克制计算） */
  enemyTroop: TroopKey
  /** 首通奖励 */
  reward: Partial<Resources>
  /** 首通解锁的修士（可选） */
  unlockCultivator?: string
  /** 该关锚定的洞府等级，用于向玩家提示「什么阶段能打」 */
  anchorDongfu: number
}

export interface ExpeditionNodeState {
  id: string
  depth: number
  branch: 0 | 1
  kind: ExpeditionNodeKind
  title: string
  desc: string
  enemyName: string
  enemyTroop: TroopKey
  enemyPower: number
  /** 节点的基础资源奖励，实际入账仍受当前仓库上限限制。 */
  reward: Partial<Resources>
  score: number
  currency: number
  resolved: boolean
}

export interface ExpeditionReport {
  nodeId: string
  kind: ExpeditionNodeKind
  title: string
  choice: ExpeditionChoice
  outcome: string
  win: boolean
  enemyTroop: TroopKey
  myPower: number
  enemyPower: number
  formation: Record<TroopKey, number>
  deployed: number
  losses: number
  /** 失败时为 false；失败节点保留在当前层，允许消耗下一枚远征令重新挑战。 */
  progressed: boolean
  /** 面向玩家解释失败支付了什么代价。 */
  penalty: string
  scoreGained: number
  currencyGained: number
  gained: Partial<Resources>
}

export interface GameState {
  resources: Resources
  buildings: Record<BuildingKey, BuildingState>
  realm: number
  character: CharacterState
  seek: SeekState
  troops: Record<TroopKey, number>
  cultivators: Record<string, CultivatorState>
  /** 已通关的最高关卡 id */
  clearedStage: number
  /** 上次结算时间戳，用于离线产出 */
  lastTick: number
  /** 已解锁的建造队列数（1 条免费，第 2 条由付费/道具解锁） */
  queueSlots: number
  /** 上次合围妖兽的时间戳（0 = 从未参与） */
  lastBossAt: number
  /** 已领取奖励的成长任务 id */
  claimedQuests: string[]
  /** 功法等级：key → level */
  gongfa: Record<string, number>
  /** 正在研究的功法：key → 完成时间戳 */
  gongfaResearching: { key: string; until: number } | null
  /** 丹药库存：key → 数量 */
  pills: Record<string, number>
  /** 丹药生效至：key → 时间戳 */
  pillActive: Record<string, number>
  /** 正在炼制的丹药 */
  pillCrafting: { key: string; until: number } | null
  /** 法宝等级：key → level（0 = 未锻造） */
  artifacts: Record<string, number>
  /** 出战编队：各兵种实际派出的人数（绝对值，受统兵上限约束） */
  formation: Record<TroopKey, number>
  /** 新手引导当前步骤下标 */
  tutorialStep: number
  /** 新手引导是否已结束（跳过或走完） */
  tutorialDone: boolean
  /** 已经看过分段引导的功能 id 列表 */
  seenIntros: string[]
  /** 当前正在播放的功能引导 id；null = 没有 */
  activeIntro: string | null
  /** 当前功能引导播放到第几步 */
  introStep: number
  /** 道途指南首次开始时间；旧存档缺失时由加载逻辑补齐。 */
  journeyStartedAt: number
  /** 由跨页面玩法写入的长期引导里程碑。 */
  guideFlags: string[]
  /** 战区据点归属；当前原型使用本地 AI 对手，联机版替换为服务端快照。 */
  warfrontNodes: Record<string, WarfrontNodeState>
  /** 当前赛季的个人战功 */
  warfrontScore: number
  /** 当前宗门（原型为演示宗门）的累计贡献 */
  warfrontSectScore: number
  /** 服务端共享战区返回的据点每秒收益；不与本地旧原型据点状态混用。 */
  onlineWarfrontIncome: Resources
  /** 已经入账的服务端战报奖励，避免刷新/轮询重复领取。 */
  warfrontClaimedReportIds: string[]
  /** 出征冷却结束时间 */
  warfrontCooldownUntil: number
  /** 当前选定的出征策略 */
  warfrontTactic: WarfrontTactic
  /** 天机远征每日地图的日期键（按本地日历切换，领域内部使用稳定 seed）。 */
  expeditionDayKey: string
  /** 地图所属日期。未完成的五层路线跨午夜保留，避免 3 枚远征令永远到不了首领。 */
  expeditionMapDayKey: string
  /** 同一天内完成一张地图后继续消耗剩余远征令时的路线序号。 */
  expeditionMapCycle: number
  /** 远征令，最多 3 枚，每 8 小时恢复 1 枚。 */
  expeditionEnergy: number
  expeditionEnergyUpdatedAt: number
  /** 当前地图已推进到第几层，5 表示今日首领已完成。 */
  expeditionProgress: number
  expeditionNodes: ExpeditionNodeState[]
  /** 28 天游历积分与本周积分。 */
  expeditionScore: number
  expeditionWeekScore: number
  expeditionCurrency: number
  expeditionWeekKey: string
  expeditionSeasonKey: string
  expeditionWeeklyClaimed: string[]
  expeditionSeasonRewards: string[]
  /** 远征商店和长期奖励获得的遗物等级。 */
  expeditionRelics: Record<ExpeditionRelicKey, number>
  expeditionShopPurchases: Record<string, number>
}

/** 战区交战的可读结算，用于前端战报；正式版应由服务端返回。 */
export interface WarfrontReport {
  nodeKey: string
  nodeName: string
  enemyName: string
  enemyTroop: TroopKey
  tactic: WarfrontTactic
  win: boolean
  myPower: number
  enemyPower: number
  /** 发起战斗时冻结的出征构成，演出和服务端战报都以它为准。 */
  formation: Record<TroopKey, number>
  deployed: number
  losses: number
  scoreGained: number
  captured: boolean
  gained: Partial<Resources>
}

/** 合围妖兽战报 */
export interface BossReport {
  bossHp: number
  myDamage: number
  npcDamage: number
  totalDamage: number
  tierName: string
  gained: Resources
}

/** 离线收益结算结果，用于回流弹窗 */
export interface OfflineReport {
  /** 实际计入的秒数（已按上限截断） */
  seconds: number
  /** 被上限截断掉的秒数 */
  truncatedSeconds: number
  gained: Resources
}

/** 顶栏飘字事件：资源到账时弹一个 +N，动画结束后由 UI 自行清除 */
export interface FloatEvent {
  id: number
  key: ResourceKey
  amount: number
}
