import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import { migrate } from './migrate.js'

export type Db = DatabaseSync

export function createDb(file: string = config.DATABASE_FILE): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })

  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  // Off by default, and per connection.
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  logger.info('database ready', { file })
  return db
}
