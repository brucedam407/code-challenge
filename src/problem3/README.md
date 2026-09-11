# Problem 3 - Messy React

What the component should do: drop balances on unsupported chains, order the rest
by chain priority, format the amounts, render a row each. What it does: throws on
the first render - and once that's fixed, renders exactly the empty balances,
with blank amounts.

21 issues, presented as the changes that fix them.
[`original.tsx`](original.tsx) -> [`refactored.tsx`](refactored.tsx).

## At a glance

**Bugs** — 1 `lhsPriority` is undefined · 2 filter keeps `amount <= 0`, i.e. the
empty balances · 3 `classes` never imported · 4 comparator has no equal-priority
branch · 5 `formattedBalances` built then discarded · 6 unguarded
`prices[currency]` renders "NaN" · 7 `toFixed()` with no argument · 8 `children`
swallowed.

**Types** — 9 `WalletBalance` has no `blockchain` · 10 `blockchain: any` ·
11 callback annotated `FormattedWalletBalance` over a `WalletBalance[]` ·
12 empty `interface Props extends BoxProps {}` · 13 `React.FC<Props>` *and*
`(props: Props)`.

**React / performance** — 14 `prices` in the deps of a memo that never reads it ·
15 `getPriority` redefined every render · 16 key derived twice per comparison ·
17 `sort` mutates · 18 `key={index}` on a reordering list · 19 `rows` not
memoised · 20 `BoxProps` spread onto a `<div>` · 21 `sortedBalances` is filtered
too.

---

## 1. The interfaces — fixes #9, #11, #12

```diff
 interface WalletBalance {
+  blockchain: string;
   currency: string;
   amount: number;
 }
-interface FormattedWalletBalance {
-  currency: string;
-  amount: number;
-  formatted: string;
-}
+interface WalletRowModel {
+  key: string;
+  amount: number;
+  formatted: string;
+  usdValue: number;
+}

-interface Props extends BoxProps {
-
-}
+type Props = BoxProps;
```

`blockchain` was read three times and declared nowhere (`TS2339` x3). It is typed
`string`, not the `Blockchain` union: the feed is an external boundary and may
return a chain this build has never heard of. `FormattedWalletBalance` became
`WalletRowModel` - what a row needs, *derived* rather than asserted, which is the
real fix for #11.

## 2. Priority — fixes #10, #15

```diff
-  const getPriority = (blockchain: any): number => {
-    switch (blockchain) {
-      case 'Osmosis':  return 100
-      case 'Ethereum': return 50
-      case 'Arbitrum': return 30
-      case 'Zilliqa':  return 20
-      case 'Neo':      return 20
-      default:         return -99
-    }
-  }
+type Blockchain = 'Osmosis' | 'Ethereum' | 'Arbitrum' | 'Zilliqa' | 'Neo';
+
+const PRIORITY: Record<Blockchain, number> = {
+  Osmosis: 100, Ethereum: 50, Arbitrum: 30, Zilliqa: 20, Neo: 20,
+};
+const UNSUPPORTED = -99;
+
+function getPriority(blockchain: string): number {
+  return PRIORITY[blockchain as Blockchain] ?? UNSUPPORTED;
+}
```

Note the indentation: this moved **out of the component**. It closes over
nothing, so being inside only reallocated it every render and made it unusable as
a hook dependency. `any` hid the case that matters - a typo'd chain scored `-99`
and the balance silently vanished; with `Record<Blockchain, number>`, adding a
chain to the union without ranking it stops compiling.

## 3. The component signature — fixes #13

```diff
-const WalletPage: React.FC<Props> = (props: Props) => {
-  const { children, ...rest } = props;
+export default function WalletPage({ children, ...rest }: Props) {
```

The type was stated twice, and `React.FC` cannot express generic components.

## 4. The derivation — fixes #1, #2, #4, #16, #17

```diff
-    return balances.filter((balance: WalletBalance) => {
-      const balancePriority = getPriority(balance.blockchain);
-      if (lhsPriority > -99) {
-         if (balance.amount <= 0) {
-           return true;
-         }
-      }
-      return false
-    }).sort((lhs: WalletBalance, rhs: WalletBalance) => {
-      const leftPriority = getPriority(lhs.blockchain);
-      const rightPriority = getPriority(rhs.blockchain);
-      if (leftPriority > rightPriority) {
-        return -1;
-      } else if (rightPriority > leftPriority) {
-        return 1;
-      }
-    });
+    const ranked: { balance: WalletBalance; priority: number }[] = [];
+    for (const balance of balances) {
+      const priority = getPriority(balance.blockchain);
+      if (priority > UNSUPPORTED && balance.amount > 0) ranked.push({ balance, priority });
+    }
+    ranked.sort((lhs, rhs) => rhs.priority - lhs.priority);
+    return ranked.map((entry) => entry.balance);
```

Four bugs and one inefficiency in that block.

The filter tests `lhsPriority`, which does not exist (`ReferenceError`,
`TS2304`), and its condition is inverted - `amount <= 0` keeps the empty balances
and drops every funded one (**#1, #2**).

Zilliqa and Neo are both `20`, so the comparator's equal path is reachable and
falls off the end returning `undefined`. TypeScript rejects that outright
(`(lhs, rhs) => 1 | -1 | undefined` is not assignable to `(a, b) => number`); at
runtime V8 coerces it to `NaN` and the spec says treat `NaN` as `+0`, so it sorts
correctly today on a detail nobody should lean on (**#4**).

The key is now derived once per balance rather than twice per comparison, in the
same pass that filters - measured 2.0-2.5x faster than the original shape
(**#16**, see below). And the sort is demonstrably on a local array, where the
original was safe only because `.filter` happened to copy first (**#17**).

## 5. The dependency list — fixes #14

```diff
-  }, [balances, prices]);
+  }, [balances]);
```

One word, and the most expensive line in the file. Ordering never reads `prices`,
so every tick of the price feed re-filtered and re-sorted the whole wallet and
handed back a **new array identity** for a list that could not have changed.

## 6. Formatting and conversion — fixes #5, #6, #7, #19

```diff
-  const formattedBalances = sortedBalances.map((balance: WalletBalance) => {
-    return {
-      ...balance,
-      formatted: balance.amount.toFixed()
-    }
-  })
+const AMOUNT_FORMAT = new Intl.NumberFormat('en-US', {   // module scope
+  minimumFractionDigits: 2,
+  maximumFractionDigits: 6,
+});
+
+  const rows = useMemo<WalletRowModel[]>(
+    () =>
+      sortedBalances.map((balance) => ({
+        key: `${balance.blockchain}-${balance.currency}`,
+        amount: balance.amount,
+        formatted: AMOUNT_FORMAT.format(balance.amount),
+        usdValue: (prices[balance.currency] ?? 0) * balance.amount,
+      })),
+    [sortedBalances, prices],
+  );
```

`formattedBalances` was computed on every render and then never used - `rows`
mapped `sortedBalances` instead, so `formattedAmount` was `undefined` on every
row (**#5**), and nothing was memoised (**#19**). `toFixed()` with no argument
means **zero** decimals: `1234.5678` rendered as `1235` (**#7**). The formatter
is built once at module scope, which matters far more than which formatter it is
- 270x, below. `?? 0` replaces `undefined * amount`, which printed "NaN" to the
user while the feed was still loading (**#6**); `usdValue?: number` and an em
dash would be more honest if `WalletRow` could be changed.

## 7. The render — fixes #3, #8, #18, #20

```diff
-    <div {...rest}>
-      {rows}
-    </div>
+    <Box {...rest}>
+      {rows.map((row) => (
+        <WalletRow
+          key={row.key}                      // `${blockchain}-${currency}`
+          className={classes.row}            // now imported
+          amount={row.amount}
+          usdValue={row.usdValue}
+          formattedAmount={row.formatted}
+        />
+      ))}
+      {children}
+    </Box>
```

`key={index}` on a list that reorders makes React reconcile row 0 of the old list
against row 0 of the new one, so DOM state - focus, animation, anything
uncontrolled - sticks to the wrong asset; `currency` alone is not unique either,
since one asset can sit on two chains. `rest` is `BoxProps`, so spreading it onto
a native `div` sends `sx` to the DOM and React warns about unknown attributes.
And `children` was destructured out of `rest`, then dropped - it renders now.

**#21 is the one change I did not make:** `sortedBalances` is filtered as well as
sorted, and `visibleBalances` would be truer. A naming nit, but part of why #5
slipped through - the name reads like the finished list.

---

## Performance, measured

`npm run bench` reproduces this (Node 24, one machine - read the ratios, not the
digits).

**#16 is a real win and an irrelevant one.** Deriving the key in the comparator
costs 8,766 lookups at `n=1000` where 1,000 would do; the shipped single pass
measures **2.0x** faster at `n=50` and **2.5x** at `n=1000` on that stage. It is
also 1.5x faster than the declarative `.filter().map().sort().map()` chain, which
is why the loop is written out - but the whole stage is **0.0016 ms for a
50-asset wallet**, so this is craft, not a fix. The shape earns its keep when the
key is *not* a Record lookup: with a deliberately expensive key it is **7.7x**.

**Formatting is where the per-render time goes**, and hoisting the formatter
matters far more than choosing it. Per 1000 amounts: `toFixed()` 0.07 ms, a
module-scope `Intl.NumberFormat` 0.39 ms, the same formatter **built per call
19.1 ms - 270x**. That last one is the only true performance bug available in
this component, and an easy one to write. #7's honest cost: correct precision
made this stage 5.5x slower than the buggy `toFixed()` - worth it at 0.39 ms per
1000 rows.

**#14 costs almost no JavaScript and is still the worst issue in the list.**
Re-deriving the order per price tick is 0.04 ms at `n=1000`; 2.5 ms/s even at 60
ticks/s. The cost was never the arithmetic - it is the new array identity, which
invalidates `rows` and reconciles **every** `WalletRow` on every tick, including
rows whose price did not move.

**Next, all outside the snippet:** `React.memo(WalletRow)` - the refactor passes
primitives rather than the row object precisely so one moving price re-renders
one row; verify `usePrices()` returns a referentially stable object, or #19's
memo never hits; virtualise if the list can run long.

## Files

| | |
|---|---|
| [`refactored.tsx`](refactored.tsx) | the result of the changes above |
| [`original.tsx`](original.tsx) | the code as given |
| [`deps.ts`](deps.ts) | ambient stubs for the hooks, `Box`, `WalletRow`, `classes` - not in the brief, so the refactor can be type-checked in isolation |
| [`bench.mjs`](bench.mjs) | the measurements above, re-runnable |

```bash
npm install
npm run typecheck   # tsc --noEmit, strict + noUncheckedIndexedAccess: clean
npm run bench
```
