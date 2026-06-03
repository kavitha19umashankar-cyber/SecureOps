import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle> | null = null

export function getDb(databaseUrl?: string) {
  if (_db) return _db

  const url = databaseUrl ?? process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL is not set')

  const client = postgres(url, { max: 10 })
  const isDev = process.env['NODE_ENV'] === 'development'
  _db = drizzle(client, { schema, logger: isDev })
  return _db
}

export type Db = ReturnType<typeof getDb>
