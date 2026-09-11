/** The numbers quoted in README.md. `node bench.mjs`, Node 20+, no deps. */

const CHAINS = ['Osmosis', 'Ethereum', 'Arbitrum', 'Zilliqa', 'Neo', 'Solana'];
const PRIORITY = { Osmosis: 100, Ethereum: 50, Arbitrum: 30, Zilliqa: 20, Neo: 20 };

let calls = 0;
const priority = (chain) => {
  calls++;
  return PRIORITY[chain] ?? -99;
};

/** A sort key that is not a single object lookup. */
const expensivePriority = (chain) => {
  calls++;
  let h = 0;
  for (let i = 0; i < 200; i++) h = (h * 31 + chain.charCodeAt(i % chain.length)) | 0;
  return (PRIORITY[chain] ?? -99) + (h & 0);
};

const makeBalances = (n) =>
  Array.from({ length: n }, (_, i) => ({
    blockchain: CHAINS[i % CHAINS.length],
    currency: `TOK${i}`,
    amount: i % 7 === 0 ? 0 : (i * 13.37) % 1000,
  }));

const SORTS = {
  // The original: key derived inside the comparator.
  'comparator derives key': (balances, key) =>
    balances
      .filter((b) => key(b.blockchain) > -99 && b.amount > 0)
      .sort((l, r) => key(r.blockchain) - key(l.blockchain)),

  // Decorate / sort / unwrap, declarative form.
  'decorate, sort, unwrap': (balances, key) =>
    balances
      .filter((b) => key(b.blockchain) > -99 && b.amount > 0)
      .map((b) => ({ b, p: key(b.blockchain) }))
      .sort((l, r) => r.p - l.p)
      .map(({ b }) => b),

  // Shipped: filter and decoration fused into one loop.
  'single pass [shipped]': (balances, key) => {
    const ranked = [];
    for (const b of balances) {
      const p = key(b.blockchain);
      if (p > -99 && b.amount > 0) ranked.push({ b, p });
    }
    ranked.sort((l, r) => r.p - l.p);
    return ranked.map((d) => d.b);
  },
};

function time(fn, iterations) {
  fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return (performance.now() - start) / iterations;
}

const section = (title) => console.log(`\n\x1b[1m${title}\x1b[0m`);

section('1. Sort stage - cheap key (a Record lookup, as shipped)');
for (const n of [50, 1000]) {
  const balances = makeBalances(n);
  const results = Object.entries(SORTS).map(([name, sort]) => {
    calls = 0;
    sort(balances, priority);
    return { name, keyCalls: calls, ms: time(() => sort(balances, priority), n > 500 ? 2000 : 20000) };
  });
  const best = Math.min(...results.map((r) => r.ms));
  console.log(`  n=${n}`);
  for (const r of results) {
    console.log(
      `    ${r.name.padEnd(24)} ${r.ms.toFixed(4)} ms  ${(r.ms / best).toFixed(2)}x   ${String(r.keyCalls).padStart(6)} key derivations`,
    );
  }
}

section('2. Sort stage - expensive key (when the shape actually matters)');
{
  const balances = makeBalances(1000);
  const results = Object.entries(SORTS).map(([name, sort]) => ({
    name,
    ms: time(() => sort(balances, expensivePriority), 200),
  }));
  const best = Math.min(...results.map((r) => r.ms));
  console.log('  n=1000');
  for (const r of results) console.log(`    ${r.name.padEnd(24)} ${r.ms.toFixed(4)} ms  ${(r.ms / best).toFixed(2)}x`);
}

section('3. Formatting 1000 amounts - where the per-render time goes');
{
  const amounts = Array.from({ length: 1000 }, (_, i) => (i * 13.37) % 100000);
  const FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  const cases = {
    'toFixed() [the original]': () => amounts.map((a) => a.toFixed()),
    'toFixed(6)': () => amounts.map((a) => a.toFixed(6)),
    'Intl, built once [shipped]': () => amounts.map((a) => FORMAT.format(a)),
    'Intl, built per call': () =>
      amounts.map((a) =>
        new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(a),
      ),
  };
  const results = Object.entries(cases).map(([name, fn]) => ({
    name,
    ms: time(fn, name.endsWith('per call') ? 20 : 500),
  }));
  const baseline = results[0].ms;
  for (const r of results) {
    console.log(`  ${r.name.padEnd(28)} ${r.ms.toFixed(4)} ms  ${(r.ms / baseline).toFixed(1)}x toFixed()`);
  }
}

section('4. Cost of the wrong useMemo dependency, in JS terms');
{
  const balances = makeBalances(1000);
  const perPass = time(() => SORTS['single pass [shipped]'](balances, priority), 2000);
  console.log(`  re-deriving the order at n=1000 costs ${perPass.toFixed(4)} ms`);
  for (const hz of [1, 10, 60]) {
    console.log(`    at ${String(hz).padStart(2)} price ticks/s: ${(perPass * hz).toFixed(2)} ms/s of main thread`);
  }
  console.log('  ...which is not the point: see README, "Performance, measured".');
}
