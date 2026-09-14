# Operations

<sub>[Scoreboard module spec](../README.md) - sections 9, 10</sub>

## 9. Non-functional requirements

### 9.1 Targets

| | Target |
|---|---|
| `POST /actions/{id}/complete` | p99 < 150 ms, verifier excluded |
| `GET /scoreboard` | p99 < 50 ms |
| Award to visible on a connected client | p95 < 500 ms |
| Availability, write path | 99.9% - a Redis outage does not count against it |
| Sustained writes | 1,000 completions/s per primary |
| Concurrent SSE connections | 20,000 per instance; horizontal beyond |
| Broadcast rate | <= 4/s regardless of write volume |

### 9.2 Rate limits (defaults; per-action overrides in the catalogue)

| Scope | Limit |
|---|---|
| `POST /actions` per user | 60 / min |
| `POST /actions/{id}/complete` per user | 30 / min, burst 10 |
| Any write per IP | 300 / min |
| `GET /scoreboard` per IP | 120 / min |
| SSE connections per IP | 5 |

These are token buckets in Redis, timed by Redis's own clock via `TIME` inside
the script. If each instance passed its own wall clock, skew between them would
let one instance refill a bucket the next one then misreads.

**When Redis is unreachable they fail open**, and we alert on it (10). That only
holds up because these buckets are volume control behind the edge's own IP
limit: every control that actually decides whether a score moves - the one-shot
ticket, `min_duration_ms`, the cooldown, the daily cap - lives in Postgres
inside the award transaction. Failing closed would turn a cache outage into a
write outage for no security gain.

### 9.3 Degradation

| Failure | Behaviour |
|---|---|
| Redis down | Limits fail open; writes commit. `/scoreboard` runs the 7.1 query with a 1 s cache, `"version": null`, `X-Scoreboard-Degraded: true`. Hubs emit `degraded`, close streams, answer `503`; clients poll every 5 s. Recovery is automatic - the next tick publishes above any version seen. |
| Postgres primary down | Write path `503`. Reads and SSE connects serve `lb:snapshot`, correct as of the last tick. The broadcaster skips ticks. |
| Broadcaster leader dies | Lock TTL expires (10 s); a successor publishes unconditionally on its first tick (7.4). |
| An instance dies | Its clients reconnect elsewhere and receive `lb:snapshot`. No state lost. |

### 9.4 Read-model consistency

There is nothing to rebuild. The top 10 is recomputed on every tick from
committed rows, so a snapshot is never a half-applied award and never a mix of
two ticks. The only way for the board to lag is a tick that does not run, and
those are bounded and visible (10). Because nothing is written to a second store
after commit, nothing can be silently lost - a Redis flush costs exactly one
tick.

### 9.5 Rollout

Every table is new and referenced by nothing else, so the migration is purely
additive: no backfill, no dual-write, no coordination with another team.

1. Run migrations. The schema is inert on its own.
2. Deploy the instances. They elect a broadcaster and serve an empty board.
3. Seed `action_types`. **This is the switch** - points exist only in the
   catalogue (rule 1), so until a row exists nothing can be awarded.
4. Enable the action in the client.

**Rolling back means undoing step 3, not step 2.** Set `enabled = false` and new
tickets are refused while the ones already open still redeem, so nobody loses
work in progress. Reverting the deploy is safe too, but it strands those open
tickets to achieve the same thing.

Scores are never migrated. `score_events` is the record and `user_scores` a fold
over it (12.3), so a bad score is repaired with a compensating event.

---

## 10. Observability

**Metrics.** `score_awards_total{action_code}` - `score_award_points_total` -
`ticket_redemption_failures_total{reason}` - `ticket_open_refused_total` -
`ratelimit_rejected_total{scope}` - `ratelimit_fail_open_total` -
`ticket_replays_total` - `scoreboard_broadcasts_total` -
`scoreboard_broadcast_lag_seconds` - `broadcaster_is_leader` -
`broadcaster_tick_seconds` - `sse_connections_active` -
`sse_client_dropped_total{reason}`.

`ticket_redemption_failures_total` is the abuse signal: a spike in `TOO_FAST`,
`PROOF_REJECTED` or `NOT_OWNED` means an attack is in progress. That is why only
a refused *redemption* increments it - the courtesy check at open time and an
empty bucket have counters of their own, so ordinary refusals cannot drown the
thing we want to watch.

**Alerts.** `broadcast_lag > 2 s` for 1 min - `sum(broadcaster_is_leader) != 1`
for 30 s - `ticket_replays_total` above baseline -
`failures{reason="NOT_OWNED"} > 0` - `sse_connections_active` dropping >50% in a
minute - `ratelimit_fail_open_total > 0`.

**Audit.** Every award writes a `score_events` row with request IP and id, and
every rejected redemption logs at `warn` with the subject, the ticket, the IP and
the *real* reason - the wire says `404`, the log says `NOT_OWNED` or
`BAD_SECRET`.
