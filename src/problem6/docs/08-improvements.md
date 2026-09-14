# Comments and improvements

<sub>[Scoreboard module spec](../README.md) - section 12</sub>

## 12. Comments and suggested improvements

*None of this is specification. It is ordered by what we would pick up first.*

**12.1 The handshake costs a round trip, and is worth it.** The obvious simpler
design is a single `POST /scores/increment` with an authenticated user, and it
cannot tell a completed action from a `curl` loop. The extra request happens
while the user is busy anyway, and it turns replay from a heuristic into
something a database constraint forbids.

**12.2 Bind the ticket to the session, not only to the user** *(we would do this
for v1)*. As it stands, a stolen token can open and redeem freely. If the ticket
also carried a session or device fingerprint, checked at redemption, the token
on its own would no longer be enough. One column today; awkward to retrofit once
clients are in the wild.

**12.3 Compensating events, never `UPDATE`.** When fraud turns up the reflex is
to edit the score, and that destroys the audit trail. Add
`POST /v1/admin/score-adjustments`, which writes a negative `score_events` row
with a reason and an operator id. The score stays a fold over an append-only
log, so any disputed number can be explained.

**12.4 Anomaly detection belongs downstream.** Every heuristic added to
`/complete` is latency on honest requests. Stream `score_events` to the
warehouse and detect offline instead, then feed the result back as a
`shadow_banned` flag checked at redemption: the award is recorded but kept off
the board. That beats an outright block, because it never tells the attacker
which technique was spotted.

**12.5 When to revisit SSE.** Only once the scoreboard itself becomes
interactive - live reactions, per-viewer filtering, anything that needs to send
something back. The fan-out design survives that change; only the transport is
swapped.

**12.6 Extensions the schema should not be reshaped for.** Seasonal and friend
leaderboards are a different `WHERE` over the same `score_events` log,
materialised by the same broadcaster loop. Worth saying out loud so nobody
denormalises the log into a shape that forecloses them.

**12.7 Things the team should not have to rediscover.**

- Nginx and most load balancers buffer SSE, and the stream then looks frozen.
  Set `X-Accel-Buffering: no` and turn off proxy buffering on that route. Flush
  the headers on connect too, or a client arriving at an empty board sits in
  "connecting" for twenty seconds.
- Create `user_scores` rows on first award rather than at signup, so the
  leaderboard never has to filter out millions of zero-score rows.
- Never accept a client timestamp anywhere in this module, not even as
  telemetry. It invites someone to start trusting it.
- Expose `userId` rather than display names. Otherwise a rename invalidates the
  snapshot, and a cacheable public endpoint quietly becomes a PII surface.

**12.8 If the top-10 query stops being an index scan.** The first sign will be
`broadcaster_tick_seconds` climbing. Measure a covering index and a read replica
before reaching for a Redis sorted set - and if you do reach for one, know that
a naive "ZADD after commit" is wrong in three ways: the composite sort key has
to encode the tie-break exactly and stay under `2^53`, writes after commit
arrive out of order and need `ZADD GT`, and a crash between `COMMIT` and `ZADD`
loses the update unless a reconciler sweeps `updated_at`. That is the
operational cost this design avoids by not having a second store at all.
