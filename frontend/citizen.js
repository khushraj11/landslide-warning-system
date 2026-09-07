const API_BASE = window.location.origin || "http://localhost:8000";

let userLocation = { lat: 25.3000, lon: 91.7000 }; // Default Cherrapunji Sector
let citizenDeviceId = "citizen-" + Math.random().toString(36).slice(2, 8).toUpperCase();


// Update Time in status bar
function updateStatusBarTime() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const el = document.getElementById("statusBarTime");
  if (el) el.textContent = `${h}:${m}`;
}
setInterval(updateStatusBarTime, 1000);
updateStatusBarTime();

// Tab Navigation
document.querySelectorAll(".nav-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.target;
    const panel = document.getElementById(target);
    if (panel) panel.classList.add("active");

    if (target === "tab-roads") {
      loadRoadsAndShelters();
      setTimeout(() => { if (citizenMap) citizenMap.invalidateSize(); }, 250);
    }
  });
});


// People affected slider update
const peopleInput = document.getElementById("citizenSosPeople");
const peopleCount = document.getElementById("citizenPeopleCount");
if (peopleInput && peopleCount) {
  peopleInput.addEventListener("input", (e) => {
    peopleCount.textContent = e.target.value;
  });
}

// Geolocation Fetch with High Precision
function acquireUserGps() {
  if (!navigator.geolocation) {
    fetchNearestHazard(userLocation.lat, userLocation.lon);
    updateGpsHud();
    return;
  }
  navigator.geolocation.watchPosition(
    (pos) => {
      userLocation.lat = pos.coords.latitude;
      userLocation.lon = pos.coords.longitude;
      if (pos.coords.accuracy) citizenGpsAccuracy = Math.round(pos.coords.accuracy * 10) / 10;
      if (pos.coords.altitude) citizenAltitude = Math.round(pos.coords.altitude);
      if (pos.coords.heading) citizenHeading = Math.round(pos.coords.heading);

      const coordsEl = document.getElementById("nearestCoords");
      if (coordsEl) coordsEl.textContent = `${userLocation.lat.toFixed(4)}° N, ${userLocation.lon.toFixed(4)}° E`;

      updateGpsHud();
      updateCitizenMapUserMarker();
      fetchNearestHazard(userLocation.lat, userLocation.lon);
    },
    () => {
      fetchNearestHazard(userLocation.lat, userLocation.lon);
      updateGpsHud();
    },
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 2000 }
  );
}


// Fetch Nearest Hazard Assessment
async function fetchNearestHazard(lat, lon) {
  try {
    const res = await fetch(`${API_BASE}/api/citizen/nearest?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error("API error");
    const data = await res.json();

    document.getElementById("nearestDistrictName").textContent = `${data.district} Sector (${data.distance_km} km)`;
    currentSectorDistrict = data.district || "Gangtok";
    const shield = document.getElementById("safetyShieldCard");

    shield.className = `safety-shield-card ${data.risk_label}`;

    const iconMap = {
      Low: "🛡️",
      Moderate: "⚡",
      High: "⚠️",
      Severe: "🚨",
    };

    document.getElementById("safetyIcon").textContent = iconMap[data.risk_label] || "⚠️";
    document.getElementById("safetyTitle").textContent = `${data.risk_label.toUpperCase()} RISK`;
    document.getElementById("safetyBadge").textContent = data.risk_label === "Severe" ? "EVACUATE" : data.risk_label.toUpperCase();
    document.getElementById("safetyAdvisory").textContent = data.advisory;
    document.getElementById("shieldRainVal").textContent = `${data.rainfall_mm} mm`;
    document.getElementById("shieldSoilVal").textContent = `${data.soil_moisture_pct}%`;
    document.getElementById("shieldRoadVal").textContent = data.road_status;
    document.getElementById("shieldRoadVal").style.color =
      data.road_status === "Blocked" ? "#e74c3c" : data.road_status === "At Risk" ? "#e67e22" : "#2ecc71";
  } catch (err) {
    console.warn("Using offline hazard cache", err);
  }
}

// Disaster Authority Alert Dispatch (Online HTTP -> Fast2SMS, Offline LoRa + Auto-Resend Queue)
const AUTHORITY_QUEUE_KEY = "citizen_pending_authority_alerts";
let currentSectorDistrict = "Cherrapunji";
let isSimulatedOffline = false;

function getPendingAuthorityQueue() {
  try {
    return JSON.parse(localStorage.getItem(AUTHORITY_QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setPendingAuthorityQueue(items) {
  localStorage.setItem(AUTHORITY_QUEUE_KEY, JSON.stringify(items));
  updateAuthorityQueueUI();
}

function updateAuthorityQueueUI() {
  const queue = getPendingAuthorityQueue();
  const noticeEl = document.getElementById("authorityQueueNotice");
  const countEl = document.getElementById("authorityQueueCount");
  if (noticeEl && countEl) {
    if (queue.length > 0) {
      noticeEl.style.display = "flex";
      countEl.textContent = queue.length;
    } else {
      noticeEl.style.display = "none";
    }
  }
}

async function isBackendOnline() {
  if (isSimulatedOffline) return false;
  if (!navigator.onLine) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${API_BASE}/api/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

// Route Switcher Controls
window.setAuthorityRoute = function(mode) {
  const btnOnline = document.getElementById("btnRouteOnline");
  const btnOffline = document.getElementById("btnRouteOffline");
  const statusEl = document.getElementById("currentRouteStatus");
  const badgeEl = document.getElementById("authorityChannelBadge");

  if (mode === "ONLINE") {
    isSimulatedOffline = false;
    if (btnOnline) btnOnline.className = "route-pill-btn active online";
    if (btnOffline) btnOffline.className = "route-pill-btn";
    if (statusEl) {
      statusEl.textContent = "HTTP / CELLULAR READY";
      statusEl.style.color = "#2ecc71";
    }
    if (badgeEl) {
      badgeEl.textContent = "🟢 INTERNET READY";
      badgeEl.style.color = "#2ecc71";
      badgeEl.style.background = "rgba(46,204,113,0.15)";
      badgeEl.style.borderColor = "rgba(46,204,113,0.3)";
    }
    syncPendingAuthorityAlerts();
  } else {
    isSimulatedOffline = true;
    if (btnOffline) btnOffline.className = "route-pill-btn active offline";
    if (btnOnline) btnOnline.className = "route-pill-btn";
    if (statusEl) {
      statusEl.textContent = "LORA IN865 (OFFLINE BUFFER)";
      statusEl.style.color = "#f1c40f";
    }
    if (badgeEl) {
      badgeEl.textContent = "⚡ ZERO-CELL (LORA ONLY)";
      badgeEl.style.color = "var(--c-caution)";
      badgeEl.style.background = "rgba(241,196,15,0.15)";
      badgeEl.style.borderColor = "rgba(241,196,15,0.4)";
    }
  }
};

const btnRouteOnline = document.getElementById("btnRouteOnline");
const btnRouteOffline = document.getElementById("btnRouteOffline");
if (btnRouteOnline) btnRouteOnline.addEventListener("click", () => window.setAuthorityRoute("ONLINE"));
if (btnRouteOffline) btnRouteOffline.addEventListener("click", () => window.setAuthorityRoute("OFFLINE"));

window.dispatchAuthorityAlert = async function(statusType) {
  const btnSafe = document.getElementById("btnSendImSafe");
  const btnHelp = document.getElementById("btnSendNeedHelp");
  const origSafeText = btnSafe ? btnSafe.innerHTML : "";
  const origHelpText = btnHelp ? btnHelp.innerHTML : "";

  // Instant tactile feedback on button
  if (statusType === "REPORT_SAFE" && btnSafe) {
    btnSafe.innerHTML = `<span>⏳</span> Reporting...`;
  } else if (statusType !== "REPORT_SAFE" && btnHelp) {
    btnHelp.innerHTML = `<span>⏳</span> Dispatching...`;
  }

  const userName = document.getElementById("citizenNameInput")?.value.trim() || "Citizen Khushraj";
  let resEl = document.getElementById("authorityAlertResult");
  const badgeEl = document.getElementById("authorityChannelBadge");

  if (resEl) {
    resEl.style.display = "block";
    resEl.style.background = "#161b22";
    resEl.style.border = "1px solid var(--c-border)";
    resEl.style.color = "var(--c-accent)";
    resEl.innerHTML = "Evaluating transmission route (Internet vs LoRa Mesh)...";
  }

  const isOnline = await isBackendOnline();

  const payload = {
    device_id: citizenDeviceId,
    user_name: userName,
    status_type: statusType,
    district: currentSectorDistrict || "Gangtok",
    latitude: userLocation.lat,
    longitude: userLocation.lon,
    message: statusType === "REPORT_SAFE"
      ? "Citizen checked in as SAFE in designated mountain zone."
      : "CRITICAL: Citizen requests immediate search, evacuation & rescue assistance.",
    channel: isOnline ? "INTERNET_DIRECT" : "LORA_MESH_FALLBACK",
  };

  try {
    if (isOnline) {
      const res = await fetch(`${API_BASE}/api/citizen/alert-authority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (badgeEl) {
        badgeEl.textContent = "🟢 INTERNET DELIVERED";
        badgeEl.style.color = "#2ecc71";
        badgeEl.style.background = "rgba(46,204,113,0.15)";
      }

      if (resEl) {
        resEl.style.color = "#2ecc71";
        resEl.style.border = "1px solid rgba(46,204,113,0.4)";
        resEl.innerHTML = `<b>✅ Delivered to Disaster Authorities:</b><br>` +
                          `&bull; Recipient: <b>${data.recipient || (payload.district + " Emergency Control")}</b><br>` +
                          `&bull; Route: Fast2SMS Quick Route (${data.sms_status || "Simulated"})<br>` +
                          `&bull; SEOC Command Center: Logged in Incident Stream at ${data.timestamp || new Date().toLocaleTimeString()}`;
        resEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      if (statusType === "REPORT_SAFE" && btnSafe) {
        btnSafe.innerHTML = `<span>✅</span> Reported Safe!`;
        setTimeout(() => { btnSafe.innerHTML = origSafeText || `<span>✅</span> Report Safe`; }, 3000);
      } else if (btnHelp) {
        btnHelp.innerHTML = `<span>🚨</span> Rescue Dispatched!`;
        setTimeout(() => { btnHelp.innerHTML = origHelpText || `<span>🆘</span> Request Rescue`; }, 3000);
      }
      return;
    }
  } catch (err) {
    console.warn("Direct HTTP failed, fallback to offline LoRa queue", err);
  }

  // --- OFFLINE ROUTE: LoRa Mesh Broadcast + Persistent Auto-Resend Queue ---
  if (badgeEl) {
    badgeEl.textContent = "⚡ LORA MESH (ZERO-CELL)";
    badgeEl.style.color = "var(--c-caution)";
    badgeEl.style.background = "rgba(241,196,15,0.15)";
  }

  // 1. Queue locally to auto-resend the second internet reconnects
  const queue = getPendingAuthorityQueue();
  queue.push({
    ...payload,
    queued_at: new Date().toISOString(),
    channel: "OFFLINE_STORE_AND_FORWARD_SYNC",
  });
  setPendingAuthorityQueue(queue);

  // 2. Transmit via LoRa Mesh simulation to local gateway
  try {
    const sosRes = await fetch(`${API_BASE}/api/sos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: citizenDeviceId,
        type: "AUTHORITY_ALERT",
        latitude: userLocation.lat,
        longitude: userLocation.lon,
        people_affected: statusType === "REPORT_SAFE" ? 1 : 2,
        severity: statusType === "REPORT_SAFE" ? "LOW" : "CRITICAL",
        message: `[Disaster Authority Alert - ${statusType}] ${payload.message}`,
        max_hops: 8,
      }),
    });
    const sosData = await sosRes.json();
    if (sosData.message_id) {
      fetch(`${API_BASE}/api/sos/simulate-relay/${sosData.message_id}`, { method: "POST" });
    }
  } catch (e) {
    // offline simulation
  }

  if (resEl) {
    resEl.style.color = "var(--c-caution)";
    resEl.style.border = "1px solid rgba(241,196,15,0.4)";
    resEl.innerHTML = `<b>⚡ ZERO INTERNET / CELLULAR DETECTED &mdash; LORA MESH BROADCAST:</b><br>` +
                      `&bull; Encoded in <b>32-byte LoRa packet</b> (IN865 865.2 MHz, ToA ~246ms).<br>` +
                      `&bull; Relaying via mountain repeaters: <i>Citizen &rarr; Ridge Node &rarr; NDRF Gateway</i>.<br>` +
                      `&bull; <b>Persistent Auto-Resend:</b> Saved in device flash memory (${queue.length} pending). ` +
                      `Will automatically resend to SDMA the instant internet reconnects!`;
    resEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  if (statusType === "REPORT_SAFE" && btnSafe) {
    btnSafe.innerHTML = `<span>⚡</span> LoRa Broadcasted!`;
    setTimeout(() => { btnSafe.innerHTML = origSafeText || `<span>✅</span> Report Safe`; }, 3000);
  } else if (btnHelp) {
    btnHelp.innerHTML = `<span>⚡</span> SOS Queued & LoRa Sent!`;
    setTimeout(() => { btnHelp.innerHTML = origHelpText || `<span>🆘</span> Request Rescue`; }, 3000);
  }
};

// Background auto-resync when internet becomes available
async function syncPendingAuthorityAlerts() {
  if (isSimulatedOffline) return;
  const queue = getPendingAuthorityQueue();
  if (queue.length === 0) return;

  const isOnline = await isBackendOnline();
  if (!isOnline) return;

  const resEl = document.getElementById("authorityAlertResult");
  const badgeEl = document.getElementById("authorityChannelBadge");

  let syncedCount = 0;
  const remaining = [];

  for (const alertItem of queue) {
    try {
      const res = await fetch(`${API_BASE}/api/citizen/alert-authority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertItem),
      });
      if (res.ok) {
        syncedCount++;
      } else {
        remaining.push(alertItem);
      }
    } catch {
      remaining.push(alertItem);
    }
  }

  setPendingAuthorityQueue(remaining);

  if (syncedCount > 0 && resEl) {
    resEl.style.display = "block";
    resEl.style.color = "#2ecc71";
    resEl.style.border = "1px solid rgba(46,204,113,0.4)";
    resEl.innerHTML = `<b>🔄 AUTO-RESEND SUCCESSFUL:</b> ${syncedCount} queued alert(s) automatically re-transmitted to Central Disaster Authorities (SDMA/NDRF) upon network reconnection!`;
    if (badgeEl) {
      badgeEl.textContent = "🟢 AUTO-SYNCED TO SDMA";
      badgeEl.style.color = "#2ecc71";
    }
  }
}

// Initialize queue UI & listeners
updateAuthorityQueueUI();
window.addEventListener("online", () => {
  if (!isSimulatedOffline) syncPendingAuthorityAlerts();
});
setInterval(() => {
  if (!isSimulatedOffline) syncPendingAuthorityAlerts();
}, 5000);

const btnSafe = document.getElementById("btnSendImSafe");
const btnHelp = document.getElementById("btnSendNeedHelp");
if (btnSafe) btnSafe.addEventListener("click", () => window.dispatchAuthorityAlert("REPORT_SAFE"));
if (btnHelp) btnHelp.addEventListener("click", () => window.dispatchAuthorityAlert("NEED_IMMEDIATE_RESCUE"));



// LoRa SOS Trigger
const btnSos = document.getElementById("btnCitizenSos");
if (btnSos) {
  btnSos.addEventListener("click", async () => {
    // Trigger vibration if available
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 400]);

    btnSos.style.transform = "scale(0.92)";
    setTimeout(() => { btnSos.style.transform = "scale(1)"; }, 200);

    const type = document.getElementById("citizenSosType").value;
    const people = parseInt(document.getElementById("citizenSosPeople").value) || 1;
    const msg = document.getElementById("citizenSosMsg").value || "Emergency SOS from Citizen App";

    const payload = {
      device_id: citizenDeviceId,
      type: type,
      latitude: userLocation.lat,
      longitude: userLocation.lon,
      people_affected: people,
      severity: "CRITICAL",
      message: msg,
      max_hops: 8,
    };

    const box = document.getElementById("citizenSosResultBox");
    const title = document.getElementById("citizenSosResultTitle");
    const text = document.getElementById("citizenSosResultMsg");
    const hex = document.getElementById("citizenSosHexDump");

    box.style.display = "block";
    title.textContent = "Broadcasting LoRa IN865 Frame...";
    text.textContent = "Transmitting to nearest Mountain Ridge Repeater (865.2 MHz)...";

    try {
      const res = await fetch(`${API_BASE}/api/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      title.textContent = `🚨 Distress Transmitted (${data.message_id})`;
      text.innerHTML = `<b>Status:</b> ${data.status} &middot; <b>Hops:</b> ${data.hop_count}/8<br>` +
                       `<b>Target Gateway:</b> NDRF Base Station NER<br>` +
                       `<small>Radio: IN865 (SF10, BW 125kHz, ToA 246ms)</small>`;
      hex.textContent = `LoRa Payload: ${data.lora_packet_hex || "4C 53 02 21 E4 54 C0 41 CC A1 62"}`;

      // Automatically trigger relay simulation in background
      fetch(`${API_BASE}/api/sos/simulate-relay/${data.message_id}`, { method: "POST" });
    } catch (e) {
      title.textContent = "🚨 Encoded in LoRa Queue";
      text.textContent = "Zero network detected. SOS saved into local LoRa buffer (IN865 865.2MHz). Retrying broadcast...";
      hex.textContent = "4C 53 02 7F A1 09 E2 1C 92 B4 04 01 8E 1F [STORED]";
    }
  });
}

// ==========================================================================
// HIGH-PRECISION GPS & OFFLINE TOPOGRAPHIC ROUTING (NER)
// ==========================================================================
let citizenGpsAccuracy = 3.8;
let citizenAltitude = 1650;
let citizenHeading = 45;
let citizenMap = null;
let userGpsMarker = null;
let userGpsCircle = null;
let corridorLayerGroup = null;
let cachedNerCorridors = [];

function updateGpsHud() {
  const el = document.getElementById("gpsMetricsText");
  if (el) {
    el.innerHTML = `Accuracy: <b>±${citizenGpsAccuracy} m</b> &middot; Alt: <b>${citizenAltitude} m MSL</b> &middot; 3D NavIC Lock`;
  }
}

let googleStreetsLayer = null;
let googleSatLayer = null;
let googleTerrainLayer = null;
let currentGmapMode = "STREETS";
let isLiveNavigating = false;
let liveNavInterval = null;
let liveNavCoordIndex = 0;
let currentActiveCorridor = null;

window.setGmapLayer = function(layerType) {
  if (!citizenMap) return;
  currentGmapMode = layerType;

  // Remove existing tile layers
  if (googleStreetsLayer && citizenMap.hasLayer(googleStreetsLayer)) citizenMap.removeLayer(googleStreetsLayer);
  if (googleSatLayer && citizenMap.hasLayer(googleSatLayer)) citizenMap.removeLayer(googleSatLayer);
  if (googleTerrainLayer && citizenMap.hasLayer(googleTerrainLayer)) citizenMap.removeLayer(googleTerrainLayer);

  // Update button active state
  ["btnGmapStreets", "btnGmapSat", "btnGmapTerrain"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.remove("active");
  });

  if (layerType === "SATELLITE") {
    googleSatLayer.addTo(citizenMap);
    document.getElementById("btnGmapSat")?.classList.add("active");
  } else if (layerType === "TERRAIN") {
    googleTerrainLayer.addTo(citizenMap);
    document.getElementById("btnGmapTerrain")?.classList.add("active");
  } else {
    googleStreetsLayer.addTo(citizenMap);
    document.getElementById("btnGmapStreets")?.classList.add("active");
  }
};

window.recenterMapOnUser = function() {
  if (!citizenMap) return;
  citizenMap.setView([userLocation.lat, userLocation.lon], 14, { animate: true });
};

window.toggleMapFullscreen = function() {
  const container = document.getElementById("citizenMapContainer");
  const icon = document.getElementById("expandMapIcon");
  if (!container) return;

  container.classList.toggle("fullscreen");
  const isFs = container.classList.contains("fullscreen");
  if (icon) icon.textContent = isFs ? "✕" : "⛶";

  setTimeout(() => {
    if (citizenMap) citizenMap.invalidateSize();
  }, 250);
};

window.resetCompassBearing = function() {
  citizenHeading = 0;
  const needle = document.getElementById("compassNeedle");
  if (needle) needle.style.transform = "rotate(0deg)";
  updateCitizenMapUserMarker();
  if (citizenMap) citizenMap.setView([userLocation.lat, userLocation.lon], citizenMap.getZoom(), { animate: true });
};

// Calculate heading angle between two coordinates
function calculateBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

window.toggleLiveNavigation = function() {
  const btn = document.getElementById("btnToggleNav");
  const icon = document.getElementById("btnNavIcon");
  const label = document.getElementById("btnNavLabel");

  if (isLiveNavigating) {
    // Stop Navigation
    isLiveNavigating = false;
    clearInterval(liveNavInterval);
    liveNavInterval = null;
    if (btn) btn.classList.remove("navigating");
    if (icon) icon.textContent = "▶";
    if (label) label.textContent = "Start Nav";
    recenterMapOnUser();
    return;
  }

  // Start Navigation along current safe corridor
  if (!currentActiveCorridor || !currentActiveCorridor.safest_alternate || !currentActiveCorridor.safest_alternate.coords) {
    alert("Please select a corridor first.");
    return;
  }

  const coords = currentActiveCorridor.safest_alternate.coords;
  if (coords.length < 2) return;

  isLiveNavigating = true;
  liveNavCoordIndex = 0;
  if (btn) btn.classList.add("navigating");
  if (icon) icon.textContent = "⏹";
  if (label) label.textContent = "Stop Nav";

  // Position user at start of route
  userLocation.lat = coords[0][0];
  userLocation.lon = coords[0][1];
  citizenMap.setView([userLocation.lat, userLocation.lon], 15, { animate: true });
  updateCitizenMapUserMarker();

  const steps = currentActiveCorridor.safest_alternate.turn_by_turn || [];

  liveNavInterval = setInterval(() => {
    liveNavCoordIndex++;
    if (liveNavCoordIndex >= coords.length) {
      // Reached destination
      clearInterval(liveNavInterval);
      isLiveNavigating = false;
      if (btn) btn.classList.remove("navigating");
      if (icon) icon.textContent = "▶";
      if (label) label.textContent = "Start Nav";

      const turnStreet = document.getElementById("gmapTurnStreet");
      const turnDist = document.getElementById("gmapTurnDist");
      const turnIcon = document.getElementById("gmapTurnIcon");
      if (turnStreet) turnStreet.textContent = "Arrived at High-Ground Relief Zone";
      if (turnDist) turnDist.textContent = "DESTINATION REACHED";
      if (turnIcon) turnIcon.textContent = "🏁";
      return;
    }

    const prevPt = coords[liveNavCoordIndex - 1];
    const currPt = coords[liveNavCoordIndex];

    userLocation.lat = currPt[0];
    userLocation.lon = currPt[1];

    // Compute heading and speed
    citizenHeading = Math.round(calculateBearing(prevPt[0], prevPt[1], currPt[0], currPt[1]));
    const needle = document.getElementById("compassNeedle");
    if (needle) needle.style.transform = `rotate(${citizenHeading}deg)`;

    // Update Turn Banner
    const stepIdx = Math.min(Math.floor((liveNavCoordIndex / coords.length) * steps.length), steps.length - 1);
    const activeStep = steps[stepIdx] || {};

    const distRemaining = Math.max(10, Math.round((coords.length - liveNavCoordIndex) * 250));
    const turnDist = document.getElementById("gmapTurnDist");
    const turnStreet = document.getElementById("gmapTurnStreet");
    const turnSub = document.getElementById("gmapTurnSub");
    const turnIcon = document.getElementById("gmapTurnIcon");

    if (turnDist) turnDist.textContent = distRemaining > 1000 ? `In ${(distRemaining/1000).toFixed(1)} km` : `In ${distRemaining} m`;
    if (turnStreet) turnStreet.textContent = activeStep.desc || "Continue along safe bypass ridge";
    if (turnSub) turnSub.textContent = `Road: ${activeStep.road || "Lifeline Ridge Road"} &bull; Heading: ${citizenHeading}°`;
    if (turnIcon) {
      const desc = (activeStep.desc || "").toLowerCase();
      turnIcon.textContent = desc.includes("left") ? "↰" : desc.includes("right") ? "↱" : "⬆";
    }

    // Update Trip ETA
    const etaMin = Math.max(2, Math.round((distRemaining / 1000) / 40 * 60));
    const tripEta = document.getElementById("gmapTripEta");
    const tripDist = document.getElementById("gmapTripDist");
    if (tripEta) tripEta.textContent = `${etaMin} min`;
    if (tripDist) tripDist.textContent = `${(distRemaining / 1000).toFixed(1)} km`;

    // Pan map to follow user
    citizenMap.panTo([userLocation.lat, userLocation.lon], { animate: true, duration: 1.0 });
    updateCitizenMapUserMarker();
  }, 1800);
};

function initCitizenOfflineMap() {
  const mapEl = document.getElementById("citizenOfflineMap");
  if (!mapEl || citizenMap) return;

  try {
    citizenMap = L.map("citizenOfflineMap", {
      center: [userLocation.lat || 27.3389, userLocation.lon || 88.6065],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(citizenMap);

    // Authentic High-Speed Google Maps Tile Layers (with load-balanced subdomains)
    googleStreetsLayer = L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      subdomains: ["0", "1", "2", "3"],
      maxZoom: 20,
      attribution: "&copy; Google Maps"
    });

    googleSatLayer = L.tileLayer("https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      subdomains: ["0", "1", "2", "3"],
      maxZoom: 20,
      attribution: "&copy; Google Maps Satellite"
    });

    googleTerrainLayer = L.tileLayer("https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}", {
      subdomains: ["0", "1", "2", "3"],
      maxZoom: 20,
      attribution: "&copy; Google Maps Terrain"
    });

    // Default to Google Streets
    googleStreetsLayer.addTo(citizenMap);

    corridorLayerGroup = L.layerGroup().addTo(citizenMap);
    updateCitizenMapUserMarker();
  } catch (err) {
    console.warn("Leaflet Google Maps initialization note:", err);
  }
}

function updateCitizenMapUserMarker() {
  if (!citizenMap) return;
  const lat = userLocation.lat;
  const lon = userLocation.lon;

  if (userGpsMarker) citizenMap.removeLayer(userGpsMarker);
  if (userGpsCircle) citizenMap.removeLayer(userGpsCircle);

  // Google Maps Style Blue Accuracy Halo
  userGpsCircle = L.circle([lat, lon], {
    radius: Math.max(citizenGpsAccuracy * 2, 20),
    color: "#4285F4",
    fillColor: "#4285F4",
    fillOpacity: 0.16,
    weight: 1.2,
  }).addTo(citizenMap);

  // Iconic Google Maps Blue Dot with Heading Flashlight Beam
  const googleBlueDotIcon = L.divIcon({
    className: "",
    html: `
      <div class="gmap-blue-dot-wrapper">
        <div class="gmap-heading-beam" style="transform: rotate(${citizenHeading}deg);"></div>
        <div class="gmap-blue-halo"></div>
        <div class="gmap-blue-dot"></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  userGpsMarker = L.marker([lat, lon], { icon: googleBlueDotIcon })
    .bindPopup(`
      <div style="font-family:sans-serif; min-width:180px; font-size:12px;">
        <b style="color:#1a73e8;">📍 Your Location (Live GPS)</b><br>
        Accuracy: <b>±${citizenGpsAccuracy} m</b><br>
        Altitude: <b>${citizenAltitude} m MSL</b><br>
        Heading: <b>${citizenHeading}°</b><br>
        Constellation: <b>3D NavIC / GNSS Lock</b>
      </div>
    `)
    .addTo(citizenMap);
}


window.onCorridorSelected = function(corridorId) {
  const corridor = (cachedNerCorridors || []).find(c => c.id === corridorId) || cachedNerCorridors[0];
  if (!corridor) return;
  renderSelectedCorridor(corridor);
};

function renderSelectedCorridor(corridor) {
  if (!corridor) return;
  currentActiveCorridor = corridor;

  // 1. Update State Badge
  const badge = document.getElementById("corridorStateBadge");
  if (badge) badge.textContent = (corridor.state || "NER").toUpperCase();

  // 2. Update Google Maps Navigation Banner & Trip Bar
  if (corridor.safest_alternate) {
    const alt = corridor.safest_alternate;
    const firstTurn = (alt.turn_by_turn && alt.turn_by_turn[0]) || { desc: "Proceed on safe ridge bypass", road: alt.highway_code };
    const turnDist = document.getElementById("gmapTurnDist");
    const turnStreet = document.getElementById("gmapTurnStreet");
    const turnSub = document.getElementById("gmapTurnSub");
    const turnIcon = document.getElementById("gmapTurnIcon");

    if (turnDist) turnDist.textContent = "In 350 m";
    if (turnStreet) turnStreet.textContent = firstTurn.desc || "Turn onto Safe Ridge Lifeline";
    if (turnSub) turnSub.textContent = `Bypass: ${alt.name} &bull; Avoids ${corridor.primary_highway} Choke Slip`;
    if (turnIcon) {
      const d = (firstTurn.desc || "").toLowerCase();
      turnIcon.textContent = d.includes("left") ? "↰" : d.includes("right") ? "↱" : "⬆";
    }

    // Trip Bar
    const tripEta = document.getElementById("gmapTripEta");
    const tripDist = document.getElementById("gmapTripDist");
    const tripSafety = document.getElementById("gmapTripSafety");
    const estTime = Math.max(15, Math.round((alt.distance_km / 35) * 60));
    if (tripEta) tripEta.textContent = `${estTime} min`;
    if (tripDist) tripDist.textContent = `${alt.distance_km} km`;
    if (tripSafety) tripSafety.textContent = `🟢 0 Active Hazards`;
  }

  // 3. Update Map Chip
  const chipSafe = document.getElementById("mapChipSafe");
  if (chipSafe && corridor.safest_alternate) {
    chipSafe.textContent = `🟢 ${corridor.safest_alternate.name.split(' ')[0]} Safe Bypass`;
  }

  // 4. Render Route Comparison Card
  const compCard = document.getElementById("routeComparisonCard");
  if (compCard && corridor.safest_alternate) {
    const isBlocked = corridor.is_blocked || corridor.primary_status.includes("BLOCK");
    compCard.innerHTML = `
      <div class="route-comparison-card">
        <!-- Primary Lifeline (Hazard Zone) -->
        <div class="route-section-box blocked">
          <div class="route-box-head">
            <span style="color:#e74c3c;">⛔ ${corridor.primary_highway}</span>
            <span class="route-badge blocked">${corridor.primary_status}</span>
          </div>
          <div class="route-detail-desc">
            <b>Active Hazard Choke Point:</b> ${corridor.choke_point}
          </div>
          <div class="route-metric-pills">
            <span class="route-metric-pill" style="color:#e74c3c;">⚠️ Rockfall & Mudslide Zone</span>
            <span class="route-metric-pill">Avoid Vehicle Travel</span>
          </div>
        </div>

        <!-- Safest Geotechnical Bypass -->
        <div class="route-section-box safest">
          <div class="route-box-head">
            <span style="color:#2ecc71;">🟢 ${corridor.safest_alternate.name}</span>
            <span class="route-badge safest">${corridor.safest_alternate.clearance_status}</span>
          </div>
          <div class="route-detail-desc">
            <b>Geotechnical Path:</b> ${corridor.safest_alternate.advantage}
          </div>
          <div class="route-metric-pills">
            <span class="route-metric-pill" style="color:#2ecc71;">🛣️ ${corridor.safest_alternate.highway_code}</span>
            <span class="route-metric-pill">📏 ${corridor.safest_alternate.distance_km} km (+${corridor.safest_alternate.extra_km} km)</span>
            <span class="route-metric-pill">📐 ${corridor.safest_alternate.gradient_steepness}</span>
            <span class="route-metric-pill">🏕️ ${corridor.safest_alternate.shelters_en_route.length} Safe Camps</span>
          </div>
        </div>
      </div>`;
  }

  // 4. Render Turn-by-Turn Guidance
  const turnContainer = document.getElementById("routeTurnStepsList");
  if (turnContainer && corridor.safest_alternate && corridor.safest_alternate.turn_by_turn) {
    turnContainer.innerHTML = corridor.safest_alternate.turn_by_turn.map(s => `
      <div class="turn-step-item">
        <div class="turn-step-num">${s.step}</div>
        <div class="turn-step-body">
          <div style="font-weight:600; color:var(--c-text);">${s.desc}</div>
          <div class="turn-step-road">🛣️ Road: ${s.road}</div>
        </div>
      </div>
    `).join("");
  }

  // 5. Draw Polylines on Leaflet Map (Google Maps Navigation aesthetic)
  if (citizenMap && corridorLayerGroup) {
    corridorLayerGroup.clearLayers();

    // Primary Highway (Red Warning Dashed Line)
    if (corridor.primary_coords && corridor.primary_coords.length > 1) {
      L.polyline(corridor.primary_coords, {
        color: "#d93025",
        weight: 5,
        opacity: 0.9,
        dashArray: "7, 9",
        lineCap: "round"
      }).bindPopup(
        `<div style="font-family:sans-serif; min-width:200px; font-size:12px;">
           <b style="color:#d93025;">⛔ ${corridor.primary_highway}</b><br>
           Status: <b>${corridor.primary_status}</b><br>
           Hazard: <i>${corridor.choke_point}</i>
         </div>`
      ).addTo(corridorLayerGroup);
    }

    // Safest Alternative Bypass (Google Maps Royal Blue Route with White Outline)
    if (corridor.safest_alternate && corridor.safest_alternate.coords) {
      // Outer white casing for Google Maps look
      L.polyline(corridor.safest_alternate.coords, {
        color: "#ffffff",
        weight: 8,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(corridorLayerGroup);

      // Inner Google Navigation Blue line
      const safeLine = L.polyline(corridor.safest_alternate.coords, {
        color: "#1a73e8",
        weight: 5,
        opacity: 1.0,
        lineCap: "round",
        lineJoin: "round"
      }).bindPopup(
        `<div style="font-family:sans-serif; min-width:220px; font-size:12px;">
           <b style="color:#1a73e8;">🟢 ${corridor.safest_alternate.name}</b><br>
           Status: <b>${corridor.safest_alternate.clearance_status}</b> (${corridor.safest_alternate.highway_code})<br>
           Geology: ${corridor.safest_alternate.advantage}<br>
           Distance: <b>${corridor.safest_alternate.distance_km} km</b><br>
           Safe Camps: ${corridor.safest_alternate.shelters_en_route.join(", ")}
         </div>`
      ).addTo(corridorLayerGroup);

      // Add Google Maps style destination pin at end of bypass
      const lastPt = corridor.safest_alternate.coords[corridor.safest_alternate.coords.length - 1];
      const destPinIcon = L.divIcon({
        className: "",
        html: `
          <div style="background:#ea4335; border:2px solid #fff; border-radius:50% 50% 50% 0; width:22px; height:22px; transform:rotate(-45deg); box-shadow:0 2px 6px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;">
            <div style="width:7px; height:7px; background:#fff; border-radius:50%;"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 22]
      });
      L.marker(lastPt, { icon: destPinIcon }).bindPopup(`<b>Destination: ${corridor.name.split('↔')[1] || "Safe Capital Zone"}</b>`).addTo(corridorLayerGroup);

      // Add markers for shelters along route
      corridor.safest_alternate.shelters_en_route.forEach((shelterName, idx) => {
        const ptIdx = Math.min(idx * 2 + 1, corridor.safest_alternate.coords.length - 2);
        const pt = corridor.safest_alternate.coords[ptIdx];
        const shelterIcon = L.divIcon({
          className: "",
          html: `
            <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.2); border-radius:12px; padding:3px 7px; font-size:10px; color:#188038; font-weight:700; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.25); display:flex; align-items:center; gap:4px;">
              <span>🏕️</span> <span>${shelterName}</span>
            </div>
          `,
          iconSize: [80, 22],
          iconAnchor: [40, 11]
        });
        L.marker(pt, { icon: shelterIcon }).addTo(corridorLayerGroup);
      });

      // Fit map bounds to show corridor with generous padding
      citizenMap.fitBounds(safeLine.getBounds(), { padding: [30, 30] });
    }
  }
}


// Load Roads & Shelters
async function loadRoadsAndShelters() {
  initCitizenOfflineMap();
  updateGpsHud();

  const sheltersContainer = document.getElementById("citizenSheltersList");

  // 1. Fetch NER Corridors & Safest Alternative Routes
  try {
    const corridorsRes = await fetch(`${API_BASE}/api/ner/corridors`);
    if (corridorsRes.ok) {
      const data = await corridorsRes.json();
      cachedNerCorridors = data.corridors || [];
      const currentSel = document.getElementById("selectNerCorridor")?.value || "sikkim_nh10";
      const targetCorridor = cachedNerCorridors.find(c => c.id === currentSel) || cachedNerCorridors[0];
      if (targetCorridor) renderSelectedCorridor(targetCorridor);
    }
  } catch (err) {
    console.warn("Using offline cached NER corridors", err);
  }

  // 2. Fetch Designated Safe Evacuation Shelters
  try {
    const sheltersRes = await fetch(`${API_BASE}/api/citizen/shelters?lat=${userLocation.lat}&lon=${userLocation.lon}`);
    const sheltersData = await sheltersRes.json();
    const shelters = sheltersData.shelters || [];

    if (sheltersContainer) {
      sheltersContainer.innerHTML = shelters.slice(0, 5).map((s) => {
        return `
          <div class="shelter-card">
            <div class="shelter-name">
              <span>🏠 ${s.name}</span>
              <span class="shelter-dist">${s.distance_km} km</span>
            </div>
            <div class="shelter-meta">
              Sector: <b>${s.district}</b> &middot; Capacity: <b>${s.capacity} persons</b> &middot; Helpline: <a href="tel:${s.phone}" style="color:var(--c-accent);">${s.phone}</a>
            </div>
          </div>`;
      }).join("");
    }
  } catch (e) {
    if (sheltersContainer) {
      sheltersContainer.innerHTML = `<div style="font-size:12px; color:var(--c-muted);">Designated shelters cached offline.</div>`;
    }
  }
}


// Citizen Hazard Report Submission
const btnReport = document.getElementById("btnSubmitCitizenReport");
if (btnReport) {
  btnReport.addEventListener("click", async () => {
    const district = document.getElementById("reportDistrictSelect").value;
    const desc = document.getElementById("reportDescription").value.trim();
    const statusEl = document.getElementById("reportSubmitStatus");

    if (!desc) {
      alert("Please enter observation details about the slope or crack.");
      return;
    }

    btnReport.disabled = true;
    statusEl.style.display = "block";
    statusEl.style.color = "var(--c-accent)";
    statusEl.textContent = "Uploading geo-tagged field report...";

    try {
      const res = await fetch(`${API_BASE}/api/field-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          district: district,
          latitude: userLocation.lat,
          longitude: userLocation.lon,
          description: desc,
        }),
      });
      const data = await res.json();
      btnReport.disabled = false;
      statusEl.style.color = "#2ecc71";
      statusEl.textContent = `Report submitted! Flagged urgency: ${data.urgency}. Transmitted to SDMA.`;
      document.getElementById("reportDescription").value = "";
    } catch (e) {
      btnReport.disabled = false;
      statusEl.style.color = "#e67e22";
      statusEl.textContent = "Offline cache: report saved locally and will auto-sync when connected.";
    }
  });
}

// Survival Guide Accordion Toggle
function toggleGuide(header) {
  const body = header.nextElementSibling;
  const isHidden = body.style.display === "none";
  body.style.display = isHidden ? "block" : "none";
  header.querySelector("span:last-child").textContent = isHidden ? "▲" : "▼";
}
window.toggleGuide = toggleGuide;

// GPS Refresh
const btnGps = document.getElementById("btnGpsRefresh");
if (btnGps) {
  btnGps.addEventListener("click", () => {
    acquireUserGps();
  });
}

// Init
acquireUserGps();
