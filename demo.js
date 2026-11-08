// Demo of Peer Map: serves api/peers from the recorded node, and on demand plays the next block exactly as the
// real app showed it (Skripte/_demo_aufnahme.mjs records them). Only the block's age runs from the moment it is
// played. Built into the demo by Skripte/demo_bauen.py; not part of the app.
(() => {
  const realFetch = window.fetch.bind(window);
  const loadedAt = Date.now();
  let step = 0, playedAt = 0, steps = 0;
  const snaps = {};
  const load = (k) => snaps[k] || (snaps[k] = realFetch(k ? `api/steps/${k}/peers` : "api/peers").then((r) => r.json()));
  window.fetch = async (input, options) => {
    const url = typeof input === "string" ? input : input.url;
    if (!/^(\.\/)?api\/peers$/.test(url)) return realFetch(input, options);
    const d = structuredClone(await load(step));
    // The age as if the page had been asking all along: from the snapshot, or from the moment a block was played.
    if (d.last_block) d.last_block.age_ms = playedAt ? Date.now() - playedAt : d.last_block.age_ms + (Date.now() - loadedAt);
    d.next_in = 10;
    return new Response(JSON.stringify(d), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const button = () => document.getElementById("demo-block");
  function label() {
    const b = button();
    if (b && steps) b.textContent = step < steps ? `Next recorded block (${step + 1} of ${steps})` : "Back to the first block";
  }
  realFetch("api/steps/count").then((r) => r.json()).then((n) => { steps = n; label(); }).catch(() => {});
  async function play() {
    if (!steps) return;
    step = step < steps ? step + 1 : 0;
    await load(step);
    playedAt = step ? Date.now() : 0;
    label();
    // The page asks again when it becomes visible; that is the quickest way in without touching the app.
    document.dispatchEvent(new Event("visibilitychange"));
  }
  document.addEventListener("click", (e) => { if (e.target.closest("#demo-block")) play(); });
  document.addEventListener("DOMContentLoaded", label);
})();
