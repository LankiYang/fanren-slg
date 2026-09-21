import { PostgresRepository } from './postgresRepository'
import { JsonRepository, type StateRepository } from './repository'

export function createRepository(): StateRepository {
  const mode = process.env.FANREN_STORAGE?.toLowerCase()
  const connectionString = process.env.FANREN_DATABASE_URL || process.env.DATABASE_URL
  if (mode === 'json' || (!connectionString && mode !== 'postgres')) return new JsonRepository()
  return new PostgresRepository(connectionString)
}
