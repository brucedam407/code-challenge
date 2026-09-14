# Acceptance criteria

<sub>[Scoreboard module spec](../README.md) - section 11</sub>

## 11. Acceptance criteria

1. A completion awards exactly the catalogue value; the response `score`
   matches Postgres.
2. Same ticket twice: `200 replayed:false` then `200 replayed:true` with
   identical `awarded`/`score`; one `score_events` row; score up once.
3. 50 concurrent completions of 50 tickets for one user: final score is the sum
   of the deltas. Seed the tickets directly - `max_open_tickets` caps a user at
   10 open, so this is unreachable through 5.1; the subject is the row lock
   (7.2), and criterion 13 covers the cap.
4. Ticket of user A redeemed with B's token: `404`, no award, one `warn` with
   reason `NOT_OWNED`. Wrong secret: identical status and message.
5. Redemption after `expires_at`: `410`, no award, row reads `EXPIRED` -
   including when it expires *while waiting* for the `user_scores` lock.
6. Redemption before `min_duration_ms`: `422`, no award, row reads `VOID`, and
   it stays unusable after the duration elapses. Same for a rejected proof.
7. Any body carrying `userId`, `score`, `delta` or `points` is `400` with no
   state change - assert by fuzzing.
8. Two clients on two instances receive the same snapshot within 500 ms of an
   award that changes the top 10.
9. 1,000 awards that do not change the top 10 produce zero broadcasts.
10. Killing Redis: writes keep committing, `/scoreboard` serves a correct top 10
    marked degraded, streaming clients receive `degraded` and are disconnected.
    Restarting Redis *empty*: the next tick publishes a version greater than any
    a client already applied.
11. A client killed and reconnected receives a current snapshot and never
    applies a version lower than one it already applied.
12. Killing the leader between `SET lb:snapshot` and `PUBLISH`: a connected
    client receives that content from the successor within 10 s plus one tick.
13. Opening `max_open_tickets + 1`: the oldest reads `VOID` and returns `409`;
    the rest redeem. 50 concurrent opens never leave more than the cap `ISSUED`.
    A concurrent open must not overwrite a ticket a redemption has already won.
14. With `daily_cap = N`, `N + 5` concurrent completions award exactly `N`.
15. Load: 1,000 completions/s for 10 minutes holds p99 < 150 ms and broadcast
    lag < 1 s.
