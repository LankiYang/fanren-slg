// ═══ 数值审计 ═══
//
// 节奏模拟器回答「跑起来是不是那个节奏」，但它验不出算术自相矛盾、量纲冲突、
// 跨模块定义不一致这类问题 —— 模拟器只会把错的数一路算下去，全程「绿」。
// 这一轮专门逐项交叉核对，宁可误报也不漏报。
//
// 跑法：npm run audit

import {
  TUNE, REALM_SPECS, TROOP_SPECS, TROOP_FILL_RATE, BOSS,
  BUILDING_UNLOCK, INITIAL_BUILDING_LEVEL, INITIAL_RESOURCES,
  DONGFU_PREREQ_COUNT,
  buildTimeMs, buildCost, prodPerSec, storageCap, troopCap, realmCost,
  expectedPower, stageDongfuAnchor, stageReward,
  bossHp, newbieDiscount, cultivatorUpCost, CULTIVATOR_MAX_LEVEL,
} from '../src/game/balance'
import { BUILDINGS, CULTIVATORS, STAGES, REALMS, TROOPS } from '../src/game/data'
import { QUESTS } from '../src/game/quests'
import {
  GONGFA, GONGFA_MAP, gongfaCost,
  PILLS, pillCost,
  ARTIFACTS, artifactCost,
} from '../src/game/systems'
import type { ResourceKey } from '../src/game/types'

const RES: ResourceKey[] = ['lingshi', 'lingqi', 'lingyao', 'kuanglingcai']
const issues: { sev: 'FATAL' | 'WARN'; where: string; what: string }[] = []
const fatal = (where: string, what: string) => issues.push({ sev: 'FATAL', where, what })
const warn = (where: string, what: string) => issues.push({ sev: 'WARN', where, what })

// ── 1. 死锁类：任何一条成立就必然卡死 ──
for (let L = 1; L < TUNE.dongfuMax; L++) {
  const cap = storageCap(L)
  const cost = buildCost(true, L + 1)
  for (const k of RES) {
    if ((cost[k] ?? 0) > cap) {
      fatal('仓库/成本', `洞府 ${L}→${L + 1} 需 ${k} ${Math.round(cost[k]!)} > 仓库 ${cap}`)
    }
  }
}
for (let tier = 1; tier < REALM_SPECS.length; tier++) {
  const cap = storageCap(REALM_SPECS[tier].gate)
  const cost = realmCost(tier)
  for (const k of RES) {
    if ((cost[k] ?? 0) > cap) {
      fatal('仓库/突破', `突破「${REALM_SPECS[tier].name}」需 ${k} ${Math.round(cost[k]!)} > 仓库 ${cap}`)
    }
  }
}
for (const k of RES) {
  if (INITIAL_RESOURCES[k] > storageCap(INITIAL_BUILDING_LEVEL.dongfu ?? 1)) {
    fatal('开局资源', `${k} ${INITIAL_RESOURCES[k]} 超过 1 级仓库，一进游戏就蒸发`)
  }
}
{
  const producers = BUILDINGS.filter(b => b.produces).map(b => b.key)
  const produced = new Set(BUILDINGS.map(b => b.produces).filter(Boolean))
  for (const k of RES) if (!produced.has(k)) fatal('资源产出', `${k} 没有任何产出建筑`)
  for (const p of producers) {
    if ((INITIAL_BUILDING_LEVEL[p] ?? 0) < 1) fatal('开局建筑', `产出建筑 ${p} 开局 0 级`)
    if ((BUILDING_UNLOCK[p] ?? 0) > 0) fatal('解锁门槛', `产出建筑 ${p} 解锁门槛 > 0，有死锁风险`)
  }
  if (DONGFU_PREREQ_COUNT > producers.length) {
    fatal('洞府前置', `要求 ${DONGFU_PREREQ_COUNT} 座产出建筑达标，但只有 ${producers.length} 座`)
  }
}

// ── 2. 跨模块一致性：同一个概念在两处必须是同一个数 ──
if (REALMS.length !== REALM_SPECS.length) {
  fatal('境界表', `data.REALMS(${REALMS.length}) 与 balance.REALM_SPECS(${REALM_SPECS.length}) 数量不一致`)
}
REALMS.forEach((r, i) => {
  const spec = REALM_SPECS[i]
  if (r.name !== spec.name) fatal('境界表', `第 ${i} 档名称不一致：${r.name} vs ${spec.name}`)
  if (r.requiresDongfu !== spec.gate) fatal('境界表', `${r.name} 门槛不一致：${r.requiresDongfu} vs ${spec.gate}`)
})
if (TROOPS.length !== TROOP_SPECS.length) fatal('兵种表', '数量不一致')
TROOPS.forEach(t => {
  const spec = TROOP_SPECS.find(x => x.key === t.key)
  if (!spec) { fatal('兵种表', `${t.key} 在 balance 中不存在`); return }
  if (t.power !== spec.power) fatal('兵种表', `${t.name} 战力不一致：${t.power} vs ${spec.power}`)
  if (t.counters !== spec.counters) fatal('兵种表', `${t.name} 克制关系不一致`)
})

// ── 3. 克制关系必须是闭合三角，不能有单向或自克 ──
{
  const map = new Map(TROOP_SPECS.map(t => [t.key, t.counters]))
  for (const t of TROOP_SPECS) {
    if (t.counters === t.key) fatal('克制', `${t.key} 克自己`)
  }
  // 从任一点出发走三步应回到原点
  const start = TROOP_SPECS[0].key
  let cur = start
  for (let i = 0; i < TROOP_SPECS.length; i++) cur = map.get(cur)!
  if (cur !== start) fatal('克制', `克制链不闭合，从 ${start} 走 ${TROOP_SPECS.length} 步到了 ${cur}`)
  if (new Set(TROOP_SPECS.map(t => t.counters)).size !== TROOP_SPECS.length) {
    fatal('克制', '存在两个兵种克制同一目标，三角不成立')
  }
}

// ── 4. 单调性：该递增的必须严格递增 ──
for (let n = 2; n <= TUNE.dongfuMax; n++) {
  const a = buildCost(true, n - 1).lingshi ?? 0
  const b = buildCost(true, n).lingshi ?? 0
  if (b <= a) fatal('成本曲线', `洞府成本非递增：${n - 1} 级 ${a} → ${n} 级 ${b}`)
}
for (let L = 2; L <= TUNE.dongfuMax; L++) {
  if (prodPerSec(L) <= prodPerSec(L - 1)) fatal('产出曲线', `产出非递增于 ${L} 级`)
  if (storageCap(L) <= storageCap(L - 1)) fatal('仓库曲线', `仓库非递增于 ${L} 级`)
}
for (let i = 1; i < REALM_SPECS.length; i++) {
  if (REALM_SPECS[i].gate < REALM_SPECS[i - 1].gate) {
    fatal('境界门槛', `${REALM_SPECS[i].name} 门槛低于前一档`)
  }
  if (REALM_SPECS[i].output <= REALM_SPECS[i - 1].output) fatal('境界乘区', `${REALM_SPECS[i].name} 产出乘区非递增`)
  if (REALM_SPECS[i].power <= REALM_SPECS[i - 1].power) fatal('境界乘区', `${REALM_SPECS[i].name} 战力乘区非递增`)
}
for (let i = 1; i < STAGES.length; i++) {
  if (STAGES[i].enemyPower < STAGES[i - 1].enemyPower) {
    fatal('关卡曲线', `第 ${STAGES[i].id} 关敌方战力低于前一关`)
  }
}

// ── 5. 新手折扣不能把成本弄成非单调或负数 ──
for (let n = 1; n <= TUNE.newbieDiscountUntil + 1; n++) {
  const d = newbieDiscount(n)
  if (d <= 0 || d > 1) fatal('新手折扣', `${n} 级折扣系数 ${d} 越界`)
}
if (newbieDiscount(TUNE.newbieDiscountUntil) !== 1) {
  warn('新手折扣', `到 ${TUNE.newbieDiscountUntil} 级才回归原价，检查是否符合预期`)
}

// ── 6. 关卡难度 vs 期望战力：不能出现卡死或碾压 ──
for (const st of STAGES) {
  const exp = expectedPower(st.anchorDongfu)
  const ratio = st.enemyPower / exp
  if (ratio > 1.15) fatal('关卡难度', `第 ${st.id} 关敌方战力是期望战力的 ${ratio.toFixed(2)} 倍（过难）`)
  if (ratio < 0.35) warn('关卡难度', `第 ${st.id} 关敌方战力仅为期望的 ${ratio.toFixed(2)} 倍（过易）`)
}

// ── 7. 关卡锚点不能超出洞府上限，否则最后几关永远打不了 ──
{
  const maxAnchor = stageDongfuAnchor(STAGES.length)
  if (maxAnchor > TUNE.dongfuMax) {
    fatal('关卡锚点', `末关锚定洞府 ${maxAnchor} 级，超过上限 ${TUNE.dongfuMax}`)
  }
}

// ── 8. 量纲检查：时间单位混用是最容易犯又最难发现的错 ──
{
  const t1 = buildTimeMs(true, 1)
  if (t1 < 1000) fatal('量纲', `buildTimeMs 返回 ${t1}，看起来是秒而不是毫秒`)
  const capped = buildTimeMs(true, TUNE.dongfuMax)
  if (capped > TUNE.maxBuildHours * 3600 * 1000) {
    fatal('量纲', `建造时长 ${capped}ms 超过 maxBuildHours 封顶，说明封顶没生效`)
  }
  if (TUNE.offlineCapHours <= 0 || TUNE.offlineCapHours > 72) {
    warn('离线', `offlineCapHours=${TUNE.offlineCapHours} 取值可疑`)
  }
  if (TUNE.offlineRate <= 0 || TUNE.offlineRate > 1) {
    fatal('离线', `offlineRate=${TUNE.offlineRate} 必须落在 (0,1]`)
  }
}

// ── 9. 修士加成：balance 的假设与 data 的实配必须同量级 ──
{
  // expectedPower 里假定「修士加成 = 1 + 0.06 × floor(洞府/2)」
  const assumedPerStep = 0.06
  const actualMax = Math.max(...CULTIVATORS.map(c => c.baseBonus))
  if (Math.abs(actualMax - assumedPerStep) > 0.02) {
    fatal('修士加成', `expectedPower 假设每级 ${assumedPerStep}，但 data 里最高 baseBonus=${actualMax}，关卡锚点会失准`)
  }
  // 满级修士加成不能离谱
  const maxTotal = actualMax * CULTIVATOR_MAX_LEVEL
  if (maxTotal > 2.0) {
    warn('修士加成', `满级单个修士加成 +${(maxTotal * 100).toFixed(0)}%，可能过强`)
  }
  for (const c of CULTIVATORS) {
    if (!TROOP_SPECS.some(t => t.key === c.spec)) {
      fatal('修士专精', `${c.name} 的专精 ${c.spec} 不是有效兵种`)
    }
  }
}

// ── 10. 兵力上限与资源的匹配：练满兵不能贵到离谱或便宜到无意义 ──
for (let L = 3; L <= TUNE.dongfuMax; L++) {
  const cap = troopCap(L - 1) * TROOP_FILL_RATE
  const perTroop = TROOP_SPECS.reduce(
    (s, t) => s + Object.values(t.cost).reduce((a, b) => a + (b ?? 0), 0), 0,
  ) / TROOP_SPECS.length
  const total = cap * perTroop
  const storage = storageCap(L) * RES.length
  const ratio = total / storage
  if (ratio > 6) warn('兵力成本', `洞府 ${L} 级练满 ${TROOP_FILL_RATE * 100}% 兵力需 ${Math.round(total)}，是满仓总量的 ${ratio.toFixed(1)} 倍`)
}

// ── 11. 合围妖兽：必须打得动但打不满，否则协作叙事不成立 ──
for (let L = 7; L <= TUNE.dongfuMax; L++) {
  const hp = bossHp(L)
  const solo = expectedPower(L)
  const withNpc = solo + hp * BOSS.npcContribution
  if (withNpc >= hp * 1.6) warn('合围妖兽', `洞府 ${L} 级时轻易击杀（伤害达血量 ${(withNpc / hp).toFixed(2)} 倍）`)
  if (withNpc < hp * 0.35) warn('合围妖兽', `洞府 ${L} 级时伤害仅 ${(withNpc / hp).toFixed(2)} 倍血量，奖励档位过低`)
}
if (BOSS.npcContribution >= 1) fatal('合围妖兽', 'NPC 贡献 ≥ 100%，玩家参不参与都一样')
{
  const ratios = BOSS.tiers.map(t => t.minRatio)
  for (let i = 1; i < ratios.length; i++) {
    if (ratios[i] >= ratios[i - 1]) fatal('合围档位', '奖励档位的 minRatio 必须严格递减')
  }
}

// ── 12. 成长任务：目标必须可达，奖励不能倒挂 ──
for (const q of QUESTS) {
  if (q.rewardRatio <= 0 || q.rewardRatio > 2) warn('任务奖励', `${q.name} rewardRatio=${q.rewardRatio} 可疑`)
}
{
  const ratios = QUESTS.map(q => q.rewardRatio)
  for (let i = 1; i < ratios.length; i++) {
    if (ratios[i] < ratios[i - 1]) {
      warn('任务奖励', `第 ${i + 1} 条「${QUESTS[i].name}」奖励比例低于前一条，后期任务反而更不值`)
    }
  }
}

// ── 13. 关卡奖励不能一次顶满仓，否则仓库机制失效 ──
for (const st of STAGES) {
  const cap = storageCap(st.anchorDongfu)
  const rw = stageReward(st.id)
  for (const k of RES) {
    if ((rw[k] ?? 0) > cap * 0.6) {
      warn('关卡奖励', `第 ${st.id} 关 ${k} 奖励 ${Math.round(rw[k]!)} 超过仓库 60%，仓库形同虚设`)
    }
  }
}

// ── 14. 修士升级成本不能超过仓库 ──
{
  const maxCost = cultivatorUpCost(CULTIVATOR_MAX_LEVEL)
  const capAtMax = storageCap(TUNE.dongfuMax)
  for (const k of RES) {
    if ((maxCost[k] ?? 0) > capAtMax) {
      fatal('修士成本', `满级修士升级需 ${k} ${Math.round(maxCost[k]!)} > 最高仓库 ${capAtMax}`)
    }
  }
}

// ── 15. 功法：成本要跟得上仓库，增益不能失控 ──
for (const g of GONGFA) {
  const maxBonus = g.perLevel * g.maxLevel
  if (maxBonus > 1.5) warn('功法', `${g.name} 满级 +${(maxBonus * 100).toFixed(0)}%，可能过强`)
  if (g.requires > TUNE.dongfuMax) fatal('功法', `${g.name} 需藏经阁 ${g.requires} 级，超过洞府上限`)
  // 满级消耗必须装得下
  const cost = gongfaCost(g.maxLevel)
  const cap = storageCap(TUNE.dongfuMax)
  for (const k of RES) {
    if ((cost[k] ?? 0) > cap) {
      fatal('功法', `${g.name} 满级研究需 ${k} ${Math.round(cost[k]!)} > 最高仓库 ${cap}`)
    }
  }
}
{
  // 「俭物诀」减免不能到 100%，否则建造免费
  const costCut = GONGFA_MAP['b_cost']
  if (costCut && costCut.perLevel * costCut.maxLevel >= 1) {
    fatal('功法', '俭物诀满级减免 ≥100%，建造将免费')
  }
}

// ── 16. 丹药：增益与时长的组合不能让玩家永久挂着 ──
for (const p of PILLS) {
  if (p.effect <= 1) fatal('丹药', `${p.name} 增益 ${p.effect} ≤ 1，服下无效`)
  if (p.effect > 2.5) warn('丹药', `${p.name} 增益 ×${p.effect} 偏高`)
  // 炼制耗时必须短于生效时长，否则永远接不上（但也不该短太多，那样可以无限叠）
  const craftH = p.craftMinutes / 60
  if (craftH >= p.hours) {
    warn('丹药', `${p.name} 炼制 ${craftH.toFixed(1)}h ≥ 生效 ${p.hours}h，无法持续覆盖`)
  }
  if (craftH < p.hours / 12) {
    warn('丹药', `${p.name} 炼制过快（${craftH.toFixed(2)}h vs 生效 ${p.hours}h），可无限囤积永久生效`)
  }
}

// ── 17. 法宝：加成与覆盖面 ──
{
  const covered = new Set(ARTIFACTS.filter(a => a.spec).map(a => a.spec))
  for (const t of TROOP_SPECS) {
    if (!covered.has(t.key) && !ARTIFACTS.some(a => a.spec === null)) {
      warn('法宝', `兵种 ${t.key} 没有任何法宝加成，与其他兵种不对等`)
    }
  }
  for (const a of ARTIFACTS) {
    const maxBonus = a.perLevel * a.maxLevel
    if (maxBonus > 2) warn('法宝', `${a.name} 满阶 +${(maxBonus * 100).toFixed(0)}%，可能过强`)
    const cost = artifactCost(a.maxLevel)
    const cap = storageCap(TUNE.dongfuMax)
    for (const k of RES) {
      if ((cost[k] ?? 0) > cap) {
        fatal('法宝', `${a.name} 满阶需 ${k} ${Math.round(cost[k]!)} > 最高仓库 ${cap}`)
      }
    }
  }
}

// ── 18. 三系统的资源去向必须分化，否则四种资源没有存在意义 ──
{
  const sinks: Record<string, Set<string>> = {}
  const note = (sys: string, cost: Partial<Record<ResourceKey, number>>) => {
    for (const k of RES) if ((cost[k] ?? 0) > 0) (sinks[k] ??= new Set()).add(sys)
  }
  note('建造', buildCost(true, 5))
  note('突破', realmCost(5))
  note('功法', gongfaCost(5))
  note('丹药', pillCost(5))
  note('法宝', artifactCost(5))
  for (const t of TROOP_SPECS) note('练兵', t.cost)
  for (const k of RES) {
    if (!sinks[k] || sinks[k].size === 0) fatal('资源去向', `${k} 没有任何消耗去向`)
    else if (sinks[k].size === 1) warn('资源去向', `${k} 只有「${[...sinks[k]][0]}」一个去向，缺乏分化`)
  }
}

// ══ 输出 ══
console.log('\n══════ 数值审计 ══════\n')
const fatals = issues.filter(i => i.sev === 'FATAL')
const warns = issues.filter(i => i.sev === 'WARN')

if (fatals.length > 0) {
  console.log(`❌ 致命 ${fatals.length} 条：`)
  for (const i of fatals) console.log(`   [${i.where}] ${i.what}`)
  console.log('')
}
if (warns.length > 0) {
  console.log(`⚠️  警告 ${warns.length} 条：`)
  for (const i of warns) console.log(`   [${i.where}] ${i.what}`)
  console.log('')
}
const CHECK_COUNT = 18
if (issues.length === 0) console.log(`✅ ${CHECK_COUNT} 类检查全部通过\n`)
else console.log(`共检出 ${fatals.length} 致命 / ${warns.length} 警告\n`)

process.exit(fatals.length > 0 ? 1 : 0)
