import { randomBytes, randomUUID } from 'node:crypto'
import { CULTIVATORS, REALMS, TROOP_MAP } from '../src/game/data'
import { ARTIFACT_MAP, GONGFA_MAP } from '../src/game/systems'
import { CULTIVATOR_MAX_LEVEL, TUNE } from '../src/game/balance'
import { battlePowerFromBattleProfile, defaultBattleProfile, formationPowerFromBattleProfile } from '../src/game/compute'
import { calculateBattleLosses } from '../src/game/penalty'
import type { BattleProfile, Resources, TroopKey } from '../src/game/types'
import { WARFRONT_NODE_MAP, WARFRONT_NODES, WARFRONT_SPAWN_POINTS, WARFRONT_TACTICS } from '../src/game/warfront'
import { ONLINE_SCHEMA_VERSION, type AttackPayload, type GarrisonPayload, type LeaderboardEntry, type MapPoint, type MarchPayload, type OnlineArmy, type OnlineBattleReport, type OnlineFriend, type OnlineFriendRequest, type OnlinePlayerSearch, type SyncBattleProfilePayload, type WarfrontSnapshot, type WithdrawPayload } from '../src/online/contracts'
import type { ServerFriendRequest, ServerMarch, ServerNode, ServerPlayer, ServerState } from './model'

const TROOP_KEYS: TroopKey[] = ['kuilei', 'yushou', 'fuxiu']
const STARTING_TROOPS = 120
const RECRUIT_AMOUNT = 24
const RECRUIT_COOLDOWN_MS = 60_000
const ATTACK_COOLDOWN_MS = 10_000
const WAR_ENERGY_MAX = 3
const WAR_ENERGY_REGEN_MS = 30_000
const GARRISON_CAP = 360
const MAX_TROOPS = 300
const MAX_MARCH_TROOPS = 180
const MARCH_MIN_MS = 4_000
const MARCH_MAX_MS = 9_000
const MARCH_MS_PER_DISTANCE = 62
const FRIEND_ONLINE_WINDOW_MS = 15_000
const PROFILE_TROOPS_MAX = 1_000_000
const PROFILE_EQUIPMENT_MAX = 10_000

export class DomainError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'INVALID_REQUEST') { super(message) }
}

export function createGuest(state: ServerState, requestedName?: string): ServerPlayer {
  state.playerSequence += 1
  const id = `p-${randomUUID()}`
  const sects = Object.values(state.sects)
  const sect = sects[(state.playerSequence - 1) % sects.length]
  const fallbackName = `散修${String(state.playerSequence).padStart(3, '0')}`
  const name = sanitizeName(requestedName) || fallbackName
  const player: ServerPlayer = {
    id,
    token: randomBytes(24).toString('base64url'),
    name,
    sectId: sect.id,
    score: 0,
    troops: { kuilei: STARTING_TROOPS, yushou: STARTING_TROOPS, fuxiu: STARTING_TROOPS },
    cooldownUntil: 0,
    recruitReadyAt: 0,
    warEnergy: WAR_ENERGY_MAX,
    warEnergyUpdatedAt: Date.now(),
    mapPosition: spawnPositionForSect(sect.id),
    march: null,
    battleProfile: defaultBattleProfile(),
    profileUpdatedAt: Date.now(),
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  }
  state.players[id] = player
  return player
}

export function authenticate(state: ServerState, token: string | undefined): ServerPlayer {
  if (!token) throw new DomainError('请先进入联机战区', 401, 'UNAUTHORIZED')
  const player = Object.values(state.players).find(x => x.token === token)
  if (!player) throw new DomainError('联机凭证已失效，请重新登录', 401, 'UNAUTHORIZED')
  player.lastSeenAt = Date.now()
  advanceWorld(state, Date.now())
  restoreWarEnergy(player)
  return player
}

export function createSnapshot(state: ServerState, player: ServerPlayer): WarfrontSnapshot {
  const now = Date.now()
  advanceWorld(state, now)
  restoreWarEnergy(player)
  refreshAllGarrisons(state)
  const players = Object.values(state.players)
  return {
    schemaVersion: ONLINE_SCHEMA_VERSION,
    seasonId: state.seasonId,
    seasonName: state.seasonName,
    serverTime: Date.now(),
    player: {
      id: player.id,
      name: player.name,
      sectId: player.sectId,
      sectName: state.sects[player.sectId]?.name ?? '无宗门',
      score: player.score,
      troops: { ...player.troops },
      cooldownUntil: player.cooldownUntil,
      recruitReadyAt: player.recruitReadyAt,
      warEnergy: player.warEnergy,
      warEnergyMax: WAR_ENERGY_MAX,
      mapPosition: { ...player.mapPosition },
      battlePower: Math.round(formationPowerFromBattleProfile(player.battleProfile, player.troops)),
      battleProfileUpdatedAt: player.profileUpdatedAt,
    },
    nodes: WARFRONT_NODES.map(def => {
      const node = state.nodes[def.key]
      const owner = node.ownerPlayerId ? state.players[node.ownerPlayerId] : null
      const sect = node.ownerSectId ? state.sects[node.ownerSectId] : null
      return {
        key: node.key,
        ownerPlayerId: owner?.id ?? null,
        ownerName: owner?.name ?? def.enemyName,
        ownerSectId: sect?.id ?? null,
        ownerSectName: sect?.name ?? null,
        guardTroop: node.guardTroop,
        guardPower: node.guardPower,
        garrison: { ...node.guardFormation },
        garrisonTotal: sumTroops(node.guardFormation),
        garrisonPower: node.guardPower,
        garrisonByMe: { ...(node.garrisonContributors[player.id] ?? emptyFormation()) },
        version: node.version,
      }
    }),
    playerLeaderboard: rank(players.map(x => ({ id: x.id, name: x.name, score: x.score })), player.id),
    sectLeaderboard: rank(Object.values(state.sects).map(x => ({ id: x.id, name: x.name, score: x.score })), player.sectId),
    reports: state.reports.filter(x => x.attackerId === player.id || x.defenderPlayerId === player.id).slice(-12).reverse(),
    armies: buildArmies(state, player, now),
    friends: buildFriends(state, player, now),
    friendRequests: buildFriendRequests(state, player),
    battleProfile: cloneBattleProfile(player.battleProfile),
    warfrontIncome: warfrontIncomeForPlayer(state, player),
  }
}

/** 接收本地洞府成长镜像；服务器只保存白名单字段并重新计算战力。 */
export function syncBattleProfile(state: ServerState, player: ServerPlayer, payload: SyncBattleProfilePayload): void {
  player.battleProfile = normalizeBattleProfile(payload.profile)
  player.profileUpdatedAt = Date.now()
  refreshAllGarrisons(state)
}

export function searchPlayers(state: ServerState, player: ServerPlayer, rawQuery: string, onlineOnly = false): OnlinePlayerSearch[] {
  const query = rawQuery.trim().toLocaleLowerCase()
  const now = Date.now()
  return Object.values(state.players)
    .filter(candidate => candidate.id !== player.id)
    .filter(candidate => !onlineOnly || now - candidate.lastSeenAt < FRIEND_ONLINE_WINDOW_MS)
    .filter(candidate => !query || candidate.name.toLocaleLowerCase().includes(query) || candidate.id.toLocaleLowerCase().includes(query))
    .sort((a, b) => Number(now - b.lastSeenAt < FRIEND_ONLINE_WINDOW_MS) - Number(now - a.lastSeenAt < FRIEND_ONLINE_WINDOW_MS) || b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, 20)
    .map(candidate => {
      const relation = relationBetween(state, player.id, candidate.id)
      return {
        id: candidate.id,
        name: candidate.name,
        sectId: candidate.sectId,
        sectName: state.sects[candidate.sectId]?.name ?? '无宗门',
        score: candidate.score,
        online: now - candidate.lastSeenAt < FRIEND_ONLINE_WINDOW_MS,
        relation: relation.kind,
        requestId: relation.request?.id ?? null,
      }
    })
}

/** 改名必须在服务端完成，避免客户端各自展示不同身份或伪造战报署名。 */
export function renamePlayer(state: ServerState, player: ServerPlayer, rawName: string): void {
  const name = sanitizeName(rawName)
  if (name.length < 2) throw new DomainError('修士名需为 2 至 12 个字符', 400, 'INVALID_NAME')
  const duplicate = Object.values(state.players).some(candidate => candidate.id !== player.id && candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  if (duplicate) throw new DomainError('这个修士名已经有人使用', 409, 'NAME_TAKEN')
  player.name = name
}

export function sendFriendRequest(state: ServerState, player: ServerPlayer, targetPlayerId: string): void {
  const target = state.players[targetPlayerId]
  if (!target) throw new DomainError('找不到这位玩家', 404, 'PLAYER_NOT_FOUND')
  if (target.id === player.id) throw new DomainError('不能添加自己为好友', 400, 'SELF_FRIEND_REQUEST')
  if (state.friendships[friendshipKey(player.id, target.id)]) throw new DomainError('你们已经是好友了', 409, 'ALREADY_FRIENDS')
  const relation = relationBetween(state, player.id, target.id)
  if (relation.request) {
    throw new DomainError(relation.kind === 'incoming' ? '对方已经向你发送了好友申请' : '好友申请已发送，等待对方回应', 409, 'FRIEND_REQUEST_EXISTS')
  }
  const id = `fr-${randomUUID()}`
  state.friendRequests[id] = { id, fromPlayerId: player.id, toPlayerId: target.id, createdAt: Date.now(), respondedAt: null }
}

export function respondFriendRequest(state: ServerState, player: ServerPlayer, requestId: string, accept: boolean): void {
  const request = state.friendRequests[requestId]
  if (!request || request.toPlayerId !== player.id) throw new DomainError('好友申请不存在或无权处理', 404, 'FRIEND_REQUEST_NOT_FOUND')
  if (request.respondedAt !== null) throw new DomainError('好友申请已经处理过了', 409, 'FRIEND_REQUEST_HANDLED')
  request.respondedAt = Date.now()
  if (!accept) return
  if (state.friendships[friendshipKey(request.fromPlayerId, request.toPlayerId)]) return
  state.friendships[friendshipKey(request.fromPlayerId, request.toPlayerId)] = {
    playerA: request.fromPlayerId,
    playerB: request.toPlayerId,
    createdAt: Date.now(),
  }
}

export function removeFriend(state: ServerState, player: ServerPlayer, friendId: string): void {
  const key = friendshipKey(player.id, friendId)
  if (!state.friendships[key]) throw new DomainError('好友关系不存在', 404, 'FRIEND_NOT_FOUND')
  delete state.friendships[key]
}

export function march(state: ServerState, player: ServerPlayer, payload: MarchPayload): void {
  if (!payload.requestId || payload.requestId.length > 100) throw new DomainError('缺少有效的出征编号')
  const idempotencyKey = mutationKey(player, 'march', payload.requestId)
  if (state.idempotency[idempotencyKey]) return

  const def = WARFRONT_NODE_MAP[payload.nodeKey]
  const node = state.nodes[payload.nodeKey]
  if (!def || !node) throw new DomainError('据点不存在', 404, 'NODE_NOT_FOUND')
  if (!WARFRONT_TACTICS[payload.tactic]) throw new DomainError('出征策略无效')
  if (node.ownerSectId === player.sectId) throw new DomainError('此据点由同宗道友驻守')
  if (player.march) throw new DomainError('已有一支部队正在行军', 409, 'MARCH_ACTIVE')
  const now = Date.now()
  if (now < player.cooldownUntil) throw new DomainError('部队正在整备，请稍候再出征', 409, 'COOLDOWN')
  if (player.warEnergy <= 0) throw new DomainError('战争令不足，等待恢复或先征募援军', 409, 'WAR_ENERGY')

  const formation = normalizeFormation(payload.formation, player.troops)
  const deployed = sumTroops(formation)
  if (deployed <= 0) throw new DomainError('请至少派出一支部队')
  if (deployed > MAX_MARCH_TROOPS) throw new DomainError(`超过赛季统兵上限（${MAX_MARCH_TROOPS}）`)

  const from = { ...player.mapPosition }
  const path = buildMarchPath(from, def.key)
  const distance = pathDistance(path)
  const duration = Math.max(MARCH_MIN_MS, Math.min(MARCH_MAX_MS, Math.round(2_200 + distance * MARCH_MS_PER_DISTANCE)))
  const active: ServerMarch = {
    id: `m-${randomUUID()}`,
    requestId: payload.requestId,
    from,
    path,
    destinationKey: def.key,
    startedAt: now,
    arriveAt: now + duration,
    formation,
    deployed,
    tactic: payload.tactic,
  }
  for (const key of TROOP_KEYS) player.troops[key] -= formation[key]
  player.warEnergy -= 1
  player.march = active
  player.cooldownUntil = now + ATTACK_COOLDOWN_MS
  state.idempotency[idempotencyKey] = active.id
}

/** 推进行军世界；所有结算都发生在抵达瞬间，前端只消费快照。 */
export function advanceWorld(state: ServerState, now: number): void {
  for (const player of Object.values(state.players)) {
    const active = player.march
    if (!active || active.arriveAt > now) continue
    resolveMarch(state, player, active)
  }
}

function resolveMarch(state: ServerState, player: ServerPlayer, active: ServerMarch): void {
  const def = WARFRONT_NODE_MAP[active.destinationKey]
  const node = state.nodes[active.destinationKey]
  if (!def || !node) {
    returnMarch(player, active)
    return
  }

  if (node.ownerSectId === player.sectId) {
    returnMarch(player, active)
    return
  }

  const enemyPower = node.guardPower
  const enemyTroop = node.guardTroop
  const defenderPlayerId = node.ownerPlayerId
  const defenderName = defenderPlayerId ? state.players[defenderPlayerId]?.name ?? def.enemyName : def.enemyName
  const tactic = WARFRONT_TACTICS[active.tactic]
  const myPower = Math.round(calculatePower(player.battleProfile, active.formation, enemyTroop) * tactic.powerFactor)
  const win = myPower >= enemyPower
  const losses = calculateBattleLosses({
    deployed: active.deployed,
    myPower,
    enemyPower,
    win,
    lossFactor: tactic.lossFactor,
    winBase: 0.1,
    winMin: 0.04,
    winMax: 0.22,
    failBase: 0.24,
    failMin: 0.16,
    failMax: 0.45,
  })
  const survivors = { ...active.formation }
  applyLosses(survivors, active.formation, losses)
  const scoreGained = win ? 20 + Math.round(enemyPower / 80) : 4
  const captured = win && node.ownerPlayerId !== player.id

  player.score += scoreGained
  state.sects[player.sectId].score += scoreGained
  if (win) {
    occupyNode(node, player, survivors, myPower)
    player.mapPosition = { ...def.position }
  } else {
    addFormation(player.troops, survivors)
    player.mapPosition = { ...active.from }
  }
  player.march = null

  const report: OnlineBattleReport = {
    id: `r-${randomUUID()}`,
    requestId: active.requestId,
    attackerId: player.id,
    attackerName: player.name,
    defenderPlayerId,
    defenderName,
    createdAt: Date.now(),
    nodeKey: def.key,
    nodeName: def.name,
    enemyName: defenderName,
    enemyTroop,
    tactic: active.tactic,
    win,
    myPower,
    enemyPower,
    formation: { ...active.formation },
    deployed: active.deployed,
    losses,
    scoreGained,
    captured,
    gained: win ? def.reward : {},
    troopsAfter: { ...player.troops },
  }
  appendReport(state, report)
}

function returnMarch(player: ServerPlayer, active: ServerMarch): void {
  addFormation(player.troops, active.formation)
  player.mapPosition = { ...active.from }
  player.march = null
}

function addFormation(target: Record<TroopKey, number>, formation: Record<TroopKey, number>): void {
  for (const key of TROOP_KEYS) target[key] = Math.min(MAX_TROOPS, target[key] + formation[key])
}

function appendReport(state: ServerState, report: OnlineBattleReport): void {
  state.reports.push(report)
  if (state.reports.length > 300) state.reports.splice(0, state.reports.length - 300)
}

export function attack(state: ServerState, player: ServerPlayer, payload: AttackPayload): OnlineBattleReport {
  if (!payload.requestId || payload.requestId.length > 100) throw new DomainError('缺少有效的出征编号')
  const idempotencyKey = `${player.id}:${payload.requestId}`
  const priorId = state.idempotency[idempotencyKey]
  if (priorId) {
    const prior = state.reports.find(x => x.id === priorId)
    if (prior) return prior
  }

  const def = WARFRONT_NODE_MAP[payload.nodeKey]
  const node = state.nodes[payload.nodeKey]
  if (!def || !node) throw new DomainError('据点不存在', 404, 'NODE_NOT_FOUND')
  if (!WARFRONT_TACTICS[payload.tactic]) throw new DomainError('出征策略无效')
  if (node.ownerSectId === player.sectId) throw new DomainError('此据点由同宗道友驻守')
  if (player.march) throw new DomainError('已有一支部队正在行军', 409, 'MARCH_ACTIVE')
  const now = Date.now()
  if (now < player.cooldownUntil) throw new DomainError('部队正在整备，请稍候再出征', 409, 'COOLDOWN')
  if (player.warEnergy <= 0) throw new DomainError('战争令不足，等待恢复或先征募援军', 409, 'WAR_ENERGY')

  const formation = normalizeFormation(payload.formation, player.troops)
  const deployed = sumTroops(formation)
  if (deployed <= 0) throw new DomainError('请至少派出一支部队')
  if (deployed > 180) throw new DomainError('超过赛季统兵上限（180）')

  const enemyPower = node.guardPower
  const enemyTroop = node.guardTroop
  const defenderPlayerId = node.ownerPlayerId
  const defenderName = defenderPlayerId ? state.players[defenderPlayerId]?.name ?? def.enemyName : def.enemyName
  const tactic = WARFRONT_TACTICS[payload.tactic]
  const myPower = Math.round(calculatePower(player.battleProfile, formation, enemyTroop) * tactic.powerFactor)
  const win = myPower >= enemyPower
  const losses = calculateBattleLosses({
    deployed,
    myPower,
    enemyPower,
    win,
    lossFactor: tactic.lossFactor,
    winBase: 0.1,
    winMin: 0.04,
    winMax: 0.22,
    failBase: 0.24,
    failMin: 0.16,
    failMax: 0.45,
  })
  applyLosses(player.troops, formation, losses)
  player.warEnergy -= 1

  const scoreGained = win ? 20 + Math.round(enemyPower / 80) : 4
  player.score += scoreGained
  player.cooldownUntil = now + ATTACK_COOLDOWN_MS
  state.sects[player.sectId].score += scoreGained
  const captured = win && node.ownerPlayerId !== player.id
  if (win) occupyNode(node, player, survivorsOf(formation, player.troops), myPower)

  const report: OnlineBattleReport = {
    id: `r-${randomUUID()}`,
    requestId: payload.requestId,
    attackerId: player.id,
    attackerName: player.name,
    defenderPlayerId,
    defenderName,
    createdAt: now,
    nodeKey: def.key,
    nodeName: def.name,
    enemyName: defenderName,
    enemyTroop,
    tactic: payload.tactic,
    win,
    myPower,
    enemyPower,
    formation,
    deployed,
    losses,
    scoreGained,
    captured,
    gained: win ? def.reward : {},
    troopsAfter: { ...player.troops },
  }
  state.reports.push(report)
  if (state.reports.length > 300) state.reports.splice(0, state.reports.length - 300)
  state.idempotency[idempotencyKey] = report.id
  return report
}

export function garrison(state: ServerState, player: ServerPlayer, payload: GarrisonPayload): void {
  const idempotencyKey = mutationKey(player, 'garrison', payload.requestId)
  if (state.idempotency[idempotencyKey]) return
  const node = state.nodes[payload.nodeKey]
  if (!node || !WARFRONT_NODE_MAP[payload.nodeKey]) throw new DomainError('据点不存在', 404, 'NODE_NOT_FOUND')
  if (node.ownerSectId !== player.sectId) throw new DomainError('只有同宗据点可以派遣援军')
  const formation = normalizeFormation(payload.formation, player.troops)
  const amount = sumTroops(formation)
  if (amount <= 0) throw new DomainError('请至少派出一支援军')
  if (sumTroops(node.guardFormation) + amount > GARRISON_CAP) throw new DomainError(`据点驻军上限为 ${GARRISON_CAP}`)
  for (const key of TROOP_KEYS) player.troops[key] -= formation[key]
  for (const key of TROOP_KEYS) node.guardFormation[key] += formation[key]
  const mine = node.garrisonContributors[player.id] ?? emptyFormation()
  for (const key of TROOP_KEYS) mine[key] += formation[key]
  node.garrisonContributors[player.id] = mine
  refreshGarrison(state, node)
  node.version += 1
  state.idempotency[idempotencyKey] = 'garrisoned'
}

export function withdrawGarrison(state: ServerState, player: ServerPlayer, payload: WithdrawPayload): void {
  const idempotencyKey = mutationKey(player, 'withdraw', payload.requestId)
  if (state.idempotency[idempotencyKey]) return
  const node = state.nodes[payload.nodeKey]
  if (!node || !WARFRONT_NODE_MAP[payload.nodeKey]) throw new DomainError('据点不存在', 404, 'NODE_NOT_FOUND')
  if (node.ownerSectId !== player.sectId) throw new DomainError('据点已不属于你的宗门')
  const mine = node.garrisonContributors[player.id] ?? emptyFormation()
  const request = normalizeFormation(payload.formation, mine)
  if (sumTroops(request) <= 0) throw new DomainError('没有可撤回的援军')
  for (const key of TROOP_KEYS) {
    if (player.troops[key] + request[key] > MAX_TROOPS) throw new DomainError('撤回后超过个人兵力上限')
    player.troops[key] += request[key]
    node.guardFormation[key] -= request[key]
    mine[key] -= request[key]
  }
  node.garrisonContributors[player.id] = mine
  refreshGarrison(state, node)
  node.version += 1
  state.idempotency[idempotencyKey] = 'withdrawn'
}

export function recruit(player: ServerPlayer): Record<TroopKey, number> {
  const now = Date.now()
  if (now < player.recruitReadyAt) throw new DomainError('赛季征募尚在整备', 409, 'RECRUIT_COOLDOWN')
  const gained = { kuilei: RECRUIT_AMOUNT, yushou: RECRUIT_AMOUNT, fuxiu: RECRUIT_AMOUNT }
  for (const key of TROOP_KEYS) player.troops[key] = Math.min(300, player.troops[key] + gained[key])
  player.recruitReadyAt = now + RECRUIT_COOLDOWN_MS
  return gained
}

export function createSect(state: ServerState, player: ServerPlayer, rawName: string): void {
  const name = sanitizeName(rawName)
  if (!name) throw new DomainError('宗门名称需为 2—12 个字符')
  if (Object.values(state.sects).some(x => x.name === name)) throw new DomainError('该宗门名称已被占用', 409)
  const id = `sect-${randomUUID()}`
  state.sects[id] = { id, name, score: 0, createdAt: Date.now() }
  transferPlayerNodes(state, player, id)
  player.sectId = id
}

export function joinSect(state: ServerState, player: ServerPlayer, sectId: string): void {
  if (!state.sects[sectId]) throw new DomainError('宗门不存在', 404)
  transferPlayerNodes(state, player, sectId)
  player.sectId = sectId
}

function occupyNode(node: ServerNode, player: ServerPlayer, formation: Record<TroopKey, number>, power: number) {
  node.ownerPlayerId = player.id
  node.ownerSectId = player.sectId
  node.guardFormation = { ...formation }
  node.garrisonContributors = { [player.id]: { ...formation } }
  node.guardTroop = strongestTroop(formation)
  node.guardPower = Math.max(240, Math.round(Math.max(basePower(player.battleProfile, formation) * 1.05, power * 0.68)))
  node.version += 1
}

function transferPlayerNodes(state: ServerState, player: ServerPlayer, nextSectId: string) {
  const owned = Object.values(state.nodes).filter(node => node.ownerPlayerId === player.id)
  for (const node of owned) {
    const otherContributors = Object.entries(node.garrisonContributors ?? {})
      .some(([id, formation]) => id !== player.id && sumTroops(formation) > 0)
    if (otherContributors) throw new DomainError('据点有其他宗门成员驻军，暂不能更换宗门', 409, 'GARRISON_TRANSFER_BLOCKED')
    node.ownerSectId = nextSectId
  }
}

function normalizeFormation(input: Record<TroopKey, number>, owned: Record<TroopKey, number>): Record<TroopKey, number> {
  const out = { kuilei: 0, yushou: 0, fuxiu: 0 }
  for (const key of TROOP_KEYS) {
    const value = Number(input?.[key])
    if (!Number.isInteger(value) || value < 0) throw new DomainError('编队数量必须是非负整数')
    if (value > owned[key]) throw new DomainError(`${TROOP_MAP[key].name}数量超过服务器兵力`)
    out[key] = value
  }
  return out
}

function calculatePower(profile: BattleProfile, formation: Record<TroopKey, number>, enemy: TroopKey): number {
  return battlePowerFromBattleProfile(profile, formation, enemy)
}

function basePower(profile: BattleProfile, formation: Record<TroopKey, number>): number {
  return formationPowerFromBattleProfile(profile, formation)
}

function refreshGarrison(state: ServerState, node: ServerNode) {
  const total = sumTroops(node.guardFormation)
  node.guardTroop = total > 0 ? strongestTroop(node.guardFormation) : node.guardTroop
  if (total <= 0) {
    if (node.guardPower !== 240) node.version += 1
    node.guardPower = 240
    return
  }
  const power = Object.entries(node.garrisonContributors).reduce((sum, [playerId, formation]) => {
    const contributor = state.players[playerId]
    return sum + (contributor ? basePower(contributor.battleProfile, formation) : 0)
  }, 0)
  // 旧 schema 可能只有守军快照，没有贡献者明细；保留旧战力，等下一次真实驻防再纳入统一公式。
  if (power <= 0) return
  const nextPower = Math.max(240, Math.round(power * 1.05))
  if (nextPower !== node.guardPower) node.version += 1
  node.guardPower = nextPower
}

function refreshAllGarrisons(state: ServerState): void {
  for (const node of Object.values(state.nodes)) {
    if (node.ownerSectId) refreshGarrison(state, node)
  }
}

function warfrontIncomeForPlayer(state: ServerState, player: ServerPlayer): Resources {
  const income: Resources = { lingshi: 0, lingqi: 0, lingyao: 0, kuanglingcai: 0 }
  for (const def of WARFRONT_NODES) {
    const node = state.nodes[def.key]
    if (node?.ownerSectId !== player.sectId) continue
    for (const key of Object.keys(def.income) as Array<keyof Resources>) income[key] += def.income[key] ?? 0
  }
  return income
}

function cloneBattleProfile(profile: BattleProfile): BattleProfile {
  return {
    ...profile,
    troops: { ...profile.troops },
    cultivators: Object.fromEntries(Object.entries(profile.cultivators).map(([key, value]) => [key, { ...value }])),
    gongfa: { ...profile.gongfa },
    artifacts: { ...profile.artifacts },
    activePills: { ...profile.activePills },
  }
}

function normalizeBattleProfile(raw: BattleProfile): BattleProfile {
  if (!raw || raw.version !== 1) throw new DomainError('战斗档案版本不受支持', 400, 'PROFILE_VERSION')
  const profile = defaultBattleProfile()
  profile.dongfuLevel = integerField(raw.dongfuLevel, 0, TUNE.dongfuMax, '洞府等级')
  profile.yanwuLevel = integerField(raw.yanwuLevel, 0, TUNE.dongfuMax, '演武场等级')
  profile.realm = integerField(raw.realm, 0, REALMS.length - 1, '境界')
  for (const key of TROOP_KEYS) profile.troops[key] = integerField(raw.troops?.[key], 0, PROFILE_TROOPS_MAX, `${key}兵力`)
  for (const def of CULTIVATORS) {
    const value = raw.cultivators?.[def.key]
    if (!value) continue
    if (typeof value.owned !== 'boolean') throw new DomainError('修士档案无效', 400, 'PROFILE_CULTIVATOR')
    profile.cultivators[def.key] = { owned: value.owned, level: integerField(value.level, 0, CULTIVATOR_MAX_LEVEL, `${def.name}等级`) }
  }
  for (const def of Object.values(GONGFA_MAP)) {
    const level = raw.gongfa?.[def.key]
    if (level !== undefined) profile.gongfa[def.key] = integerField(level, 0, def.maxLevel, `${def.name}等级`)
  }
  for (const def of Object.values(ARTIFACT_MAP)) {
    const level = raw.artifacts?.[def.key]
    if (level !== undefined) profile.artifacts[def.key] = integerField(level, 0, def.maxLevel, `${def.name}等级`)
  }
  if (!Number.isFinite(raw.equipmentPower) || raw.equipmentPower < 0 || raw.equipmentPower > PROFILE_EQUIPMENT_MAX) {
    throw new DomainError('灵装战力档案无效', 400, 'PROFILE_EQUIPMENT')
  }
  profile.equipmentPower = Math.round(raw.equipmentPower)
  for (const key of ['qi', 'body', 'mind'] as const) {
    if (typeof raw.activePills?.[key] !== 'boolean') throw new DomainError('丹药档案无效', 400, 'PROFILE_PILL')
    profile.activePills[key] = raw.activePills[key]
  }
  return profile
}

function integerField(value: unknown, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new DomainError(`${label}档案无效`, 400, 'PROFILE_FIELD')
  return Number(value)
}

function survivorsOf(formation: Record<TroopKey, number>, troopsAfter: Record<TroopKey, number>): Record<TroopKey, number> {
  return TROOP_KEYS.reduce((out, key) => {
    out[key] = Math.min(formation[key], troopsAfter[key])
    return out
  }, emptyFormation())
}

function emptyFormation(): Record<TroopKey, number> {
  return { kuilei: 0, yushou: 0, fuxiu: 0 }
}

function applyLosses(troops: Record<TroopKey, number>, formation: Record<TroopKey, number>, losses: number) {
  let remaining = losses
  const deployed = sumTroops(formation)
  const order = [...TROOP_KEYS].filter(k => formation[k] > 0).sort((a, b) => formation[b] - formation[a])
  for (const key of order) {
    if (remaining <= 0) break
    const share = Math.min(troops[key], Math.min(formation[key], Math.ceil(losses * formation[key] / deployed), remaining))
    troops[key] -= share
    remaining -= share
  }
  if (remaining > 0) {
    for (const key of order) {
      const share = Math.min(troops[key], remaining)
      troops[key] -= share
      remaining -= share
      if (remaining <= 0) break
    }
  }
}

function strongestTroop(formation: Record<TroopKey, number>): TroopKey {
  return [...TROOP_KEYS].sort((a, b) => formation[b] - formation[a])[0]
}

function buildArmies(state: ServerState, player: ServerPlayer, now: number): OnlineArmy[] {
  return Object.values(state.players).flatMap(other => {
    const active = other.march
    if (!active) return []
    const destination = WARFRONT_NODE_MAP[active.destinationKey]
    if (!destination) return []
    const progress = Math.max(0, Math.min(1, (now - active.startedAt) / Math.max(1, active.arriveAt - active.startedAt)))
    return [{
      id: active.id,
      playerId: other.id,
      name: other.name,
      sectId: other.sectId,
      sectName: state.sects[other.sectId]?.name ?? '无宗门',
      isMine: other.id === player.id,
      position: interpolatePath(active.path, progress),
      destinationKey: destination.key,
      from: { ...active.from },
      to: { ...destination.position },
      startedAt: active.startedAt,
      arriveAt: active.arriveAt,
      deployed: active.deployed,
      formation: { ...active.formation },
      tactic: active.tactic,
    }]
  })
}

function buildFriends(state: ServerState, player: ServerPlayer, now: number): OnlineFriend[] {
  return Object.values(state.friendships)
    .filter(friendship => friendship.playerA === player.id || friendship.playerB === player.id)
    .map(friendship => state.players[friendship.playerA === player.id ? friendship.playerB : friendship.playerA])
    .filter((friend): friend is ServerPlayer => Boolean(friend))
    .map(friend => {
      const active = friend.march
      const position = active
        ? interpolatePath(active.path, Math.max(0, Math.min(1, (now - active.startedAt) / Math.max(1, active.arriveAt - active.startedAt))))
        : friend.mapPosition
      return {
        id: friend.id,
        name: friend.name,
        sectId: friend.sectId,
        sectName: state.sects[friend.sectId]?.name ?? '无宗门',
        score: friend.score,
        online: now - friend.lastSeenAt < FRIEND_ONLINE_WINDOW_MS,
        lastSeenAt: friend.lastSeenAt,
        mapPosition: { ...position },
        marchDestinationKey: active?.destinationKey ?? null,
        marchArriveAt: active?.arriveAt ?? null,
      }
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
}

function buildFriendRequests(state: ServerState, player: ServerPlayer): OnlineFriendRequest[] {
  return Object.values(state.friendRequests)
    .filter(request => request.respondedAt === null && (request.fromPlayerId === player.id || request.toPlayerId === player.id))
    .map(request => {
      const otherId = request.fromPlayerId === player.id ? request.toPlayerId : request.fromPlayerId
      const other = state.players[otherId]
      if (!other) return null
      return {
        id: request.id,
        playerId: other.id,
        playerName: other.name,
        sectName: state.sects[other.sectId]?.name ?? '无宗门',
        direction: request.toPlayerId === player.id ? 'incoming' : 'outgoing',
        createdAt: request.createdAt,
      }
    })
    .filter((request): request is OnlineFriendRequest => Boolean(request))
    .sort((a, b) => b.createdAt - a.createdAt)
}

function relationBetween(state: ServerState, playerId: string, otherId: string): { kind: 'none' | 'friend' | 'incoming' | 'outgoing'; request: ServerFriendRequest | null } {
  if (state.friendships[friendshipKey(playerId, otherId)]) return { kind: 'friend', request: null }
  const request = Object.values(state.friendRequests).find(candidate => candidate.respondedAt === null && ((candidate.fromPlayerId === playerId && candidate.toPlayerId === otherId) || (candidate.fromPlayerId === otherId && candidate.toPlayerId === playerId))) ?? null
  if (!request) return { kind: 'none', request: null }
  return { kind: request.fromPlayerId === playerId ? 'outgoing' : 'incoming', request }
}

function friendshipKey(playerA: string, playerB: string): string {
  return [playerA, playerB].sort().join(':')
}

function interpolatePath(path: MapPoint[], progress: number): MapPoint {
  if (path.length < 2) return path[0] ?? { x: 50, y: 94 }
  const total = pathDistance(path)
  let distance = total * progress
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]
    const to = path[index]
    const segment = Math.hypot(to.x - from.x, to.y - from.y)
    if (distance <= segment || index === path.length - 1) {
      return interpolate(from, to, segment <= 0 ? 1 : distance / segment)
    }
    distance -= segment
  }
  return { ...path[path.length - 1] }
}

function interpolate(from: MapPoint, to: MapPoint, progress: number): MapPoint {
  return {
    x: Math.round((from.x + (to.x - from.x) * progress) * 100) / 100,
    y: Math.round((from.y + (to.y - from.y) * progress) * 100) / 100,
  }
}

function buildMarchPath(from: MapPoint, destinationKey: string): MapPoint[] {
  const destination = WARFRONT_NODE_MAP[destinationKey]
  if (!destination) return [from]
  const nearest = WARFRONT_NODES.reduce((best, node) => distance(from, node.position) < distance(from, best.position) ? node : best)
  const queue: string[][] = [[nearest.key]]
  const visited = new Set<string>([nearest.key])
  let route: string[] | null = null
  while (queue.length > 0) {
    const current = queue.shift()!
    const key = current[current.length - 1]
    if (key === destinationKey) { route = current; break }
    for (const next of WARFRONT_NODE_MAP[key].connections) {
      if (visited.has(next)) continue
      visited.add(next)
      queue.push([...current, next])
    }
  }
  const points = [from, ...(route ?? [destinationKey]).map(key => ({ ...WARFRONT_NODE_MAP[key].position }))]
  const last = points[points.length - 1]
  if (last.x !== destination.position.x || last.y !== destination.position.y) points.push({ ...destination.position })
  return points
}

function pathDistance(path: MapPoint[]): number {
  return path.slice(1).reduce((total, point, index) => total + distance(path[index], point), 0)
}

function distance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function spawnPositionForSect(sectId: string): MapPoint {
  const position = WARFRONT_SPAWN_POINTS[sectId as keyof typeof WARFRONT_SPAWN_POINTS] ?? WARFRONT_SPAWN_POINTS['sect-liuyun']
  return { x: position.x, y: position.y }
}

function sumTroops(troops: Record<TroopKey, number>): number {
  return TROOP_KEYS.reduce((sum, key) => sum + troops[key], 0)
}

function restoreWarEnergy(player: ServerPlayer) {
  const now = Date.now()
  player.warEnergy = Math.max(0, Math.min(WAR_ENERGY_MAX, player.warEnergy ?? WAR_ENERGY_MAX))
  const updatedAt = player.warEnergyUpdatedAt || now
  const ticks = Math.floor(Math.max(0, now - updatedAt) / WAR_ENERGY_REGEN_MS)
  if (ticks > 0) {
    player.warEnergy = Math.min(WAR_ENERGY_MAX, player.warEnergy + ticks)
    player.warEnergyUpdatedAt = updatedAt + ticks * WAR_ENERGY_REGEN_MS
  }
  if (player.warEnergy >= WAR_ENERGY_MAX) player.warEnergyUpdatedAt = now
}

function rank(rows: Omit<LeaderboardEntry, 'rank' | 'isMine'>[], mine: string): LeaderboardEntry[] {
  return rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN')).slice(0, 20)
    .map((x, index) => ({ ...x, rank: index + 1, isMine: x.id === mine }))
}

function sanitizeName(value?: string): string {
  return (value ?? '').trim().replace(/[<>\r\n]/g, '').slice(0, 12)
}

function mutationKey(player: ServerPlayer, action: string, requestId: string): string {
  if (!requestId || requestId.length > 100) throw new DomainError('缺少有效的操作编号')
  return `${player.id}:${action}:${requestId}`
}
