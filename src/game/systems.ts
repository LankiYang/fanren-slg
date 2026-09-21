// ═══ 三大养成系统：功法 / 丹药 / 法宝 ═══
//
// 这三座建筑（藏经阁/炼丹房/炼器阁）原先能建、要花资源、却没有任何功能。
// 本文件给它们各配一套系统，让「四资源」有分化的去向，而不是全部涌向建造：
//   · 功法（藏经阁）= 永久增益，吃灵气 → 长线目标
//   · 丹药（炼丹房）= 限时增益，吃灵药 → 日常消耗，制造「上线嗑一颗」的循环
//   · 法宝（炼器阁）= 装备加成，吃矿灵材 → 深度养成，与修士绑定
//
// 三者的加成都乘在既有公式上，balance.ts 的关卡锚点未把它们计入 ——
// 这是有意的「玩家优势」缓冲：认真养成的玩家会比锚点强，推图更顺。

import type { GameState, ResourceKey, TroopKey } from './types'
import { storageCap } from './balance'

// ──────────────────────────────────────────────
// 功法（藏经阁）：永久增益科技树
// ──────────────────────────────────────────────

export type GongfaBranch = 'gather' | 'war' | 'build'

export interface GongfaDef {
  key: string
  branch: GongfaBranch
  name: string
  desc: string
  /** 每级增益 */
  perLevel: number
  maxLevel: number
  /** 解锁所需藏经阁等级 */
  requires: number
}

export const GONGFA_BRANCHES: Record<GongfaBranch, { name: string; color: string }> = {
  gather: { name: '采集', color: 'var(--teal)' },
  war: { name: '攻伐', color: 'var(--danger)' },
  build: { name: '营造', color: 'var(--gold)' },
}

export const GONGFA: GongfaDef[] = [
  // 采集支
  { key: 'g_output', branch: 'gather', name: '聚灵诀', desc: '全局资源产出', perLevel: 0.04, maxLevel: 20, requires: 1 },
  { key: 'g_cap', branch: 'gather', name: '纳物诀', desc: '仓库上限', perLevel: 0.06, maxLevel: 15, requires: 3 },
  { key: 'g_offline', branch: 'gather', name: '闭关诀', desc: '离线产出效率', perLevel: 0.03, maxLevel: 10, requires: 6 },
  // 攻伐支
  { key: 'w_power', branch: 'war', name: '战体诀', desc: '全军战力', perLevel: 0.05, maxLevel: 20, requires: 1 },
  { key: 'w_counter', branch: 'war', name: '相克诀', desc: '兵种克制加成', perLevel: 0.03, maxLevel: 10, requires: 4 },
  { key: 'w_cap', branch: 'war', name: '统御诀', desc: '兵力上限', perLevel: 0.05, maxLevel: 15, requires: 7 },
  // 营造支
  { key: 'b_speed', branch: 'build', name: '神行诀', desc: '建造速度', perLevel: 0.04, maxLevel: 20, requires: 1 },
  { key: 'b_cost', branch: 'build', name: '俭物诀', desc: '建造消耗减免', perLevel: 0.02, maxLevel: 12, requires: 5 },
]

export const GONGFA_MAP = Object.fromEntries(GONGFA.map(g => [g.key, g])) as Record<string, GongfaDef>

/** 功法研究消耗（主要吃灵气，给聚灵阵一个专属去向） */
export function gongfaCost(level: number): Partial<Record<ResourceKey, number>> {
  const f = Math.pow(1.65, level - 1)
  return {
    lingqi: Math.round(900 * f),
    lingshi: Math.round(500 * f),
  }
}

/** 功法研究耗时（毫秒） */
export function gongfaTimeMs(level: number): number {
  return Math.round(Math.min(60 * Math.pow(1.5, level - 1), 12 * 3600) * 1000)
}

/** 取某条功法的当前总增益 */
export function gongfaBonus(s: GameState, key: string): number {
  const def = GONGFA_MAP[key]
  if (!def) return 0
  return (s.gongfa[key] ?? 0) * def.perLevel
}

// ──────────────────────────────────────────────
// 丹药（炼丹房）：限时增益
// ──────────────────────────────────────────────

export type PillKey = 'qi' | 'body' | 'mind'

export interface PillDef {
  key: PillKey
  name: string
  desc: string
  sprite: string
  /** 增益倍率（1.5 = +50%） */
  effect: number
  /** 持续时长（小时） */
  hours: number
  /** 炼制耗时（分钟） */
  craftMinutes: number
}

export const PILLS: PillDef[] = [
  {
    key: 'qi', name: '聚气丹', desc: '服下后资源产出大增',
    sprite: 'item/pill-qi.webp', effect: 1.5, hours: 2, craftMinutes: 10,
  },
  {
    key: 'body', name: '淬体丹', desc: '服下后全军战力提升',
    sprite: 'item/pill-body.webp', effect: 1.3, hours: 1, craftMinutes: 15,
  },
  {
    key: 'mind', name: '凝神丹', desc: '服下后建造速度提升',
    sprite: 'item/pill-mind.webp', effect: 1.6, hours: 3, craftMinutes: 20,
  },
]

export const PILL_MAP = Object.fromEntries(PILLS.map(p => [p.key, p])) as Record<PillKey, PillDef>

/** 炼丹消耗（主要吃灵药，给灵田一个专属去向） */
export function pillCost(liandanLevel: number): Partial<Record<ResourceKey, number>> {
  const cap = storageCap(Math.max(1, liandanLevel))
  return {
    lingyao: Math.round(cap * 0.18),
    lingshi: Math.round(cap * 0.08),
  }
}

/** 某种丹药当前是否生效，返回倍率（未生效为 1） */
export function pillEffect(s: GameState, key: PillKey, now: number): number {
  const until = s.pillActive[key] ?? 0
  return now < until ? PILL_MAP[key].effect : 1
}

// ──────────────────────────────────────────────
// 法宝（炼器阁）：装备加成
// ──────────────────────────────────────────────

export interface ArtifactDef {
  key: string
  name: string
  desc: string
  sprite: string
  /** 加成哪个兵种；null 表示全军 */
  spec: TroopKey | null
  /** 每级加成 */
  perLevel: number
  maxLevel: number
  /** 解锁所需炼器阁等级 */
  requires: number
}

export const ARTIFACTS: ArtifactDef[] = [
  {
    key: 'sword', name: '青锋剑', desc: '符修弓阵战力',
    sprite: 'item/artifact-sword.webp', spec: 'fuxiu', perLevel: 0.08, maxLevel: 15, requires: 1,
  },
  {
    key: 'shield', name: '玄龟盾', desc: '傀儡兵战力',
    sprite: 'item/artifact-shield.webp', spec: 'kuilei', perLevel: 0.08, maxLevel: 15, requires: 1,
  },
  {
    key: 'rope', name: '缚灵索', desc: '御兽军战力',
    sprite: 'item/artifact-rope.webp', spec: 'yushou', perLevel: 0.08, maxLevel: 15, requires: 3,
  },
]

export const ARTIFACT_MAP = Object.fromEntries(ARTIFACTS.map(a => [a.key, a])) as Record<string, ArtifactDef>

/** 法宝锻造/升阶消耗（主要吃矿灵材，给矿脉一个专属去向） */
export function artifactCost(level: number): Partial<Record<ResourceKey, number>> {
  const f = Math.pow(1.7, level - 1)
  return {
    kuanglingcai: Math.round(1200 * f),
    lingshi: Math.round(600 * f),
  }
}

/** 某兵种从法宝获得的总加成 */
export function artifactBonus(s: GameState, troop: TroopKey): number {
  let sum = 0
  for (const a of ARTIFACTS) {
    const lv = s.artifacts[a.key] ?? 0
    if (lv > 0 && (a.spec === troop || a.spec === null)) sum += lv * a.perLevel
  }
  return sum
}
