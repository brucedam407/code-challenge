import type { Db } from './index.js'

/** Add a step to the end; `user_version` tracks which have run. */
const migrations: string[] = [
  `
  CREATE TABLE users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'guest')),
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  -- NOCASE, or 'A@b.com' and 'a@b.com' both insert.
  CREATE UNIQUE INDEX idx_users_email_unique ON users (email COLLATE NOCASE);

  -- One composite per filter, each carrying the default sort column: a plain
  -- (role, status) index serves neither a status-only filter nor the sort.
  CREATE INDEX idx_users_created ON users (created_at DESC);
  CREATE INDEX idx_users_role_created ON users (role, created_at DESC);
  CREATE INDEX idx_users_status_created ON users (status, created_at DESC);
  `,
]

export function migrate(db: Db): void {
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as {
    user_version: number
  }

  for (let version = current; version < migrations.length; version++) {
    const sql = migrations[version]!
    db.exec('BEGIN')
    try {
      db.exec(sql)
      // PRAGMA takes no bound parameters.
      db.exec(`PRAGMA user_version = ${version + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}
