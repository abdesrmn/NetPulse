/* NetPulse Maroc: speed test engine + page logic (plain JavaScript, no libraries) */
(() => {
  "use strict";

  /* ---------- Settings: change these when you have your own test server ---------- */
  const CFG = {
    API_URL: "",   // e.g. "https://yourdomain.ma/api". Empty = results are NOT sent anywhere yet.
    // Test endpoints. Right now: Cloudflare's public speed-test servers.
    // Later: point these at your own LibreSpeed / test server near Morocco.
    PING_URL: () => `https://speed.cloudflare.com/__down?bytes=0&r=${Math.random()}`,
    DOWN_URL: (bytes) => `https://speed.cloudflare.com/__down?bytes=${bytes}&r=${Math.random()}`,
    UP_URL: () => `https://speed.cloudflare.com/__up?r=${Math.random()}`,
    PING_COUNT: 10,
    DOWN_SECONDS: 8, DOWN_STREAMS: 6, DOWN_CHUNK: 25000000,
    UP_SECONDS: 7, UP_STREAMS: 3, UP_CHUNK: 3000000,
    WARMUP: 1.2          // seconds ignored at the start of each phase (connection ramp-up)
  };

  const $ = (id) => document.getElementById(id);
  const ARC = 377;       // length of the gauge arc
  let ctl = null;        // AbortController for the running test

  /* ---------- Gauge ---------- */
  const frac = (mbps) => Math.min(1, Math.log10(1 + mbps) / Math.log10(1001)); // 0..1000 Mbps, log scale
  function setGauge(v, label) {
    $("gFill").style.strokeDashoffset = ARC * (1 - frac(v));
    $("gValue").textContent = v >= 100 ? Math.round(v) : v.toFixed(1);
    if (label !== undefined) $("gPhase").textContent = label;
  }
  (function drawTicks() {
    const g = $("gTicks");
    [1, 5, 10, 25, 50, 100, 250, 500, 1000].forEach((v) => {
      const a = Math.PI * (1 - frac(v));
      const x = 150 + 138 * Math.cos(a), y = 150 - 138 * Math.sin(a) + 3;
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", x.toFixed(1)); t.setAttribute("y", y.toFixed(1)); t.setAttribute("class", "g-tick");
      t.textContent = v; g.appendChild(t);
    });
  })();

  /* ---------- Measurements ---------- */
  async function measurePing(signal) {
    const times = [];
    for (let i = 0; i <= CFG.PING_COUNT; i++) {
      const s = performance.now();
      const r = await fetch(CFG.PING_URL(), { cache: "no-store", signal });
      await r.arrayBuffer();
      if (i > 0) times.push(performance.now() - s);   // first request includes connection setup
    }
    const sorted = [...times].sort((a, b) => a - b);
    const ping = sorted[Math.floor(sorted.length / 2)];
    let jitter = 0;
    for (let i = 1; i < times.length; i++) jitter += Math.abs(times[i] - times[i - 1]);
    return { ping, jitter: jitter / (times.length - 1) };
  }

  // Runs for N seconds, reporting Mbps; ignores the warm-up period.
  function timed(signal, seconds, getBytes, onTick) {
    return new Promise((resolve, reject) => {
      const t0 = performance.now();
      let tm = null, b0 = 0;
      const id = setInterval(() => {
        const now = performance.now(), el = (now - t0) / 1000;
        if (tm === null && el >= CFG.WARMUP) { tm = now; b0 = getBytes(); }
        const mbps = tm === null
          ? (getBytes() * 8) / 1e6 / Math.max(el, 0.2)
          : ((getBytes() - b0) * 8) / 1e6 / Math.max((now - tm) / 1000, 0.2);
        onTick(mbps);
        if (el >= seconds + CFG.WARMUP) { clearInterval(id); resolve(mbps); }
      }, 200);
      signal.addEventListener("abort", () => { clearInterval(id); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
    });
  }

  async function measureDown(signal, onTick) {
    let bytes = 0, stop = false;
    const c = new AbortController();
    signal.addEventListener("abort", () => c.abort(), { once: true });
    const worker = async () => {
      while (!stop) {
        try {
          const r = await fetch(CFG.DOWN_URL(CFG.DOWN_CHUNK), { cache: "no-store", signal: c.signal });
          const rd = r.body.getReader();
          for (;;) { const x = await rd.read(); if (x.done) break; bytes += x.value.length; }
        } catch (e) { return; }
      }
    };
    for (let i = 0; i < CFG.DOWN_STREAMS; i++) worker();
    try {
      const v = await timed(signal, CFG.DOWN_SECONDS, () => bytes, onTick);
      if (bytes === 0) throw new Error("no data");
      return v;
    } finally { stop = true; c.abort(); }
  }

  async function measureUp(signal, onTick) {
    let bytes = 0, stop = false, fails = 0;
    const block = new Uint8Array(65536); crypto.getRandomValues(block);
    const blob = new Blob(Array.from({ length: Math.ceil(CFG.UP_CHUNK / 65536) }, () => block));
    const xhrs = new Set();
    const worker = () => {
      if (stop) return;
      const x = new XMLHttpRequest(); xhrs.add(x);
      let last = 0;
      x.open("POST", CFG.UP_URL());
      x.upload.onprogress = (e) => { bytes += e.loaded - last; last = e.loaded; };
      x.onload = x.onabort = () => { xhrs.delete(x); worker(); };
      x.onerror = () => { xhrs.delete(x); if (++fails <= 2) worker(); };
      x.send(blob);
    };
    for (let i = 0; i < CFG.UP_STREAMS; i++) worker();
    try {
      const v = await timed(signal, CFG.UP_SECONDS, () => bytes, onTick);
      if (bytes === 0) throw new Error("no data");
      return v;
    } finally { stop = true; xhrs.forEach((x) => x.abort()); }
  }

  /* ---------- Page logic ---------- */
  const fmt = (v, d = 1) => (v == null ? "–" : v >= 100 ? Math.round(v) : v.toFixed(d));
  function setMetric(id, text) { $(id).textContent = text; }
  function activate(id) { document.querySelectorAll(".metric").forEach((m) => m.classList.toggle("active", m.id === id)); }

  function interpret(r) {
    const d = r.down, u = r.up ?? 0;
    const tier = d < 5 ? "Slow" : d < 25 ? "Basic" : d < 100 ? "Good" : d < 300 ? "Very good" : "Excellent";
    const uses = [
      ["Web browsing", d >= 3],
      ["HD video", d >= 8],
      ["4K video", d >= 25],
      ["Video calls", d >= 5 && u >= 3 && r.ping < 100],
      ["Online gaming", r.ping < 50 && r.jitter < 20 && d >= 5]
    ];
    return { tier, uses };
  }

  function showResult(r) {
    const { tier, uses } = interpret(r);
    $("resultTitle").textContent = `${tier} connection`;
    $("chips").innerHTML = uses.map(([n, ok]) => `<span class="chip ${ok ? "ok" : "no"}">${ok ? "✓" : "✕"} ${n}</span>`).join("");
    $("resultTip").textContent = $("path").value === "wifi" || $("path").value === ""
      ? "Tip: if this is lower than expected, test again with a network cable. A big difference means the problem is your Wi-Fi, not your operator."
      : "Tip: test again in the evening (7–11 pm). If results drop a lot, it may be peak-hour congestion.";
    $("result").hidden = false;
  }

  const LABELS = { maroc_telecom: "Maroc Telecom", orange: "Orange", inwi: "inwi" };

  /* history (kept only in this browser) */
  function loadHist() { try { return JSON.parse(localStorage.getItem("np_history") || "[]"); } catch (e) { return []; } }
  function saveHist(r) {
    try {
      const h = loadHist();
      h.unshift({ t: Date.now(), down: r.down, up: r.up, ping: r.ping, op: $("operator").value });
      localStorage.setItem("np_history", JSON.stringify(h.slice(0, 10)));
    } catch (e) { /* storage unavailable: ignore */ }
    renderHist();
  }
  function renderHist() {
    const h = loadHist(), box = $("histBox");
    if (!h.length) { box.innerHTML = '<p class="hist-empty">No tests yet. Your results will appear here.</p>'; return; }
    box.innerHTML = '<table class="hist"><thead><tr><th>When</th><th>Download</th><th>Upload</th><th>Ping</th><th>Operator</th></tr></thead><tbody>' +
      h.map((x) => `<tr><td>${new Date(x.t).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td><td>${fmt(x.down)} Mbps</td><td>${fmt(x.up)} Mbps</td><td>${fmt(x.ping, 0)} ms</td><td>${LABELS[x.op] || "–"}</td></tr>`).join("") +
      "</tbody></table>";
  }

  async function save(r) {
    const note = $("saveNote");
    const body = {
      zone_id: Number($("zone").value), operator: $("operator").value, connection_type: $("conn").value,
      network_path: $("path").value || "unknown",
      download_mbps: +r.down.toFixed(2), upload_mbps: +(r.up ?? 0).toFixed(2),
      ping_ms: +r.ping.toFixed(1), jitter_ms: +r.jitter.toFixed(1)
    };
    if (!CFG.API_URL) { note.textContent = "Preview mode: your result is shown and saved only on this device for now."; return; }
    if (!body.zone_id || !body.operator || !body.connection_type) { note.textContent = "Choose your neighbourhood, operator and connection type to add your result to the map."; return; }
    try {
      const res = await fetch(CFG.API_URL + "/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(res.status);
      note.textContent = "Thanks! Your result was added to the community data.";
    } catch (e) { note.textContent = "We couldn't save your result. Please try again later."; }
  }

  async function run() {
    if (ctl) { ctl.abort(); return; }           // second click = stop
    ctl = new AbortController(); const sig = ctl.signal;
    $("startBtn").classList.add("stop"); $("btnText").textContent = "Stop";
    $("result").hidden = true; $("error").hidden = true; $("saveNote").textContent = "";
    ["mPing", "mJit", "mDown", "mUp"].forEach((m) => setMetric(m, "–"));
    const r = { ping: 0, jitter: 0, down: 0, up: null };
    try {
      activate("boxPing"); setGauge(0, "Testing latency…");
      Object.assign(r, await measurePing(sig));
      setMetric("mPing", fmt(r.ping, 0)); setMetric("mJit", fmt(r.jitter, 0));

      activate("boxDown"); setGauge(0, "Testing download…");
      r.down = await measureDown(sig, (v) => { setGauge(v); setMetric("mDown", fmt(v)); });
      setMetric("mDown", fmt(r.down));

      activate("boxUp"); setGauge(0, "Testing upload…");
      try { r.up = await measureUp(sig, (v) => { setGauge(v); setMetric("mUp", fmt(v)); }); setMetric("mUp", fmt(r.up)); }
      catch (e) { if (e.name === "AbortError") throw e; r.up = null; setMetric("mUp", "n/a"); }

      setGauge(r.down, "Done");
      activate("");
      showResult(r); saveHist(r); await save(r);
    } catch (e) {
      if (e.name === "AbortError") { setGauge(0, "Test stopped"); }
      else { $("error").textContent = "We couldn't reach the test server. Check your internet connection and try again."; $("error").hidden = false; setGauge(0, "Test failed"); }
      activate("");
    } finally {
      ctl = null; $("startBtn").classList.remove("stop"); $("btnText").textContent = "Run Speed Test";
    }
  }

  $("startBtn").addEventListener("click", run);
  $("clearHist").addEventListener("click", () => { try { localStorage.removeItem("np_history"); } catch (e) {} renderHist(); });
  setGauge(0, "Ready");
  renderHist();
})();