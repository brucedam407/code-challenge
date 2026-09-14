# API

<sub>[Scoreboard module spec](../README.md) - section 5</sub>

## 5. API

Everything lives under `/v1` and speaks JSON. Endpoints require
`Authorization: Bearer <token>` unless noted otherwise. Request bodies are
checked against a closed schema, so an unknown top-level field is rejected with
a `400` rather than quietly ignored.

**The subject always comes from the token, never from the body.** No endpoint in
this module accepts a `userId`, and a change that introduces one should be
rejected in review.

**What we verify on the token.** Issuing tokens is somebody else's job (2),
which is exactly why the verifier cannot assume the issuer got everything right.
Check the signature and `iss`, and require `exp` - a token that simply omits it
would otherwise be valid forever. `sub` is the user id, and we read nothing
else.

### 5.1 `POST /v1/actions` - open a ticket

Called when the user *starts* the action.

```jsonc
// Request
{ "actionCode": "PUZZLE_SOLVED" }

// 201 Created
{
  "ticketId": "0f9c...",
  "ticketSecret": "v1.8Jd2...",   // 32 random bytes, base64url; shown once
  "expiresAt": "2026-09-11T10:05:00Z",
  "minDurationMs": 1500
}
```

A user may hold `max_open_tickets` open tickets per action, and opening one more
voids the oldest. The default is 3 rather than 1 so that a second browser tab,
or a retried open after a timeout, does not silently kill the ticket the user is
working on. The cap bounds rows, not risk: a hoarded ticket is still single-use
and still has to pass cooldown and cap when it is redeemed. It is enforced under
`pg_advisory_xact_lock(hashtext(userId || ':' || actionCode))` in the same
transaction as the insert.

We check cooldown and daily cap here too, as a courtesy - better to refuse now
than after the user has done the work. Redemption checks them again, and that is
the check that counts (6.1).

### 5.2 `POST /v1/actions/{ticketId}/complete` - redeem

The only endpoint that changes a score.

```jsonc
// Request
{
  "ticketSecret": "v1.8Jd2...",
  "proof": { }                   // optional, action-specific; see 8.2
}

// 200 OK
{
  "awarded": 25,
  "score": 1425,
  "rank": 7,                     // null outside the top 100, or on replay
  "replayed": false              // true: already redeemed, this is the original outcome (6.3)
}
```

Notice what the request does not carry: no score, no delta, no user id, no
timestamp, not even an idempotency key - the ticket id already is one (6.3).

`rank` is computed inside the award transaction, with the count of rows ahead
stopped at 100; past that it comes back `null`. It is a convenience for the
action UI, not a way to read the leaderboard.

### 5.3 `GET /v1/scoreboard` - snapshot

Public, no auth. This is what SSR, non-streaming clients and crawlers use to
bootstrap, and it serves `lb:snapshot` verbatim.

```jsonc
// 200 OK  -  Cache-Control: public, max-age=1, stale-while-revalidate=5
{
  "version": 98211,
  "generatedAt": "2026-09-11T10:04:59.750Z",
  "top": [
    { "rank": 1, "userId": "3b1e...", "score": 9820 },
    { "rank": 2, "userId": "9ac4...", "score": 9655 }
    // ... 10 entries
  ]
}
```

If Redis is unreachable the instance runs the 7.1 query itself, caches the
result for a second, and answers with `"version": null` and the header
`X-Scoreboard-Degraded: true` (9.3).

### 5.4 `GET /v1/scoreboard/stream` - live updates (SSE)

Public, `text/event-stream`. The server sends the current snapshot as soon as
you connect, and a new one after every material change to the top 10.

```
event: snapshot
id: 98211
data: {"version":98211,"generatedAt":"...","top":[ ... ]}

: keep-alive

event: degraded
data: {}
```

- `id` carries the `version`. **A client must ignore any event whose version is
  not greater than the last one it applied** - that single rule is what makes
  delivery order irrelevant and reconnection safe.
- Payloads are full snapshots rather than deltas, so a message that arrives
  twice, out of order, or not at all cannot corrupt what the client shows. On
  reconnect the server does not replay history; it sends the current snapshot,
  which supersedes anything missed.
- A `: keep-alive` comment every 20 s stops proxies reaping idle connections.
- `event: degraded` is sent once, just before the server closes a stream whose
  feed it has lost (7.3). The client should then poll `/scoreboard` every 5 s
  until a `snapshot` arrives. Without this event a client cannot tell a quiet
  leaderboard from a dead feed, because keep-alives keep arriving either way.

**Why SSE and not WebSocket.** The traffic only goes one way and there is not
much of it. A WebSocket would buy a client-to-server channel this module has no
use for, and charge us an upgrade path, a heartbeat protocol and a subprotocol
to version (12.5).

### 5.5 Errors

Body: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`

| HTTP | `code` | When | Client should |
|---|---|---|---|
| 400 | `INVALID_REQUEST` | Schema violation, including unknown fields | Fix and retry |
| 401 | `UNAUTHENTICATED` | Missing, expired or invalid token | Refresh, retry once |
| 404 | `ACTION_UNKNOWN` | Not in the catalogue, or `enabled = false` | Give up |
| 404 | `TICKET_NOT_FOUND` | Unknown id, **or** owned by another subject, **or** wrong secret | Give up; the real reason is logged and mismatches are an attack signal (10) |
| 409 | `TICKET_VOID` | Superseded, or voided by a failed validation | Re-open the action |
| 410 | `TICKET_EXPIRED` | `clock_timestamp() > expires_at` | Re-open the action |
| 422 | `COMPLETED_TOO_FAST` | Redeemed before `min_duration_ms` | Give up; ticket voided, attempt flagged |
| 422 | `PROOF_REJECTED` | Verifier rejected `proof` | Give up; ticket voided, attempt flagged |
| 429 | `RATE_LIMITED` | Bucket empty, cooldown running, or cap hit | Back off per `Retry-After`. On redemption the ticket is untouched; at open time no ticket was created |
| 503 | `UNAVAILABLE` | Postgres down on the write path; neither store on the read path; or `/stream` refusing because the hub lost its feed or is over a cap (7.3) | Retry with backoff |

There is deliberately no `403` and no "already redeemed" error. An unknown
ticket, someone else's ticket and a wrong secret all collapse into the same
`404`, because a distinct status code would leak whether the ticket exists no
matter how carefully we worded the message. A ticket that really was already
redeemed, presented with the correct secret, comes back as a `200` (6.3).
