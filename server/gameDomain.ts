import { randomUUID } from 'node:crypto'
import type {
  GameCommandName, GameCommandResult, GameDerivedSnapshot, GameSnapshot,
} from '../src/online/contracts'
import type {
  BuildingKey, EquipmentSlot, ExpeditionChoice, ExpeditionReport,
  GameState, Gender, ResourceKey, Resources, SeekDrop, TroopKey,
} from '../src/game/types'
import { BUILDINGS, BUILDING_MAP, CULTIVATOR_MAP, CULTIVATORS, REALMS, STAGES, TROOP_MAP, buildingCost, buildingOutput, buildingTime, cultivatorCost } from '../src/game/data'
import {
  BOSS, TUNE, bossHp, bossReward, bossTier, canUpgradeDongfu,
  CULTIVATOR_MAX_LEVEL, DONGFU_PREREQ_COUNT, dongfuPrereqLevel,
} from '../src/game/balance'
import {
  battlePower, busyQueues, canAfford, computeRates, currentCap, currentMarchCap,
  counterBonus, currentTroopCap, formationUsed, optimalFormation, pay, scaleCost, totalPower, totalTroops, troopPower,
  buildCostFactor, buildSpeedFactor,
} from '../src/game/compute'
import { calculateBattleLosses } from '../src/game/penalty'
import { QUESTS, questReward } from '../src/game/quests'
import {
  ARTIFACT_MAP, artifactBonus, artifactCost, GONGFA_MAP, gongfaBonus, gongfaCost, gongfaTimeMs,
  PILL_MAP, pillCost, pillEffect, type PillKey,
} from '../src/game/systems'
import {
  EXPEDITION_DEPTHS, EXPEDITION_MAX_ENERGY, EXPEDITION_SEASON_REWARDS,
  EXPEDITION_SHOP, EXPEDITION_WEEKLY_REWARDS, createExpeditionNodes,
  expeditionBattleMultiplier, expeditionEnergyReadyAt, expeditionRewardMultiplier,
  expeditionRiskSuccess, expeditionScoreMultiplier,
  refreshExpeditionState, scaledExpeditionReward,
} from '../src/game/expedition'
import {
  SEEK_COMBO_WINDOW_MS, SEEK_MAX_ENERGY, SEEK_MILESTONES, cultivationRequirement,
  refreshSeekState, resolveSeekDrop,
} from '../src/game/seek'
import { createInitialGameState } from '../src/game/defaults'
import type { ServerPlayer } from './model'

export const GAME_STATE_SCHEMA_VERSION = 1

const GAME_COMMANDS: readonly GameCommandName[] = [
  'character.choose', 'building.start', 'building.claim', 'realm.breakthrough',
  'seek.draw', 'seek.temper', 'seek.milestone.claim', 'troops.train', 'formation.set',
  'cultivator.level', 'stage.attack', 'queue.unlock', 'boss.challenge', 'quest.claim', 'guide.flag',
  'gongfa.research', 'pill.craft', 'pill.collect', 'pill.use', 'artifact.forge',
  'expedition.explore', 'expedition.weekly.claim', 'expedition.season.claim',
  'expedition.shop.buy',
]

export interface GameMutationContext {
  result: GameCommandResult
  offlineReport: GameSnapshot['offlineReport']
}

export function createServerGameState(now = Date.now()): GameState {
  return createInitialGameState(now)
}

export function hydrateGameState(raw: GameState | undefined): GameState {
  const base = createServerGameState()
  if (!raw || typeof raw !== 'object') return base
  const input = raw as Partial<GameState>
  return {
    ...base,
    ...input,
    resources: { ...base.resources, ...(input.resources ?? {}) },
    buildings: { ...base.buildings, ...(input.buildings ?? {}) },
    character: { ...base.character, ...(input.character ?? {}) },
    seek: {
      ...base.seek,
      ...(input.seek ?? {}),
      equipmentLoadout: { ...base.seek.equipmentLoadout, ...(input.seek?.equipmentLoadout ?? {}) },
      equipmentInventory: input.seek?.equipmentInventory ?? base.seek.equipmentInventory,
      recentDrops: input.seek?.recentDrops ?? base.seek.recentDrops,
    },
    troops: { ...base.troops, ...(input.troops ?? {}) },
    cultivators: { ...base.cultivators, ...(input.cultivators ?? {}) },
    gongfa: { ...base.gongfa, ...(input.gongfa ?? {}) },
    pills: { ...base.pills, ...(input.pills ?? {}) },
    pillActive: { ...base.pillActive, ...(input.pillActive ?? {}) },
    artifacts: { ...base.artifacts, ...(input.artifacts ?? {}) },
    formation: { ...base.formation, ...(input.formation ?? {}) },
    claimedQuests: input.claimedQuests ?? base.claimedQuests,
    seenIntros: input.seenIntros ?? base.seenIntros,
    guideFlags: input.guideFlags ?? base.guideFlags,
    warfrontNodes: { ...base.warfrontNodes, ...(input.warfrontNodes ?? {}) },
    onlineWarfrontIncome: { ...base.onlineWarfrontIncome, ...(input.onlineWarfrontIncome ?? {}) },
    warfrontClaimedReportIds: input.warfrontClaimedReportIds ?? base.warfrontClaimedReportIds,
    expeditionNodes: input.expeditionNodes ?? base.expeditionNodes,
    expeditionWeeklyClaimed: input.expeditionWeeklyClaimed ?? base.expeditionWeeklyClaimed,
    expeditionSeasonRewards: input.expeditionSeasonRewards ?? base.expeditionSeasonRewards,
    expeditionRelics: { ...base.expeditionRelics, ...(input.expeditionRelics ?? {}) },
    expeditionShopPurchases: { ...base.expeditionShopPurchases, ...(input.expeditionShopPurchases ?? {}) },
  }
}

export function advanceGame(game: GameState, now = Date.now()): GameSnapshot['offlineReport'] {
  const refreshedSeek = refreshSeekState(game.seek, now)
  if (refreshedSeek !== game.seek) game.seek = refreshedSeek

  const expeditionPatch = refreshExpeditionState(game, now)
  Object.assign(game, expeditionPatch)

  const elapsed = Math.max(0, (now - game.lastTick) / 1000)
  if (elapsed < 0.05) return null

  const cap = currentCap(game)
  const rates = computeRates(game, now)
  const offline = elapsed > 60
  const capSeconds = TUNE.offlineCapHours * 3600
  const effective = offline ? Math.min(elapsed, capSeconds) : elapsed
  const factor = offline ? TUNE.offlineRate : 1
  const gained = emptyResources()
  const resources = { ...game.resources }
  for (const key of Object.keys(rates) as ResourceKey[]) {
    const before = resources[key]
    resources[key] = Math.min(cap, before + rates[key] * effective * factor)
    gained[key] = resources[key] - before
  }
  game.resources = resources

  const buildings = { ...game.buildings }
  for (const key of Object.keys(buildings) as BuildingKey[]) {
    const building = buildings[key]
    if (building.upgradingUntil !== null && now >= building.upgradingUntil) {
      buildings[key] = { level: building.level + 1, upgradingUntil: null }
    }
  }
  game.buildings = buildings

  if (game.gongfaResearching && now >= game.gongfaResearching.until) {
    const key = game.gongfaResearching.key
    game.gongfa = { ...game.gongfa, [key]: (game.gongfa[key] ?? 0) + 1 }
    game.gongfaResearching = null
  }
  game.lastTick = now

  if (offline && Object.values(gained).some(value => value > 1)) {
    return {
      seconds: effective,
      truncatedSeconds: Math.max(0, elapsed - capSeconds),
      gained,
    }
  }
  return null
}

export function executeGameCommand(
  player: ServerPlayer,
  command: GameCommandName,
  payload: Record<string, unknown> | undefined,
  requestId: string,
): GameMutationContext {
  if (typeof requestId !== 'string' || requestId.trim().length === 0 || requestId.length > 100) throw new GameDomainError('缺少有效的操作编号', 400, 'REQUEST_ID_REQUIRED')
  if (!GAME_COMMANDS.includes(command)) throw new GameDomainError('不支持的游戏命令', 400, 'COMMAND_NOT_SUPPORTED')
  const key = `game:${requestId}`
  const prior = player.gameIdempotency[key]
  if (prior) return { result: prior.result as GameCommandResult, offlineReport: prior.offlineReport as GameSnapshot['offlineReport'] }

  const offlineReport = advanceGame(player.game)
  const commandPayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
  const result = dispatchCommand(player.game, command, commandPayload)
  player.gameIdempotency[key] = { result, offlineReport }
  const keys = Object.keys(player.gameIdempotency)
  if (keys.length > 500) delete player.gameIdempotency[keys[0]]
  return { result, offlineReport }
}

export function createGameSnapshot(game: GameState, offlineReport: GameSnapshot['offlineReport'] = null, now = Date.now()): GameSnapshot {
  const derived = deriveGameSnapshot(game, now)
  return {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    serverTime: now,
    game: cloneGame(game),
    derived,
    offlineReport,
  }
}

function deriveGameSnapshot(game: GameState, now: number): GameDerivedSnapshot {
  const maxTrainable = { kuilei: 0, yushou: 0, fuxiu: 0 } as Record<TroopKey, number>
  const room = Math.max(0, currentTroopCap(game) - totalTroops(game))
  for (const key of Object.keys(maxTrainable) as TroopKey[]) {
    const costs = Object.keys(TROOP_MAP[key].cost) as ResourceKey[]
    const byResource = Math.min(...costs.map(resource => Math.floor(game.resources[resource] / (TROOP_MAP[key].cost[resource] ?? 1))))
    maxTrainable[key] = Math.max(0, Math.min(room, Number.isFinite(byResource) ? byResource : 0))
  }
  const buildingCosts: Record<string, Partial<Resources>> = {}
  const buildingTimes: Record<string, number> = {}
  for (const def of BUILDINGS) {
    const target = game.buildings[def.key].level + 1
    buildingCosts[def.key] = scaleCost(buildingCost(def.key, target), buildCostFactor(game))
    buildingTimes[def.key] = buildingTime(def.key, target) * buildSpeedFactor(game, now)
  }
  const stagePower: Record<string, number> = {}
  for (const stage of STAGES) stagePower[String(stage.id)] = Math.round(battlePower(game, stage.enemyTroop, now))
  const battlePowerByEnemy = { kuilei: 0, yushou: 0, fuxiu: 0 } as Record<TroopKey, number>
  const recommendedFormationByEnemy = {
    kuilei: { kuilei: 0, yushou: 0, fuxiu: 0 },
    yushou: { kuilei: 0, yushou: 0, fuxiu: 0 },
    fuxiu: { kuilei: 0, yushou: 0, fuxiu: 0 },
  } as Record<TroopKey, Record<TroopKey, number>>
  for (const enemy of Object.keys(battlePowerByEnemy) as TroopKey[]) {
    battlePowerByEnemy[enemy] = Math.round(battlePower(game, enemy, now))
    recommendedFormationByEnemy[enemy] = optimalFormation(game, enemy)
  }

  const outputMultiplier = REALMS[Math.min(game.realm, REALMS.length - 1)].outputBonus
    * (1 + gongfaBonus(game, 'g_output'))
    * pillEffect(game, 'qi', now)
  const buildingDetails = {} as GameDerivedSnapshot['buildingDetails']
  for (const def of BUILDINGS) {
    const current = game.buildings[def.key]
    const target = current.level + 1
    const targetBuilding = { ...current, level: target, upgradingUntil: null }
    const nextGame = { ...game, buildings: { ...game.buildings, [def.key]: targetBuilding } }
    const producerLevels = BUILDINGS.filter(item => item.produces !== null).map(item => game.buildings[item.key].level)
    const prerequisite = def.key === 'dongfu'
      ? (() => {
          const level = dongfuPrereqLevel(target)
          return {
            ok: canUpgradeDongfu(producerLevels, target),
            need: DONGFU_PREREQ_COUNT,
            have: producerLevels.filter(value => value >= level).length,
            level,
          }
        })()
      : null
    buildingDetails[def.key] = {
      targetLevel: target,
      cost: scaleCost(buildingCost(def.key, target), buildCostFactor(game)),
      durationMs: buildingTime(def.key, target) * buildSpeedFactor(game, now),
      currentOutput: def.produces ? buildingOutput(current.level) * outputMultiplier : 0,
      nextOutput: def.produces ? buildingOutput(target) * outputMultiplier : null,
      currentStorageCap: def.key === 'dongfu' ? currentCap(game) : null,
      nextStorageCap: def.key === 'dongfu' ? currentCap(nextGame) : null,
      currentTroopCap: def.key === 'yanwu' ? currentTroopCap(game) : null,
      nextTroopCap: def.key === 'yanwu' ? currentTroopCap(nextGame) : null,
      busy: current.upgradingUntil !== null && now < current.upgradingUntil,
      done: current.upgradingUntil !== null && now >= current.upgradingUntil,
      locked: current.level === 0 && game.buildings.dongfu.level < def.unlockAt,
      atMax: def.key === 'dongfu' && current.level >= TUNE.dongfuMax,
      cappedByDongfu: def.key !== 'dongfu' && current.level >= game.buildings.dongfu.level,
      prerequisite,
      queueFull: busyQueues(game, now) >= game.queueSlots,
    }
  }

  const troopDetails = {} as GameDerivedSnapshot['troopDetails']
  for (const key of Object.keys(TROOP_MAP) as TroopKey[]) {
    const unitCost = { ...TROOP_MAP[key].cost }
    const trainingCosts = Object.fromEntries([1, 10, 50, maxTrainable[key]].map(count => [String(count), Object.fromEntries(
      Object.entries(unitCost).map(([resource, value]) => [resource, (value ?? 0) * count]),
    )])) as Record<string, Partial<Resources>>
    troopDetails[key] = {
      unitPower: troopPower(game, key, now),
      powerByEnemy: Object.fromEntries((['kuilei', 'yushou', 'fuxiu'] as TroopKey[]).map(enemy => {
        return [enemy, battlePowerFromSingleTroop(game, key, enemy, now)]
      })) as Record<TroopKey, number>,
      trainingCost: unitCost,
      trainingCosts,
      maxTrainable: maxTrainable[key],
    }
  }

  const cultivatorDetails = Object.fromEntries(CULTIVATORS.map(def => {
    const state = game.cultivators[def.key]
    const owned = Boolean(state?.owned)
    const level = state?.level ?? 0
    return [def.key, {
      level,
      owned,
      maxLevel: CULTIVATOR_MAX_LEVEL,
      nextCost: owned && level < CULTIVATOR_MAX_LEVEL ? cultivatorCost(level + 1) : null,
      bonusPercent: owned ? def.baseBonus * level * 100 : 0,
    }]
  })) as GameDerivedSnapshot['cultivatorDetails']

  const gongfaDetails = Object.fromEntries(Object.values(GONGFA_MAP).map(def => {
    const level = game.gongfa[def.key] ?? 0
    return [def.key, {
      level,
      maxLevel: def.maxLevel,
      locked: game.buildings.cangjing.level < def.requires,
      cost: level < def.maxLevel ? gongfaCost(level + 1) : null,
      timeMs: level < def.maxLevel ? gongfaTimeMs(level + 1) : null,
      currentPercent: level * def.perLevel * 100,
      nextPercent: level < def.maxLevel ? (level + 1) * def.perLevel * 100 : null,
    }]
  })) as GameDerivedSnapshot['gongfaDetails']

  const pillCostValue = pillCost(Math.max(1, game.buildings.liandan.level))
  const pillDetails = Object.fromEntries(Object.values(PILL_MAP).map(def => {
    const activeUntil = game.pillActive[def.key] ?? 0
    return [def.key, {
      owned: game.pills[def.key] ?? 0,
      active: now < activeUntil,
      activeUntil,
      remainingMs: Math.max(0, activeUntil - now),
      cost: pillCostValue,
    }]
  })) as GameDerivedSnapshot['pillDetails']

  const artifactDetails = Object.fromEntries(Object.values(ARTIFACT_MAP).map(def => {
    const level = game.artifacts[def.key] ?? 0
    return [def.key, {
      level,
      maxLevel: def.maxLevel,
      locked: game.buildings.lianqi.level < def.requires,
      cost: level < def.maxLevel ? artifactCost(level + 1) : null,
      currentPercent: level * def.perLevel * 100,
      nextPercent: level < def.maxLevel ? (level + 1) * def.perLevel * 100 : null,
    }]
  })) as GameDerivedSnapshot['artifactDetails']
  const artifactBonusPercent = Object.fromEntries((['kuilei', 'yushou', 'fuxiu'] as TroopKey[]).map(key => [key, artifactBonus(game, key) * 100])) as Record<TroopKey, number>
  const seekTemperCosts = Object.fromEntries((['weapon', 'armor', 'accessory'] as EquipmentSlot[]).map(slot => {
    const item = game.seek.equipmentLoadout[slot]
    return [slot, item ? Math.max(12, Math.round(item.power * 0.16)) : 0]
  })) as Record<EquipmentSlot, number>

  const questDetails = Object.fromEntries(QUESTS.map(quest => {
    const progress = quest.progress?.(game)
    return [quest.id, {
      claimed: game.claimedQuests.includes(quest.id),
      done: quest.done(game),
      current: progress?.cur ?? null,
      target: progress?.target ?? null,
      reward: questReward(game, quest),
    }]
  })) as GameDerivedSnapshot['questDetails']

  const currentRealm = REALMS[Math.min(game.realm, REALMS.length - 1)]
  const nextRealm = REALMS[game.realm + 1]
  const cultivationNeed = cultivationRequirement(game.realm)
  const realm = {
    currentName: currentRealm.name,
    currentOutputBonus: currentRealm.outputBonus,
    currentPowerBonus: currentRealm.powerBonus,
    cultivation: game.seek.cultivation,
    cultivationNeed,
    dongfuReady: Boolean(nextRealm && game.buildings.dongfu.level >= nextRealm.requiresDongfu),
    cultivationReady: game.seek.cultivation >= cultivationNeed,
    resourcesReady: Boolean(nextRealm && canAfford(game.resources, nextRealm.cost)),
    next: nextRealm ? {
      name: nextRealm.name,
      requiresDongfu: nextRealm.requiresDongfu,
      cost: { ...nextRealm.cost },
      outputBonus: nextRealm.outputBonus,
      powerBonus: nextRealm.powerBonus,
    } : null,
    canBreakthrough: Boolean(nextRealm
      && game.buildings.dongfu.level >= nextRealm.requiresDongfu
      && game.seek.cultivation >= cultivationNeed
      && canAfford(game.resources, nextRealm.cost)),
  }
  const readyAt = game.lastBossAt === 0 ? 0 : game.lastBossAt + BOSS.cooldownHours * 3600 * 1000
  const boss = {
    hp: bossHp(game.buildings.dongfu.level),
    myPower: Math.round(totalPower(game, now)),
    readyAt,
    canChallenge: game.buildings.zongmen.level > 0 && now >= readyAt,
  }
  return {
    rates: computeRates(game, now),
    storageCap: currentCap(game),
    troopCap: currentTroopCap(game),
    marchCap: currentMarchCap(game),
    totalTroops: totalTroops(game),
    totalPower: Math.round(totalPower(game, now)),
    formationUsed: formationUsed(game),
    busyQueues: busyQueues(game, now),
    maxTrainable,
    buildingCosts,
    buildingTimes,
    stagePower,
    battlePowerByEnemy,
    recommendedFormationByEnemy,
    buildingDetails,
    troopDetails,
    cultivatorDetails,
    gongfaDetails,
    pillDetails,
    artifactDetails,
    artifactBonusPercent,
    seekTemperCosts,
    questDetails,
    realm,
    boss,
    bossReadyAt: game.lastBossAt === 0 ? 0 : game.lastBossAt + BOSS.cooldownHours * 3600 * 1000,
    expeditionEnergyReadyAt: expeditionEnergyReadyAt(game),
  }
}

function dispatchCommand(game: GameState, command: GameCommandName, payload: Record<string, unknown>): GameCommandResult {
  switch (command) {
    case 'character.choose': return chooseGender(game, readGender(payload.gender))
    case 'building.start': return startUpgrade(game, readBuildingKey(payload.key))
    case 'building.claim': return finishUpgrade(game, readBuildingKey(payload.key))
    case 'realm.breakthrough': return breakthrough(game)
    case 'seek.draw': return seekNow(game)
    case 'seek.temper': return temperEquipment(game, readEquipmentSlot(payload.slot))
    case 'seek.milestone.claim': return claimSeekMilestone(game, readString(payload.id, '寻道里程碑'))
    case 'troops.train': return trainTroop(game, readTroopKey(payload.key), readInteger(payload.count, '训练数量', 1, 1_000_000))
    case 'formation.set': return setFormation(game, payload.formation)
    case 'cultivator.level': return levelUpCultivator(game, readString(payload.key, '修士'))
    case 'stage.attack': return challengeStage(game, readInteger(payload.id, '关卡', 1, STAGES.length))
    case 'queue.unlock': return unlockQueue(game)
    case 'boss.challenge': return challengeBoss(game)
    case 'quest.claim': return claimQuest(game, readString(payload.id, '任务'))
    case 'guide.flag': return markGuideFlag(game, readString(payload.flag, '引导标记'))
    case 'gongfa.research': return researchGongfa(game, readString(payload.key, '功法'))
    case 'pill.craft': return craftPill(game, readPillKey(payload.key))
    case 'pill.collect': return collectPill(game)
    case 'pill.use': return usePill(game, readPillKey(payload.key))
    case 'artifact.forge': return forgeArtifact(game, readString(payload.key, '法宝'))
    case 'expedition.explore': return exploreExpeditionNode(game, readString(payload.nodeId, '远征节点'), readChoice(payload.choice))
    case 'expedition.weekly.claim': return claimExpeditionWeekly(game, readString(payload.id, '周里程碑'))
    case 'expedition.season.claim': return claimExpeditionSeason(game, readString(payload.id, '赛季里程碑'))
    case 'expedition.shop.buy': return buyExpeditionShop(game, readString(payload.id, '远征商品'))
  }
}

function chooseGender(game: GameState, gender: Gender): GameCommandResult {
  if (game.character.gender !== null) throw new GameDomainError('身份已经确定')
  game.character = { gender }
  return { ok: true }
}

function startUpgrade(game: GameState, key: BuildingKey): GameCommandResult {
  const now = Date.now()
  const building = game.buildings[key]
  const def = BUILDING_MAP[key]
  if (building.upgradingUntil !== null) throw new GameDomainError('该建筑正在升级中')
  if (busyQueues(game, now) >= game.queueSlots) throw new GameDomainError(`建造队列已满（${game.queueSlots} 条）`)
  if (building.level === 0 && game.buildings.dongfu.level < def.unlockAt) throw new GameDomainError(`需洞府 ${def.unlockAt} 级才能兴建`)
  if (key === 'dongfu') {
    if (building.level >= TUNE.dongfuMax) throw new GameDomainError('洞府已达当前版本上限')
    const need = dongfuPrereqLevel(building.level + 1)
    const producerLevels = BUILDINGS.filter(item => item.produces !== null).map(item => game.buildings[item.key].level)
    const ok = canUpgradeDongfu(producerLevels, building.level + 1)
    if (!ok) {
      const have = producerLevels.filter(level => level >= need).length
      throw new GameDomainError(`需 ${DONGFU_PREREQ_COUNT} 座产出建筑达到 ${need} 级（当前 ${have} 座）`)
    }
  } else if (building.level >= game.buildings.dongfu.level) {
    throw new GameDomainError('不可超过洞府等级，请先升级洞府')
  }
  const target = building.level + 1
  const cost = scaleCost(buildingCost(key, target), buildCostFactor(game))
  if (!canAfford(game.resources, cost)) throw new GameDomainError('资源不足')
  const duration = buildingTime(key, target) * buildSpeedFactor(game, now)
  game.resources = pay(game.resources, cost)
  game.buildings = { ...game.buildings, [key]: { ...building, upgradingUntil: now + duration } }
  return { ok: true, key, target, upgradingUntil: now + duration }
}

function finishUpgrade(game: GameState, key: BuildingKey): GameCommandResult {
  const building = game.buildings[key]
  if (building.upgradingUntil === null) throw new GameDomainError('没有可领取的升级')
  if (Date.now() < building.upgradingUntil) throw new GameDomainError('升级尚未完成', 409, 'BUILDING_NOT_READY')
  game.buildings = { ...game.buildings, [key]: { level: building.level + 1, upgradingUntil: null } }
  return { ok: true, key, level: building.level + 1 }
}

function breakthrough(game: GameState): GameCommandResult {
  const next = game.realm + 1
  const realm = REALMS[next]
  if (!realm) throw new GameDomainError('已至当前版本最高境界')
  if (game.buildings.dongfu.level < realm.requiresDongfu) throw new GameDomainError(`需洞府 ${realm.requiresDongfu} 级`)
  const insightNeed = cultivationRequirement(game.realm)
  if (game.seek.cultivation < insightNeed) throw new GameDomainError(`修为不足，还需参悟 ${Math.max(0, insightNeed - game.seek.cultivation)} 点`)
  if (!canAfford(game.resources, realm.cost)) throw new GameDomainError('资源不足')
  game.resources = pay(game.resources, realm.cost)
  game.realm = next
  game.seek = { ...game.seek, cultivation: Math.max(0, game.seek.cultivation - insightNeed) }
  return { ok: true, realm: realm.name }
}

function seekNow(game: GameState): GameCommandResult {
  const now = Date.now()
  game.seek = refreshSeekState(game.seek, now)
  const id = `seek-${randomUUID()}`
  const raw = resolveSeekDrop(game.seek, game.realm, id)
  const current = raw.equipment ? game.seek.equipmentLoadout[raw.equipment.slot] : null
  const shouldEquip = Boolean(raw.equipment && (!current || raw.equipment.power > current.power))
  const dustGained = raw.equipment && !shouldEquip ? Math.max(1, Math.round(raw.equipment.power * 0.22)) : 0
  const report: SeekDrop = { ...raw, equipmentEquipped: shouldEquip, dustGained }
  const credited = addCappedReward(game, raw.reward)
  const equipmentLoadout = { ...game.seek.equipmentLoadout }
  if (raw.equipment && shouldEquip) equipmentLoadout[raw.equipment.slot] = raw.equipment
  const equipmentInventory = raw.equipment ? [raw.equipment, ...game.seek.equipmentInventory].slice(0, 24) : game.seek.equipmentInventory
  const combo = now - game.seek.lastAt <= SEEK_COMBO_WINDOW_MS ? game.seek.combo + 1 : 1
  const rare = raw.rarity === 'epic' || raw.rarity === 'legendary'
  const legendary = raw.rarity === 'legendary'
  game.seek = {
    ...game.seek,
    energy: Math.max(0, game.seek.energy - 1),
    energyUpdatedAt: game.seek.energy >= SEEK_MAX_ENERGY ? now : game.seek.energyUpdatedAt,
    cultivation: game.seek.cultivation + raw.cultivation,
    total: game.seek.total + 1,
    dailyCount: game.seek.dailyCount + 1,
    combo,
    bestCombo: Math.max(game.seek.bestCombo, combo),
    lastAt: now,
    pity: rare ? 0 : game.seek.pity + 1,
    legendaryPity: legendary ? 0 : game.seek.legendaryPity + 1,
    equipmentInventory,
    equipmentLoadout,
    equipmentDust: game.seek.equipmentDust + dustGained,
    lastDrop: report,
    recentDrops: [report, ...game.seek.recentDrops].slice(0, 5),
  }
  game.resources = credited.resources
  return { ok: true, report }
}

function temperEquipment(game: GameState, slot: EquipmentSlot): GameCommandResult {
  const item = game.seek.equipmentLoadout[slot]
  if (!item) throw new GameDomainError('该部位还没有灵装')
  const cost = Math.max(12, Math.round(item.power * 0.16))
  if (game.seek.equipmentDust < cost) throw new GameDomainError(`炼器尘不足，还需 ${cost - game.seek.equipmentDust}`)
  const boost = Math.max(5, Math.round(item.power * 0.08))
  const nextItem = { ...item, id: `${item.id}-temper-${randomUUID()}`, power: item.power + boost, affix: `${item.affix} · 淬炼+${boost}` }
  game.seek = {
    ...game.seek,
    equipmentDust: game.seek.equipmentDust - cost,
    equipmentLoadout: { ...game.seek.equipmentLoadout, [slot]: nextItem },
    equipmentInventory: game.seek.equipmentInventory.map(entry => entry.id === item.id ? nextItem : entry),
  }
  return { ok: true, item: nextItem }
}

function claimSeekMilestone(game: GameState, id: string): GameCommandResult {
  const milestone = SEEK_MILESTONES.find(item => item.id === id)
  if (!milestone) throw new GameDomainError('寻道里程碑不存在')
  if (game.seek.claimedMilestones.includes(id)) throw new GameDomainError('该里程碑已领取')
  if (game.seek.total < milestone.need) throw new GameDomainError('寻道次数尚未达标')
  const credited = addCappedReward(game, milestone.reward)
  game.resources = credited.resources
  game.seek = { ...game.seek, equipmentDust: game.seek.equipmentDust + milestone.dust, claimedMilestones: [...game.seek.claimedMilestones, id] }
  return { ok: true, gained: credited.gained }
}

function trainTroop(game: GameState, key: TroopKey, count: number): GameCommandResult {
  if (game.buildings.yanwu.level <= 0) throw new GameDomainError('需先兴建演武场')
  const room = currentTroopCap(game) - totalTroops(game)
  if (room <= 0) throw new GameDomainError('已达兵力上限，请先升级演武场')
  if (count > room) throw new GameDomainError(`超出兵力上限，最多还能练 ${room}`)
  const cost = Object.fromEntries(Object.entries(TROOP_MAP[key].cost).map(([resource, value]) => [resource, (value ?? 0) * count])) as Partial<Resources>
  if (!canAfford(game.resources, cost)) throw new GameDomainError('资源不足')
  game.resources = pay(game.resources, cost)
  game.troops = { ...game.troops, [key]: game.troops[key] + count }
  return { ok: true, key, count }
}

function setFormation(game: GameState, input: unknown): GameCommandResult {
  const formation = normalizeFormation(input)
  const deployed = Object.values(formation).reduce((sum, value) => sum + value, 0)
  if (deployed > currentMarchCap(game)) throw new GameDomainError(`超过统兵上限（${currentMarchCap(game)}）`)
  for (const key of Object.keys(formation) as TroopKey[]) if (formation[key] > game.troops[key]) throw new GameDomainError('编队数量超过当前兵力')
  game.formation = formation
  return { ok: true, formation }
}

function levelUpCultivator(game: GameState, key: string): GameCommandResult {
  const state = game.cultivators[key]
  if (!state?.owned) throw new GameDomainError('尚未招募该修士')
  if (state.level >= 20) throw new GameDomainError('已至最高等级')
  const cost = cultivatorCost(state.level + 1)
  if (!canAfford(game.resources, cost)) throw new GameDomainError('资源不足')
  game.resources = pay(game.resources, cost)
  game.cultivators = { ...game.cultivators, [key]: { ...state, level: state.level + 1 } }
  return { ok: true, key, level: state.level + 1 }
}

function challengeStage(game: GameState, id: number): GameCommandResult {
  const stage = STAGES.find(item => item.id === id)
  if (!stage) throw new GameDomainError('关卡不存在')
  if (id > game.clearedStage + 1) throw new GameDomainError('请先通关前置关卡')
  const deployed = formationUsed(game)
  if (deployed <= 0) throw new GameDomainError('请先在演武场配置出战编队')
  const myPower = battlePower(game, stage.enemyTroop)
  const win = myPower >= stage.enemyPower
  const firstClear = win && id > game.clearedStage
  const losses = calculateBattleLosses({ deployed, myPower, enemyPower: stage.enemyPower, win, winBase: 0.07, winMin: 0.04, winMax: 0.18, failBase: 0.22, failMin: 0.16, failMax: 0.42 })
  const committedFormation = { ...game.formation }
  const injured = applyFormationLosses(game.troops, game.formation, losses, deployed)
  game.troops = injured.troops
  game.formation = injured.formation
  let gained: Partial<Resources> = {}
  if (firstClear) {
    const credited = addCappedReward(game, stage.reward)
    game.resources = credited.resources
    gained = credited.gained
    if (stage.unlockCultivator && CULTIVATOR_MAP[stage.unlockCultivator]) {
      game.cultivators = { ...game.cultivators, [stage.unlockCultivator]: { owned: true, level: 1 } }
    }
    game.clearedStage = id
  }
  return { ok: true, name: stage.name, sprite: stage.sprite, win, myPower, enemyPower: stage.enemyPower, deployed, losses, enemyTroop: stage.enemyTroop, formation: committedFormation, firstClear, unlockCultivator: stage.unlockCultivator, gained }
}

function unlockQueue(game: GameState): GameCommandResult {
  if (game.queueSlots >= 2) throw new GameDomainError('已解锁全部队列')
  game.queueSlots = 2
  return { ok: true, queueSlots: game.queueSlots }
}

function challengeBoss(game: GameState): GameCommandResult {
  if (game.buildings.zongmen.level <= 0) throw new GameDomainError('需先兴建宗门大殿')
  const now = Date.now()
  if (game.lastBossAt > 0 && now < game.lastBossAt + BOSS.cooldownHours * 3600 * 1000) throw new GameDomainError('妖兽尚未再次现身')
  const hp = bossHp(game.buildings.dongfu.level)
  const myDamage = totalPower(game)
  const npcDamage = hp * BOSS.npcContribution
  const totalDamage = myDamage + npcDamage
  const tier = bossTier(totalDamage / hp)
  const credited = addCappedReward(game, bossReward(game.buildings.dongfu.level, tier.mult))
  game.resources = credited.resources
  game.lastBossAt = now
  return { ok: true, report: { bossHp: hp, myDamage, npcDamage, totalDamage, tierName: tier.name, gained: credited.gained } }
}

function claimQuest(game: GameState, id: string): GameCommandResult {
  if (game.claimedQuests.includes(id)) throw new GameDomainError('已领取')
  const quest = QUESTS.find(item => item.id === id)
  if (!quest) throw new GameDomainError('任务不存在')
  if (!quest.done(game)) throw new GameDomainError('尚未达成')
  const credited = addCappedReward(game, questReward(game, quest))
  game.resources = credited.resources
  game.claimedQuests = [...game.claimedQuests, id]
  return { ok: true, gained: credited.gained }
}

function markGuideFlag(game: GameState, flag: string): GameCommandResult {
  if (!game.guideFlags.includes(flag)) game.guideFlags = [...game.guideFlags, flag]
  return { ok: true, flag }
}

function researchGongfa(game: GameState, key: string): GameCommandResult {
  const def = GONGFA_MAP[key]
  if (!def) throw new GameDomainError('功法不存在')
  const cangjing = game.buildings.cangjing.level
  if (cangjing <= 0) throw new GameDomainError('需先兴建藏经阁')
  if (cangjing < def.requires) throw new GameDomainError(`需藏经阁 ${def.requires} 级`)
  if (game.gongfaResearching) throw new GameDomainError('已有功法在参研中')
  const current = game.gongfa[key] ?? 0
  if (current >= def.maxLevel) throw new GameDomainError('已至最高层')
  const cost = gongfaCost(current + 1)
  if (!canAfford(game.resources, cost)) throw new GameDomainError('资源不足')
  game.resources = pay(game.resources, cost)
  game.gongfaResearching = { key, until: Date.now() + gongfaTimeMs(current + 1) }
  return { ok: true, key, until: game.gongfaResearching.until }
}

function craftPill(game: GameState, key: PillKey): GameCommandResult {
  if (game.buildings.liandan.level <= 0) throw new GameDomainError('需先兴建炼丹房')
  if (game.pillCrafting) throw new GameDomainError('丹炉正忙')
  const cost = pillCost(game.buildings.liandan.level)
  if (!canAfford(game.resources, cost)) throw new GameDomainError('资源不足')
  game.resources = pay(game.resources, cost)
  game.pillCrafting = { key, until: Date.now() + PILL_MAP[key].craftMinutes * 60 * 1000 }
  return { ok: true, key, until: game.pillCrafting.until }
}

function collectPill(game: GameState): GameCommandResult {
  if (!game.pillCrafting) throw new GameDomainError('当前没有待收取的丹药')
  if (Date.now() < game.pillCrafting.until) throw new GameDomainError('丹药尚未出炉', 409, 'PILL_NOT_READY')
  const key = game.pillCrafting.key
  game.pills = { ...game.pills, [key]: (game.pills[key] ?? 0) + 1 }
  game.pillCrafting = null
  return { ok: true, key }
}

function usePill(game: GameState, key: PillKey): GameCommandResult {
  if ((game.pills[key] ?? 0) <= 0) throw new GameDomainError('没有这种丹药')
  const now = Date.now()
  const until = Math.max(now, game.pillActive[key] ?? 0) + PILL_MAP[key].hours * 3600 * 1000
  game.pills = { ...game.pills, [key]: game.pills[key] - 1 }
  game.pillActive = { ...game.pillActive, [key]: until }
  return { ok: true, key, until }
}

function forgeArtifact(game: GameState, key: string): GameCommandResult {
  const def = ARTIFACT_MAP[key]
  if (!def) throw new GameDomainError('法宝不存在')
  const lianqi = game.buildings.lianqi.level
  if (lianqi <= 0) throw new GameDomainError('需先兴建炼器阁')
  if (lianqi < def.requires) throw new GameDomainError(`需炼器阁 ${def.requires} 级`)
  const current = game.artifacts[key] ?? 0
  if (current >= def.maxLevel) throw new GameDomainError('已至最高阶')
  const cost = artifactCost(current + 1)
  if (!canAfford(game.resources, cost)) throw new GameDomainError('资源不足')
  game.resources = pay(game.resources, cost)
  game.artifacts = { ...game.artifacts, [key]: current + 1 }
  return { ok: true, key, level: current + 1 }
}

function exploreExpeditionNode(game: GameState, nodeId: string, choice: ExpeditionChoice): GameCommandResult {
  const refreshed = refreshExpeditionState(game, Date.now())
  Object.assign(game, refreshed)
  const node = game.expeditionNodes.find(item => item.id === nodeId)
  if (!node) throw new GameDomainError('远征节点不存在')
  if (node.depth !== game.expeditionProgress || node.resolved) throw new GameDomainError('该节点当前不可行军')
  if (game.expeditionEnergy <= 0) throw new GameDomainError('远征令不足，等待恢复或完成其他长期目标')
  const committedFormation = { ...game.formation }
  const deployed = formationUsed(game)
  let myPower = 0
  const enemyPower = node.enemyPower
  let win = true
  let losses = 0
  let outcome = ''
  if (node.kind === 'battle' || node.kind === 'boss') {
    if (game.buildings.yanwu.level <= 0) throw new GameDomainError('需先兴建演武场')
    if (deployed <= 0) throw new GameDomainError('请先在演武场配置出战编队')
    const tactic = choice === 'risk' ? 1.08 : 0.96
    myPower = Math.round(battlePower(game, node.enemyTroop) * tactic * expeditionBattleMultiplier(game))
    win = myPower >= enemyPower
    losses = calculateBattleLosses({ deployed, myPower, enemyPower, win, winBase: choice === 'risk' ? 0.12 : 0.07, winMin: 0.03, winMax: 0.24, failBase: choice === 'risk' ? 0.28 : 0.20, failMin: 0.14, failMax: 0.5 })
    outcome = win ? (node.kind === 'boss' ? '首领伏诛，远征军带着星火凯旋' : '阵线击穿，路线向前推进') : '敌阵未破，幸存部队收拢撤离'
  } else {
    const riskSucceeded = choice === 'steady' || expeditionRiskSuccess(node.id, node.kind)
    win = riskSucceeded
    losses = choice === 'risk' && deployed > 0 ? Math.max(1, Math.round(deployed * (riskSucceeded ? (node.kind === 'event' ? 0.03 : 0.045) : 0.08))) : 0
    outcome = riskSucceeded
      ? node.kind === 'gather' ? (choice === 'risk' ? '深入灵脉，带回一批高纯度灵材' : '稳妥采集，队伍平安归来')
        : node.kind === 'caravan' ? (choice === 'risk' ? '加速穿过险道，商队额外送来谢礼' : '护送商队抵达，获得约定酬金')
          : (choice === 'risk' ? '解开禁制，天机回响落入识海' : '绕开禁制，带走可辨认的遗物')
      : '风险判断失误，队伍带伤撤回，路线暂未推进'
  }
  const reward = scaledExpeditionReward(node.reward, expeditionRewardMultiplier(game, choice), win)
  const credited = addCappedReward(game, reward)
  const scoreGained = win ? Math.max(1, Math.round(node.score * (choice === 'risk' ? 1.18 : 1) * expeditionScoreMultiplier(game))) : 0
  const currencyGained = win ? Math.max(1, Math.round(node.currency * (choice === 'risk' ? 1.15 : 1))) : 0
  const injured = losses > 0 ? applyFormationLosses(game.troops, game.formation, losses, deployed) : { troops: { ...game.troops }, formation: { ...game.formation } }
  game.troops = injured.troops
  game.formation = injured.formation
  const nodes = game.expeditionNodes.map(item => item.id === node.id ? { ...item, resolved: win } : item)
  const nextEnergy = game.expeditionEnergy - 1
  const mapComplete = win && game.expeditionProgress + 1 >= EXPEDITION_DEPTHS
  const continueSameDay = mapComplete && nextEnergy > 0
  const nextMapCycle = continueSameDay ? game.expeditionMapCycle + 1 : game.expeditionMapCycle
  const nextNodes = continueSameDay ? createExpeditionNodes(game.expeditionMapDayKey, game.buildings.dongfu.level, nextMapCycle) : nodes
  game.resources = credited.resources
  game.expeditionNodes = nextNodes
  game.expeditionProgress = continueSameDay ? 0 : (win ? game.expeditionProgress + 1 : game.expeditionProgress)
  game.expeditionMapCycle = nextMapCycle
  game.expeditionEnergy = nextEnergy
  game.expeditionEnergyUpdatedAt = game.expeditionEnergy >= EXPEDITION_MAX_ENERGY ? Date.now() : game.expeditionEnergyUpdatedAt
  game.expeditionScore += scoreGained
  game.expeditionWeekScore += scoreGained
  game.expeditionCurrency += currencyGained
  const report: ExpeditionReport = {
    nodeId: node.id, kind: node.kind, title: node.title, choice, outcome, win,
    enemyTroop: node.enemyTroop, myPower, enemyPower, formation: committedFormation,
    deployed, losses, progressed: win,
    penalty: win ? (losses > 0 ? `行动令 -1 · 兵损 ${losses}` : '行动令 -1') : `行动令 -1 · 兵损 ${losses} · 路线未推进 · 奖励为 0`,
    scoreGained, currencyGained, gained: credited.gained,
  }
  return { ok: true, report }
}

function claimExpeditionWeekly(game: GameState, id: string): GameCommandResult {
  const reward = EXPEDITION_WEEKLY_REWARDS.find(item => item.id === id)
  if (!reward) throw new GameDomainError('周里程碑不存在')
  if (game.expeditionWeeklyClaimed.includes(id)) throw new GameDomainError('该里程碑已领取')
  if (game.expeditionWeekScore < reward.need) throw new GameDomainError('本周远征积分尚未达标')
  const credited = addCappedReward(game, reward.reward)
  game.resources = credited.resources
  game.expeditionCurrency += reward.currency
  game.expeditionWeeklyClaimed = [...game.expeditionWeeklyClaimed, id]
  return { ok: true, gained: credited.gained, currency: reward.currency }
}

function claimExpeditionSeason(game: GameState, id: string): GameCommandResult {
  const reward = EXPEDITION_SEASON_REWARDS.find(item => item.id === id)
  if (!reward) throw new GameDomainError('赛季里程碑不存在')
  if (game.expeditionSeasonRewards.includes(id)) throw new GameDomainError('该赛季奖励已领取')
  if (game.expeditionScore < reward.need) throw new GameDomainError('赛季远征积分尚未达标')
  const credited = addCappedReward(game, reward.reward)
  game.resources = credited.resources
  game.expeditionCurrency += reward.currency
  game.expeditionSeasonRewards = [...game.expeditionSeasonRewards, id]
  if (reward.relic) game.expeditionRelics = { ...game.expeditionRelics, [reward.relic]: Math.min(3, (game.expeditionRelics[reward.relic] ?? 0) + 1) }
  return { ok: true, gained: credited.gained, currency: reward.currency }
}

function buyExpeditionShop(game: GameState, id: string): GameCommandResult {
  const item = EXPEDITION_SHOP.find(entry => entry.id === id)
  if (!item) throw new GameDomainError('远征商店商品不存在')
  const bought = game.expeditionShopPurchases[id] ?? 0
  if (bought >= item.maxPurchases) throw new GameDomainError('该商品已达购买上限')
  if (game.expeditionCurrency < item.cost) throw new GameDomainError('远征币不足')
  const credited = addCappedReward(game, item.reward)
  game.resources = credited.resources
  game.expeditionCurrency -= item.cost
  game.expeditionShopPurchases = { ...game.expeditionShopPurchases, [id]: bought + 1 }
  if (item.relic) game.expeditionRelics = { ...game.expeditionRelics, [item.relic]: Math.min(3, (game.expeditionRelics[item.relic] ?? 0) + 1) }
  return { ok: true, gained: credited.gained }
}

function addCappedReward(game: GameState, reward: Partial<Resources>): { resources: Resources; gained: Partial<Resources> } {
  const resources = { ...game.resources }
  const gained: Partial<Resources> = {}
  const cap = currentCap(game)
  for (const key of Object.keys(reward) as ResourceKey[]) {
    const before = resources[key]
    resources[key] = Math.min(cap, before + (reward[key] ?? 0))
    gained[key] = resources[key] - before
  }
  return { resources, gained }
}

export function creditGameReward(game: GameState, reward: Partial<Resources>): Partial<Resources> {
  const credited = addCappedReward(game, reward)
  game.resources = credited.resources
  return credited.gained
}

function applyFormationLosses(troops: Record<TroopKey, number>, formation: Record<TroopKey, number>, losses: number, deployed: number): { troops: Record<TroopKey, number>; formation: Record<TroopKey, number> } {
  const nextTroops = { ...troops }
  const nextFormation = { ...formation }
  let remaining = losses
  const order = (Object.keys(nextFormation) as TroopKey[]).filter(key => nextFormation[key] > 0).sort((a, b) => nextFormation[b] - nextFormation[a])
  for (const key of order) {
    if (remaining <= 0) break
    const share = Math.min(nextTroops[key], nextFormation[key], Math.ceil(losses * nextFormation[key] / Math.max(1, deployed)), remaining)
    nextTroops[key] -= share
    nextFormation[key] = Math.min(nextFormation[key], nextTroops[key])
    remaining -= share
  }
  return { troops: nextTroops, formation: nextFormation }
}

function normalizeFormation(input: unknown): Record<TroopKey, number> {
  if (!input || typeof input !== 'object') throw new GameDomainError('编队格式无效')
  const value = input as Record<string, unknown>
  const formation = { kuilei: readInteger(value.kuilei, '傀儡兵编队', 0, 1_000_000), yushou: readInteger(value.yushou, '御兽军编队', 0, 1_000_000), fuxiu: readInteger(value.fuxiu, '符修编队', 0, 1_000_000) }
  return formation
}

function cloneGame(game: GameState): GameState {
  return JSON.parse(JSON.stringify(game)) as GameState
}

function readString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 100) throw new GameDomainError(`${label}无效`)
  return value.trim()
}

function readInteger(value: unknown, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new GameDomainError(`${label}无效`)
  return Number(value)
}

function readBuildingKey(value: unknown): BuildingKey {
  const key = readString(value, '建筑') as BuildingKey
  if (!BUILDING_MAP[key]) throw new GameDomainError('建筑不存在')
  return key
}

function readTroopKey(value: unknown): TroopKey {
  const key = readString(value, '兵种') as TroopKey
  if (!TROOP_MAP[key]) throw new GameDomainError('兵种不存在')
  return key
}

function readEquipmentSlot(value: unknown): EquipmentSlot {
  const slot = readString(value, '装备部位') as EquipmentSlot
  if (!['weapon', 'armor', 'accessory'].includes(slot)) throw new GameDomainError('装备部位无效')
  return slot
}

function readGender(value: unknown): Gender {
  if (value !== 'male' && value !== 'female') throw new GameDomainError('修行身份无效')
  return value
}

function readPillKey(value: unknown): PillKey {
  const key = readString(value, '丹药') as PillKey
  if (!PILL_MAP[key]) throw new GameDomainError('丹药不存在')
  return key
}

function readChoice(value: unknown): ExpeditionChoice {
  if (value === undefined || value === 'steady') return 'steady'
  if (value === 'risk') return 'risk'
  throw new GameDomainError('远征策略无效')
}

function emptyResources(): Resources {
  return { lingshi: 0, lingqi: 0, lingyao: 0, kuanglingcai: 0 }
}

function battlePowerFromSingleTroop(game: GameState, troop: TroopKey, enemy: TroopKey, now: number): number {
  const value = troopPower(game, troop, now)
  const cb = counterBonus(game)
  const multiplier = TROOP_MAP[troop].counters === enemy
    ? cb
    : TROOP_MAP[enemy].counters === troop
      ? 1 / cb
      : 1
  return value * multiplier
}

export class GameDomainError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'INVALID_GAME_COMMAND') {
    super(message)
  }
}
