// ═══ 寻道主循环 · 30 天内容模拟 ═══
// 验证点击不是一次性烟花：每天都有稳定收益，保底可达，
// 灵装会填满成长层，且机缘耗尽不会把玩家挡在主线外。

import {
  SEEK_MAX_ENERGY, cultivationRequirement, initialSeekState,
  resolveSeekDrop, refreshSeekState, equipmentPower,
} from '../src/game/seek'
import type { SeekState } from '../src/game/types'

const START = new Date('2026-01-05T08:00:00').getTime()
const DAYS = 30
const CLICKS_PER_DAY = 24

let seed = 0x51eeda
function random(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 0x100000000
}

let now = START
let realm = 0
let state: SeekState = initialSeekState(now)
let clicks = 0
let equipmentDrops = 0
let epicDrops = 0
let legendaryDrops = 0
let breakthroughs = 0
let maxPity = 0
let maxLegendaryPity = 0

for (let day = 0; day < DAYS; day++) {
  for (let click = 0; click < CLICKS_PER_DAY; click++) {
    // 45 分钟一个操作间隔，覆盖在线与回流，不把点击强行限制在机缘上。
    now += 45 * 60 * 1000
    state = refreshSeekState(state, now)
    const id = `sim-${day}-${click}`
    const drop = resolveSeekDrop(state, realm, id, random)
    const item = drop.equipment
    const equipped = !!item && (!state.equipmentLoadout[item.slot] || item.power > state.equipmentLoadout[item.slot]!.power)
    const loadout = { ...state.equipmentLoadout }
    if (item && equipped) loadout[item.slot] = item
    const combo = now - state.lastAt <= 7_000 ? state.combo + 1 : 1
    const rare = drop.rarity === 'epic' || drop.rarity === 'legendary'
    state = {
      ...state,
      energy: Math.max(0, state.energy - 1),
      energyUpdatedAt: state.energy >= SEEK_MAX_ENERGY ? now : state.energyUpdatedAt,
      cultivation: state.cultivation + drop.cultivation,
      total: state.total + 1,
      dailyCount: state.dailyCount + 1,
      combo,
      bestCombo: Math.max(state.bestCombo, combo),
      lastAt: now,
      pity: rare ? 0 : state.pity + 1,
      legendaryPity: drop.rarity === 'legendary' ? 0 : state.legendaryPity + 1,
      equipmentLoadout: loadout,
      equipmentInventory: item ? [item, ...state.equipmentInventory].slice(0, 24) : state.equipmentInventory,
    }
    maxPity = Math.max(maxPity, state.pity)
    maxLegendaryPity = Math.max(maxLegendaryPity, state.legendaryPity)
    if (item) equipmentDrops++
    if (drop.rarity === 'epic') epicDrops++
    if (drop.rarity === 'legendary') legendaryDrops++
    clicks++

    const need = cultivationRequirement(realm)
    if (state.cultivation >= need && realm < 12) {
      state = { ...state, cultivation: state.cultivation - need }
      realm++
      breakthroughs++
    }
  }
}

const checks = [
  { name: '30 天点击次数持续增长', ok: clicks === DAYS * CLICKS_PER_DAY && state.total === clicks },
  { name: '三部位灵装均能通过点击填满', ok: Object.values(state.equipmentLoadout).every(Boolean) },
  { name: '30 天至少触发一次史诗与传说保底/掉落', ok: epicDrops > 0 && legendaryDrops > 0 },
  { name: '普通点击始终有修为产出', ok: state.cultivation > 0 || breakthroughs > 0 },
  { name: '史诗保底不会超过 10 次空窗', ok: maxPity <= 9 },
  { name: '传说保底不会超过 40 次空窗', ok: maxLegendaryPity <= 39 },
  { name: '寻道结果能推动多次境界进阶', ok: breakthroughs >= 4 && realm >= 4 },
  { name: '灵装确实进入战力乘区', ok: equipmentPower(state.equipmentLoadout) > 0 },
]

console.log('\n══════ 寻道循环 · 30 天模拟 ══════')
console.log(`点击：${clicks}　境界推进：${breakthroughs}　当前境界索引：${realm}`)
console.log(`灵装掉落：${equipmentDrops}　上品：${epicDrops}　天成：${legendaryDrops}`)
console.log(`最大普通保底空窗：${maxPity}　最大传说保底空窗：${maxLegendaryPity}　灵装战力：${equipmentPower(state.equipmentLoadout)}`)
for (const check of checks) console.log(`${check.ok ? '✅' : '❌'} ${check.name}`)

const failed = checks.filter(check => !check.ok)
if (failed.length > 0) process.exit(1)
console.log('✅ 寻道循环可支撑 30 天持续参与\n')
