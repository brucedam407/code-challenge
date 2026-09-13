import type { StatementSync } from 'node:sqlite'
import type { Db } from '../../db/index.js'
import { HttpError } from '../../lib/errors.js'
import type { ListUsersQuery } from './user.schema.js'
import { toUser, type User, type UserRow } from './user.types.js'

/** The only place a sort value reaches SQL. */
const SORT_COLUMNS = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  name: 'name',
  email: 'email',
} as const

const ID_CHUNK = 400

/** SQLite extended result codes; the low byte is the class. */
const CONSTRAINT = 19
const CONSTRAINT_UNIQUE = 2067
const CONSTRAINT_PRIMARYKEY = 1555

export interface InsertUserRecord {
  id: string
  name: string
  email: string
  role: UserRow['role']
  status: UserRow['status']
  createdAt: string
}

export interface UpdateUserRecord {
  name?: string | undefined
  email?: string | undefined
  role?: UserRow['role'] | undefined
  status?: UserRow['status'] | undefined
  updatedAt: string
}

export interface ListResult {
  items: User[]
  total: number
}

/** node:sqlite returns plain records; the column types live in UserRow. */
const asUser = (row: unknown): User => toUser(row as UserRow)

export class UserRepository {
  private readonly selectById: StatementSync
  private readonly selectByEmail: StatementSync
  private readonly insertUser: StatementSync
  private readonly deleteById: StatementSync

  constructor(private readonly db: Db) {
    this.selectById = db.prepare('SELECT * FROM users WHERE id = ?')
    this.selectByEmail = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
    this.insertUser = db.prepare(
      `INSERT INTO users (id, name, email, role, status, created_at, updated_at)
       VALUES (@id, @name, @email, @role, @status, @createdAt, @createdAt)
       RETURNING *`,
    )
    this.deleteById = db.prepare('DELETE FROM users WHERE id = ?')
  }

  insert(record: InsertUserRecord): User {
    try {
      return asUser(this.insertUser.get({ ...record }))
    } catch (error) {
      // Catches the race past the handler's own check.
      throw translate(error)
    }
  }

  findById(id: string): User | null {
    const row = this.selectById.get(id)
    return row ? asUser(row) : null
  }

  findByEmail(email: string): User | null {
    const row = this.selectByEmail.get(email)
    return row ? asUser(row) : null
  }

  /** Chunked: SQLite caps bound parameters per statement. */
  findManyByIds(ids: string[]): User[] {
    const users: User[] = []
    for (let start = 0; start < ids.length; start += ID_CHUNK) {
      const chunk = ids.slice(start, start + ID_CHUNK)
      const placeholders = chunk.map(() => '?').join(', ')
      const rows = this.db
        .prepare(`SELECT * FROM users WHERE id IN (${placeholders})`)
        .all(...chunk)
      users.push(...rows.map(asUser))
    }
    return users
  }

  list(query: ListUsersQuery): ListResult {
    const where: string[] = []
    const params: Record<string, string | number> = {}

    if (query.q !== undefined) {
      // ESCAPE stops a literal % or _ being a wildcard.
      where.push("(name LIKE @q ESCAPE '\\' OR email LIKE @q ESCAPE '\\')")
      params.q = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
    }
    if (query.role !== undefined) {
      where.push('role = @role')
      params.role = query.role
    }
    if (query.status !== undefined) {
      where.push('status = @status')
      params.status = query.status
    }
    if (query.createdAfter !== undefined) {
      where.push('created_at >= @createdAfter')
      params.createdAfter = query.createdAfter
    }
    if (query.createdBefore !== undefined) {
      where.push('created_at <= @createdBefore')
      params.createdBefore = query.createdBefore
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    const { count } = this.db
      .prepare(`SELECT COUNT(*) AS count FROM users ${whereSql}`)
      .get(params) as { count: number }

    const column = SORT_COLUMNS[query.sort]
    const direction = query.order === 'asc' ? 'ASC' : 'DESC'
    const rows = this.db
      .prepare(
        `SELECT * FROM users ${whereSql}
         ORDER BY ${column} ${direction}, id ${direction}
         LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit: query.limit, offset: (query.page - 1) * query.limit })

    return { items: rows.map(asUser), total: count }
  }

  update(id: string, record: UpdateUserRecord): User | null {
    try {
      return this.runUpdate(id, record)
    } catch (error) {
      throw translate(error)
    }
  }

  private runUpdate(id: string, record: UpdateUserRecord): User | null {
    const assignments = ['updated_at = @updatedAt']
    const params: Record<string, string> = { id, updatedAt: record.updatedAt }

    // Explicit: the SET clause is where a key would reach the SQL.
    for (const field of ['name', 'email', 'role', 'status'] as const) {
      const value = record[field]
      if (value === undefined) continue
      assignments.push(`${field} = @${field}`)
      params[field] = value
    }

    const row = this.db
      .prepare(`UPDATE users SET ${assignments.join(', ')} WHERE id = @id RETURNING *`)
      .get(params)
    return row ? asUser(row) : null
  }

  delete(id: string): boolean {
    return this.deleteById.run(id).changes > 0
  }
}

function translate(error: unknown): unknown {
  if (!(error instanceof Error)) return error
  const errcode: unknown = Reflect.get(error, 'errcode')
  if (typeof errcode !== 'number' || (errcode & 0xff) !== CONSTRAINT) return error

  if (errcode === CONSTRAINT_UNIQUE || errcode === CONSTRAINT_PRIMARYKEY) {
    return HttpError.conflict('That value is already taken', { errcode })
  }
  return HttpError.badRequest('Request violates a database constraint', { errcode })
}
