// Shared by both demos: one simulated block, drawn from the snapshot's own numbers. Built in by
// Skripte/demo_bauen.py; not part of the apps.
//   - who delivers it: a peer that delivered at least one of the last 500 blocks first (Lab ranking),
//     the strongest about every third block, the others in turn
//   - who mined it: by each pool's share of last week's blocks (mempool.space, pool_shares.json)
//   - the template: transactions drawn first, Core's time from them - 37 ms plus 13 ms per 1000
//     transactions, from two measured blocks on this node (991 tx in 50 ms, 4058 tx in 90 ms)
//   - the pools' jobs: each around its own time in the snapshot, the fastest wins the round
window.DemoSim = (() => {
  const between = (a, b) => a + Math.random() * (b - a);
  const pick = (items, weight) => {
    const total = items.reduce((t, x) => t + weight(x), 0);
    let r = Math.random() * total;
    for (const x of items) if ((r -= weight(x)) <= 0) return x;
    return items[items.length - 1];
  };
  function deliverer(ranking) {
    const delivered = ranking.filter((p) => p.live && p.recentFirst > 0);
    if (!delivered.length) return null;
    const strongest = delivered.reduce((a, b) => (b.recentFirst > a.recentFirst ? b : a));
    const others = delivered.filter((p) => p !== strongest);
    return Math.random() < 1 / 3 || !others.length ? strongest : others[Math.floor(Math.random() * others.length)];
  }
  const pool = (shares) => pick(shares.filter((s) => s.name !== "Unknown"), (s) => s.blocks).name;
  function template() {
    // Now and then a nearly empty block, as right after another one; mostly a full one.
    const tx = Math.random() < 0.08 ? Math.round(between(1, 300)) : Math.round(between(1500, 5000));
    return { tx, ms: Math.round((37 + 0.013 * tx) * between(0.9, 1.15)) };
  }
  // base: label -> the pool's delay behind the first job in the snapshot (ms). Returns label -> delay
  // behind this round's first job; a pool sometimes has a slow round, so the winner changes now and then.
  function round(base) {
    const raw = {};
    for (const [label, ms] of Object.entries(base)) {
      raw[label] = Math.max(1, ms) * between(0.6, 1.4) + 4 + (Math.random() < 0.1 ? between(80, 300) : 0);
    }
    const first = Math.min(...Object.values(raw));
    for (const label of Object.keys(raw)) raw[label] -= first;
    return raw;
  }
  return { between, deliverer, pool, template, round };
})();
