# Security

<sub>[Scoreboard module spec](../README.md) - section 8</sub>

## 8. Threat model

### 8.1 Controls

| Threat | Control |
|---|---|
| Forged `userId` in the request | No endpoint reads a user id from the body; subject comes from the verified token (5) |
| Client-chosen score or delta | No delta in the wire format, unknown fields are `400`; value read from `action_types` and snapshotted on the ticket (1) |
| Replaying a completion | Single-use ticket, `FOR UPDATE` + terminal state, `ticket_id UNIQUE`; the replay is answered from the stored outcome (6.2, 6.3) |
| Calling `/complete` without opening | Ticket must exist and be `ISSUED`; ids are 122-bit random, secrets 256-bit |
| Open then complete back-to-back | `min_duration_ms` on database timestamps; cooldown and daily cap under the user's row lock (6.1) |
| Racing two completions past a cap | Cooldown and cap read after `FOR UPDATE` on `user_scores`, serialising one user's completions (6.1) |
| Stockpiling tickets | Each is single-use, expires by TTL, and still faces cooldown and cap; `max_open_tickets` bounds rows, not risk (5.1) |
| Replaying a proof onto another ticket | The verifier binds `proof` to `ticket.id` (8.2) |
| Stolen access token | Short-lived tokens; per-subject velocity limits bound the blast radius (12.2) |
| Ticket id enumeration | Not-found, wrong owner and wrong secret are one `404`, one path (5.5); ids unguessable regardless |
| Leaked database dump | Secrets stored as SHA-256 hashes |
| Redis outage to slip past limits | Edge IP limit still applies (3); every limit gating an award lives in Postgres (9.2) |
| Collusion at scale | Out of band: `score_events` is complete, so any award is attributable and reversible (12.3) |
| Scraping / stream flooding | Public endpoints IP rate limited and connection capped; snapshots are identical for everyone |

### 8.2 The `proof` field, and the limit of what an API can enforce

**If an action's outcome only ever exists on the client, no server-side API can
prove it happened.** What the ticket flow actually proves is narrower than it
looks: that a token the server issued was presented once, by its owner, no
sooner than `min_duration_ms` after it was issued. It does not prove the user
played the game. This is worth saying plainly to whoever owns the action,
because the strength of the anti-cheat guarantee is a property of their design.
All this module can promise is that the scoring layer will not weaken it.

`proof` is where that gap can be closed, when the action allows it. Each
`action_code` may register a verifier that receives `(ticket, proof, userId)`.
When the outcome is computable on the server - submitted answers, a replayable
move list, a result derived from a seed the server generated - a verifier
reduces trust in the client to zero. When the action is purely client-side, no
verifier helps, and the rate limits are containment rather than prevention.

Three rules if you write one:

- **Bind to the ticket.** Derive the challenge from `ticket.id`, so a proof
  harvested from one ticket is invalid for another. Without this, one honest
  completion is a proof factory.
- **Be pure.** It runs before the transaction (7.2) and its verdict is trusted
  inside it.
- **Reject is terminal.** A rejected proof voids the ticket; no second attempt.
