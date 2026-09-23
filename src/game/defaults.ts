import type { GameState } from './types'
import { BUILDINGS, CULTIVATORS, INITIAL_RESOURCES } from './data'
import { INITIAL_BUILDING_LEVEL } from './balance'
import { emptyResources } from './compute'
import { initialExpeditionState } from './expedition'
import { initialSeekState } from './seek'
import { initialWarfrontNodes } from './warfront'

/**
 * 权威存档的初始形状。
 *
 * 这里必须保持纯函数：浏览器只用它渲染“尚未连接”占位状态，服务端用它创建真实账号。
 * 任何会改变资源、战斗或掉落的逻辑都不应该放在这个文件里。
 */
export function createInitialGameState(now = Date.now()): GameState {
  const buildings = Object.fromEntries(
    BUILDINGS.map(def => [def.key, {
      level: INITIAL_BUILDING_LEVEL[def.key] ?? 0,
      upgradingUntil: null,
    }]),
  ) as GameState['buildings']

  const cultivators = Object.fromEntries(
    CULTIVATORS.map(def => [def.key, {
      level: def.key === 'hanli' ? 1 : 0,
      owned: def.key === 'hanli',
    }]),
  ) as GameState['cultivators']

  return {
    resources: { ...emptyResources(), ...INITIAL_RESOURCES },
    buildings,
    realm: 0,
    character: { gender: null },
    seek: initialSeekState(now),
    troops: { kuilei: 0, yushou: 0, fuxiu: 0 },
    cultivators,
    clearedStage: 0,
    lastTick: now,
    queueSlots: 1,
    lastBossAt: 0,
    claimedQuests: [],
    gongfa: {},
    gongfaResearching: null,
    pills: {},
    pillActive: {},
    pillCrafting: null,
    artifacts: {},
    formation: { kuilei: 0, yushou: 0, fuxiu: 0 },
    tutorialStep: 0,
    tutorialDone: false,
    seenIntros: [],
    activeIntro: null,
    introStep: 0,
    journeyStartedAt: now,
    guideFlags: [],
    warfrontNodes: initialWarfrontNodes(),
    warfrontScore: 0,
    warfrontSectScore: 0,
    onlineWarfrontIncome: emptyResources(),
    warfrontClaimedReportIds: [],
    warfrontCooldownUntil: 0,
    warfrontTactic: 'raid',
    ...initialExpeditionState(now, INITIAL_BUILDING_LEVEL.dongfu ?? 1),
  }
}
