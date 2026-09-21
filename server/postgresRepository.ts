import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Pool, type PoolClient } from 'pg'
import type { ServerState } from './model'
import { createInitialState, hydrateState, type RepositoryHealth, type StateRepository } from './repository'

const WORLD_ID = 'global'
const MIGRATION_FILE = resolve(process.cwd(), 'server/db/migrations/001_world_state.sql')

export class PostgresRepository implements StateRepository {
  private readonly pool: Pool
  private migrationPromise: Promise<void> | null = null

  constructor(connectionString = process.env.FANREN_DATABASE_URL || process.env.DATABASE_URL) {
    if (!connectionString) throw new Error('PostgreSQL connection string is required')
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.FANREN_DB_POOL_SIZE || 10),
      application_name: 'fanren-slg-api',
    })
  }

  async load(): Promise<ServerState> {
    await this.ensureSchema()
    const client = await this.pool.connect()
    try {
      return hydrateState(await this.readOrCreate(client))
    } finally {
      client.release()
    }
  }

  async mutate<T>(fn: (state: ServerState) => T | Promise<T>): Promise<T> {
    await this.ensureSchema()
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const state = hydrateState(await this.readOrCreate(client, true))
      const result = await fn(state)
      await client.query(
        'UPDATE fanren_world_state SET state = $1::jsonb, revision = revision + 1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(state), WORLD_ID],
      )
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }

  async health(): Promise<RepositoryHealth> {
    await this.ensureSchema()
    const result = await this.pool.query<{ revision: string }>('SELECT revision FROM fanren_world_state WHERE id = $1', [WORLD_ID])
    return { storage: 'postgres', revision: Number(result.rows[0]?.revision ?? 0) }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  private async ensureSchema(): Promise<void> {
    if (!this.migrationPromise) {
      this.migrationPromise = readFile(MIGRATION_FILE, 'utf8')
        .then(sql => this.pool.query(sql))
        .then(() => undefined)
        .catch(error => {
          this.migrationPromise = null
          throw error
        })
    }
    await this.migrationPromise
  }

  private async readOrCreate(client: PoolClient, lock = false): Promise<ServerState> {
    const query = `SELECT state FROM fanren_world_state WHERE id = $1${lock ? ' FOR UPDATE' : ''}`
    const result = await client.query<{ state: ServerState }>(query, [WORLD_ID])
    if (result.rows[0]) return result.rows[0].state
    const initial = createInitialState()
    await client.query(
      'INSERT INTO fanren_world_state (id, state) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING',
      [WORLD_ID, JSON.stringify(initial)],
    )
    const created = await client.query<{ state: ServerState }>(`SELECT state FROM fanren_world_state WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [WORLD_ID])
    if (!created.rows[0]) throw new Error('failed to initialize PostgreSQL world state')
    return created.rows[0].state
  }
}
