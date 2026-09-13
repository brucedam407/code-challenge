# Problem 5 - CRUD backend with ExpressJS and TypeScript

A user service: create, list, read, update and delete, over SQLite.

```bash
npm install
npm run seed     # six sample users, optional
npm run dev      # http://localhost:4001
```

```bash
curl http://localhost:4001/health
curl "http://localhost:4001/api/users?role=admin&limit=5"
```

## Contents

- [Running it](#running-it)
- [Configuration](#configuration)
- [API](#api)
- [Errors](#errors)
- [How it is put together](#how-it-is-put-together)
- [Tests](#tests)
- [Out of scope](#out-of-scope)

## Running it

Requires **Node 22.5+** (developed on 24). Nothing else - no database server, no
Docker, and no native module to compile: storage is Node's built-in
`node:sqlite`, which is still flagged experimental, so the scripts pass
`--disable-warning=ExperimentalWarning`.

| Command                                 | What it does                                            |
| --------------------------------------- | ------------------------------------------------------- |
| `npm run dev`                           | Development server, restarts on change (`tsx watch`).   |
| `npm run build`                         | Type-checks and compiles to `dist/`.                    |
| `npm start`                             | Runs the compiled server.                               |
| `npm run seed`                          | Inserts six sample users; skips any that already exist. |
| `npm test`                              | Full suite (42 tests).                                  |
| `npm run typecheck` / `lint` / `format` | Types, ESLint, Prettier.                                |

The database is a SQLite file created on first run at `./data/app.db`, schema
included - nothing to install or migrate by hand. Delete the file to start over.

## Configuration

Every setting has a default, so the server runs on a fresh clone with no `.env`.
Copy `.env.example` to `.env` to change any of them.

| Variable                     | Default         | Meaning                                             |
| ---------------------------- | --------------- | --------------------------------------------------- |
| `PORT`                       | `4001`          | HTTP port.                                          |
| `NODE_ENV`                   | `development`   | `development` adds stack traces to unexpected 500s. |
| `DATABASE_FILE`              | `./data/app.db` | SQLite file; `:memory:` for a throwaway database.   |
| `MAX_PAGE_SIZE`              | `100`           | Largest `limit` `GET /api/users` accepts.           |
| `CREATE_RATE_LIMIT`          | `10`            | Users one client may create per window.             |
| `CREATE_RATE_WINDOW_SECONDS` | `60`            | How long that window is.                            |
| `LOG_LEVEL`                  | `info`          | `silent` mutes request logs; errors still print.    |

The environment is parsed by zod at startup, so a bad value stops the process
with a message naming the variable rather than failing later inside a request.

## API

Every success carries its payload under `data`, and anything describing it under
`meta`.

| #   | Method   | Path             | Purpose                                 |
| --- | -------- | ---------------- | --------------------------------------- |
| 1   | `POST`   | `/api/users`     | Create a user.                          |
| 2   | `GET`    | `/api/users`     | List with filters, sorting, pagination. |
| 3   | `GET`    | `/api/users/:id` | One user.                               |
| 4   | `PATCH`  | `/api/users/:id` | Update some fields.                     |
| 5   | `DELETE` | `/api/users/:id` | Delete.                                 |
|     | `GET`    | `/health`        | Liveness.                               |

A user is `{ id, name, email, role, status, createdAt, updatedAt }`, where `role`
is `admin | member | guest` and `status` is `active | inactive | suspended`.

```bash
curl -X POST http://localhost:4001/api/users -H 'Content-Type: application/json' -d '{"name":"Ada Lovelace","email":"ada@example.com","role":"admin"}'
curl "http://localhost:4001/api/users?q=ada&role=admin&sort=name&order=asc&page=1&limit=20"
curl http://localhost:4001/api/users/$ID
curl -X PATCH http://localhost:4001/api/users/$ID -H 'Content-Type: application/json' -d '{"status":"suspended"}'
curl -i -X DELETE http://localhost:4001/api/users/$ID
```

| Filter on `GET /api/users`      | Values                                 | Notes                                                                     |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `q`                             | any text                               | Case-insensitive substring of name **or** email. `%` and `_` are literal. |
| `role`                          | `admin` `member` `guest`               |                                                                           |
| `status`                        | `active` `inactive` `suspended`        |                                                                           |
| `createdAfter`, `createdBefore` | ISO 8601                               | Inclusive; an inverted pair is `400`.                                     |
| `sort`                          | `createdAt` `updatedAt` `name` `email` | Default `createdAt`.                                                      |
| `order`                         | `asc` `desc`                           | Default `desc`.                                                           |
| `page`, `limit`                 | integers                               | Default `1` and `20`; `limit` caps at `MAX_PAGE_SIZE`.                    |

```json
{
  "data": [{ "id": "…", "name": "Ada Lovelace", "…": "…" }],
  "meta": {
    "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3, "hasNext": true }
  }
}
```

`POST` is rate limited - `CREATE_RATE_LIMIT` per `CREATE_RATE_WINDOW_SECONDS`
per client - and answers `429` with `RateLimit-*` and `Retry-After` headers once
a client is over. Reads are not limited. The counter is a fixed window held in
the process, keyed on `req.ip`, so behind a proxy the app needs
`trust proxy` set, and a multi-instance deployment wants this at the edge
instead.

`POST` returns `201` with a `Location` header. `PATCH` touches only the fields
sent and moves `updatedAt`; an empty body is a `422`. `DELETE` answers `204`, and
`404` if the user was already gone. Names are trimmed, emails lowercased,
duplicates rejected with `409`. Unknown fields and unknown query parameters are
`422` rather than silently ignored - a mistyped `?stauts=active` that quietly
returns everything is worse than an error.

## Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "source": "body",
      "issues": [
        { "path": "email", "code": "invalid_format", "message": "must be a valid email address" }
      ]
    }
  }
}
```

| Status | Code                            | When                                                            |
| ------ | ------------------------------- | --------------------------------------------------------------- |
| 400    | `BAD_REQUEST`                   | Malformed JSON, or an inverted date range.                      |
| 404    | `NOT_FOUND` / `ROUTE_NOT_FOUND` | No such user / no such route.                                   |
| 409    | `CONFLICT`                      | Email already registered.                                       |
| 413    | `PAYLOAD_TOO_LARGE`             | Body over 100 KB.                                               |
| 415    | `UNSUPPORTED_MEDIA_TYPE`        | Body in an encoding Express cannot read.                        |
| 422    | `VALIDATION_ERROR`              | Body, query or params failed validation.                        |
| 429    | `TOO_MANY_REQUESTS`             | Too many creates from one client.                               |
| 500    | `INTERNAL_ERROR`                | Anything unplanned; the detail goes to the log, not the client. |

## How it is put together

```
src/
  index.ts              boot, graceful shutdown
  app.ts                express app, built from its dependencies
  config.ts             environment parsed and validated by zod
  db/                   sqlite connection, versioned migrations, seed
  modules/
    users/              types, schemas, repository, routes
      handlers/         one file per operation: create, list, get, update, delete
  middleware/           validation, rate limiting, error handler, request logging
  lib/                  HttpError, logger
```

Four layers, each with one job: **routes** speak HTTP, **handlers** hold the
rules, **repository** owns the SQL. A handler never touches a SQL string, and
the repository never throws an HTTP status.

**One handler per operation**, rather than one service class per resource:
`createUserHandler`, `listUsersHandler`, and so on, each a factory closing over
what it needs. Adding an operation adds a file instead of a method to something
that keeps growing, and each one can be read - or tested - on its own. The two
checks more than one of them needs, `requireUser` and `assertEmailFree`, sit in
`user.guards.ts`.

- **`createApp({ db, limits })` takes its dependencies as arguments**, which is
  what lets the tests run the real app against an in-memory database without
  stubbing a module. Limits are arguments too,
  not configuration read while a schema is being defined, so two apps in one
  process can enforce different ones - there is a test that does exactly that.
- **Validation and typing happen in the same call.** `route({ body, query,
params }, handler)` parses with zod and hands the handler values that are
  already typed, so there is no cast between "validated" and "used".
- **Each layer translates its own failures.** The repository turns a SQLite
  constraint violation into a `409` and validation turns a zod issue into a
  `422`, so the error handler knows only about the app's own error type and what
  Express throws.
- **SQLite, via `node:sqlite`** because the brief asks for a simple database and
  this one needs no service, no credentials, no fixture and no install step - it
  ships with Node. The repository is the only file that knows; swapping in
  Postgres means rewriting one class. Schema changes are numbered statements
  against `PRAGMA user_version`.
- **Shutdown is graceful**: `SIGINT`/`SIGTERM` stop new connections, let in-flight
  requests finish, then close SQLite, with a 10s backstop.

## Tests

```bash
npm test
```

42 tests, one file per handler, no mocking framework:

| File                            | Covers                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `users/create-user.test.ts`     | Defaults, trimming, duplicate emails, validation, malformed JSON.                            |
| `users/list-users.test.ts`      | Every filter, sorting, pagination, injected limits, and the rejections.                      |
| `users/get-user.test.ts`        | Detail, 404, non-UUID id.                                                                    |
| `users/update-user.test.ts`     | PATCH semantics, keeping your own email, taking somebody else's, empty body.                 |
| `users/delete-user.test.ts`     | 204, and 404 when the user was already gone.                                                 |
| `users/user-repository.test.ts` | The repository directly: a unique violation becomes a 409, not a 500.                        |
| `app.test.ts`                   | Routing, health, request ids, and 413 rather than 500 on an oversized body.                  |
| `middleware/rate-limit.test.ts` | The limiter on a clock the test drives: the window rolling over, headers, per-client counts. |

Each file builds its own app on an in-memory database, so they run in any order
and in parallel.

## Out of scope

- **Authentication.** There are no passwords and no sessions; anyone can call
  anything.
- **CORS**, and rate limiting beyond the one write worth protecting here - both
  belong to the deployment as much as to the app.
