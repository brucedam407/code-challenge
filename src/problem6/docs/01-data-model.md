# Data model

<sub>[Scoreboard module spec](../README.md) - section 4</sub>

## 4. Data model

### 4.1 PostgreSQL

```sql
-- Catalogue. Seeded by migration; the ONLY place a point value is defined.
CREATE TABLE action_types (
    code              TEXT PRIMARY KEY,              -- 'PUZZLE_SOLVED'
    points            INTEGER NOT NULL CHECK (points BETWEEN 1 AND 10000),
    min_duration_ms   INTEGER NOT NULL DEFAULT 0,    -- floor between open & complete
    ticket_ttl_ms     INTEGER NOT NULL DEFAULT 300000,
    cooldown_ms       INTEGER NOT NULL DEFAULT 0,    -- per user, between two awards
    daily_cap         INTEGER,                       -- awards per UTC day; NULL = uncapped
    max_open_tickets  INTEGER NOT NULL DEFAULT 3 CHECK (max_open_tickets BETWEEN 1 AND 10),
    enabled           BOOLEAN NOT NULL DEFAULT TRUE, -- FALSE refuses new tickets only
    CHECK (min_duration_ms < ticket_ttl_ms)
);

-- clock_timestamp(), not now(): now() is transaction start (7.1).
CREATE TABLE user_scores (
    user_id         UUID PRIMARY KEY,
    score           BIGINT NOT NULL DEFAULT 0 CHECK (score >= 0),
    last_scored_at  TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- Matches the ORDER BY in 7.1 exactly; a 10-row scan.
CREATE INDEX ON user_scores (score DESC, last_scored_at ASC, user_id ASC);

CREATE TABLE action_tickets (
    id            UUID PRIMARY KEY,
    user_id       UUID NOT NULL,
    action_code   TEXT NOT NULL REFERENCES action_types(code),
    secret_hash   BYTEA NOT NULL,                 -- SHA-256 of the bearer secret
    status        TEXT NOT NULL CHECK (status IN ('ISSUED','REDEEMED','EXPIRED','VOID')),
    points        INTEGER NOT NULL,               -- snapshotted at issue time
    issued_at     TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at    TIMESTAMPTZ NOT NULL,
    redeemed_at   TIMESTAMPTZ
);
CREATE INDEX ON action_tickets (user_id, action_code, issued_at) WHERE status = 'ISSUED';  -- cap, 5.1
CREATE INDEX ON action_tickets (expires_at) WHERE status = 'ISSUED';                       -- sweeper, 6.2

-- Append-only. Never updated, never deleted.
CREATE TABLE score_events (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL,
    ticket_id    UUID NOT NULL UNIQUE REFERENCES action_tickets(id),
    action_code  TEXT NOT NULL,
    delta        INTEGER NOT NULL,
    score_after  BIGINT NOT NULL,
    request_ip   INET,
    request_id   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON score_events (user_id, action_code, created_at DESC);  -- cooldown, cap, replay
```

Three properties in there carry most of the design:

- **`score_events.ticket_id` is `UNIQUE`.** It is the constraint, not the
  application code, that stands as the last defence against double-awarding, and
  it is also what lets us answer a replay (6.3).
- **`points` is snapshotted onto the ticket** when the ticket is issued, so
  re-pricing an action cannot change what an already-open ticket pays out.
- **`secret_hash` stores a hash, not the secret.** Someone who reads the table
  gets nothing they can redeem. The secret is 32 random bytes, so an unsalted
  SHA-256 is enough.

Every timestamp is taken by Postgres, in SQL. However many instances are
running, and however far apart their clocks drift, they cannot disagree about
whether a ticket has expired.

### 4.2 Redis

| Key | Type | Contents |
|---|---|---|
| `lb:snapshot` | STRING | last published payload, byte-identical to the SSE `data:` |
| `lb:version` | counter | monotonic version, clock-seeded so it survives a restart (7.4) |
| `scoreboard:updates` | pub/sub | snapshot payloads |
| `rl:{scope}:{id}` | HASH + TTL | token bucket: `tokens` + `ts` (9.2) |
| `lock:broadcaster` | STRING + TTL | leader election |

**None of this is a source of truth.** Every key above is regenerated within one
broadcaster tick of being lost (9.4).
