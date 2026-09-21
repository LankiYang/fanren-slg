// ═══ 天机远征 · 30 天内容支撑模拟 ═══
// 只调用远征领域生成器，不复制线上规则。它验证的是：
// 每天有可走路线、主题会轮换、行动令能覆盖 30 天、积分与远征币有长期出口。

import {
  createExpeditionNodes, expeditionDayKey, expeditionSeasonKey, expeditionTheme,
  expeditionWeekKey, EXPEDITION_DEPTHS, EXPEDITION_ENERGY_REGEN_MS, EXPEDITION_MAX_ENERGY,
  EXPEDITION_SHOP,
} from '../src/game/expedition'

const START = new Date('2026-01-05T00:00:00')
const DONGFU_LEVEL = 12
const DAYS = 30
const actionsPerDay = 3
const SESSION_HOURS = [0, 8, 16]

let score = 0
let currency = 0
let progress = 0
let energy = EXPEDITION_MAX_ENERGY
let energyUpdatedAt = START.getTime()
let mapDayKey = expeditionDayKey(START)
let mapCycle = 0
let nodes = createExpeditionNodes(mapDayKey, DONGFU_LEVEL, mapCycle)
let seasonScore = 0
let maxSeasonScore = 0
let weekScore = 0
let maxWeekScore = 0
let currentSeason = ''
let currentWeek = ''
let maps = 1
let actions = 0
const themes = new Set<string>()
const kinds = new Set<string>()
const routeFailures: string[] = []

for (let day = 0; day < DAYS; day++) {
  const dayStart = new Date(START.getTime() + day * 86400000)
  const date = dayStart
  const dayKey = expeditionDayKey(date)
  const week = expeditionWeekKey(dayKey)
  const season = expeditionSeasonKey(dayKey)
  if (season !== currentSeason) {
    currentSeason = season
    seasonScore = 0
  }
  if (week !== currentWeek) {
    currentWeek = week
    weekScore = 0
  }

  const theme = expeditionTheme(dayKey)
  themes.add(theme.key)
  // 和线上 refreshExpeditionState 一致：未完成的五层地图跨午夜保留，
  // 击破后下一天换图；首领战后若还有行动令，则当日立即开下一张同主题图。
  if (day > 0 && progress >= EXPEDITION_DEPTHS) {
    mapDayKey = dayKey
    mapCycle = 0
    nodes = createExpeditionNodes(mapDayKey, DONGFU_LEVEL, mapCycle)
    progress = 0
    maps++
    energy = EXPEDITION_MAX_ENERGY
    energyUpdatedAt = dayStart.getTime()
  }

  for (let action = 0; action < actionsPerDay; action++) {
    const now = dayStart.getTime() + SESSION_HOURS[action] * 3600 * 1000
    if (energy < EXPEDITION_MAX_ENERGY) {
      const recovered = Math.floor(Math.max(0, now - energyUpdatedAt) / EXPEDITION_ENERGY_REGEN_MS)
      if (recovered > 0) {
        energy = Math.min(EXPEDITION_MAX_ENERGY, energy + recovered)
        energyUpdatedAt = energy >= EXPEDITION_MAX_ENERGY ? now : energyUpdatedAt + recovered * EXPEDITION_ENERGY_REGEN_MS
      }
    }
    if (energy <= 0) continue
    const available = nodes.filter(node => node.depth === progress && !node.resolved)
    if (available.length === 0) {
      routeFailures.push(`${dayKey} 第 ${progress + 1} 层没有可选节点`)
      continue
    }
    const node = available[action % available.length]
    node.resolved = true
    progress++
    energy--
    if (energy === EXPEDITION_MAX_ENERGY - 1) energyUpdatedAt = now
    actions++
    kinds.add(node.kind)
    const earnedScore = Math.round(node.score * (action === 1 ? 1.18 : 1))
    score += earnedScore
    seasonScore += earnedScore
    weekScore += earnedScore
    currency += node.currency
    maxSeasonScore = Math.max(maxSeasonScore, seasonScore)
    maxWeekScore = Math.max(maxWeekScore, weekScore)
    if (progress >= EXPEDITION_DEPTHS && energy > 0) {
      mapCycle++
      nodes = createExpeditionNodes(mapDayKey, DONGFU_LEVEL, mapCycle)
      progress = 0
      maps++
    }
  }
}

const relicShopCost = EXPEDITION_SHOP
  .filter(item => item.relic)
  .reduce((sum, item) => sum + item.cost * item.maxPurchases, 0)
const expectedSeasonMilestone = 7200
const checks = [
  { name: '30 天日历循环正常推进', ok: maps >= 10 },
  { name: '行动令足以支撑连续参与', ok: actions >= DAYS * 2 },
  { name: '至少 5 个主题轮换', ok: themes.size >= 5 },
  { name: '节点类型覆盖战斗/采集/护送/事件/首领', ok: ['battle', 'gather', 'caravan', 'event', 'boss'].every(kind => kinds.has(kind)) },
  { name: '路线不存在结构性死锁', ok: routeFailures.length === 0 },
  { name: '至少一轮赛季可达最高积分档', ok: maxSeasonScore >= expectedSeasonMilestone },
  { name: '远征币存在永久遗物消费出口', ok: currency >= relicShopCost },
]

console.log('\n══════ 天机远征 · 30 天内容模拟 ══════')
console.log(`洞府锚点：${DONGFU_LEVEL}　每日行动：${actionsPerDay}　地图：${maps}　行动：${actions}`)
console.log(`主题：${[...themes].join('、')}`)
console.log(`积分：${score}　最高周积分：${maxWeekScore}　最高赛季积分：${maxSeasonScore}　远征币：${currency}`)
console.log(`遗物全套购买成本：${relicShopCost}`)
for (const check of checks) console.log(`${check.ok ? '✅' : '❌'} ${check.name}`)

const failed = checks.filter(check => !check.ok)
if (failed.length > 0) {
  if (routeFailures.length > 0) console.log('路线问题：' + routeFailures.join('；'))
  process.exit(1)
}
console.log('✅ 远征循环可支撑 30 天持续参与\n')
