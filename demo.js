// Demo of Peer Lab: answers the page's API calls from the recorded node in demo-data/, and on demand plays the
// next block exactly as the real app showed it (Skripte/_pl_demo_aufnahme.mjs records them): its block events
// with their real gaps, then every table as it stood once the pool was known. Only the clock moves: every recorded
// time (connected since, log entries, the block) is shifted so the snapshot happened when it was loaded or played,
// and a visit a month later still shows the ages the node had. Built into the demo by Skripte/pl_demo_bauen.py; not part of the app.
(() => {
  const realFetch = window.fetch.bind(window);
  const loadedAt = Date.now();
  let step = 0, steps = 0, playedAt = 0;
  const dir = (k = step) => "demo-data/" + (k ? `steps/${k}/` : "");
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const lists = {};
  const list = (k, name) => lists[k + name] || (lists[k + name] = realFetch(dir(k) + name).then((r) => r.json()));
  // How far the recording lies behind now, in ms. A played block arrived when the button was pressed; the start
  // was taken when the page loaded (the map list's fetched_at is when that snapshot was taken).
  let playedShift = null;
  const shiftMs = async () => playedShift != null ? playedShift : loadedAt - (await list(0, "peers.json")).fetched_at * 1000;
  // The snapshot of a played block was taken some seconds after it arrived, so a shifted time can land a moment
  // after now; it is held at now.
  const later = (v, ms, unit = 1) => (typeof v === "number" ? Math.min(v + ms / unit, Date.now() / unit) : v);
  function shiftLab(name, d, ms) {
    if (name.startsWith("rotation")) {
      for (const e of d.log || []) e.at = later(e.at, ms);
      if (d.status) { d.status.at = later(d.status.at, ms); if (typeof d.status.nextAt === "number") d.status.nextAt += ms; }
    } else if (name.startsWith("health")) {
      for (const sv of Object.values(d.services || {})) {
        sv.lastBlockAtMs = later(sv.lastBlockAtMs, ms); sv.subscribedAtMs = later(sv.subscribedAtMs, ms);
      }
    } else if (name.startsWith("traffic") && typeof d.since === "string") {
      d.since = new Date(Date.parse(d.since) + ms).toISOString();
    }
    return d;
  }

  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const local = url.origin === location.origin;
    if (local && url.pathname.endsWith("/peers/api/peers")) {
      // The list the page asks for when a block arrives (?block=) was recorded with that question too.
      const d = structuredClone(await list(step, url.searchParams.get("block") ? "peers_block.json" : "peers.json"));
      if (d.last_block) d.last_block.age_ms = playedAt ? Date.now() - playedAt : d.last_block.age_ms + (Date.now() - loadedAt);
      const ms = await shiftMs();
      d.fetched_at = later(d.fetched_at, ms, 1000);
      for (const p of d.peers || []) if (p.conntime) p.conntime = later(p.conntime, ms, 1000);
      d.next_in = 10;
      return reply(d);
    }
    if (!local || !url.pathname.startsWith("/api/")) return realFetch(input, options);
    if ((options.method || "GET") !== "GET") return reply({ error: "This is a demo: nothing here changes a node." }, 403);
    const name = (url.pathname.slice(5) + url.search).replace(/[/?=]/g, "_") + ".json";
    const r = await realFetch(dir() + name);
    if (!r.ok || !/^(rotation|health|traffic)/.test(name)) return r;
    return reply(shiftLab(name, await r.json(), await shiftMs()));
  };

  // /api/events: the recorded block once on connect, as the server does, then whatever the button plays.
  const listeners = [];
  const timers = [];
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
  const events = (k) => realFetch(dir(k) + "events.json").then((r) => r.json());
  events(0).then((l) => { const last = l[l.length - 1]; if (last) emit(last.data); }).catch(() => {});

  const button = () => document.getElementById("demo-block");
  function label() {
    const b = button();
    if (b && steps) b.textContent = step < steps ? `Next recorded block (${step + 1} of ${steps})` : "Back to the first block";
  }
  realFetch(dir(0) + "steps/count.json").then((r) => r.json()).then((n) => { steps = n; label(); }).catch(() => {});

  async function play() {
    if (!steps) return;
    // Back to the start: the page keeps the highest height it has seen, so it starts over instead.
    if (step >= steps) { location.reload(); return; }
    const next = step + 1;
    const l = await events(next);
    await Promise.all([list(next, "peers.json"), list(next, "peers_block.json")]);
    for (const t of timers.splice(0)) clearTimeout(t);
    step = next;
    playedAt = step ? Date.now() : 0;
    label();
    // The events as they came, a few seconds apart (the pool is read from the coinbase after the block); the
    // detection time moves to now, everything else is the recording.
    const t0 = Date.now(), d0 = l.length ? l[0].data.detectedAt : 0;
    playedShift = l.length ? t0 - d0 : null;
    const shift = (b) => ({ ...b, detectedAt: t0 + (b.detectedAt - d0) });
    for (const e of l) timers.push(setTimeout(() => emit(shift(e.data)), e.after_ms));
  }
  document.addEventListener("click", (e) => { if (e.target.closest("#demo-block")) play(); });
  document.addEventListener("DOMContentLoaded", label);
})();
