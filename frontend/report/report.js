/* NetPulse Maroc: outage report page (Leaflet map + report form) */
(() => {
  "use strict";

  /* ---------- Settings ---------- */
  const CFG = {
    API_URL: "",          // e.g. "https://yourdomain.ma/api". Empty = preview mode (nothing is sent).
    GRID: 0.005,          // positions are snapped to a ~500 m grid before being sent (privacy)
    COOLDOWN_MIN: 30      // one report per operator every 30 minutes per device
  };

  /* Simplified outline of Morocco + Western Sahara as [lon, lat] (Natural Earth, public domain, slightly widened) */
  const MOROCCO = [[-15.99,23.6],[-16.05,23.68],[-15.95,23.89],[-15.63,24.13],[-15.23,24.53],[-15.08,24.61],[-14.97,24.75],[-14.86,25.43],[-14.59,25.95],[-14.47,26.29],[-13.63,26.78],[-13.24,27.69],[-13.0,27.97],[-12.81,28.05],[-12.01,28.2],[-11.58,28.37],[-11.12,28.77],[-10.53,29.12],[-10.25,29.42],[-9.73,30.13],[-9.72,30.41],[-9.91,30.6],[-9.94,30.71],[-9.88,31.44],[-9.73,31.75],[-9.41,32.12],[-9.3,32.61],[-8.55,33.31],[-8.33,33.44],[-7.59,33.71],[-6.95,34.02],[-6.42,34.81],[-5.97,35.84],[-5.64,35.9],[-5.41,36.0],[-5.25,35.97],[-5.21,35.9],[-5.27,35.77],[-5.06,35.52],[-4.8,35.34],[-4.33,35.23],[-3.7,35.35],[-3.57,35.3],[-3.23,35.31],[-2.96,35.48],[-2.8,35.2],[-2.2,35.17],[-2.09,35.03],[-1.74,34.79],[-1.72,34.71],[-1.77,34.62],[-1.66,34.48],[-1.71,34.36],[-1.64,34.18],[-1.64,33.74],[-1.56,33.57],[-1.61,33.33],[-1.4,32.83],[-1.06,32.6],[-1.0,32.48],[-1.18,32.3],[-1.17,32.06],[-1.27,32.02],[-2.45,32.06],[-2.85,32.01],[-2.99,31.77],[-3.43,31.64],[-3.75,31.62],[-3.78,31.57],[-3.72,31.36],[-3.76,31.23],[-3.56,31.08],[-3.56,30.97],[-3.63,30.9],[-3.96,30.85],[-4.3,30.63],[-4.92,30.41],[-5.13,30.12],[-5.42,29.89],[-5.99,29.76],[-6.44,29.75],[-6.46,29.62],[-6.62,29.5],[-7.13,29.55],[-7.45,29.33],[-7.65,29.29],[-8.61,28.67],[-8.61,26.0],[-8.65,25.94],[-11.95,25.93],[-11.96,23.45],[-12.35,23.25],[-12.59,23.21],[-12.98,22.95],[-13.09,22.8],[-13.02,22.5],[-12.95,21.34],[-12.97,21.28],[-16.91,21.26],[-16.98,20.78],[-17.09,20.75],[-17.17,20.86],[-17.0,21.92],[-16.84,22.21],[-16.72,22.33],[-16.56,22.39],[-16.42,22.62],[-16.37,22.87],[-16.26,22.98],[-16.27,23.13],[-15.99,23.6]];

  /* Cities used to describe a position ("Near Agadir") and to jump around the map */
  const CITIES = [["Casablanca",33.5731,-7.5898],["Rabat",34.0209,-6.8416],["Fès",34.0331,-5.0003],["Marrakech",31.6295,-7.9811],["Tanger",35.7595,-5.834],["Agadir",30.4278,-9.5981],["Meknès",33.8935,-5.5473],["Oujda",34.6867,-1.9114],["Kénitra",34.261,-6.5802],["Tétouan",35.5785,-5.3684],["Safi",32.2994,-9.2372],["Mohammedia",33.6866,-7.383],["El Jadida",33.2316,-8.5007],["Béni Mellal",32.3373,-6.3498],["Nador",35.1681,-2.9335],["Taza",34.21,-4.01],["Settat",33.001,-7.6166],["Khouribga",32.8811,-6.9063],["Larache",35.1932,-6.1557],["Ksar el-Kébir",35.0017,-5.9034],["Khémisset",33.824,-6.066],["Guelmim",28.987,-10.0574],["Laâyoune",27.1253,-13.1625],["Dakhla",23.6848,-15.9579],["Essaouira",31.5085,-9.7595],["Ouarzazate",30.9189,-6.8934],["Errachidia",31.9314,-4.4244],["Al Hoceima",35.2517,-3.9372],["Chefchaouen",35.1688,-5.2636],["Tiznit",29.6974,-9.7316],["Taroudant",30.4703,-8.877],["Inezgane",30.3556,-9.537],["Berrechid",33.2655,-7.5875],["Azrou",33.4342,-5.2216],["Ifrane",33.5228,-5.1107],["Midelt",32.6852,-4.745],["Tan-Tan",28.438,-11.1032],["Smara",26.7384,-11.6719],["Boujdour",26.1253,-14.4846],["Sidi Ifni",29.3797,-10.173],["Zagora",30.3324,-5.8384],["Tinghir",31.5147,-5.5328],["Berkane",34.92,-2.32],["Taourirt",34.407,-2.897],["Sidi Kacem",34.2214,-5.7071],["Azilal",31.96,-6.57],["Kelaat Sraghna",32.0526,-7.4093],["Youssoufia",32.2463,-8.529],["Asilah",35.465,-6.034],["M’diq",35.686,-5.325],["Fnideq",35.849,-5.357],["Figuig",32.108,-1.23]];

  const ISSUES = {
    no_internet: "No internet",
    very_slow: "Very slow internet",
    disconnects: "Keeps disconnecting",
    high_ping: "High ping / lag",
    mobile_signal: "Mobile signal problem"
  };
  const OPS = { maroc_telecom: "Maroc Telecom", orange: "Orange", inwi: "inwi" };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Geometry helpers ---------- */
  function inMorocco(lat, lon) {                       // ray-casting point-in-polygon
    let inside = false;
    for (let i = 0, j = MOROCCO.length - 1; i < MOROCCO.length; j = i++) {
      const [xi, yi] = MOROCCO[i], [xj, yj] = MOROCCO[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function km(aLat, aLon, bLat, bLon) {                // haversine distance
    const R = 6371, r = Math.PI / 180;
    const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function nearest(lat, lon) {
    let best = null;
    for (const [name, la, lo] of CITIES) { const d = km(lat, lon, la, lo); if (!best || d < best.d) best = { name, d }; }
    return best;
  }
  const snap = (v) => +(Math.floor(v / CFG.GRID) * CFG.GRID + CFG.GRID / 2).toFixed(4);
  function ago(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  }

  /* ---------- Storage (this browser only) ---------- */
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  function deviceToken() {
    let t = read("np_device", null);
    if (!t) { t = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); write("np_device", t); }
    return t;
  }

  /* ---------- Map ---------- */
  const map = L.map("map", {
    minZoom: 5, maxZoom: 18,
    maxBounds: [[19.5, -18.8], [37.2, 0.8]], maxBoundsViscosity: 0.9
  }).setView([31.8, -7.0], 6);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const pinIcon = L.divIcon({
    className: "pin-icon", iconSize: [36, 36], iconAnchor: [18, 33],
    html: '<svg viewBox="0 0 24 24"><path d="M12 22s7-6.4 7-12.2A7 7 0 0 0 5 9.8C5 15.6 12 22 12 22z" fill="#e30613" stroke="#fff" stroke-width="1.4"/><circle cx="12" cy="9.8" r="2.7" fill="#fff"/></svg>'
  });
  const layer = L.layerGroup().addTo(map);
  let marker = null, accCircle = null, pos = null;

  function showPos(text, snapNote, bad) {
    $("posText").textContent = text;
    $("posText").classList.toggle("bad", !!bad);
    $("posNote").textContent = snapNote || "";
  }

  function setPosition(lat, lon, opts = {}) {
    if (!inMorocco(lat, lon)) {
      showPos("That position is outside Morocco.", "Reports are only accepted inside the country. Move the pin or choose another spot.", true);
      if (marker && pos) marker.setLatLng([pos.lat, pos.lon]);   // put a dragged pin back
      return false;
    }
    pos = { lat, lon, acc: opts.acc || null };
    if (!marker) {
      marker = L.marker([lat, lon], { icon: pinIcon, draggable: true }).addTo(map);
      marker.on("dragend", () => { const p = marker.getLatLng(); setPosition(p.lat, p.lng); });
    } else marker.setLatLng([lat, lon]);
    if (accCircle) { map.removeLayer(accCircle); accCircle = null; }
    if (opts.acc) accCircle = L.circle([lat, lon], { radius: opts.acc, color: "#1f6feb", weight: 1, fillOpacity: 0.12 }).addTo(map);
    const n = nearest(lat, lon);
    const dist = n.d < 1 ? "less than 1 km" : `${Math.round(n.d)} km`;
    let note = "To protect your privacy, the report is shown within about 500 m. Your exact position is never stored.";
    if (opts.acc) note = `GPS accuracy about ±${Math.round(opts.acc)} m. ` + (opts.acc > 1000 ? "That is low: drag the pin to the right spot. " : "") + note;
    showPos(`Near ${n.name} (${dist})`, note, false);
    $("formMsg").textContent = ""; $("formMsg").className = "rp-msg";
    return true;
  }

  map.on("click", (e) => setPosition(e.latlng.lat, e.latlng.lng));

  /* Use my location (asks the browser for permission) */
  $("locBtn").addEventListener("click", () => {
    if (!("geolocation" in navigator)) { showPos("Your browser can't share its location.", "Tap the map to place the pin instead.", true); return; }
    const btn = $("locBtn"); btn.disabled = true; btn.textContent = "Locating…";
    navigator.geolocation.getCurrentPosition(
      (p) => {
        btn.disabled = false; btn.textContent = "Use my location";
        const ok = setPosition(p.coords.latitude, p.coords.longitude, { acc: p.coords.accuracy });
        if (ok) { accCircle ? map.fitBounds(accCircle.getBounds(), { maxZoom: 16 }) : map.setView([pos.lat, pos.lon], 15); }
      },
      (err) => {
        btn.disabled = false; btn.textContent = "Use my location";
        const m = { 1: "Location permission was denied.", 2: "Your position couldn't be determined.", 3: "Finding your position took too long." }[err.code] || "Location unavailable.";
        showPos(m, "Tap the map to place the pin yourself, or pick a city above to jump there.", true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  /* Jump to a city */
  const sel = $("cityJump");
  [...CITIES].sort((a, b) => a[0].localeCompare(b[0])).forEach(([n, la, lo]) => sel.add(new Option(n, `${la},${lo}`)));
  sel.addEventListener("change", () => {
    if (!sel.value) return;
    const [la, lo] = sel.value.split(",").map(Number);
    map.setView([la, lo], 12);
    showPos("Now tap the map exactly where the problem is.", "", false);
  });

  /* ---------- Report markers and list ---------- */
  const colorOf = (i) => (i === "no_internet" ? "#e30613" : "#f5a623");
  function addMarker(r, mine) {
    if (typeof r.lat !== "number" || typeof r.lng !== "number") return;
    L.circleMarker([r.lat, r.lng], {
      radius: 10, color: "#fff", weight: 2, fillColor: colorOf(r.issue_type), fillOpacity: 0.92, dashArray: mine ? "3 3" : null
    }).addTo(layer).bindPopup(
      `<b>${esc(ISSUES[r.issue_type] || "Problem")}</b><br>${esc(OPS[r.operator] || "")}<br><small>${esc(ago(r.created_at))}${mine ? " · your report" : ""}</small>`
    );
  }
  function renderList(items, note) {
    $("listNote").textContent = note || "";
    const ul = $("recentList");
    if (!items.length) { ul.innerHTML = '<li class="rp-empty">No reports to show yet.</li>'; return; }
    ul.innerHTML = items.slice(0, 8).map((r) => {
      const c = r.city || (typeof r.lat === "number" ? nearest(r.lat, r.lng).name : "Morocco");
      return `<li><span class="dot ${r.issue_type === "no_internet" ? "s-r" : "s-o"}"></span><b>${esc(c)}</b>` +
        `<span class="msg">${esc(ISSUES[r.issue_type] || "Problem")} · ${esc(OPS[r.operator] || "")}</span>` +
        `<time><svg><use href="#i-clock"/></svg>${esc(ago(r.created_at))}</time></li>`;
    }).join("");
  }
  async function loadReports() {
    const mine = read("np_reports", []);
    layer.clearLayers();
    if (!CFG.API_URL) {
      mine.forEach((r) => addMarker(r, true));
      renderList(mine, "Preview mode: community reports will appear here once the backend is connected. These are your own reports on this device.");
      return;
    }
    try {
      const res = await fetch(CFG.API_URL + "/reports/recent?limit=200");
      if (!res.ok) throw new Error(res.status);
      const items = await res.json();
      items.forEach((r) => addMarker(r, false));
      renderList([...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), "Latest reports from the community.");
    } catch (e) {
      mine.forEach((r) => addMarker(r, true));
      renderList(mine, "Couldn't load community reports right now.");
    }
  }

  /* ---------- Form ---------- */
  function msg(kind, text, html) {
    const m = $("formMsg"); m.className = "rp-msg " + kind;
    if (html) m.innerHTML = text; else m.textContent = text;
  }

  $("rpForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if ($("website").value) return;                       // honeypot: bots fill this hidden field
    const f = e.target;
    const issue = (f.querySelector('input[name="issue"]:checked') || {}).value;
    const operator = $("operator").value, conn = $("conn").value;
    if (!pos) return msg("err", "Please place the pin on the map first: tap the map or use “Use my location”.");
    if (!issue) return msg("err", "Please choose what kind of problem you have.");
    if (!operator || !conn) return msg("err", "Please choose your operator and connection type.");

    const last = read("np_last", {});
    const wait = CFG.COOLDOWN_MIN * 60000 - (Date.now() - (last[operator] || 0));
    if (wait > 0) return msg("err", `You already reported a problem with ${OPS[operator]} recently. Please wait about ${Math.ceil(wait / 60000)} min before sending another.`);

    const payload = {
      lat: snap(pos.lat), lng: snap(pos.lon),
      operator, connection_type: conn, issue_type: issue,
      started: $("started").value, scope: $("scope").value,
      device_token: deviceToken()
    };
    const btn = $("sendBtn"); btn.disabled = true;
    try {
      if (CFG.API_URL) {
        const res = await fetch(CFG.API_URL + "/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(res.status);
      }
      const mine = read("np_reports", []);
      mine.unshift({ ...payload, created_at: new Date().toISOString() });
      write("np_reports", mine.slice(0, 20));
      last[operator] = Date.now(); write("np_last", last);
      msg("ok", (CFG.API_URL ? "Thank you! Your report was sent." : "Preview mode: your report is shown on this device only.") +
        ' While you’re here, <a href="../speetest/speedtest.html">run a speed test</a> to add measurements too.', true);
      loadReports();
    } catch (err) {
      msg("err", "We couldn't send your report. Please try again in a moment.");
    } finally { btn.disabled = false; }
  });

  loadReports();
})();