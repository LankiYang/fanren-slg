// ═══ 节奏模拟器 ═══
//
// 模拟一个「正常活跃玩家」30 天的发育曲线，用来验证 balance.ts 的数值是否达标。
// 与游戏共用 balance.ts，不会出现「模拟器算一套、线上跑另一套」。
//
// 跑法：npm run sim
//
// 它回答的问题：
//   1. D1/D3/D7/D14/D30 玩家到什么境界、什么战力？落在目标区间吗？
//   2. 玩家是「资源卡」还是「时间卡」？前期该资源卡、后期该时间卡。
//   3. 有没有断档（某段时间无事可做）或卡死（永远攒不够）？

import {
  TUNE, REALM_SPECS, TROOP_SPECS, TROOP_FILL_RATE,
  BUILDING_UNLOCK, INITIAL_BUILDING_LEVEL, INITIAL_RESOURCES, canUpgradeDongfu,
  buildTimeMs, buildCost, prodPerSec, storageCap, troopCap, marchCap,
  realmCost, expectedPower, stageEnemyPower, stageDongfuAnchor,
} from '../src/game/balance'
import type { ResourceKey } from '../src/game/types'

// ── 玩家行为假设 ──
const PLAY = {
  /** 每天上线次数（均匀分布在清醒的 16 小时里） */
  sessionsPerDay: 5,
  /**
   * 单次在线停留时长（分钟）。
   * 这条假设很关键：玩家不是「填满队列就走」，而是会盯着队列，完成一个补一个。
   * 前期建造是秒级的，一次停留能连点十几次；后期建造按小时计，停留期内补不了几次。
   * 首版漏掉这条，导致前期被人为拖慢（D1 只到洞府 3）。
   */
  sessionMinutes: 8,
  /** 清醒时段长度（小时）—— 夜间 8 小时按离线算 */
  awakeHours: 16,
  /** 模拟总天数 */
  days: 30,
  /** 每步长（秒）*/
  stepSec: 60,
}

// ── 达标区间（立项会要能说清「为什么是这个节奏」）──
// ⚠️ 目标里的「境界」必须和「洞府区间」自洽：境界有洞府门槛，
// 写一个在该洞府区间下限根本达不到的境界，这条目标就永远不可能通过。
// 首版 D1 写「洞府 5~7 + 炼气大圆满」就是这个错——炼气大圆满门槛是洞府 6，
// 洞府 5 时无论如何都突破不了。下面每行都按 REALM_SPECS 的 gate 核对过。
const TARGETS = [
  // 洞府 5~7 → 可达 tier4(gate5) ~ tier5(gate6)
  { day: 1, realmName: '炼气九层', dongfuMin: 5, dongfuMax: 7 },
  // 洞府 8~10 → 可达 tier6(gate8) ~ tier7(gate10)
  { day: 3, realmName: '筑基初期', dongfuMin: 8, dongfuMax: 10 },
  // 洞府 11~14 → 可达 tier7(gate10) ~ tier8(gate12)
  { day: 7, realmName: '筑基后期', dongfuMin: 11, dongfuMax: 14 },
  // 洞府 15~18 → 可达 tier9(gate15) ~ tier10(gate18)
  { day: 14, realmName: '结丹初期', dongfuMin: 15, dongfuMax: 18 },
  // 洞府 20~24 → 可达 tier10(gate18) ~ tier12(gate24)
  { day: 30, realmName: '结丹后期', dongfuMin: 20, dongfuMax: 24 },
]

type Res = Record<ResourceKey, number>
const RES_KEYS: ResourceKey[] = ['lingshi', 'lingqi', 'lingyao', 'kuanglingcai']

/** 产出建筑 → 产什么资源 */
const PRODUCERS: { key: string; res: ResourceKey }[] = [
  { key: 'juling', res: 'lingqi' },
  { key: 'lingtian', res: 'lingyao' },
  { key: 'kuangmai', res: 'kuanglingcai' },
  { key: 'fangshi', res: 'lingshi' },
]
/** 非产出建筑（也要占建造队列与资源） */
const SUPPORT = ['yanwu', 'liandan', 'lianqi', 'cangjing', 'zongmen']
/** 解锁门槛与初始状态直接取自 balance.ts，避免模拟器与游戏各配一套 */
const UNLOCK = BUILDING_UNLOCK

interface Sim {
  t: number                       // 秒
  res: Res
  lv: Record<string, number>      // 建筑等级（含 dongfu）
  realm: number
  troops: number                  // 简化为总兵数（模拟器只关心战力量级）
  queues: { until: number; key: string }[]
  // 统计
  blockedByRes: number            // 想建但资源不够的步数
  blockedByTime: number           // 队列全忙的步数
  cappedSteps: Partial<Record<ResourceKey, number>> // 各资源满仓步数
  cappedEarly: number             // 前 7 天满仓计数（4 种资源累加）
  cappedLate: number              // 第 8 天起满仓计数
  sessionEnd: number              // 当前这次在线停留的结束时刻（秒）
  log: { day: number; dongfu: number; realm: string; power: number; stage: number }[]
  stage: number
}

function newSim(): Sim {
  const lv: Record<string, number> = {}
  for (const k of ['dongfu', ...PRODUCERS.map(p => p.key), ...SUPPORT]) {
    lv[k] = INITIAL_BUILDING_LEVEL[k] ?? 0
  }
  return {
    t: 0,
    res: { ...INITIAL_RESOURCES },
    lv, realm: 0, troops: 0,
    queues: [],
    blockedByRes: 0, blockedByTime: 0, cappedSteps: {}, cappedEarly: 0, cappedLate: 0,
    sessionEnd: -1,
    log: [], stage: 0,
  }
}

const QUEUE_COUNT = 2   // 1 条免费 + 1 条（VIP/道具解锁），模拟器按已解锁算

function canAfford(res: Res, cost: Partial<Res>): boolean {
  return RES_KEYS.every(k => res[k] >= (cost[k] ?? 0))
}
function pay(res: Res, cost: Partial<Res>) {
  for (const k of RES_KEYS) res[k] -= cost[k] ?? 0
}

/**
 * 当前可投入战斗的战力。
 *
 * ⚠️ 受「统兵上限」约束：拥有的兵多于一次能带走的兵，
 * 所以这里取 min(拥有, marchCap)，不能直接用总兵数 ——
 * 否则模拟器会认为玩家能全军压上，推出比实际更乐观的推图进度。
 */
function power(s: Sim): number {
  const avgUnit = TROOP_SPECS.reduce((a, t) => a + t.power, 0) / TROOP_SPECS.length
  const realmMul = REALM_SPECS[s.realm].power
  const cultivatorBonus = 1 + 0.06 * Math.floor(s.lv.dongfu / 2)
  const fielded = Math.min(s.troops, marchCap(s.lv.yanwu))
  return fielded * avgUnit * realmMul * cultivatorBonus
}

/** 玩家的升级优先级：先保洞府（解门槛），再补产出建筑，最后功能建筑 */
function pickUpgrade(s: Sim): string | null {
  const d = s.lv.dongfu
  const building = new Set(s.queues.map(q => q.key))
  const producerLevels = PRODUCERS.map(p => s.lv[p.key])
  const dongfuReady = canUpgradeDongfu(producerLevels, d + 1)

  // 1) 洞府：若它正卡着下一个境界门槛，优先升（前提是配套建筑已达标）
  const nextRealm = REALM_SPECS[s.realm + 1]
  const dongfuUrgent = nextRealm && d < nextRealm.gate
  if (dongfuUrgent && dongfuReady && !building.has('dongfu') && d < TUNE.dongfuMax) return 'dongfu'

  // 2) 产出建筑：等级落后洞府的先升（洞府封顶）
  const producers = PRODUCERS
    .filter(p => d >= UNLOCK[p.key] && !building.has(p.key) && s.lv[p.key] < d)
    .sort((a, b) => s.lv[a.key] - s.lv[b.key])
  if (producers.length > 0) return producers[0].key

  // 3) 功能建筑（演武场优先，它决定兵力上限）
  const support = SUPPORT
    .filter(k => d >= UNLOCK[k] && !building.has(k) && s.lv[k] < d)
    .sort((a, b) => (a === 'yanwu' ? -1 : b === 'yanwu' ? 1 : s.lv[a] - s.lv[b]))
  if (support.length > 0) return support[0]

  // 4) 都满了就继续推洞府（同样要满足前置）
  if (dongfuReady && !building.has('dongfu') && d < TUNE.dongfuMax) return 'dongfu'
  return null
}

function run(): Sim {
  const s = newSim()
  const totalSteps = (PLAY.days * 86400) / PLAY.stepSec
  const sessionGapSec = (PLAY.awakeHours * 3600) / PLAY.sessionsPerDay

  for (let step = 0; step < totalSteps; step++) {
    s.t += PLAY.stepSec
    const hourOfDay = (s.t % 86400) / 3600
    const awake = hourOfDay < PLAY.awakeHours
    const cap = storageCap(s.lv.dongfu)

    // ── 资源产出 ──
    const realmOut = REALM_SPECS[s.realm].output
    for (const p of PRODUCERS) {
      const rate = prodPerSec(s.lv[p.key]) * realmOut * (awake ? 1 : TUNE.offlineRate)
      s.res[p.res] = Math.min(cap, s.res[p.res] + rate * PLAY.stepSec)
      if (s.res[p.res] >= cap - 1e-6) {
        s.cappedSteps[p.res] = (s.cappedSteps[p.res] ?? 0) + 1
        // 分段统计：前期满仓是设计意图（仓库小、催上线），后期满仓才是产出过剩的信号
        if (s.t < 7 * 86400) s.cappedEarly++
        else s.cappedLate++
      }
    }

    // ── 建造完成结算 ──
    s.queues = s.queues.filter(q => {
      if (s.t >= q.until) { s.lv[q.key] += 1; return false }
      return true
    })

    // ── 玩家操作：上线后会停留一段时间，期间完成一个补一个 ──
    if (awake && (s.t % Math.round(sessionGapSec)) < PLAY.stepSec) {
      s.sessionEnd = s.t + PLAY.sessionMinutes * 60
    }
    const isSession = awake && s.t <= s.sessionEnd
    if (isSession) {
      // 反复尝试，直到队列满或买不起
      for (let guard = 0; guard < 20; guard++) {
        if (s.queues.length >= QUEUE_COUNT) { s.blockedByTime++; break }
        const key = pickUpgrade(s)
        if (!key) break
        const isDongfu = key === 'dongfu'
        const target = s.lv[key] + 1
        const cost = buildCost(isDongfu, target)
        if (!canAfford(s.res, cost)) { s.blockedByRes++; break }
        pay(s.res, cost)
        s.queues.push({ key, until: s.t + buildTimeMs(isDongfu, target) / 1000 })
      }

      // ── 境界突破 ──
      const nr = REALM_SPECS[s.realm + 1]
      if (nr && s.lv.dongfu >= nr.gate) {
        const c = realmCost(s.realm + 1)
        if (canAfford(s.res, c)) { pay(s.res, c); s.realm++ }
      }

      // ── 练兵 ──
      // 策略：按需练兵。打不过下一关时优先补兵（真实玩家就是这么做的），
      // 否则只用富余资源慢慢囤。首版让建造无条件优先，结果兵永远起不来、
      // 秘境从 D3 到 D14 卡在第 4 关不动——那是策略失真，不是关卡太难。
      const tcap = troopCap(s.lv.yanwu)
      const want = Math.floor(tcap * TROOP_FILL_RATE) - s.troops
      if (want > 0) {
        const needMore = s.stage < 40 && power(s) < stageEnemyPower(s.stage + 1)
        // 急need时几乎倾尽资源，不急时预留六成仓容给建造
        const reserve = needMore ? cap * 0.08 : cap * 0.60
        const roundCost: Partial<Res> = {}
        for (const spec of TROOP_SPECS) {
          for (const k of RES_KEYS) roundCost[k] = (roundCost[k] ?? 0) + (spec.cost[k] ?? 0)
        }
        const rounds = Math.min(
          Math.ceil(want / TROOP_SPECS.length),
          ...RES_KEYS.map(k => {
            const c = roundCost[k] ?? 0
            if (c === 0) return Infinity
            return Math.max(0, Math.floor((s.res[k] - reserve) / c))
          }),
        )
        if (rounds > 0 && Number.isFinite(rounds)) {
          for (const k of RES_KEYS) s.res[k] -= (roundCost[k] ?? 0) * rounds
          s.troops += rounds * TROOP_SPECS.length
        }
      }

      // ── 推秘境：能打赢就推，打不过就停 ──
      for (let guard = 0; guard < 50; guard++) {
        const next = s.stage + 1
        if (next > 40) break
        if (power(s) >= stageEnemyPower(next)) s.stage = next
        else break
      }
    }

    // ── 每日快照 ──
    if (s.t % 86400 === 0) {
      s.log.push({
        day: s.t / 86400,
        dongfu: s.lv.dongfu,
        realm: REALM_SPECS[s.realm].name,
        power: Math.round(power(s)),
        stage: s.stage,
      })
    }
  }
  return s
}

// ══ 结构性不变量自检 ══
// 这些是「违反了必然卡死」的硬约束，与调参无关。
// 调参过程中已经踩中过两次死锁，所以固化成断言，改坏了立刻报错而不是等 30 天模拟跑完才发现。
function checkInvariants(): string[] {
  const errs: string[] = []

  // 1) 仓库必须装得下下一级洞府开销，否则满仓也买不起
  for (let L = 1; L < TUNE.dongfuMax; L++) {
    const cap = storageCap(L)
    const cost = buildCost(true, L + 1)
    for (const k of RES_KEYS) {
      if ((cost[k] ?? 0) > cap) {
        errs.push(`洞府 ${L}→${L + 1} 需 ${k} ${Math.round(cost[k]!)}，超过仓库上限 ${cap}（必然卡死）`)
      }
    }
  }

  // 2) 突破消耗也必须装得下
  for (let tier = 1; tier < REALM_SPECS.length; tier++) {
    const gate = REALM_SPECS[tier].gate
    const cap = storageCap(gate)
    const cost = realmCost(tier)
    for (const k of RES_KEYS) {
      if ((cost[k] ?? 0) > cap) {
        errs.push(`突破「${REALM_SPECS[tier].name}」需 ${k} ${Math.round(cost[k]!)}，超过洞府 ${gate} 级仓库 ${cap}（必然卡死）`)
      }
    }
  }

  // 3) 开局资源不能超过 1 级仓库上限，否则白送的资源一进游戏就被截断
  const cap1 = storageCap(INITIAL_BUILDING_LEVEL.dongfu ?? 1)
  for (const k of RES_KEYS) {
    if (INITIAL_RESOURCES[k] > cap1) {
      errs.push(`开局 ${k} ${INITIAL_RESOURCES[k]} 超过 1 级仓库上限 ${cap1}（会当场蒸发）`)
    }
  }

  // 4) 四种资源开局都必须有产出来源，否则只出不进
  const producedRes = new Set(PRODUCERS.map(p => p.res))
  for (const k of RES_KEYS) {
    if (!producedRes.has(k)) errs.push(`资源 ${k} 没有任何产出建筑`)
  }
  for (const p of PRODUCERS) {
    if ((INITIAL_BUILDING_LEVEL[p.key] ?? 0) < 1) {
      errs.push(`产出建筑 ${p.key} 开局等级为 0，${p.res} 将零产出（死锁风险）`)
    }
  }

  return errs
}

const invariantErrs = checkInvariants()
if (invariantErrs.length > 0) {
  console.log('\n❌ 结构性不变量被破坏，先修这些再谈调参：')
  for (const e of invariantErrs) console.log('   · ' + e)
  process.exit(1)
}

// ══ 输出报告 ══
const s = run()

console.log('\n══════ 凡人修仙 SLG · 30 天节奏模拟 ══════')
console.log(`假设：每天上线 ${PLAY.sessionsPerDay} 次，清醒 ${PLAY.awakeHours}h，建造队列 ${QUEUE_COUNT} 条\n`)

console.log('日 | 洞府 | 境界       | 战力      | 秘境')
console.log('---+------+------------+-----------+-----')
for (const r of s.log) {
  if (![1, 2, 3, 5, 7, 10, 14, 21, 30].includes(r.day)) continue
  console.log(
    `${String(r.day).padStart(2)} | ${String(r.dongfu).padStart(4)} | ${r.realm.padEnd(10)} | ${String(r.power).padStart(9)} | ${String(r.stage).padStart(3)}`,
  )
}

console.log('\n── 里程碑达标检查 ──')
let allPass = true
for (const tg of TARGETS) {
  const row = s.log.find(r => r.day === tg.day)!
  const realmIdx = REALM_SPECS.findIndex(r => r.name === row.realm)
  const wantIdx = REALM_SPECS.findIndex(r => r.name === tg.realmName)
  const dongfuOk = row.dongfu >= tg.dongfuMin && row.dongfu <= tg.dongfuMax
  // 境界允许比目标高/低一档
  const realmOk = Math.abs(realmIdx - wantIdx) <= 1
  const pass = dongfuOk && realmOk
  if (!pass) allPass = false
  console.log(
    `D${String(tg.day).padEnd(2)} ${pass ? '✅' : '❌'} ` +
    `洞府 ${row.dongfu}（目标 ${tg.dongfuMin}~${tg.dongfuMax}）· ` +
    `${row.realm}（目标 ${tg.realmName}${realmOk ? '' : ' ← 偏差过大'}）`,
  )
}

console.log('\n── 卡点分析（前期该资源卡、后期该时间卡）──')
console.log(`资源不足次数：${s.blockedByRes}　队列占满次数：${s.blockedByTime}`)
const stepsEarly = (7 * 86400) / PLAY.stepSec * PRODUCERS.length
const stepsLate = ((PLAY.days - 7) * 86400) / PLAY.stepSec * PRODUCERS.length
console.log(
  `满仓占比：前 7 天 ${(s.cappedEarly / stepsEarly * 100).toFixed(1)}%　` +
  `第 8~30 天 ${(s.cappedLate / stepsLate * 100).toFixed(1)}%`,
)
console.log(`（前期满仓高是设计意图：仓库小、催上线；后期仍高则说明产出过剩、资源失去约束力）`)

console.log('\n── 终局状态 ──')
const last = s.log[s.log.length - 1]
console.log(`洞府 ${last.dongfu}/${TUNE.dongfuMax}　境界 ${last.realm}　战力 ${last.power}　秘境 ${last.stage}/40`)
console.log(`各建筑等级：` + Object.entries(s.lv).map(([k, v]) => `${k}${v}`).join(' '))
console.log(`期望战力校验：洞府${last.dongfu} 期望 ${Math.round(expectedPower(last.dongfu))}，实际 ${last.power}`)
console.log(`第40关锚定洞府 ${stageDongfuAnchor(40)}，敌方战力 ${stageEnemyPower(40)}`)

console.log(`\n总评：${allPass ? '✅ 全部里程碑达标' : '❌ 存在未达标里程碑，需调参'}\n`)
process.exit(allPass ? 0 : 1)
