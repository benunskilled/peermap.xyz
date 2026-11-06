// Messmodus der Demo (Ben 06.11.2026: am iPhone springt die Lab-Seite nach längerem Lesen nach unten, im nachgebauten
// Safari nie). Nur mit ?messen in der Adresse. Schreibt unten in eine Leiste, wer die Seite bewegt: unsere eigenen
// scrollTo/scrollBy/scrollIntoView-Aufrufe (mit der Funktion, die sie auslöst), jeden Sprung über 100 px zwischen zwei
// Bildern, Größenänderungen des Fensters, Berührungen und welche Bereiche sich davor geändert haben.
// Wird von demo_bauen.py in die Lab-Demo kopiert; nicht Teil der App.
(() => {
  if (!/[?&]messen\b/.test(location.search)) return;
  const t0 = performance.now();
  const lines = [];
  let box = null;
  const now = () => ((performance.now() - t0) / 1000).toFixed(1) + "s";
  function log(msg) {
    lines.push(`${now()} ${msg}`);
    if (lines.length > 30) lines.shift();
    if (box) { box.textContent = lines.join("\n"); box.scrollTop = box.scrollHeight; }
  }
  // Welche Funktion in app.js hat gescrollt: die erste Zeile im Stapel, die nicht von hier stammt.
  const caller = () => {
    const s = (new Error().stack || "").split("\n").map((l) => l.trim()).filter((l) => l && !/demo-messen/.test(l) && !/^Error/.test(l));
    return (s[0] || "?").replace(/https?:\/\/[^ )]+\//, "").slice(0, 60);
  };
  for (const name of ["scrollTo", "scrollBy"]) {
    const orig = window[name].bind(window);
    window[name] = (...a) => {
      const y0 = Math.round(scrollY);
      orig(...a);
      // Jeder Aufruf, auch ein sanfter (behavior: smooth), der erst in den nächsten Bildern scrollt: am 06.11.
      // lief so ein Sprung über 0,2 s, und diese Zeile fehlte, weil sie nur sofortige Sprünge zählte.
      const d = Math.round(scrollY) - y0;
      log(`${name}(${JSON.stringify(a).slice(0, 60)}) sofort ${d} von ${caller()}`);
    };
  }
  const siv = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (...a) {
    const y0 = Math.round(scrollY);
    siv.apply(this, a);
    log(`scrollIntoView(${JSON.stringify(a).slice(0, 40)}) sofort ${Math.round(scrollY) - y0} (${this.id || String(this.className).slice(0, 30) || this.tagName}) von ${caller()}`);
  };
  // Was sich zuletzt geändert hat, für die Zeile beim Sprung.
  let changed = [];
  new MutationObserver((list) => {
    for (const m of list) {
      if (box && (m.target === box || box.contains(m.target))) continue;
      const card = m.target.closest && m.target.closest("section, .card, [id]");
      const name = card ? card.id || card.className.split(" ")[0] : m.target.nodeName;
      if (!changed.includes(name)) changed.push(name);
    }
    if (changed.length > 4) changed = changed.slice(-4);
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  // Die Leiste bleibt zu, bis die Seite springt, ohne dass ein Finger drauf ist oder eben losgelassen hat (Ben 06.11.:
  // mit offener Leiste kam der Sprung nicht mehr, der Bildschirm war zu klein zum Lesen).
  let lastY = scrollY, lastH = 0, touching = false, releasedAt = 0;
  addEventListener("touchstart", () => { touching = true; }, { passive: true });
  addEventListener("touchend", () => { touching = false; releasedAt = performance.now(); log("Finger los"); }, { passive: true });
  const show = () => { if (box) box.style.display = "block"; };
  addEventListener("resize", () => log(`Fenster ${innerWidth}×${innerHeight}`));
  // Klicks, Tasten und Fokus: auch ein Klick ohne Finger (Tastatur, Trackpad) kann scrollen.
  const what = (el) => (el && (el.id || (el.textContent || "").trim().slice(0, 24) || el.tagName)) || "?";
  addEventListener("click", (e) => log(`Klick auf ${what(e.target)}`), true);
  addEventListener("keydown", (e) => log(`Taste ${e.key}`), true);
  addEventListener("focusin", (e) => log(`Fokus ${what(e.target)}`), true);
  addEventListener("toggle", (e) => log(`aufgeklappt=${e.target.open} ${what(e.target)}`), true);
  if (window.visualViewport) visualViewport.addEventListener("resize", () => log(`Sichtfeld ${Math.round(visualViewport.height)}`));
  function frame() {
    const y = Math.round(scrollY), h = document.documentElement.scrollHeight;
    if (Math.abs(y - lastY) > 100 && !touching && performance.now() - releasedAt > 1500) show();
    if (Math.abs(y - lastY) > 100 && lines.length && /SPRUNG/.test(lines[lines.length - 1])) { lines[lines.length - 1] = `${now()} SPRUNG weiter bis y ${y}`; if (box) box.textContent = lines.join("\n"); }
    else if (Math.abs(y - lastY) > 100) log(`SPRUNG ${y - lastY > 0 ? "+" : ""}${y - lastY} (y ${y}, Seite ${lastH}→${h}${touching ? ", Finger drauf" : ""}) nach: ${changed.join(", ") || "nichts"}`);
    if (Math.abs(h - lastH) > 50 && lastH) log(`Seitenhöhe ${lastH}→${h} (${changed.join(", ")})`);
    lastY = y; lastH = h; changed = [];
    requestAnimationFrame(frame);
  }
  addEventListener("DOMContentLoaded", () => {
    box = document.createElement("pre");
    box.style.cssText = "display:none;position:fixed;left:0;right:0;bottom:0;z-index:99999;margin:0;padding:6px 8px;max-height:38vh;overflow:auto;" +
      "background:rgba(0,0,0,.85);color:#9f9;font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap;pointer-events:none";
    // Neben body, nicht darin: die App beobachtet body und würde jede neue Zeile als Änderung der Seite nehmen.
    document.documentElement.appendChild(box);
    log(`Messmodus an, ${innerWidth}×${innerHeight}`);
    lastH = document.documentElement.scrollHeight;
    requestAnimationFrame(frame);
  });
})();
