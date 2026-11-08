// Demo of Bitcoin Lab: answers the page's API calls from the recorded node in demo-data/, and on demand plays the
// next block exactly as the real app showed it (Skripte/_demo_aufnahme.mjs records them): its block events with
// their real gaps, then every table as it stood once the pool was known. Only the clock moves to the moment the
// block is played. Built into the demo by Skripte/demo_bauen.py; not part of the app.
(() => {
  const realFetch = window.fetch.bind(window);
  let step = 0, steps = 0;
  const file = (path) => "demo-data/" + (step ? `steps/${step}/` : "") + path.replace(/^\/api\//, "").replace(/[/?=]/g, "_") + ".json";
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  window.fetch = async (input, options = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.startsWith("/api/")) return realFetch(input, options);
    if ((options.method || "GET") !== "GET") return reply({ error: "This is a demo: nothing here changes a node." }, 403);
    return realFetch(file(url));
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
  const events = (k) => realFetch(`demo-data/${k ? `steps/${k}/` : ""}events.json`).then((r) => r.json());
  events(0).then((list) => { const last = list[list.length - 1]; if (last) emit(last.data); }).catch(() => {});

  const button = () => document.getElementById("demo-block");
  function label() {
    const b = button();
    if (b && steps) b.textContent = step < steps ? `Next recorded block (${step + 1} of ${steps})` : "Back to the first block";
  }
  realFetch("demo-data/steps/count.json").then((r) => r.json()).then((n) => { steps = n; label(); }).catch(() => {});

  async function play() {
    if (!steps) return;
    const next = step < steps ? step + 1 : 0;
    const list = await events(next);
    for (const t of timers.splice(0)) clearTimeout(t);
    step = next;
    label();
    // The events as they came, a few seconds apart (the pool is read from the coinbase after the block); the
    // detection time moves to now, everything else is the recording.
    const t0 = Date.now(), d0 = list.length ? list[0].data.detectedAt : 0;
    const shift = (b) => ({ ...b, detectedAt: t0 + (b.detectedAt - d0) });
    if (!step) { const last = list[list.length - 1]; if (last) emit(shift(last.data)); return; }
    for (const e of list) timers.push(setTimeout(() => emit(shift(e.data)), e.after_ms));
  }
  document.addEventListener("click", (e) => { if (e.target.closest("#demo-block")) play(); });
  document.addEventListener("DOMContentLoaded", label);
})();
