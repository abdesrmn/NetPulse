const API = "http://localhost:8000";
const s = new Speedtest();
let last = null;

s.onupdate = (data) => { last = data; /* update the screen here */ };

s.onend = async (aborted) => {
  if (aborted || !last) return;
  const body = {
    zone_id: Number(document.getElementById("zone").value),
    operator: document.getElementById("operator").value,
    connection_type: document.getElementById("conn").value,
    network_path: document.getElementById("path").value,
    download_mbps: parseFloat(last.dlStatus),
    upload_mbps: parseFloat(last.ulStatus),
    ping_ms: parseFloat(last.pingStatus),
    jitter_ms: parseFloat(last.jitterStatus),
  };
  try {
    const r = await fetch(API + "/measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("Save failed");
  } catch (e) { console.error(e); alert("Result could not be saved."); }
};