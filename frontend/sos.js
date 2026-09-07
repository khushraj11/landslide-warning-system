const SOS_QUEUE_KEY = "sos_offline_queue";
const SOS_DEVICE_KEY = "sos_device_id";
const NER_FALLBACK_COORDS = [25.5788, 91.8933]; // Shillong / Meghalaya Ridge

let sosMarkersLayer = null;
let loraMeshLinesLayer = null;
let forcedNetworkState = null;
let backendReachable = false;
let sosSocket = null;
let currentSosLocation = NER_FALLBACK_COORDS;

const LORA_CHAIN_PREVIEW = [
  { hop: 0, label: "Node A: Stranded Citizen (Origin)", role: "Originator Beacon", rssi: -84 },
  { hop: 1, label: "Node B: Mountain Ridge Repeater (+2.8 km)", role: "Solar Repeater", rssi: -96 },
  { hop: 2, label: "Node C: Valley Relay Node (+6.4 km)", role: "Valley Mesh", rssi: -107 },
  { hop: 3, label: "Node D: NDRF Base Camp Gateway (+11.2 km)", role: "LoRaWAN Gateway", rssi: -114 },
  { hop: 4, label: "SEOC Central Disaster Operations", role: "HQ Server", rssi: 0 },
];

function getDeviceId() {
  let id = localStorage.getItem(SOS_DEVICE_KEY);
  if (!id) {
    id = "lora-node-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    localStorage.setItem(SOS_DEVICE_KEY, id);
  }
  return id;
}

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(SOS_QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}
function setOfflineQueue(items) {
  localStorage.setItem(SOS_QUEUE_KEY, JSON.stringify(items));
}
function queueOffline(item) {
  const queue = getOfflineQueue();
  queue.push(item);
  setOfflineQueue(queue);
}

async function checkNetwork() {
  if (forcedNetworkState === false) {
    backendReachable = false;
    updateNetworkBadge("offline");
    return;
  }
  if (forcedNetworkState === true) {
    backendReachable = true;
    updateNetworkBadge("online");
    return;
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${API}/api/health`, { signal: ctrl.signal });
    clearTimeout(t);
    backendReachable = res.ok;
    updateNetworkBadge(backendReachable ? "online" : "offline");
  } catch {
    backendReachable = false;
    updateNetworkBadge("offline");
  }
}

function updateNetworkBadge(state) {
  const badge = document.getElementById("networkBadge");
  const text = document.getElementById("networkBadgeText");
  if (!badge) return;
  badge.className = `network-badge ${state}`;
  text.textContent = state === "online" ? "ONLINE" : state === "syncing" ? "SYNCING" : "OFFLINE (LoRa ACTIVE)";
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(NER_FALLBACK_COORDS);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      () => resolve(NER_FALLBACK_COORDS),
      { timeout: 3500 }
    );
  });
}

async function openSosModal() {
  document.getElementById("sosStepConfirm").style.display = "block";
  document.getElementById("sosStepResult").style.display = "none";
  document.getElementById("sosOverlay").classList.add("show");
  document.getElementById("sosLocationText").textContent = "Acquiring GPS fix...";
  currentSosLocation = await getLocation();
  document.getElementById("sosLocationText").textContent =
    `${currentSosLocation[0].toFixed(4)}° N, ${currentSosLocation[1].toFixed(4)}° E (Himalayan Sector)`;
}

function closeSosModal() {
  document.getElementById("sosOverlay").classList.remove("show");
}

function genLocalMessageId() {
  return "SOS-LORA-" + Math.random().toString(16).slice(2, 8).toUpperCase();
}

async function sendSos() {
  const btn = document.getElementById("sosSend");
  btn.disabled = true;

  const payload = {
    device_id: getDeviceId(),
    type: document.getElementById("sosType").value,
    latitude: currentSosLocation[0],
    longitude: currentSosLocation[1],
    people_affected: parseInt(document.getElementById("sosPeople").value) || 1,
    severity: document.getElementById("sosSeverity").value,
    message: document.getElementById("sosMessage").value || "",
    max_hops: 8,
  };

  await checkNetwork();

  if (backendReachable) {
    try {
      const res = await fetch(`${API}/api/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("submit failed");
      const record = await res.json();
      showSosResult(record, false);
      loadActiveSos();
      btn.disabled = false;
      return;
    } catch {
      // fallback to offline queue
    }
  }

  const localId = genLocalMessageId();
  const offlineRecord = {
    message_id: localId,
    ...payload,
    client_timestamp: new Date().toISOString(),
    status: "OFFLINE_STORED",
    lora_band: "IN865 (India ISM)",
    lora_frequency_mhz: 865.200,
    lora_sf: 10,
    lora_airtime_ms: 246.2,
    rssi_dbm: -84,
    snr_db: +8.2,
    lora_packet_hex: "4C 53 02 7F A1 09 E2 1C 92 B4 04 01 8E 1F",
    current_hop_label: "Node A: Stranded Citizen / Sensor (Origin)",
  };
  queueOffline(offlineRecord);
  showSosResult(offlineRecord, true);
  renderActiveSosFromLocalAndServer();
  btn.disabled = false;
}

function renderHopTrackHTML(currentHop = 0) {
  return LORA_CHAIN_PREVIEW.map((step) => {
    const isPast = step.hop < currentHop;
    const isActive = step.hop === currentHop;
    const cls = isActive ? "active" : isPast ? "past" : "";
    const statusTag = isActive ? "▶ CURRENT HOP" : isPast ? "✓ FORWARDED" : "QUEUED";
    return `
      <div class="lora-hop-step ${cls}">
        <span><b>${step.label}</b> &middot; <span style="color:var(--text-muted)">${step.role}</span></span>
        <span>${step.rssi !== 0 ? step.rssi + " dBm &middot; " : ""}<b style="color:${isActive ? 'var(--glacier)' : 'var(--text-muted)'}">${statusTag}</b></span>
      </div>`;
  }).join("");
}

function showSosResult(record, isOffline) {
  document.getElementById("sosStepConfirm").style.display = "none";
  document.getElementById("sosStepResult").style.display = "block";
  document.getElementById("sosResultTitle").textContent = "🚨 LORA SOS BROADCAST";
  document.getElementById("sosResultBody").textContent = isOffline
    ? "No cellular tower detected. Emergency packet encoded into 32-byte LoRa IN865 frame and queued for multi-hop mountain relay."
    : "Connected to gateway. Emergency telemetry transmitted across LoRa mesh and received at District Emergency Center.";

  document.getElementById("sosResultId").textContent = record.message_id;
  document.getElementById("sosResultStatus").textContent = record.status;

  const freqEl = document.getElementById("loraTelemFreq");
  const sfEl = document.getElementById("loraTelemSF");
  const rssiEl = document.getElementById("loraTelemRssi");
  const airtimeEl = document.getElementById("loraTelemAirtime");
  const hexEl = document.getElementById("loraHexPayload");
  const trackEl = document.getElementById("loraHopTracker");

  if (freqEl) freqEl.textContent = (record.lora_frequency_mhz || 865.2).toFixed(1) + " MHz";
  if (sfEl) sfEl.textContent = "SF" + (record.lora_sf || 10);
  if (rssiEl) rssiEl.textContent = (record.rssi_dbm || -84) + " dBm";
  if (airtimeEl) airtimeEl.textContent = Math.round(record.lora_airtime_ms || 246) + " ms";
  if (hexEl) hexEl.textContent = record.lora_packet_hex || "4C 53 02 7F A1 09 E2 1C 92 B4 04 01 8E 1F";
  if (trackEl) trackEl.innerHTML = renderHopTrackHTML(record.hop_count || 0);
}

async function syncOfflineQueue() {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;
  await checkNetwork();
  if (!backendReachable) return;

  updateNetworkBadge("syncing");
  try {
    const res = await fetch(`${API}/api/sos/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queue),
    });
    if (res.ok) {
      setOfflineQueue([]);
    }
  } catch {
    // stay in queue
  }
  updateNetworkBadge(backendReachable ? "online" : "offline");
  loadActiveSos();
}

function sosSeverityClass(sev) {
  if (sev === "CRITICAL") return "sos-critical";
  if (sev === "HIGH") return "sos-high";
  return "sos-moderate";
}

async function loadActiveSos() {
  let serverSos = [];
  try {
    const data = await api("/api/sos/active");
    serverSos = data.sos || [];
  } catch {
    // backend offline
  }
  renderActiveSosFromLocalAndServer(serverSos);
}

let cachedServerSos = [];
let currentSosFilter = "ALL"; // "ALL", "RECEIVED", "DELIVERED"

function setSosFilter(filter) {
  currentSosFilter = filter;
  ["btnSosFilterAll", "btnSosFilterReceived", "btnSosFilterDelivered"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.remove("active", "filter-received", "filter-delivered");
  });
  const activeBtn = document.getElementById(
    filter === "RECEIVED" ? "btnSosFilterReceived" : filter === "DELIVERED" ? "btnSosFilterDelivered" : "btnSosFilterAll"
  );
  if (activeBtn) {
    activeBtn.classList.add("active");
    if (filter === "RECEIVED") activeBtn.classList.add("filter-received");
    if (filter === "DELIVERED") activeBtn.classList.add("filter-delivered");
  }
  renderActiveSosFromLocalAndServer(cachedServerSos);
}
window.setSosFilter = setSosFilter;

function renderSosCard(r, localQueue) {
  const isDelivered = r.status === "DELIVERED";
  const rssiVal = r.rssi_dbm || -84;
  const relayBtn =
    !isDelivered && !localQueue.find((q) => q.message_id === r.message_id)
      ? `<button class="chip" style="margin-top:8px; background:rgba(95,179,179,0.18); border-color:var(--glacier); color:var(--glacier); font-weight:600;" onclick="simulateRelay('${r.message_id}')">📡 Simulate LoRa Mountain Relay (IN865)</button>`
      : "";

  return `
    <div class="risk-card ${sosSeverityClass(r.severity)}">
      <div class="risk-card-title">
        ${r.type.replace("_SOS", "")} <span class="sos-status-pill ${r.status}">${r.status}</span>
      </div>
      <div class="lora-rf-badge" style="margin:4px 0 6px;">
        <span class="lora-rf-dot"></span> IN865 &middot; 865.2 MHz &middot; SF10 &middot; RSSI: ${rssiVal} dBm
      </div>
      <div class="risk-meta">
        ${r.people_affected} affected &middot; ${r.latitude.toFixed?.(3) ?? r.latitude}°N, ${r.longitude.toFixed?.(3) ?? r.longitude}°E
        &middot; Hop: ${r.hop_count || 0}/8 &middot; ${r.message_id}
      </div>
      ${r.current_hop_label ? `<div class="risk-meta" style="color:var(--glacier)">📍 ${r.current_hop_label}</div>` : ""}
      ${r.message ? `<div class="risk-meta">"${r.message}"</div>` : ""}
      ${relayBtn}
    </div>`;
}

function renderActiveSosFromLocalAndServer(serverSos) {
  cachedServerSos = serverSos || [];
  const localQueue = getOfflineQueue();
  const serverIds = new Set((serverSos || []).map((r) => r.message_id));
  const merged = [...(serverSos || []), ...localQueue.filter((r) => !serverIds.has(r.message_id))];

  const listEl = document.getElementById("sosActiveList");
  if (!listEl) return;

  const receivedList = merged.filter((r) => r.status !== "DELIVERED");
  const deliveredList = merged.filter((r) => r.status === "DELIVERED");

  // Update counts
  const allCountEl = document.getElementById("countSosAll");
  const recvCountEl = document.getElementById("countSosReceived");
  const delvCountEl = document.getElementById("countSosDelivered");
  if (allCountEl) allCountEl.textContent = merged.length;
  if (recvCountEl) recvCountEl.textContent = receivedList.length;
  if (delvCountEl) delvCountEl.textContent = deliveredList.length;

  if (merged.length === 0) {
    listEl.innerHTML = `<div class="sos-empty-box">No active LoRa SOS alerts in system.</div>`;
    renderSosMarkers(merged);
    return;
  }

  const receivedHtml = receivedList.length
    ? receivedList.map((r) => renderSosCard(r, localQueue)).join("")
    : `<div class="sos-empty-box">No pending inbound gateway alerts.</div>`;

  const deliveredHtml = deliveredList.length
    ? deliveredList.map((r) => renderSosCard(r, localQueue)).join("")
    : `<div class="sos-empty-box">No delivered alerts recorded yet.</div>`;

  if (currentSosFilter === "RECEIVED") {
    listEl.innerHTML = `
      <div class="sos-column">
        <div class="sos-column-head received">
          <span>📥 Inbound &mdash; Received at Gateways (${receivedList.length})</span>
          <span style="font-size:10px; font-weight:normal;">Active Mountain Relays Required</span>
        </div>
        <div class="triage-list">${receivedHtml}</div>
      </div>`;
  } else if (currentSosFilter === "DELIVERED") {
    listEl.innerHTML = `
      <div class="sos-column">
        <div class="sos-column-head delivered">
          <span>✅ Outbound &mdash; Delivered to Authorities (${deliveredList.length})</span>
          <span style="font-size:10px; font-weight:normal;">Logged at SEOC Command HQ</span>
        </div>
        <div class="triage-list">${deliveredHtml}</div>
      </div>`;
  } else {
    // "ALL": Side-by-Side Split View
    listEl.innerHTML = `
      <div class="sos-split-grid">
        <div class="sos-column">
          <div class="sos-column-head received">
            <span>📥 Received at Gateways (${receivedList.length})</span>
            <span style="font-size:10px; font-weight:normal;">Pending Relay / Action</span>
          </div>
          <div class="triage-list">${receivedHtml}</div>
        </div>
        <div class="sos-column">
          <div class="sos-column-head delivered">
            <span>✅ Delivered to SEOC (${deliveredList.length})</span>
            <span style="font-size:10px; font-weight:normal;">Dispatched to NDRF</span>
          </div>
          <div class="triage-list">${deliveredHtml}</div>
        </div>
      </div>`;
  }

  renderSosMarkers(merged);
}


function renderSosMarkers(sosList) {
  if (!sosMarkersLayer || !map) return;
  sosMarkersLayer.clearLayers();
  if (loraMeshLinesLayer) loraMeshLinesLayer.clearLayers();

  sosList.forEach((r) => {
    const lat = Number(r.latitude);
    const lon = Number(r.longitude);
    if (isNaN(lat) || isNaN(lon)) return;

    const icon = L.divIcon({
      className: "",
      html: `<div style="background:#e2543f;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 5px rgba(226,84,63,0.35);font-size:15px;cursor:pointer;">🚨</div>`,
      iconSize: [28, 28],
    });

    const marker = L.marker([lat, lon], { icon })
      .bindPopup(
        `<div style="font-family:sans-serif; min-width:180px;">
          <b>${r.type} (LoRa IN865)</b><br>
          Status: <b>${r.status}</b><br>
          Victims: ${r.people_affected}<br>
          Signal: ${r.rssi_dbm || -84} dBm (SF10)<br>
          Hops: ${r.hop_count || 0}<br>
          <small>${r.message_id}</small>
        </div>`
      )
      .addTo(sosMarkersLayer);

    // If relay active, draw simulated mountain mesh repeater nodes and dotted links
    if (r.hop_count > 0 && loraMeshLinesLayer) {
      const hopCoords = [
        [lat, lon],
        [lat + 0.024, lon + 0.018],
        [lat + 0.048, lon + 0.039],
        [lat + 0.075, lon + 0.062],
      ];
      const activePath = hopCoords.slice(0, Math.min(r.hop_count + 1, hopCoords.length));

      L.polyline(activePath, {
        color: "#5fb3b3",
        weight: 3,
        dashArray: "6, 8",
        opacity: 0.85,
      }).addTo(loraMeshLinesLayer);

      // Plot relay node markers
      for (let i = 1; i < activePath.length; i++) {
        const isGw = i === 3;
        const repIcon = L.divIcon({
          className: "",
          html: `<div style="background:${isGw ? '#2ecc71' : '#d98e3f'};border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 0 6px rgba(0,0,0,0.5);">${isGw ? '📡' : '⚡'}</div>`,
          iconSize: [18, 18],
        });
        L.marker(activePath[i], { icon: repIcon })
          .bindPopup(isGw ? "<b>NDRF Base Gateway (Connected)</b>" : `<b>Mountain LoRa Repeater #${i}</b>`)
          .addTo(loraMeshLinesLayer);
      }
    }
  });
}

window.simulateRelay = async function (messageId) {
  try {
    const res = await fetch(`${API}/api/sos/simulate-relay/${messageId}`, { method: "POST" });
    if (res.ok) {
      const updated = await res.json();
      loadActiveSos();
      const trackEl = document.getElementById("loraHopTracker");
      if (trackEl) trackEl.innerHTML = renderHopTrackHTML(updated.hop_count || 4);
    }
  } catch {
    alert("Backend unreachable -- start uvicorn to test LoRa relay simulation.");
  }
};

function connectSosSocket() {
  try {
    sosSocket = new WebSocket(`ws://localhost:8000/api/sos/ws`);
    sosSocket.onmessage = (evt) => {
      loadActiveSos();
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === "relay_hop" && msg.record) {
          const trackEl = document.getElementById("loraHopTracker");
          if (trackEl) trackEl.innerHTML = renderHopTrackHTML(msg.record.hop_count || 0);
          const rssiEl = document.getElementById("loraTelemRssi");
          if (rssiEl) rssiEl.textContent = (msg.record.rssi_dbm || -84) + " dBm";
          const statusEl = document.getElementById("sosResultStatus");
          if (statusEl) statusEl.textContent = msg.record.status;
        }
      } catch (e) {
        // ignore parse error
      }
    };
    sosSocket.onclose = () => setTimeout(connectSosSocket, 4000);
  } catch {
    setTimeout(connectSosSocket, 4000);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  if (typeof map !== "undefined" && map) {
    sosMarkersLayer = L.layerGroup().addTo(map);
    loraMeshLinesLayer = L.layerGroup().addTo(map);
  }

  document.getElementById("sosButton").addEventListener("click", openSosModal);
  document.getElementById("sosCancel").addEventListener("click", closeSosModal);
  document.getElementById("sosClose").addEventListener("click", closeSosModal);
  document.getElementById("sosSend").addEventListener("click", sendSos);

  document.getElementById("sosForceOffline").addEventListener("click", () => {
    forcedNetworkState = false;
    checkNetwork();
  });
  document.getElementById("sosForceOnline").addEventListener("click", () => {
    forcedNetworkState = true;
    checkNetwork();
    syncOfflineQueue();
  });
  document.getElementById("sosSyncNow").addEventListener("click", syncOfflineQueue);

  checkNetwork();
  loadActiveSos();
  connectSosSocket();

  setInterval(() => {
    checkNetwork();
    syncOfflineQueue();
  }, 5000);
});
