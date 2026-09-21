// ═══ 赛季秘境战区 ═══
//
// 当前版本是可试玩的本地垂直切片：对手是固定的 AI 守军，所有结算仍在客户端。
// 领域数据与 UI 分离，后续接服务端时只需让 API 返回同形状的节点快照与战报。

import type {
  GameState, ResourceKey, Resources, TroopKey, WarfrontNodeState, WarfrontOwner, WarfrontTactic,
} from './types'

export interface WarfrontNodeDef {
  key: string
  name: string
  kind: string
  position: { x: number; y: number }
  connections: string[]
  enemyName: string
  enemyTroop: TroopKey
  enemyPower: number
  /** 首次夺取资源 */
  reward: Partial<Resources>
  /** 持有时追加到每秒资源产出 */
  income: Partial<Resources>
}

export const WARFRONT_NODES: WarfrontNodeDef[] = [
  {
    key: 'mist-gate', name: '迷雾关', kind: '关隘', position: { x: 22, y: 52 }, connections: ['cloud-platform', 'moonwell'], enemyName: '赤霞巡卫', enemyTroop: 'yushou', enemyPower: 820,
    reward: { lingshi: 360, kuanglingcai: 120 }, income: { lingshi: 0.08 },
  },
  {
    key: 'moonwell', name: '望月灵泉', kind: '灵泉', position: { x: 28, y: 80 }, connections: ['mist-gate', 'iron-ridge'], enemyName: '玄水兽群', enemyTroop: 'kuilei', enemyPower: 1080,
    reward: { lingqi: 300, lingyao: 180 }, income: { lingqi: 0.09 },
  },
  {
    key: 'iron-ridge', name: '赤铁矿岭', kind: '矿脉', position: { x: 72, y: 80 }, connections: ['spirit-field', 'moonwell'], enemyName: '铁甲傀儡', enemyTroop: 'kuilei', enemyPower: 1370,
    reward: { kuanglingcai: 360, lingshi: 220 }, income: { kuanglingcai: 0.08 },
  },
  {
    key: 'spirit-field', name: '青萝药圃', kind: '药圃', position: { x: 78, y: 52 }, connections: ['cloud-platform', 'iron-ridge'], enemyName: '百草宗弟子', enemyTroop: 'fuxiu', enemyPower: 1560,
    reward: { lingyao: 400, lingshi: 220 }, income: { lingyao: 0.1 },
  },
  {
    key: 'cloud-platform', name: '凌云台', kind: '遗迹', position: { x: 50, y: 30 }, connections: ['mist-gate', 'spirit-field', 'star-fort'], enemyName: '玄冥战阵', enemyTroop: 'yushou', enemyPower: 1880,
    reward: { lingqi: 420, kuanglingcai: 230 }, income: { lingshi: 0.05, lingqi: 0.05 },
  },
  {
    key: 'star-fort', name: '坠星堡', kind: '核心据点', position: { x: 50, y: 11 }, connections: ['cloud-platform'], enemyName: '苍梧宗主力', enemyTroop: 'fuxiu', enemyPower: 2350,
    reward: { lingshi: 600, lingqi: 360, lingyao: 240, kuanglingcai: 240 }, income: { lingshi: 0.08, lingqi: 0.08 },
  },
]

export const WARFRONT_NODE_MAP = Object.fromEntries(
  WARFRONT_NODES.map(node => [node.key, node]),
) as Record<string, WarfrontNodeDef>

export const WARFRONT_SPAWN_POINTS = {
  'sect-qingyun': { x: 12, y: 88 },
  'sect-cangwu': { x: 88, y: 88 },
  'sect-liuyun': { x: 50, y: 94 },
} as const

export const WARFRONT_TACTICS: Record<WarfrontTactic, {
  name: string
  desc: string
  powerFactor: number
  lossFactor: number
}> = {
  assault: { name: '强攻', desc: '战力 +15%，兵损更高', powerFactor: 1.15, lossFactor: 1.25 },
  cautious: { name: '谨慎', desc: '战力 -6%，兵损更低', powerFactor: 0.94, lossFactor: 0.62 },
  raid: { name: '奇袭', desc: '均衡出击，适合试探', powerFactor: 1, lossFactor: 1 },
}

export function initialWarfrontNodes(): Record<string, WarfrontNodeState> {
  return Object.fromEntries(WARFRONT_NODES.map((node, index) => [node.key, {
    // 两处中立点让新玩家有低风险的首胜；其余节点由 AI 宗门控制。
    owner: index < 2 ? 'neutral' : 'rival',
  }])) as Record<string, WarfrontNodeState>
}

export function warfrontIncome(s: GameState): Resources {
  const income: Resources = { lingshi: 0, lingqi: 0, lingyao: 0, kuanglingcai: 0 }
  for (const node of WARFRONT_NODES) {
    if (s.warfrontNodes[node.key]?.owner !== 'player') continue
    for (const key of Object.keys(node.income) as ResourceKey[]) income[key] += node.income[key] ?? 0
  }
  return income
}

export function ownerName(owner: WarfrontOwner): string {
  if (owner === 'player') return '我方占领'
  if (owner === 'rival') return '苍梧宗占领'
  return '无人占领'
}
