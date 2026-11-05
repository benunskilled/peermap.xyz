// Demo of Bitcoin Lab: answers the page's API calls from a snapshot in demo-data/, and plays a new block on demand
// (demo_sim.js draws it). Built into the demo by Skripte/demo_bauen.py; not part of the app.
(() => {
  const realFetch = window.fetch.bind(window);
  let sim = null; // the newest simulated block, once there is one
  const file = (path) => "demo-data/" + path.replace(/^\/api\//, "").replace(/[/?=]/g, "_") + ".json";
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const load = (path) => realFetch(file(path)).then((r) => r.json());
  // The Stratum Race tables as they stand after the simulated blocks, by range.
  const pools = {};
  const CAP = { "10": 10, "100": 100, all: Infinity };

  window.fetch = async (input, options = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.startsWith("/api/")) return realFetch(input, options);
    if ((options.method || "GET") !== "GET") return reply({ error: "This is a demo: nothing here changes a node." }, 403);
    const range = url.match(/^\/api\/pools\?range=(\w+)$/);
    if (range && pools[range[1]]) return reply(pools[range[1]]);
    const res = await realFetch(file(url));
    if (!res.ok) return res;
    const data = await res.json();
    // The status poll would put the snapshot's height back under a simulated block.
    if (url === "/api/status" && sim) data.blockHeight = sim.blockHeight;
    return reply(data);
  };

  // /api/events: the snapshot's block once on connect, as the server does, then whatever the button plays.
  const listeners = [];
  let base = null;
  load("/api/event_block").then((b) => { base = b; emit(b); }).catch(() => {});
  function emit(block) {
    const e = new MessageEvent("block", { data: JSON.stringify(block) });
    for (const fn of listeners) fn(e);
  }
  window.EventSource = class {
    constructor() { this.readyState = 1; }
    addEventListener(type, fn) { if (type === "block") listeners.push(fn); }
    close() { this.readyState = 2; }
  };
  window.EventSource.CLOSED = 2;

  // One round of the Stratum Race into every range's table: the new delay is "last", the average and the
  // wins take it in, and a range that is full lets its oldest block go.
  function addRound(delays) {
    const winner = Object.entries(delays).reduce((a, b) => (b[1] < a[1] ? b : a))[0];
    for (const [range, rows] of Object.entries(pools)) {
      for (const p of rows) {
        if (!(p.label in delays)) continue;
        const ms = delays[p.label], won = p.label === winner;
        const n = Math.min(p.seen, CAP[range] - 1);
        p.avgMs = (p.avgMs * n + ms) / (n + 1);
        p.wins = (p.seen >= CAP[range] ? p.wins * (CAP[range] - 1) / CAP[range] : p.wins) + (won ? 1 : 0);
        p.seen = Math.min(p.seen + 1, CAP[range]);
        p.winPct = (100 * p.wins) / p.seen;
        p.lastMs = ms;
        p.wonLastRace = won;
      }
      rows.sort((a, b) => b.wins - a.wins || a.avgMs - b.avgMs);
    }
  }

  async function play() {
    if (!base) return;
    const [ranking, shares, local] = await Promise.all([load("/api/peers/ranking"), load("/api/pool_shares"), load("/api/pools/local")]);
    for (const r of Object.keys(CAP)) if (!pools[r]) pools[r] = await load("/api/pools?range=" + r);
    const prev = sim || base;
    const peer = DemoSim.deliverer(ranking) || ranking[0];
    const tpl = DemoSim.template();
    const core = DemoSim.between(60, 180); // the block at Core, after the first pool's job (ms)
    const delays = DemoSim.round(Object.fromEntries(pools.all.map((p) => [p.label, p.avgMs])));
    // The node's own pool builds its job from Core's template, so it cannot be ready before it; how long
    // it takes after that grows with the transactions (216 ms behind the template at 4058 in the snapshot).
    const own = local.find((l) => l.added);
    const ownPool = own && pools.all.find((p) => p.host === own.host);
    if (ownPool) {
      const after = 216 * (0.5 + (0.5 * tpl.tx) / 4058) * DemoSim.between(0.8, 1.2);
      delays[ownPool.label] = Math.max(delays[ownPool.label], core + tpl.ms + after);
    }
    const first = Math.min(...Object.values(delays));
    for (const k of Object.keys(delays)) delays[k] -= first;
    addRound(delays);
    const hash = "00000000000000000000" + [...crypto.getRandomValues(new Uint8Array(22))].map((b) => b.toString(16).padStart(2, "0")).join("");
    sim = { ...prev, id: prev.id + 1, blockHash: hash.slice(0, 64), blockHeight: prev.blockHeight + 1, detectedAt: Date.now(),
      pool: null, poolName: null, poolTag: null, templateMs: tpl.ms, templateTx: tpl.tx,
      firstPingMs: (peer.minPingMs || 20) * DemoSim.between(1, 1.3),
      firstPeers: [{ address: peer.address, trustedLabel: peer.trustedLabel || null }] };
    emit(sim);
    // The pool is read from the coinbase a few seconds later, as on a real node.
    const name = DemoSim.pool(shares);
    setTimeout(() => { sim = { ...sim, pool: name, poolName: name }; emit(sim); }, 3000);
  }
  document.addEventListener("click", (e) => { if (e.target.closest("#demo-block")) play(); });
})();
