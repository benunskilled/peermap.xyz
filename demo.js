// Demo of Peer Lab: answers the page's API calls from the recorded node in demo-data/, and on demand plays the
// next block exactly as the real app showed it (Skripte/_pl_demo_aufnahme.mjs records them): its block events
// with their real gaps, then every table as it stood once the pool was known. Only the clock moves to the moment
// the block is played. Built into the demo by Skripte/pl_demo_bauen.py; not part of the app.
(() => {
  const realFetch = window.fetch.bind(window);
  const loadedAt = Date.now();
  let step = 0, steps = 0, playedAt = 0;
  const dir = (k = step) => "demo-data/" + (k ? `steps/${k}/` : "");
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const lists = {};
  const list = (k, name) => lists[k + name] || (lists[k + name] = realFetch(dir(k) + name).then((r) => r.json()));

  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const local = url.origin === location.origin;
    if (local && url.pathname.endsWith("/peers/api/peers")) {
      // The list the page asks for when a block arrives (?block=) was recorded with that question too.
      const d = structuredClone(await list(step, url.searchParams.get("block") ? "peers_block.json" : "peers.json"));
      if (d.last_block) d.last_block.age_ms = playedAt ? Date.now() - playedAt : d.last_block.age_ms + (Date.now() - loadedAt);
      d.next_in = 10;
      return reply(d);
    }
    if (!local || !url.pathname.startsWith("/api/")) return realFetch(input, options);
    if ((options.method || "GET") !== "GET") return reply({ error: "This is a demo: nothing here changes a node." }, 403);
    const name = (url.pathname.slice(5) + url.search).replace(/[/?=]/g, "_") + ".json";
    return realFetch(dir() + name);
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
    const shift = (b) => ({ ...b, detectedAt: t0 + (b.detectedAt - d0) });
    for (const e of l) timers.push(setTimeout(() => emit(shift(e.data)), e.after_ms));
  }
  document.addEventListener("click", (e) => { if (e.target.closest("#demo-block")) play(); });
  document.addEventListener("DOMContentLoaded", label);
})();
