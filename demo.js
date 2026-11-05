// Demo of Peer Map: serves api/peers from the snapshot, keeps the block's age running, and plays a new block on
// demand (demo_sim.js draws it). Built into the demo by Skripte/demo_bauen.py; not part of the app.
(() => {
  const realFetch = window.fetch.bind(window);
  const loadedAt = Date.now();
  let snap = null, simAt = 0;
  window.fetch = async (input, options) => {
    const url = typeof input === "string" ? input : input.url;
    if (!/^(\.\/)?api\/peers$/.test(url)) return realFetch(input, options);
    if (!snap) snap = await (await realFetch("api/peers")).json();
    const d = structuredClone(snap);
    // The age as if the page had been asking all along, from the snapshot's block or the simulated one.
    if (d.last_block) d.last_block.age_ms = simAt ? Date.now() - simAt : d.last_block.age_ms + (Date.now() - loadedAt);
    d.next_in = 10;
    return new Response(JSON.stringify(d), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  async function play() {
    if (!snap) return;
    // Who delivers it: from the Lab demo's ranking beside this one, which carries the same addresses.
    const [ranking, shares] = await Promise.all([
      realFetch("lab/demo-data/peers_ranking.json").then((r) => r.json()),
      realFetch("api/pool_shares").then((r) => r.json()),
    ]);
    const known = new Map(snap.peers.map((p) => [p.addr, p]));
    const choice = DemoSim.deliverer(ranking.filter((r) => known.has(r.address)));
    const peer = choice ? known.get(choice.address) : snap.peers.find((p) => p.group !== "inbound");
    const b = snap.last_block, s = b.stratum;
    const tpl = DemoSim.template();
    const core = s.core_ms * DemoSim.between(0.6, 1.5);
    const delays = DemoSim.round(Object.fromEntries(s.entries.map((e) => [e.label, e.latency_ms])));
    // The node's own pool builds its job from Core's template, so it cannot be ready before it; how long it
    // takes after that grows with the transactions (216 ms behind the template at 4058 in the snapshot).
    const own = s.entries.find((e) => e.own);
    if (own) delays[own.label] = Math.max(delays[own.label], core + tpl.ms + 216 * (0.5 + (0.5 * tpl.tx) / 4058) * DemoSim.between(0.8, 1.2));
    const first = Math.min(...Object.values(delays));
    const entries = s.entries.map((e) => ({ ...e, latency_ms: delays[e.label] - first }))
      .sort((x, y) => x.latency_ms - y.latency_ms).map((e, i) => ({ ...e, rank: i + 1 }));
    const name = DemoSim.pool(shares);
    const hash = "00000000000000000000" + [...crypto.getRandomValues(new Uint8Array(22))].map((x) => x.toString(16).padStart(2, "0")).join("");
    simAt = Date.now();
    snap.last_block = { ...b, hash: hash.slice(0, 64), height: b.height + 1, pool: name, pool_name: name, pool_source: "address",
      first_peers: peer ? [peer.addr] : [], first_ping_ms: peer ? (peer.min_ping_ms || peer.ping_ms) * DemoSim.between(1, 1.3) : null,
      template_ms: tpl.ms, template_tx: tpl.tx, stratum: { ...s, created_at: simAt, core_ms: Math.round(core - first), entries } };
    snap.fetched_at = Math.floor(simAt / 1000);
    // The page asks again when it becomes visible; that is the quickest way in without touching the app.
    document.dispatchEvent(new Event("visibilitychange"));
  }
  document.addEventListener("click", (e) => { if (e.target.closest("#demo-block")) play(); });
})();
