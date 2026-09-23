import type { BattleProfile, BuildingKey, EquipmentSlot, GameState, OfflineReport, Resources, TroopKey, WarfrontReport, WarfrontTactic } from '../game/types'

export const ONLINE_SCHEMA_VERSION = 4
export const GAME_API_SCHEMA_VERSION = 1

export interface MapPoint {
  x: number
  y: number
}

export interface OnlinePlayer {
  id: string
  name: string
  sectId: string
  sectName: string
  score: number
  troops: Record<TroopKey, number>
  cooldownUntil: number
  recruitReadyAt: number
  warEnergy: number
  warEnergyMax: number
  marchCap: number
  mapPosition: MapPoint
  /** 服务器依据战斗档案重算的无克制总战力。 */
  battlePower: number
  battleProfileUpdatedAt: number
}

export interface OnlineNodeState {
  key: string
  ownerPlayerId: string | null
  ownerName: string
  ownerSectId: string | null
  ownerSectName: string | null
  guardTroop: TroopKey
  guardPower: number
  garrison: Record<TroopKey, number>
  garrisonTotal: number
  garrisonPower: number
  garrisonByMe: Record<TroopKey, number>
  version: number
}

export interface OnlineArmy {
  id: string
  playerId: string
  name: string
  sectId: string
  sectName: string
  isMine: boolean
  position: MapPoint
  destinationKey: string | null
  from: MapPoint | null
  to: MapPoint | null
  startedAt: number | null
  arriveAt: number | null
  deployed: number
  formation: Record<TroopKey, number>
  tactic: WarfrontTactic | null
}

export type FriendRelation = 'none' | 'friend' | 'incoming' | 'outgoing'

export interface OnlineFriend {
  id: string
  name: string
  sectId: string
  sectName: string
  score: number
  online: boolean
  lastSeenAt: number
  mapPosition: MapPoint
  marchDestinationKey: string | null
  marchArriveAt: number | null
}

export interface OnlineFriendRequest {
  id: string
  playerId: string
  playerName: string
  sectName: string
  direction: 'incoming' | 'outgoing'
  createdAt: number
}

export interface OnlinePlayerSearch {
  id: string
  name: string
  sectId: string
  sectName: string
  score: number
  online: boolean
  relation: FriendRelation
  requestId: string | null
}

export interface PlayerSearchResponse {
  players: OnlinePlayerSearch[]
}

export interface LeaderboardEntry {
  id: string
  name: string
  score: number
  rank: number
  isMine?: boolean
}

export interface OnlineBattleReport extends WarfrontReport {
  id: string
  requestId: string
  attackerId: string
  attackerName: string
  defenderPlayerId: string | null
  defenderName: string
  createdAt: number
  troopsAfter: Record<TroopKey, number>
  /** 据点被攻破时，为每个曾驻防的宗门贡献者（含原据点主人）各生成一条通知；不填即为常规交战战报。 */
  kind?: 'battle' | 'garrisonLoss'
}

export interface WarfrontSnapshot {
  schemaVersion: number
  seasonId: string
  seasonName: string
  serverTime: number
  player: OnlinePlayer
  nodes: OnlineNodeState[]
  playerLeaderboard: LeaderboardEntry[]
  sectLeaderboard: LeaderboardEntry[]
  reports: OnlineBattleReport[]
  armies: OnlineArmy[]
  friends: OnlineFriend[]
  friendRequests: OnlineFriendRequest[]
  /** 服务器确认后的养成档案，前端用它展示与服务器一致的战力预估。 */
  battleProfile: BattleProfile
  /** 当前玩家宗门据点带来的每秒资源产出，作为本地洞府钱包的唯一战区收益来源。 */
  warfrontIncome: Resources
}

export interface GuestAuthResponse {
  token: string
  snapshot: WarfrontSnapshot
}

export interface AccountInfo {
  id: string
  username: string
  playerId: string
}

export interface AccountAuthResponse {
  token: string
  account: AccountInfo
  snapshot: WarfrontSnapshot
}

export interface RegisterAccountPayload {
  username: string
  password: string
  displayName: string
}

export interface LoginAccountPayload {
  username: string
  password: string
}

export interface ChatMessage {
  id: string
  channel: 'world' | 'sect'
  senderId: string
  senderName: string
  sectId: string
  sectName: string
  text: string
  command: { kind: string; args: string[] } | null
  createdAt: number
}

export interface ChatMessagesResponse {
  messages: ChatMessage[]
  serverTime: number
}

export interface SendChatPayload {
  channel: 'world' | 'sect'
  text: string
}

export interface AttackPayload {
  requestId: string
  nodeKey: string
  tactic: WarfrontTactic
  formation: Record<TroopKey, number>
}

export interface AttackResponse {
  report: OnlineBattleReport
  snapshot: WarfrontSnapshot
}

export interface WarfrontPreviewPayload {
  nodeKey: string
  tactic: WarfrontTactic
  formation: Record<TroopKey, number>
}

export interface WarfrontPreview {
  nodeKey: string
  tactic: WarfrontTactic
  deployed: number
  myPower: number
  enemyPower: number
  win: boolean
  powerPercent: number
  recommendedFormation: Record<TroopKey, number>
}

export interface MarchPayload {
  requestId: string
  nodeKey: string
  tactic: WarfrontTactic
  formation: Record<TroopKey, number>
}

export interface MarchResponse {
  snapshot: WarfrontSnapshot
}

export interface RecruitResponse {
  gained: Record<TroopKey, number>
  snapshot: WarfrontSnapshot
}

export interface GarrisonPayload {
  requestId: string
  nodeKey: string
  formation: Record<TroopKey, number>
}

export interface GarrisonResponse {
  snapshot: WarfrontSnapshot
}

export interface WithdrawPayload {
  requestId: string
  nodeKey: string
  formation: Record<TroopKey, number>
}

export interface WithdrawResponse {
  snapshot: WarfrontSnapshot
}

export interface CreateSectPayload {
  name: string
}

export interface FriendRequestPayload {
  targetPlayerId: string
}

export interface RespondFriendRequestPayload {
  requestId: string
  accept: boolean
}

export interface RemoveFriendPayload {
  friendId: string
}

export interface RenamePayload {
  displayName: string
}

export interface SyncBattleProfilePayload {
  profile: BattleProfile
}

export interface SyncBattleProfileResponse {
  snapshot: WarfrontSnapshot
}

export interface ApiError {
  error: string
  code?: string
  details?: Partial<Resources>
}

export interface GameDerivedSnapshot {
  rates: Resources
  storageCap: number
  troopCap: number
  marchCap: number
  totalTroops: number
  totalPower: number
  formationUsed: number
  busyQueues: number
  maxTrainable: Record<TroopKey, number>
  buildingCosts: Record<string, Partial<Resources>>
  buildingTimes: Record<string, number>
  stagePower: Record<string, number>
  battlePowerByEnemy: Record<TroopKey, number>
  recommendedFormationByEnemy: Record<TroopKey, Record<TroopKey, number>>
  buildingDetails: Record<BuildingKey, GameBuildingDerived>
  troopDetails: Record<TroopKey, GameTroopDerived>
  cultivatorDetails: Record<string, GameCultivatorDerived>
  gongfaDetails: Record<string, GameGongfaDerived>
  pillDetails: Record<string, GamePillDerived>
  artifactDetails: Record<string, GameArtifactDerived>
  artifactBonusPercent: Record<TroopKey, number>
  seekTemperCosts: Record<EquipmentSlot, number>
  questDetails: Record<string, GameQuestDerived>
  realm: GameRealmDerived
  boss: GameBossDerived
  bossReadyAt: number
  expeditionEnergyReadyAt: number
}

export interface GameBuildingDerived {
  targetLevel: number
  cost: Partial<Resources>
  durationMs: number
  currentOutput: number
  nextOutput: number | null
  currentStorageCap: number | null
  nextStorageCap: number | null
  currentTroopCap: number | null
  nextTroopCap: number | null
  busy: boolean
  done: boolean
  locked: boolean
  atMax: boolean
  cappedByDongfu: boolean
  prerequisite: { ok: boolean; need: number; have: number; level: number } | null
  queueFull: boolean
}

export interface GameTroopDerived {
  unitPower: number
  powerByEnemy: Record<TroopKey, number>
  trainingCost: Partial<Resources>
  trainingCosts: Record<string, Partial<Resources>>
  maxTrainable: number
}

export interface GameCultivatorDerived {
  level: number
  owned: boolean
  maxLevel: number
  nextCost: Partial<Resources> | null
  bonusPercent: number
}

export interface GameGongfaDerived {
  level: number
  maxLevel: number
  locked: boolean
  cost: Partial<Resources> | null
  timeMs: number | null
  currentPercent: number
  nextPercent: number | null
}

export interface GamePillDerived {
  owned: number
  active: boolean
  activeUntil: number
  remainingMs: number
  cost: Partial<Resources>
}

export interface GameArtifactDerived {
  level: number
  maxLevel: number
  locked: boolean
  cost: Partial<Resources> | null
  currentPercent: number
  nextPercent: number | null
}

export interface GameQuestDerived {
  claimed: boolean
  done: boolean
  current: number | null
  target: number | null
  reward: Partial<Resources>
}

export interface GameRealmDerived {
  currentName: string
  currentOutputBonus: number
  currentPowerBonus: number
  cultivation: number
  cultivationNeed: number
  dongfuReady: boolean
  cultivationReady: boolean
  resourcesReady: boolean
  next: {
    name: string
    requiresDongfu: number
    cost: Partial<Resources>
    outputBonus: number
    powerBonus: number
  } | null
  canBreakthrough: boolean
}

export interface GameBossDerived {
  hp: number
  myPower: number
  readyAt: number
  canChallenge: boolean
}

/**
 * 洞府玩法的服务端快照。
 * `game` 是服务器保存的事实；`derived` 只提供界面展示所需的已计算结果，
 * 不代表客户端可以提交这些结果作为结算依据。
 */
export interface GameSnapshot {
  schemaVersion: number
  serverTime: number
  game: GameState
  derived: GameDerivedSnapshot
  offlineReport: OfflineReport | null
}

export type GameCommandName =
  | 'character.choose'
  | 'building.start'
  | 'building.claim'
  | 'realm.breakthrough'
  | 'seek.draw'
  | 'seek.temper'
  | 'seek.milestone.claim'
  | 'troops.train'
  | 'formation.set'
  | 'cultivator.level'
  | 'stage.attack'
  | 'queue.unlock'
  | 'boss.challenge'
  | 'quest.claim'
  | 'guide.flag'
  | 'gongfa.research'
  | 'pill.craft'
  | 'pill.collect'
  | 'pill.use'
  | 'artifact.forge'
  | 'expedition.explore'
  | 'expedition.weekly.claim'
  | 'expedition.season.claim'
  | 'expedition.shop.buy'

export interface GameCommandRequest {
  requestId: string
  command: GameCommandName
  payload?: Record<string, unknown>
}

export interface GameCommandResult {
  ok: true
  [key: string]: unknown
}

export interface GameCommandResponse {
  snapshot: GameSnapshot
  result: GameCommandResult
}
