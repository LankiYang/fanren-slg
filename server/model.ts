import type { BattleProfile, TroopKey, WarfrontTactic } from '../src/game/types'
import type { MapPoint, OnlineBattleReport } from '../src/online/contracts'

export interface ServerMarch {
  id: string
  requestId: string
  from: MapPoint
  path: MapPoint[]
  destinationKey: string
  startedAt: number
  arriveAt: number
  formation: Record<TroopKey, number>
  deployed: number
  tactic: WarfrontTactic
}

export interface ServerPlayer {
  id: string
  token: string
  name: string
  sectId: string
  score: number
  troops: Record<TroopKey, number>
  cooldownUntil: number
  recruitReadyAt: number
  warEnergy: number
  warEnergyUpdatedAt: number
  mapPosition: MapPoint
  march: ServerMarch | null
  /** 洞府养成同步到战区的服务端校验档案。 */
  battleProfile: BattleProfile
  profileUpdatedAt: number
  createdAt: number
  lastSeenAt: number
}

export interface ServerFriendRequest {
  id: string
  fromPlayerId: string
  toPlayerId: string
  createdAt: number
  respondedAt: number | null
}

export interface ServerFriendship {
  playerA: string
  playerB: string
  createdAt: number
}

export interface ServerSect {
  id: string
  name: string
  score: number
  createdAt: number
}

export interface ServerNode {
  key: string
  ownerPlayerId: string | null
  ownerSectId: string | null
  guardTroop: TroopKey
  guardPower: number
  guardFormation: Record<TroopKey, number>
  garrisonContributors: Record<string, Record<TroopKey, number>>
  version: number
}

export interface ServerState {
  schemaVersion: number
  seasonId: string
  seasonName: string
  playerSequence: number
  players: Record<string, ServerPlayer>
  sects: Record<string, ServerSect>
  nodes: Record<string, ServerNode>
  reports: OnlineBattleReport[]
  idempotency: Record<string, string>
  friendRequests: Record<string, ServerFriendRequest>
  friendships: Record<string, ServerFriendship>
}
