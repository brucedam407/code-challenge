# Problem 1 - Three ways to sum to n

`index.js` exports three independent implementations of `sum_to_n`.

Because the brief says "any integer", negatives are defined symmetrically -
the terms run the other way and carry their sign, so `sum_to_n(-5) === -15`
and `sum_to_n(0) === 0`. All three agree on every input.

| | Approach | Time | Space |
|---|---|---|---|
| `sum_to_n_a` | Closed form (Gauss pairing) | O(1) | O(1) |
| `sum_to_n_b` | Iterative accumulation | O(n) | O(1) |
| `sum_to_n_c` | Halving recurrence (recursive) | O(log n) | O(log n) stack |

Two details worth calling out:

- **(a)** halves the even member of `(n, n + 1)` *before* multiplying. Doing
  `n * (n + 1) / 2` computes an intermediate twice the size of the answer,
  which can leave the safe-integer range even when the result would not.
- **(c)** avoids the textbook `n + sum(n - 1)` recursion, which needs one stack
  frame per term and overflows near `n = 1e4`. The brief allows `n` up to
  `134,217,727`, so the range is split by parity instead: the even terms are
  twice the same problem at half the size, and the first `k` odd numbers sum to
  exactly `k^2`, so they need no recursion at all. That gives
  `S(m) = 2 * S(floor(m / 2)) + ceil(m / 2)^2` - 27 frames and no measurable
  runtime at the largest permitted input.

`sum_to_n_a` is the one to ship; (b) and (c) are included because the task asks
for three distinct approaches.

## Verifying

```
node -e "const {sum_to_n_a,sum_to_n_b,sum_to_n_c}=require('./index.js'); console.log(sum_to_n_a(5), sum_to_n_b(5), sum_to_n_c(5))"
# 15 15 15
```
