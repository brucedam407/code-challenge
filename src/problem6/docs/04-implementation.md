# Implementation notes

<sub>[Scoreboard module spec](../README.md) - section 7</sub>

## 7. Implementation notes

### 7.1 Ranking and ties

This is the only definition of rank in the module:

```sql
SELECT user_id, score, last_scored_at
FROM user_scores
ORDER BY score DESC, last_scored_at ASC, user_id ASC
LIMIT 10;
```

**On equal scores the earlier achiever wins.** `last_scored_at` is written with
`clock_timestamp()` rather than `now()`, and the difference matters: `now()` is
the transaction's start time, and an award transaction starts *before* it waits
for the `user_scores` lock. Under `now()` the tie-break would quietly come to
mean "who began their transaction first". `user_id` is the third sort key, which
makes the order total and therefore identical on every instance.

Run it against the primary - replica lag would eat the 500 ms target in 9.1
without anything looking broken.

### 7.2 Concurrency

Two awards for the same user are resolved by the `user_scores` row lock. The
update is a single `UPDATE ... SET score = score + $points`, so there is no
read-modify-write in application code and no lost update. The transaction
touches three rows plus a bounded count and does no network I/O at all. The
proof verifier is the one thing that might, which is why it runs before `BEGIN`
(6.1, check 7); because it is pure, the verdict it returns outside the
transaction is still valid inside it.

### 7.3 SSE hub

Each instance keeps one registry of open streams and one Redis subscription.
When a message arrives, write the already-serialized payload to every stream.
When a client connects, send `lb:snapshot` first and register the stream
afterwards - a message landing in between is then a duplicate version the client
ignores, rather than a gap it never sees.

Claim the connection slot synchronously, before the first `await`. If you check
a limit and register after some asynchronous work, an arriving burst passes the
check before any of it has registered. A client that cannot keep up with one
10-row snapshot per 250 ms is closed rather than buffered.

**Losing the subscription.** Redis pub/sub is at-most-once, so a subscriber that
drops leaves its clients on a stream that looks healthy but is stale. When that
happens, send `degraded`, close every stream, and answer `503` until the
subscription is back. Shutdown works the same way: stop accepting, then close.

### 7.4 Broadcaster loop

Every instance runs the loop, but only the lock holder does anything.

- **Lock.** `SET lock:broadcaster <id> NX PX 10000` on each tick, renewed with a
  compare-value-then-`PEXPIRE` script. If two instances briefly both hold it
  during a hand-over they publish twice, which is harmless - snapshots are
  idempotent and clients drop non-increasing versions.
- **Tick, every 250 ms.** Run the 7.1 query, hash the result, and compare it
  against the last hash *this* leader published. Keep that hash in process
  memory, never in Redis.
- **Publish when the hash changed, or unconditionally on the first tick after
  acquiring the lock.** That first-tick rule is what makes hand-over safe: a
  leader that died after `SET lb:snapshot` but before `PUBLISH` left every
  client one snapshot behind, and a successor comparing against a hash stored in
  Redis would find it equal and stay silent.
- **Version.** One script does `v = max(lb:version + 1, now_ms)`, then
  `SET lb:version`, then `SET lb:snapshot`; it builds the payload itself,
  because `v` has to be inside the JSON stored under it. Allocation and the
  `SET` must be atomic, or during a hand-over the loser's write lands last and
  leaves the older version in place. `PUBLISH` stays outside, where a missed
  message costs nothing worse than a reconnect. Seeding from the clock is what
  lets the version survive a Redis restart: a counter restarting at 1 would be
  ignored by every connected client (5.4) until it reloaded the page.
- **Postgres unreachable:** skip the tick and bump nothing.
