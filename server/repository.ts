import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { ServerState } from './model'
import { WARFRONT_NODE_MAP, WARFRONT_NODES, WARFRONT_SPAWN_POINTS } from '../src/game/warfront'
import { defaultBattleProfile } from '../src/game/compute'

const DEFAULT_PATH = resolve(process.cwd(), 'server/data/state.json')

export interface RepositoryHealth {
  storage: 'json' | 'postgres'
  revision: number
}

export interface StateRepository {
  load(): Promise<ServerState>
  mutate<T>(fn: (state: ServerState) => T | Promise<T>): Promise<T>
  health(): Promise<RepositoryHealth>
  close(): Promise<void>
}

export function createInitialState(): ServerState {
  const sects = [
    { id: 'sect-qingyun', name: '青云宗' },
    { id: 'sect-cangwu', name: '苍梧宗' },
    { id: 'sect-liuyun', name: '流云会' },
  ]
  return {
    schemaVersion: 4,
    seasonId: 's1-cangwu',
    seasonName: '第 1 赛季 · 苍梧秘境',
    playerSequence: 0,
    players: {},
    sects: Object.fromEntries(sects.map(x => [x.id, { ...x, score: 0, createdAt: Date.now() }])),
    nodes: Object.fromEntries(WARFRONT_NODES.map(node => [node.key, {
      key: node.key,
      ownerPlayerId: null,
      ownerSectId: null,
      guardTroop: node.enemyTroop,
      guardPower: node.enemyPower,
      guardFormation: { kuilei: 0, yushou: 0, fuxiu: 0 },
      garrisonContributors: {},
      version: 1,
    }])),
    reports: [],
    idempotency: {},
    friendRequests: {},
    friendships: {},
  }
}

export class JsonRepository implements StateRepository {
  private state: ServerState | null = null
  private writeQueue = Promise.resolve()

  constructor(private readonly filePath = process.env.FANREN_DATA_FILE || DEFAULT_PATH) {}

  async load(): Promise<ServerState> {
    if (this.state) return this.state
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as ServerState
      if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2 && parsed.schemaVersion !== 3 && parsed.schemaVersion !== 4) throw new Error('unsupported schema')
      this.state = hydrateState(parsed)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT' && !(error instanceof SyntaxError) && (error as Error).message !== 'unsupported schema') throw error
      this.state = createInitialState()
      await this.save()
    }
    return this.state
  }

  async mutate<T>(fn: (state: ServerState) => T | Promise<T>): Promise<T> {
    const state = await this.load()
    const result = await fn(state)
    await this.save()
    return result
  }

  async health(): Promise<RepositoryHealth> {
    await this.load()
    return { storage: 'json', revision: 0 }
  }

  async close(): Promise<void> {}

  private async save(): Promise<void> {
    if (!this.state) return
    const serialized = JSON.stringify(this.state, null, 2)
    const target = this.filePath
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(target), { recursive: true })
      const temp = `${target}.tmp`
      await writeFile(temp, serialized, 'utf8')
      await rename(temp, target)
    })
    await this.writeQueue
  }
}

export function hydrateState(state: ServerState): ServerState {
  state.schemaVersion = 4
  for (const player of Object.values(state.players)) {
    player.warEnergy = Number.isFinite(player.warEnergy) ? player.warEnergy : 3
    player.warEnergyUpdatedAt = Number.isFinite(player.warEnergyUpdatedAt) ? player.warEnergyUpdatedAt : Date.now()
    player.mapPosition = player.mapPosition && Number.isFinite(player.mapPosition.x) && Number.isFinite(player.mapPosition.y)
      ? player.mapPosition
      : { ...(WARFRONT_SPAWN_POINTS[player.sectId as keyof typeof WARFRONT_SPAWN_POINTS] ?? WARFRONT_SPAWN_POINTS['sect-liuyun']) }
    player.march = player.march ?? null
    player.battleProfile = player.battleProfile ?? defaultBattleProfile()
    player.profileUpdatedAt = Number.isFinite(player.profileUpdatedAt) ? player.profileUpdatedAt : 0
    player.lastSeenAt = Number.isFinite(player.lastSeenAt) ? player.lastSeenAt : 0
    if (player.march && (!Array.isArray(player.march.path) || player.march.path.length < 2)) {
      player.march.path = [player.march.from, WARFRONT_NODE_MAP[player.march.destinationKey]?.position ?? player.march.from]
    }
  }
  for (const node of Object.values(state.nodes)) {
    node.guardFormation = node.guardFormation ?? { kuilei: 0, yushou: 0, fuxiu: 0 }
    node.garrisonContributors = node.garrisonContributors ?? {}
    node.version = node.version || 1
  }
  state.reports = state.reports ?? []
  state.idempotency = state.idempotency ?? {}
  state.friendRequests = state.friendRequests ?? {}
  state.friendships = state.friendships ?? {}
  return state
}
