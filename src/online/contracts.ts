import type { BattleProfile, Resources, TroopKey, WarfrontReport, WarfrontTactic } from '../game/types'

export const ONLINE_SCHEMA_VERSION = 4

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
