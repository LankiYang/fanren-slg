import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { ServerState } from './model'
import { WARFRONT_NODE_MAP, WARFRONT_NODES, WARFRONT_SPAWN_POINTS } from '../src/game/warfront'
import { defaultBattleProfile } from '../src/game/compute'
import { ensureBots, reassignHumansOutOfAiSect } from './domain'

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
  const state: ServerState = {
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
  // 苍梧宗常驻电脑玩家，保证没有真人同场时战区也不是一张死地图。
  ensureBots(state)
  return state
}

export class JsonRepository implements StateRepository {
  private state: ServerState | null = null
  private mutationQueue = Promise.resolve()
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
    const operation = this.mutationQueue.then(async () => {
      const state = await this.load()
      const result = await fn(state)
      await this.save()
      return result
    })
    this.mutationQueue = operation.then(() => undefined, () => undefined)
    return operation
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
      await renameWithRetry(temp, target)
    })
    await this.writeQueue
  }
}

/**
 * Windows 上覆盖写一个已存在的文件（尤其是 OneDrive/云盘同步的目录里，这个项目的
 * server/data 正好在 Desktop 下）时，同步引擎或杀软会短暂持有目标文件句柄，
 * 导致 rename 抛 EPERM/EBUSY——不是数据损坏，几十毫秒后重试基本都能成功。
 * 实测：战区每次行动都会触发一次 save，之前没有重试时这个 EPERM 会直接把整个
 * 请求做成 500，前端就看到「多人服务器暂时不可达」，看起来像功能坏了。
 */
async function renameWithRetry(from: string, to: string, attempts = 8): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (attempt === attempts || (code !== 'EPERM' && code !== 'EBUSY')) throw error
      await new Promise(resolve => setTimeout(resolve, 30 * attempt))
    }
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
    player.isBot = player.isBot ?? false
    player.nextActionAt = Number.isFinite(player.nextActionAt) ? player.nextActionAt : 0
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
  // 老存档可能在 AI 宗门加入前就有真人落在这个宗门里，先迁走再补齐机器人。
  reassignHumansOutOfAiSect(state)
  ensureBots(state)
  return state
}
