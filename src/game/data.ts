// ═══ 游戏配置数据 ═══
// 数值曲线一律从 balance.ts 取，本文件只负责「有哪些东西、叫什么、长什么样」。
// 不要在这里写死任何数值公式 —— 那会让节奏模拟器验证过的数和线上跑的数分叉。
import type {
  BuildingDef, BuildingKey, RealmDef, ResourceKey,
  TroopDef, TroopKey, CultivatorDef, StageDef,
} from './types'
import {
  REALM_SPECS, TROOP_SPECS, BUILDING_UNLOCK, TUNE,
  buildCost, buildTimeMs, prodPerSec, realmCost,
  stageEnemyPower, stageReward, stageDongfuAnchor,
} from './balance'

export const RESOURCE_META: Record<ResourceKey, { name: string; icon: string; desc: string }> = {
  lingshi: { name: '灵石', icon: 'icon/lingshi.svg', desc: '修真界通货，建造与交易之本' },
  lingqi: { name: '灵气', icon: 'icon/lingqi.svg', desc: '修炼与突破境界所需' },
  lingyao: { name: '灵药', icon: 'icon/lingyao.svg', desc: '炼丹材料，供养修士' },
  kuanglingcai: { name: '矿灵材', icon: 'icon/kuanglingcai.svg', desc: '炼器材料，锻造法宝与傀儡' },
}

export const BUILDINGS: BuildingDef[] = [
  // pos / scale 只用于 2D 退路（无 WebGL 时）：数值取自 3D 场景（src/ui/world/homeLayout.ts）投影后的屏幕位置，
  // 保证两种模式布局一致。pos.x = 水平中心，pos.y = 地面接触线（建筑由此向上生长），渲染时按 y 排序。
  // ── 远排 ──
  {
    key: 'cangjing', name: '藏经阁', desc: '参研功法，解锁长期增益。',
    produces: null, sprite: 'building/cangjing.svg',
    pos: { x: 34, y: 44 }, scale: 18, unlockAt: BUILDING_UNLOCK.cangjing,
  },
  {
    key: 'lianqi', name: '炼器阁', desc: '以矿灵材锻造法宝，提升部队战力。',
    produces: null, sprite: 'building/lianqi.svg',
    pos: { x: 76, y: 70 }, scale: 24, unlockAt: BUILDING_UNLOCK.lianqi,
  },
  // ── 中排 ──
  {
    key: 'juling', name: '聚灵阵', desc: '汇聚天地灵气，持续产出灵气。',
    produces: 'lingqi', sprite: 'building/juling-formation.svg',
    pos: { x: 75, y: 45 }, scale: 21, unlockAt: BUILDING_UNLOCK.juling,
  },
  {
    key: 'lingtian', name: '灵田', desc: '培植灵草，持续产出灵药。',
    produces: 'lingyao', sprite: 'building/lingtian.svg',
    pos: { x: 29, y: 55 }, scale: 24, unlockAt: BUILDING_UNLOCK.lingtian,
  },
  // ── 主建筑：居中偏上，体量最大 ──
  {
    key: 'dongfu', name: '洞府', desc: '你的立身之所。等级决定其余建筑的上限，也是突破境界的前置。',
    produces: null, sprite: 'building/dongfu.svg',
    pos: { x: 54, y: 39 }, scale: 31, unlockAt: BUILDING_UNLOCK.dongfu,
  },
  // ── 近排 ──
  {
    key: 'kuangmai', name: '矿脉', desc: '开采地脉灵矿，持续产出矿灵材。',
    produces: 'kuanglingcai', sprite: 'building/kuangmai.svg',
    pos: { x: 80, y: 56 }, scale: 27, unlockAt: BUILDING_UNLOCK.kuangmai,
  },
  {
    key: 'fangshi', name: '坊市', desc: '与散修交易，持续产出灵石。',
    produces: 'lingshi', sprite: 'building/fangshi.svg',
    pos: { x: 76, y: 88 }, scale: 30, unlockAt: BUILDING_UNLOCK.fangshi,
  },
  {
    key: 'liandan', name: '炼丹房', desc: '以灵药炼制丹药，提升全局产出。',
    produces: null, sprite: 'building/liandan.svg',
    pos: { x: 52, y: 52 }, scale: 19, unlockAt: BUILDING_UNLOCK.liandan,
  },
  // ── 最近排 ──
  {
    key: 'yanwu', name: '演武场', desc: '操练傀儡、灵兽与符修。等级决定兵力上限。',
    produces: null, sprite: 'building/yanwu.svg',
    pos: { x: 25, y: 68 }, scale: 27, unlockAt: BUILDING_UNLOCK.yanwu,
  },
  {
    key: 'zongmen', name: '宗门大殿', desc: '加入宗门，参与合围妖兽等协作玩法。',
    produces: null, sprite: 'building/zongmen.svg',
    pos: { x: 27, y: 88 }, scale: 38, unlockAt: BUILDING_UNLOCK.zongmen,
  },
]

export const BUILDING_MAP = Object.fromEntries(
  BUILDINGS.map(b => [b.key, b]),
) as Record<BuildingKey, BuildingDef>

/** 产出建筑的 key 列表（洞府升级前置要用） */
export const PRODUCER_KEYS: BuildingKey[] = BUILDINGS
  .filter(b => b.produces !== null)
  .map(b => b.key)

// ── 以下三个是给 UI 用的薄封装，真正的曲线在 balance.ts ──
export function buildingCost(key: BuildingKey, targetLevel: number) {
  return buildCost(key === 'dongfu', targetLevel)
}
export function buildingTime(key: BuildingKey, targetLevel: number) {
  return buildTimeMs(key === 'dongfu', targetLevel)
}
export function buildingOutput(level: number) {
  return prodPerSec(level)
}

// ── 境界体系 ──
// ⚠️ 命名的核实状态见 README「世界观/人设/剧情核实状态」：
//    炼气/筑基为高置信；「结丹」为中置信（部分同类作品用「金丹」），联网核实前不得当最终设定。
export const REALMS: RealmDef[] = REALM_SPECS.map(r => ({
  tier: r.tier,
  name: r.name,
  requiresDongfu: r.gate,
  cost: realmCost(r.tier),
  outputBonus: r.output,
  powerBonus: r.power,
}))

// ── 兵种：三角克制 ──
const TROOP_META: Record<TroopKey, { name: string; desc: string; sprite: string }> = {
  kuilei: {
    name: '傀儡兵', desc: '以矿灵材炼制的傀儡，重甲肉盾。克御兽军。',
    sprite: 'troop/kuilei.svg',
  },
  yushou: {
    name: '御兽军', desc: '驱使灵兽冲阵，机动迅捷。克符修弓阵。',
    sprite: 'troop/yushou.svg',
  },
  fuxiu: {
    name: '符修弓阵', desc: '以灵力凝弓，远程齐射。克傀儡兵。',
    sprite: 'troop/fuxiu.svg',
  },
}

export const TROOPS: TroopDef[] = TROOP_SPECS.map(t => ({
  key: t.key,
  name: TROOP_META[t.key].name,
  desc: TROOP_META[t.key].desc,
  sprite: TROOP_META[t.key].sprite,
  power: t.power,
  cost: t.cost,
  counters: t.counters,
}))

export const TROOP_MAP = Object.fromEntries(TROOPS.map(t => [t.key, t])) as Record<TroopKey, TroopDef>

/** 克制加成系数 */
export const COUNTER_BONUS = TUNE.counterBonus

// ── 修士（英雄）──
// ⚠️ 角色名为原著占位符，对外发布前必须替换为原创角色（README 决策1）
// baseBonus 与 balance.ts 的 expectedPower 里那条「修士加成」假设保持同量级，
// 改这里要同步改那边，否则关卡难度锚点会失准。
export const CULTIVATORS: CultivatorDef[] = [
  {
    key: 'hanli', name: '韩立（占位）', spec: 'kuilei',
    desc: '谨慎多疑的散修，精于傀儡之道。', sprite: 'cultivator/hanli.svg',
    rarity: 3, baseBonus: 0.06,
  },
  {
    key: 'nangongwan', name: '南宫婉（占位）', spec: 'fuxiu',
    desc: '符箓之道精深，符阵齐射无往不利。', sprite: 'cultivator/nangongwan.svg',
    rarity: 3, baseBonus: 0.06,
  },
  {
    key: 'danxiu', name: '丹修·青元', spec: 'yushou',
    desc: '以丹药温养灵兽，御兽冲阵愈勇。', sprite: 'cultivator/danxiu.svg',
    rarity: 2, baseBonus: 0.04,
  },
  {
    key: 'zhenxiu', name: '阵修·墨岩', spec: 'kuilei',
    desc: '布阵而战，傀儡结阵坚不可摧。', sprite: 'cultivator/zhenxiu.svg',
    rarity: 2, baseBonus: 0.04,
  },
]

export const CULTIVATOR_MAP = Object.fromEntries(
  CULTIVATORS.map(c => [c.key, c]),
) as Record<string, CultivatorDef>

export { cultivatorUpCost as cultivatorCost, CULTIVATOR_MAX_LEVEL } from './balance'

/** 修士等级提供的加成 = baseBonus * level */
export function cultivatorBonus(def: CultivatorDef, level: number): number {
  return def.baseBonus * level
}

// ── 秘境关卡（PvE 推图，对应无尽冬日的远征）──
// 40 关 / 8 章。难度与奖励全部由 balance.ts 的曲线生成，
// 这里只配章节主题与关卡文案 —— 手写数值必然与模拟器验证过的曲线脱节。
const CHAPTERS: { name: string; sprite: string; flavor: string[] }[] = [
  { name: '青牛谷', sprite: 'monster/ch1-serpent.svg', flavor: ['初入秘境，几只低阶妖兽游荡其间。', '灵泉旁盘踞着守泉的妖蟒。', '前人遗留的洞府，机关仍在运转。', '谷底雾气翻涌，隐有兽吼。', '谷主遗蜕所在，煞气未散。'] },
  { name: '乱星海', sprite: 'monster/ch2-leviathan.svg', flavor: ['浓雾遮蔽视野，妖兽借雾突袭。', '沉没的修士渡船，怨灵未散。', '暗礁间游弋着成群的水属妖兽。', '漩涡深处传来低沉的鸣声。', '海眼之下，一头巨物正在苏醒。'] },
  { name: '落霞涧', sprite: 'monster/ch3-firebird.svg', flavor: ['晚霞如血，涧中灵禽盘旋。', '断桥残骸下埋着旧日战场。', '火灵之气灼人，寻常修士难以久留。', '崖壁洞窟中传出铁器交击声。', '涧主是一头炼就内丹的赤焰雕。'] },
  { name: '太岳山脉', sprite: 'monster/ch4-ape.svg', flavor: ['山道崎岖，土属妖兽善于伏击。', '古老的封印石碑已现裂痕。', '矿洞深处，傀儡守卫仍在巡逻。', '山腹中埋藏着上古阵法枢纽。', '镇山巨猿，力可裂石。'] },
  { name: '万毒岭', sprite: 'monster/ch5-hydra.svg', flavor: ['瘴气弥漫，草木皆有剧毒。', '毒虫成群，防不胜防。', '腐尸遍野，此处曾有大战。', '毒潭中央立着一座残破祭坛。', '万毒之主，一条九头毒蟒。'] },
  { name: '幽冥谷', sprite: 'monster/ch6-undead.svg', flavor: ['阴气森然，日光照不进来。', '鬼修的残魂在谷中游荡。', '枯骨堆成小山，怨念不散。', '幽冥井直通地脉，寒气刺骨。', '谷中主宰是一具化形阴尸。'] },
  { name: '天南废墟', sprite: 'monster/ch7-warpuppet.svg', flavor: ['昔日仙城，如今只剩断壁。', '废墟下的宝库仍有禁制。', '守城傀儡历经千年仍未停止运转。', '城主府邸中残留着结丹级威压。', '废墟核心，一尊上古战傀苏醒。'] },
  { name: '星落原', sprite: 'monster/ch8-starbeast.svg', flavor: ['陨石遍布，天地灵气紊乱。', '星力凝成的异兽在原野游荡。', '陨坑深处埋着一件残破法宝。', '星陨之夜，异兽尽数狂化。', '原野尽头，坠星所化的凶物盘踞于此。'] },
]

const STAGE_SUFFIX = ['外围', '深处', '秘窟', '绝地', '核心']
/** 敌方兵种按固定顺序轮换，保证每章都覆盖三种克制关系 */
const ENEMY_ROTATION: TroopKey[] = ['yushou', 'kuilei', 'fuxiu']
/** 章节首领关（每章第 5 关）解锁的修士 */
const STAGE_UNLOCK: Record<number, string> = { 5: 'danxiu', 15: 'zhenxiu', 25: 'nangongwan' }

export const STAGES: StageDef[] = Array.from({ length: 40 }, (_, i) => {
  const id = i + 1
  const chapterIdx = Math.floor(i / 5)
  const ch = CHAPTERS[chapterIdx]
  const sub = i % 5
  return {
    id,
    chapter: chapterIdx + 1,
    chapterName: ch.name,
    sprite: ch.sprite,
    name: `${ch.name}·${STAGE_SUFFIX[sub]}`,
    desc: ch.flavor[sub],
    enemyPower: stageEnemyPower(id),
    enemyTroop: ENEMY_ROTATION[i % 3],
    reward: stageReward(id),
    unlockCultivator: STAGE_UNLOCK[id],
    anchorDongfu: stageDongfuAnchor(id),
  }
})

/**
 * 洞府外观随等级分三档。
 * 主建筑在屏幕正中，是玩家最常看的东西；等级变了外观不变，
 * 升级的成就感会大打折扣 —— 这是 SLG 的标准做法。
 */
export function dongfuSprite(level: number): string {
  if (level >= 16) return 'building/dongfu-t3.svg'
  if (level >= 8) return 'building/dongfu-t2.svg'
  return 'building/dongfu.svg'
}

export { INITIAL_RESOURCES } from './balance'
