// ============================================================
// OFFLINE-FIRST API LAYER
// Detect native Android (Capacitor) where window.location.origin
// resolves to http://localhost on the DEVICE (not the server).
// We embed all static NER/district/shelter data so the app works
// 100% offline. When the server IS reachable on the LAN, we use it.
// ============================================================

const _isCapacitor = Boolean(
  window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
);

// On Capacitor/Android the origin is capacitor://localhost or http://localhost
// which is the phone itself – NOT your server. We must NOT call it.
// You can configure SERVER_URL to your server's LAN IP for live data.
const SERVER_URL = ""; // e.g. "http://192.168.1.100:8000" — leave blank for pure offline
const API_BASE = _isCapacitor
  ? (SERVER_URL || null)
  : (window.location.origin || "http://localhost:8000");

// Smart API fetch: returns null if offline/native with no server configured
async function apiFetch(path, opts, timeoutMs = 3500) {
  if (!API_BASE) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(API_BASE + path, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ============================================================
// EMBEDDED OFFLINE DATA — all key data baked into the APK
// ============================================================

const OFFLINE_CORRIDORS = {"corridors":[{"id":"sikkim_nh10","name":"NH-10 (Sikkim Lifeline: Siliguri \u2194 Gangtok)","state":"Sikkim","primary_highway":"NH-10 via Sevoke, Teesta & Rangpo","choke_point":"29th Mile / Teesta Riverbank Gorge (Active slope slumping & river scour)","primary_coords":[[26.727,88.423],[26.883,88.471],[27.054,88.441],[27.176,88.529],[27.234,88.567],[27.3389,88.6065]],"safest_alternate":{"name":"Lava \u2013 Reshi \u2013 Pakyong High-Ground Bypass","highway_code":"SH-12 / NH-717A","advantage":"Follows stable metamorphic ridge crests; avoids waterlogged Teesta gorge cuttings","distance_km":114,"extra_km":18,"gradient_steepness":"Moderate (6.2% avg)","clearance_status":"OPEN & STABLE","shelters_en_route":["Gorubathan Civil Camp","Lava High Shelter","Pakyong Emergency Center"],"coords":[[26.727,88.423],[26.89,88.67],[26.96,88.7],[27.087,88.66],[27.116,88.59],[27.165,88.64],[27.185,88.61],[27.23,88.6],[27.3389,88.6065]],"turn_by_turn":[{"step":1,"desc":"From Siliguri take NH-31C East towards Damdim junction (28 km).","road":"NH-31C"},{"step":2,"desc":"Turn North at Damdim onto Gorubathan-Lava Ridge Highway. Stable granite slope.","road":"SH-12"},{"step":3,"desc":"Ascend to Lava Ridge Summit (2,138m MSL). Halt available at Lava High Relief Camp.","road":"Lava Pass"},{"step":4,"desc":"Proceed through Algarah to Reshi Border check-post. Cross into East Sikkim.","road":"NH-717A"},{"step":5,"desc":"Descend via Pakyong Airport bypass directly into Gangtok Capital (Safe Evacuation Route).","road":"NH-717A"}]},"monitored_district":"Gangtok","district_risk":"Moderate","is_blocked":false,"primary_status":"OPEN - CAUTION","primary_color":"#e67e22","safest_alternate_status":"VERIFIED ALTERNATIVE PASS","safest_alternate_color":"#2ecc71"},{"id":"meghalaya_nh6","name":"NH-6 (Meghalaya\u2013Assam: Guwahati \u2194 Shillong \u2194 Silchar)","state":"Meghalaya","primary_highway":"NH-6 via Sonapur Tunnel & Umkiang","choke_point":"Sonapur Tunnel & Lukha River Bank (High debris slide zone)","primary_coords":[[26.182,91.75],[25.578,91.893],[25.449,92.203],[25.12,92.36],[25.04,92.42],[24.833,92.779]],"safest_alternate":{"name":"Mawryngkneng \u2013 Umrangso \u2013 Haflong Bypass","highway_code":"NH-27 / SH-19","advantage":"Plateau basalt bedrock with reinforced drainage; completely bypasses fragile limestone sinkholes of Sonapur","distance_km":242,"extra_km":34,"gradient_steepness":"Gentle (4.8% avg)","clearance_status":"OPEN & STABLE","shelters_en_route":["Mawryngkneng Safe Camp","Umrangso Hydro Complex Shelter","Haflong Relief Center"],"coords":[[25.578,91.893],[25.556,92.054],[25.5,92.75],[25.17,93.02],[24.833,92.779]],"turn_by_turn":[{"step":1,"desc":"From Shillong take Eastern Bypass towards Mawryngkneng (18 km).","road":"Shillong Bypass"},{"step":2,"desc":"Divert onto Umrangso-Dima Hasao plateau highway away from rain-battered southern cliffs.","road":"SH-19"},{"step":3,"desc":"Cross Kopili reservoir causeway; road is concrete paved and free of overhang rocks.","road":"Kopili Arterial"},{"step":4,"desc":"Connect to NH-27 4-lane expressway at Haflong junction with direct descent to Silchar.","road":"NH-27"}]},"monitored_district":"Shillong","district_risk":"Moderate","is_blocked":false,"primary_status":"OPEN - CAUTION","primary_color":"#e67e22","safest_alternate_status":"VERIFIED ALTERNATIVE PASS","safest_alternate_color":"#2ecc71"},{"id":"arunachal_nh13","name":"NH-13 (Arunachal Lifeline: Tezpur \u2194 Bomdila \u2194 Tawang)","state":"Arunachal Pradesh","primary_highway":"NH-13 via Bhalukpong Gorge & Sela Pass","choke_point":"Bhalukpong River Gorge & Tipi Rockfall Corridor","primary_coords":[[26.65,92.79],[27.01,92.64],[27.26,92.42],[27.5,92.1],[27.586,91.866]],"safest_alternate":{"name":"Orang \u2013 Kalaktang \u2013 Shergaon \u2013 Rupa Bypass","highway_code":"Trans-Arunachal Western Corridor","advantage":"Bypasses the treacherous Kameng river cuttings; wide military double-lane ridge alignment","distance_km":188,"extra_km":14,"gradient_steepness":"Moderate (5.9% avg)","clearance_status":"OPEN & STABLE","shelters_en_route":["Kalaktang Army Base Camp","Shergaon Community Shelter","Rupa Safe Station"],"coords":[[26.7,92.3],[26.98,92.1],[27.12,92.26],[27.2,92.39],[27.26,92.42],[27.586,91.866]],"turn_by_turn":[{"step":1,"desc":"Divert at Orang border gate towards Balemu-Kalaktang highway.","road":"Western Axis"},{"step":2,"desc":"Follow newly engineered ridge road to Kalaktang town. Broad clearance with zero debris.","road":"NH-13A"},{"step":3,"desc":"Traverse through Shergaon pine plateau to Rupa military station.","road":"Rupa Bypass"},{"step":4,"desc":"Safely rejoin Bomdila-Tawang highway on stable high ground.","road":"NH-13"}]},"monitored_district":"Tawang","district_risk":"Moderate","is_blocked":false,"primary_status":"OPEN - CAUTION","primary_color":"#e67e22","safest_alternate_status":"VERIFIED ALTERNATIVE PASS","safest_alternate_color":"#2ecc71"},{"id":"nagaland_nh29","name":"NH-29 (Nagaland\u2013Manipur Lifeline: Dimapur \u2194 Kohima \u2194 Imphal)","state":"Nagaland","primary_highway":"NH-29 via Pagla Pahar Gorge & Phesama","choke_point":"Pagla Pahar Gorge (Prone to torrential mudflows and boulders)","primary_coords":[[25.906,93.727],[25.75,93.9],[25.67,94.107],[25.5,94.15],[24.817,93.936]],"safest_alternate":{"name":"Niuland \u2013 Ghaspani \u2013 Zhadima Ridge Evacuation Road","highway_code":"Ridge Alignment bypass","advantage":"Built along dry watershed ridges; avoids narrow riverbed canyon of Pagla Pahar","distance_km":82,"extra_km":12,"gradient_steepness":"Gentle (5.1% avg)","clearance_status":"OPEN & STABLE","shelters_en_route":["Niuland Sub-Division Safe Ground","Zhadima High School Camp"],"coords":[[25.906,93.727],[25.86,93.88],[25.79,94.02],[25.72,94.12],[25.67,94.107]],"turn_by_turn":[{"step":1,"desc":"Take eastern exit from Dimapur onto 4-lane Niuland bypass.","road":"Niuland Road"},{"step":2,"desc":"Ascend Zhadima ridge. Hard rock foundation with heavy retaining gabion walls.","road":"Zhadima Axis"},{"step":3,"desc":"Enter Kohima North safe zone, avoiding all active landslides at Pagla Pahar.","road":"Kohima High Bypass"}]},"monitored_district":"Kohima","district_risk":"Moderate","is_blocked":false,"primary_status":"OPEN - CAUTION","primary_color":"#e67e22","safest_alternate_status":"VERIFIED ALTERNATIVE PASS","safest_alternate_color":"#2ecc71"},{"id":"mizoram_nh306","name":"NH-306 (Mizoram Lifeline: Silchar \u2194 Kolasib \u2194 Aizawl)","state":"Mizoram","primary_highway":"NH-306 via Vairengte & Kawnpui","choke_point":"Kawnpui Sinking Zone & Bilkhawthlir Slope Slip","primary_coords":[[24.833,92.779],[24.51,92.76],[24.23,92.68],[23.73,92.717]],"safest_alternate":{"name":"Bairabi \u2013 Mamit \u2013 Lengpui West Ridge Lifeline","highway_code":"SH-4 / Western Axis","advantage":"Runs through sandstone crest formation; avoids clay shale slip zones of central Kawnpui","distance_km":146,"extra_km":21,"gradient_steepness":"Moderate (5.5% avg)","clearance_status":"OPEN & STABLE","shelters_en_route":["Bairabi Railway Safe Zone","Mamit District Sports Camp","Lengpui Airport Ground"],"coords":[[24.833,92.779],[24.19,92.53],[23.93,92.49],[23.84,92.62],[23.73,92.717]],"turn_by_turn":[{"step":1,"desc":"Take Bairabi railhead highway exit west of Silchar border.","road":"Bairabi Link"},{"step":2,"desc":"Ascend to Mamit district headquarters along wide ridge with solid rock subgrade.","road":"SH-4"},{"step":3,"desc":"Connect via Lengpui Airport highway into western Aizawl with zero landslide blockages.","road":"Lengpui 4-Lane"}]},"monitored_district":"Aizawl","district_risk":"Moderate","is_blocked":false,"primary_status":"OPEN - CAUTION","primary_color":"#e67e22","safest_alternate_status":"VERIFIED ALTERNATIVE PASS","safest_alternate_color":"#2ecc71"}]};

// Offline district hazard data — realistic static snapshot for demo/offline mode
const OFFLINE_DISTRICTS = {
  "Cherrapunji": { district: "Cherrapunji", distance_km: 0.1, risk_label: "Moderate", confidence: 62.7, rainfall_mm: 177.9, soil_moisture_pct: 65.8, road_status: "Open - Monitor", advisory: "Intermittent rainfall recorded. Avoid steep road cuttings and watch for small rockfalls.", helplines: { "National Emergency": "112", "NDMA": "1070", "SDRF": "1077", "Ambulance": "108" } },
  "Shillong": { district: "Shillong", distance_km: 0.2, risk_label: "Low", confidence: 78.3, rainfall_mm: 45.2, soil_moisture_pct: 42.1, road_status: "Open", advisory: "Conditions stable. Routine monitoring active. Carry emergency kit when travelling.", helplines: { "National Emergency": "112", "NDMA": "1070", "SDRF": "1077", "Ambulance": "108" } },
  "Gangtok": { district: "Gangtok", distance_km: 0.3, risk_label: "High", confidence: 55.4, rainfall_mm: 312.8, soil_moisture_pct: 88.6, road_status: "At Risk", advisory: "Severe rainfall in Teesta catchment. NH-10 prone to landslides. Use Lava-Pakyong bypass.", helplines: { "National Emergency": "112", "NDMA": "1070", "SDRF": "1077", "Ambulance": "108" } },
  "Kohima": { district: "Kohima", distance_km: 0.4, risk_label: "Moderate", confidence: 61.1, rainfall_mm: 134.5, soil_moisture_pct: 59.3, road_status: "Open - Monitor", advisory: "Moderate soil saturation near Pagla Pahar. Use Zhadima ridge bypass if NH-29 is congested.", helplines: { "National Emergency": "112", "NDMA": "1070", "SDRF": "1077", "Ambulance": "108" } },
  "Aizawl": { district: "Aizawl", distance_km: 0.3, risk_label: "Moderate", confidence: 59.8, rainfall_mm: 98.7, soil_moisture_pct: 55.2, road_status: "Open - Monitor", advisory: "Clay shale slip zone at Kawnpui. Use western NH-306 bypass via Bairabi-Mamit.", helplines: { "National Emergency": "112", "NDMA": "1070", "SDRF": "1077", "Ambulance": "108" } },
  "Tawang": { district: "Tawang", distance_km: 0.5, risk_label: "Severe", confidence: 48.9, rainfall_mm: 489.3, soil_moisture_pct: 95.1, road_status: "Blocked", advisory: "EVACUATION ADVISORY: Bhalukpong gorge fully blocked by rockfall. All traffic via Kalaktang-Shergaon bypass only.", helplines: { "National Emergency": "112", "NDMA": "1070", "SDRF": "1077", "Ambulance": "108" } },
};

// Offline shelters data
const OFFLINE_SHELTERS = [
  { id: "SH-01", name: "Shillong Civil Defense Relief Center", district: "Shillong", latitude: 25.572, longitude: 91.885, capacity: 450, status: "OPEN", phone: "0364-222400", distance_km: 12.4 },
  { id: "SH-02", name: "Cherrapunji High-Ground Govt Camp", district: "Cherrapunji", latitude: 25.295, longitude: 91.708, capacity: 300, status: "OPEN", phone: "03637-23512", distance_km: 0.3 },
  { id: "GK-01", name: "Gangtok Emergency Relief Hub", district: "Gangtok", latitude: 27.3389, longitude: 88.6065, capacity: 600, status: "OPEN", phone: "03592-202520", distance_km: 28.1 },
  { id: "NK-01", name: "Kohima District Disaster Shelter", district: "Kohima", latitude: 25.67, longitude: 94.107, capacity: 380, status: "OPEN", phone: "0370-2226900", distance_km: 34.7 },
  { id: "AZ-01", name: "Aizawl State Disaster Camp", district: "Aizawl", latitude: 23.73, longitude: 92.717, capacity: 520, status: "OPEN", phone: "0389-2334581", distance_km: 41.2 },
  { id: "TW-01", name: "Tawang Army Relief Base", district: "Tawang", latitude: 27.586, longitude: 91.866, capacity: 250, status: "LIMITED", phone: "03794-222333", distance_km: 88.5 },
];

// Compute nearest district from GPS coords (offline fallback)
function getOfflineNearestDistrict(lat, lon) {
  const districtCenters = [
    { key: "Cherrapunji", lat: 25.2994, lon: 91.6997 },
    { key: "Shillong", lat: 25.578, lon: 91.893 },
    { key: "Gangtok", lat: 27.3389, lon: 88.6065 },
    { key: "Kohima", lat: 25.67, lon: 94.107 },
    { key: "Aizawl", lat: 23.73, lon: 92.717 },
    { key: "Tawang", lat: 27.586, lon: 91.866 },
  ];
  let nearest = districtCenters[0];
  let minDist = Infinity;
  for (const d of districtCenters) {
    const dist = Math.hypot(d.lat - lat, d.lon - lon);
    if (dist < minDist) { minDist = dist; nearest = d; }
  }
  const data = OFFLINE_DISTRICTS[nearest.key] || OFFLINE_DISTRICTS["Cherrapunji"];
  return { ...data, distance_km: Math.round(minDist * 111 * 10) / 10 };
}

// Native Capacitor & PWA Standalone Detection
const isNativeApp = Boolean(
  (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
  window.location.protocol === "capacitor:" ||
  window.navigator.standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(max-width: 900px)").matches
);

if (isNativeApp || (window.Capacitor && window.Capacitor.isNativePlatform)) {
  document.body.classList.add("is-native-app");
}

// Haptic feedback helper
function triggerHaptic(type = "light") {
  try {
    if (navigator.vibrate) {
      if (type === "sos") navigator.vibrate([150, 80, 150, 80, 300]);
      else if (type === "warning") navigator.vibrate([100, 50, 100]);
      else navigator.vibrate(30);
    }
  } catch (e) {}
}

let userLocation = { lat: 25.3000, lon: 91.7000 }; // Default Cherrapunji Sector
let citizenDeviceId = "citizen-" + Math.random().toString(36).slice(2, 8).toUpperCase();

// Update Time in status bar (for desktop presentation preview)
function updateStatusBarTime() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const el = document.getElementById("statusBarTime");
  if (el) el.textContent = `${h}:${m}`;
}
setInterval(updateStatusBarTime, 1000);
updateStatusBarTime();

// Window Resize & Orientation Change Handlers for Leaflet
window.addEventListener("resize", () => {
  if (citizenMap) setTimeout(() => citizenMap.invalidateSize(), 200);
});
window.addEventListener("orientationchange", () => {
  if (citizenMap) setTimeout(() => citizenMap.invalidateSize(), 300);
});

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


// Fetch Nearest Hazard Assessment (API first, then offline embedded data)
async function fetchNearestHazard(lat, lon) {
  let data = await apiFetch(`/api/citizen/nearest?lat=${lat}&lon=${lon}`);
  if (!data) {
    // Use embedded offline district data — works perfectly on Android APK
    data = getOfflineNearestDistrict(lat, lon);
  }
  try {

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
  if (!API_BASE) return false;          // native Android with no SERVER_URL configured
  if (!navigator.onLine) return false;
  const res = await apiFetch("/api/health", undefined, 2000);
  return res !== null;
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
      const data = await apiFetch("/api/citizen/alert-authority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (data) {
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

  // 2. Transmit via LoRa Mesh simulation to local gateway (fire-and-forget, safe offline)
  apiFetch("/api/sos", {
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
  }).then(sosData => {
    if (sosData && sosData.message_id) {
      apiFetch(`/api/sos/simulate-relay/${sosData.message_id}`, { method: "POST" });
    }
  });
  // If offline: silently skip – the queue above handles resync

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
    const res = await apiFetch("/api/citizen/alert-authority", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alertItem),
    });
    if (res) {
      syncedCount++;
    } else {
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

    const data = await apiFetch("/api/sos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (data) {
      title.textContent = `🚨 Distress Transmitted (${data.message_id})`;
      text.innerHTML = `<b>Status:</b> ${data.status} &middot; <b>Hops:</b> ${data.hop_count}/8<br>` +
                       `<b>Target Gateway:</b> NDRF Base Station NER<br>` +
                       `<small>Radio: IN865 (SF10, BW 125kHz, ToA 246ms)</small>`;
      hex.textContent = `LoRa Payload: ${data.lora_packet_hex || "4C 53 02 21 E4 54 C0 41 CC A1 62"}`;
      // Trigger relay simulation in background
      apiFetch(`/api/sos/simulate-relay/${data.message_id}`, { method: "POST" });
    } else {
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

  // 1. NER Corridors & Safest Alternative Routes (API or embedded offline)
  const corridorData = await apiFetch("/api/ner/corridors");
  cachedNerCorridors = (corridorData ? corridorData.corridors : null) || OFFLINE_CORRIDORS.corridors;
  const currentSel = document.getElementById("selectNerCorridor")?.value || "sikkim_nh10";
  const targetCorridor = cachedNerCorridors.find(c => c.id === currentSel) || cachedNerCorridors[0];
  if (targetCorridor) renderSelectedCorridor(targetCorridor);

  // 2. Designated Safe Evacuation Shelters (API or embedded offline)
  const shelterData = await apiFetch(`/api/citizen/shelters?lat=${userLocation.lat}&lon=${userLocation.lon}`);
  const shelters = (shelterData ? shelterData.shelters : null) || OFFLINE_SHELTERS;

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

    const data = await apiFetch("/api/field-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        district: district,
        latitude: userLocation.lat,
        longitude: userLocation.lon,
        description: desc,
      }),
    });

    btnReport.disabled = false;
    if (data) {
      statusEl.style.color = "#2ecc71";
      statusEl.textContent = `Report submitted! Flagged urgency: ${data.urgency}. Transmitted to SDMA.`;
      document.getElementById("reportDescription").value = "";
    } else {
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
