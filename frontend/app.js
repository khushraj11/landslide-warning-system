const API = "http://localhost:8000";

const RISK_COLOR = {
  Low: "#5fb3b3",
  Moderate: "#d9a53f",
  High: "#c9622a",
  Severe: "#e2543f",
};
const RISK_RANK = { Low: 0, Moderate: 1, High: 2, Severe: 3 };

let map, markersLayer;
let districtNames = [];
let state = { rainfall: 1.0, soil: 0 };
let forecastChart = null;

async function api(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}
async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
function setStatusStrip(counts) {
  const order = ["Severe", "High", "Moderate", "Low"];
  const top = order.find((k) => counts[k] > 0) || "Low";
  document.getElementById("statusStrip").style.background = RISK_COLOR[top];
}

function initNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const targetPanel = document.getElementById(`panel-${btn.dataset.tab}`);
      if (targetPanel) targetPanel.classList.add("active");
      if (btn.dataset.tab === "dashboard") {
        setTimeout(() => { if (map) map.invalidateSize(); }, 150);
      }
      if (btn.dataset.tab === "roads") loadRoads();
      if (btn.dataset.tab === "weather") loadForecast();
      if (btn.dataset.tab === "alerts") loadAlertsPanel();
      if (btn.dataset.tab === "field") loadFieldReports();
      if (btn.dataset.tab === "sensors") loadSensors();
    });
  });
}

function initMobileNav() {
  const btnMenu = document.getElementById("btnMobileMenu");
  const sidebar = document.getElementById("mainSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  const btnClose = document.getElementById("btnSidebarClose");

  function openSidebar() {
    if (sidebar) sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("active");
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("active");
  }

  if (btnMenu) btnMenu.addEventListener("click", openSidebar);
  if (btnClose) btnClose.addEventListener("click", closeSidebar);
  if (backdrop) backdrop.addEventListener("click", closeSidebar);

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeSidebar();
    });
  });

  window.addEventListener("resize", () => {
    if (map) map.invalidateSize();
  });
}

let nerCorridorsLayer = null;
let baseLayers = {};
let hazardLayer = null;
let isHazardVisible = false;

function initMap() {
  map = L.map("map", { zoomControl: true }).setView([25.8, 92.5], 6);

  baseLayers.street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  });
  baseLayers.satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles &copy; Esri World Imagery / Sentinel Satellite Composite" }
  );

  baseLayers.street.addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  nerCorridorsLayer = L.layerGroup().addTo(map);

  // GSI Susceptibility Polygon Overlays for high vulnerability mountain belts
  hazardLayer = L.layerGroup();
  const gsiHazardPolygons = [
    { name: "GSI Very High Susceptibility Zone (Meghalaya Plateau Scarp)", center: [25.30, 91.72], radius: 14000, color: "#e2543f" },
    { name: "Durtlang Thrust Lineament Zone (Mizoram Flysch Belt)", center: [23.75, 92.73], radius: 11000, color: "#e2543f" },
    { name: "Main Central Thrust (MCT) High Vulnerability Corridor", center: [27.52, 92.10], radius: 18000, color: "#c9622a" },
    { name: "Teesta River Valley High Fragility Corridor", center: [27.35, 88.58], radius: 15000, color: "#e2543f" },
    { name: "Disang Thrust Active Debris Flow Zone", center: [25.68, 94.08], radius: 12000, color: "#c9622a" },
    { name: "Patkai Range Complex Slip Belt", center: [24.82, 93.94], radius: 14000, color: "#e2543f" },
  ];
  gsiHazardPolygons.forEach((z) => {
    L.circle(z.center, {
      radius: z.radius,
      color: z.color,
      fillColor: z.color,
      fillOpacity: 0.16,
      weight: 2,
      dashArray: "6, 8",
    }).bindPopup(`<b>${z.name}</b><br><span style="font-size:11px; color:#aaa;">GSI Macro-Zonation Vulnerability Polygon</span>`).addTo(hazardLayer);
  });

  L.control.layers(
    { "Street Map": baseLayers.street, "Satellite (Sentinel)": baseLayers.satellite },
    { "Stations & Evacuation Buffers": markersLayer, "NER Safe Evacuation Routes": nerCorridorsLayer, "GSI Susceptibility Zones": hazardLayer }
  ).addTo(map);
}

window.setMapBase = function (mode) {
  if (mode === "satellite") {
    map.removeLayer(baseLayers.street);
    map.addLayer(baseLayers.satellite);
    document.getElementById("btnLayerStreet")?.classList.remove("active");
    document.getElementById("btnLayerSat")?.classList.add("active");
  } else {
    map.removeLayer(baseLayers.satellite);
    map.addLayer(baseLayers.street);
    document.getElementById("btnLayerSat")?.classList.remove("active");
    document.getElementById("btnLayerStreet")?.classList.add("active");
  }
};

window.toggleHazardLayer = function () {
  isHazardVisible = !isHazardVisible;
  const btn = document.getElementById("btnLayerHazard");
  if (isHazardVisible) {
    map.addLayer(hazardLayer);
    btn?.classList.add("active");
  } else {
    map.removeLayer(hazardLayer);
    btn?.classList.remove("active");
  }
};


function renderMapMarkers(districts) {
  markersLayer.clearLayers();
  districts.forEach((d) => {
    const color = RISK_COLOR[d.risk_label];
    const isCritical = d.risk_label === "High" || d.risk_label === "Severe";

    // 5 km circular evacuation buffer for critical zones
    if (isCritical) {
      L.circle([d.latitude, d.longitude], {
        radius: 6000,
        color: color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: "5, 6",
      }).addTo(markersLayer);
    }

    const marker = L.circleMarker([d.latitude, d.longitude], {
      radius: 9 + d.confidence * 8,
      color,
      fillColor: color,
      fillOpacity: 0.75,
      weight: 2,
    }).bindPopup(
      `<div style="font-family:sans-serif; min-width:200px;">
        <div style="font-size:14px; font-weight:bold; margin-bottom:4px;">${d.district} Sector</div>
        <div style="margin-bottom:6px;">Status: <b style="color:${color};">${d.risk_label.toUpperCase()} RISK</b> (${(d.confidence * 100).toFixed(0)}% AI Conf)</div>
        <div style="font-size:12px; color:#555; line-height:1.5;">
          🌧️ Rainfall: <b>${d.rainfall_mm.toFixed(0)} mm</b> ${d.baseline_rainfall_mm ? `<span style="color:#888; font-size:11px;">(Base: ${d.baseline_rainfall_mm}mm)</span>` : ""}<br>
          💧 Saturation: <b>${d.soil_moisture_pct.toFixed(0)}%</b> ${d.baseline_soil_moisture_pct ? `<span style="color:#888; font-size:11px;">(Base: ${d.baseline_soil_moisture_pct}%)</span>` : ""}<br>
          📐 Slope Angle: <b>${d.slope_angle_deg.toFixed(1)}°</b> &middot; Past Events: <b>${d.historical_landslides || 0}</b>
        </div>
        ${isCritical ? `<div style="margin-top:8px; padding-top:6px; border-top:1px solid #eee; font-size:11px; color:#e74c3c; font-weight:bold;">⚠️ EVACUATION BUFFER ACTIVE (5 KM)</div>` : ""}
      </div>`
    );
    marker.addTo(markersLayer);
  });
}

async function renderNerCorridorsOnMap() {
  if (!nerCorridorsLayer || !map) return;
  nerCorridorsLayer.clearLayers();
  try {
    const { corridors } = await api("/api/ner/corridors");
    (corridors || []).forEach((c) => {
      // Primary Highway (Red/Orange dashed line)
      if (c.primary_coords && c.primary_coords.length > 1) {
        L.polyline(c.primary_coords, {
          color: c.primary_color || "#e74c3c",
          weight: 3.5,
          opacity: 0.85,
          dashArray: "6, 8",
        }).bindPopup(
          `<div style="font-family:sans-serif; min-width:190px;">
             <b style="color:#e74c3c;">⛔ ${c.primary_highway}</b><br>
             Status: <b>${c.primary_status}</b><br>
             Hazard Choke: <i>${c.choke_point}</i>
           </div>`
        ).addTo(nerCorridorsLayer);
      }

      // Safest Alternate Bypass (Solid Glowing Green line)
      if (c.safest_alternate && c.safest_alternate.coords) {
        L.polyline(c.safest_alternate.coords, {
          color: "#2ecc71",
          weight: 4.5,
          opacity: 0.95,
        }).bindPopup(
          `<div style="font-family:sans-serif; min-width:230px;">
             <b style="color:#2ecc71;">🟢 ${c.safest_alternate.name}</b><br>
             Clearance: <b>${c.safest_alternate.clearance_status}</b> (${c.safest_alternate.highway_code})<br>
             Advantage: ${c.safest_alternate.advantage}<br>
             Distance: ${c.safest_alternate.distance_km} km (+${c.safest_alternate.extra_km} km)<br>
             Gradient: ${c.safest_alternate.gradient_steepness}<br>
             Safe Speed: ${c.safest_alternate.estimated_safe_speed}
           </div>`
        ).addTo(nerCorridorsLayer);
      }
    });
  } catch (err) {
    console.warn("Could not load NER alternate corridors:", err);
  }
}


function riskCardHTML(district, risk, meta) {
  return `
    <div class="risk-card ${risk}">
      <div class="risk-card-title">${district} <span class="risk-badge">${risk}</span></div>
      <div class="risk-meta">${meta}</div>
    </div>`;
}

async function loadDashboard() {
  const { counts, districts } = await api(`/api/risk?rainfall=${state.rainfall}&soil=${state.soil}`);
  window.__lastDistricts = districts;

  document.getElementById("countLow").textContent = counts.Low;
  document.getElementById("countModerate").textContent = counts.Moderate;
  document.getElementById("countHigh").textContent = counts.High;
  document.getElementById("countSevere").textContent = counts.Severe;
  setStatusStrip(counts);

  renderMapMarkers(districts);
  renderNerCorridorsOnMap();

  const sorted = [...districts].sort((a, b) => RISK_RANK[b.risk_label] - RISK_RANK[a.risk_label]);
  document.getElementById("triageList").innerHTML = sorted
    .map((d) =>
      riskCardHTML(
        d.district,
        d.risk_label,
        `conf ${(d.confidence * 100).toFixed(0)}% &middot; rain ${d.rainfall_mm.toFixed(0)}mm ${d.baseline_rainfall_mm ? `(base ${d.baseline_rainfall_mm}mm)` : ""} &middot; soil ${d.soil_moisture_pct.toFixed(0)}%`
      )
    )
    .join("");

  if (districtNames.length === 0) {
    districtNames = districts.map((d) => d.district).sort();
    populateDistrictSelects();
  }
}

function populateDistrictSelects() {
  const frSelect = document.getElementById("fr-district");
  const fcSelect = document.getElementById("forecastDistrict");
  [frSelect, fcSelect].forEach((sel) => {
    sel.innerHTML = districtNames.map((d) => `<option value="${d}">${d}</option>`).join("");
  });
}

function initSliders() {
  const rainfallSlider = document.getElementById("rainfallSlider");
  const soilSlider = document.getElementById("soilSlider");

  rainfallSlider.addEventListener("input", (e) => {
    state.rainfall = parseFloat(e.target.value);
    document.getElementById("rainfallVal").textContent = `${state.rainfall.toFixed(1)}x`;
    refreshAll();
  });
  soilSlider.addEventListener("input", (e) => {
    state.soil = parseInt(e.target.value);
    document.getElementById("soilVal").textContent = `${state.soil >= 0 ? "+" : ""}${state.soil}%`;
    refreshAll();
  });
}

function refreshAll() {
  loadDashboard();
  const activeTab = document.querySelector(".nav-item.active")?.dataset.tab;
  if (activeTab === "roads") loadRoads();
  if (activeTab === "alerts") loadAlertsPanel();
  if (activeTab === "sensors") loadSensors();
}

let roadFilter = "all";
async function loadRoads() {
  const { roads } = await api(`/api/roads?rainfall=${state.rainfall}&soil=${state.soil}`);
  const filtered = roadFilter === "all" ? roads : roads.filter((r) => r.status === roadFilter);
  document.getElementById("roadsList").innerHTML = filtered
    .map((r) => riskCardHTML(`${r.road} &mdash; <i style="opacity:.7">${r.district}</i>`, r.risk_label, `${r.status}: ${r.blurb}`))
    .join("");
}
function initRoadFilters() {
  document.querySelectorAll(".filter-row .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-row .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      roadFilter = chip.dataset.filter;
      loadRoads();
    });
  });
}

async function loadForecast() {
  const { forecast } = await api(`/api/forecast?days=3`);

  const byDistrict = {};
  forecast.forEach((f) => {
    if (!byDistrict[f.district]) byDistrict[f.district] = [];
    byDistrict[f.district].push(f);
  });

  const escalations = [];
  Object.entries(byDistrict).forEach(([district, rows]) => {
    rows.sort((a, b) => a.day - b.day);
    const start = RISK_RANK[rows[0].risk_label];
    const end = RISK_RANK[rows[rows.length - 1].risk_label];
    if (end > start) {
      escalations.push({ district, from: rows[0].risk_label, to: rows[rows.length - 1].risk_label });
    }
  });
  document.getElementById("escalationList").innerHTML = escalations.length
    ? escalations
        .map((e) => riskCardHTML(e.district, e.to, `projected escalation from ${e.from} &rarr; ${e.to}`))
        .join("")
    : `<div class="risk-meta">No districts currently projected to escalate.</div>`;

  const districtSelect = document.getElementById("forecastDistrict");
  if (!districtSelect.dataset.wired) {
    districtSelect.addEventListener("change", () => renderForecastChart(byDistrict[districtSelect.value]));
    districtSelect.dataset.wired = "1";
  }
  const chosen = districtSelect.value || Object.keys(byDistrict)[0];
  renderForecastChart(byDistrict[chosen]);
}

function renderForecastChart(rows) {
  if (!rows) return;
  const ctx = document.getElementById("forecastChart");
  const labels = rows.map((r) => `Day ${r.day}`);
  if (forecastChart) forecastChart.destroy();
  forecastChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Rainfall (mm)", data: rows.map((r) => r.rainfall_mm), borderColor: "#5fb3b3", tension: 0.3 },
        { label: "Soil Moisture (%)", data: rows.map((r) => r.soil_moisture_pct), borderColor: "#d98e3f", tension: 0.3 },
      ],
    },
    options: {
      plugins: { legend: { labels: { color: "#8b96a3" } } },
      scales: {
        x: { ticks: { color: "#8b96a3" }, grid: { color: "#2e3844" } },
        y: { ticks: { color: "#8b96a3" }, grid: { color: "#2e3844" } },
      },
    },
  });

  document.getElementById("forecastDayList").innerHTML = rows
    .map((r) => riskCardHTML(`Day ${r.day}`, r.risk_label, `rain ${r.rainfall_mm}mm &middot; soil ${r.soil_moisture_pct}%`))
    .join("");
}

let currentReportCoords = null;

window.locateFieldUser = function () {
  const statusEl = document.getElementById("fr-gps-status");
  if (!navigator.geolocation) {
    if (statusEl) statusEl.textContent = "📍 Browser geolocation unavailable.";
    return;
  }
  if (statusEl) statusEl.textContent = "📍 Acquiring high-precision GPS...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      currentReportCoords = [pos.coords.latitude, pos.coords.longitude];
      if (statusEl) {
        statusEl.textContent = `📍 GPS Fixed: ${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E (±${Math.round(pos.coords.accuracy)}m)`;
      }
    },
    () => {
      if (statusEl) statusEl.textContent = "📍 GPS fallback: Using district center.";
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
};

function initFieldReport() {
  const photoInput = document.getElementById("fr-photo");
  const imgPreview = document.getElementById("fr-preview");
  const videoPreview = document.getElementById("fr-video-preview");

  if (photoInput) {
    photoInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) {
        if (imgPreview) imgPreview.style.display = "none";
        if (videoPreview) videoPreview.style.display = "none";
        return;
      }
      const url = URL.createObjectURL(file);
      if (file.type.startsWith("video/")) {
        if (imgPreview) imgPreview.style.display = "none";
        if (videoPreview) {
          videoPreview.src = url;
          videoPreview.style.display = "block";
        }
      } else {
        if (videoPreview) videoPreview.style.display = "none";
        if (imgPreview) {
          imgPreview.src = url;
          imgPreview.style.display = "block";
        }
      }
    });
  }

  const form = document.getElementById("fieldForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const district = document.getElementById("fr-district").value;
      const description = document.getElementById("fr-desc").value;
      const coords = currentReportCoords || districtCoords(district);
      const file = photoInput?.files[0];
      const mediaType = file && file.type.startsWith("video/") ? "video" : (file ? "image" : null);

      const result = await apiPost("/api/field-report", {
        district,
        latitude: coords[0],
        longitude: coords[1],
        description: description + (currentReportCoords ? ` [GPS: ${coords[0].toFixed(4)}°N, ${coords[1].toFixed(4)}°E]` : ""),
        media_type: mediaType,
        media_url: file ? file.name : null,
      });

      const box = document.getElementById("fr-result");
      box.className = `form-result show ${result.urgency === "Urgent" ? "urgent" : "routine"}`;
      box.textContent =
        result.urgency === "Urgent"
          ? `Flagged URGENT (keywords: ${result.keywords_hit.join(", ")}) -- prioritized for dispatch.`
          : `Submitted and logged for review.${file ? ` Attached: ${file.name} (${mediaType})` : ""}`;

      document.getElementById("fr-desc").value = "";
      if (photoInput) photoInput.value = "";
      if (imgPreview) imgPreview.style.display = "none";
      if (videoPreview) videoPreview.style.display = "none";
      loadFieldReports();
    });
  }

  if (navigator.geolocation) {
    locateFieldUser();
  }
}

function districtCoords(name) {
  const found = window.__lastDistricts?.find((d) => d.district === name);
  return found ? [found.latitude, found.longitude] : [25.8, 92.5];
}

window.verifyReport = async function (timestamp, isVerified) {
  try {
    await apiPost("/api/field-report/verify", {
      timestamp,
      verified: isVerified,
      notes: isVerified ? "Verified by SDMA / Escalated to NDRF team" : "Routine terrain movement",
    });
    loadFieldReports();
  } catch (e) {
    alert("Verification failed");
  }
};

async function loadFieldReports() {
  const { reports } = await api("/api/field-reports");
  document.getElementById("fr-list").innerHTML = reports.length
    ? reports
        .map((r) => {
          const status = r.official_verified || "PENDING";
          const verifyButtons =
            status === "PENDING"
              ? `<div style="margin-top:8px; display:flex; gap:6px;">
                   <button class="chip" style="color:var(--risk-low); border-color:var(--risk-low); background:rgba(46,204,113,0.12);" onclick="verifyReport('${r.timestamp}', true)">✅ Verify & Dispatch NDRF</button>
                   <button class="chip" style="color:var(--text-faint);" onclick="verifyReport('${r.timestamp}', false)">❌ Reject</button>
                 </div>`
              : "";

          let channelBadge = "";
          const combined = `${r.description} ${r.official_notes}`.toUpperCase();
          if (combined.includes("STORE_AND_FORWARD") || combined.includes("AUTO-RESENT")) {
            channelBadge = `<span class="chip" style="color:#38bdf8; border-color:#38bdf8; background:rgba(56,189,248,0.12); font-size:10px; padding:1px 6px;">🔄 STORE & FORWARD AUTO-RESENT</span>`;
          } else if (combined.includes("LORA")) {
            channelBadge = `<span class="chip" style="color:#f1c40f; border-color:#f1c40f; background:rgba(241,196,15,0.12); font-size:10px; padding:1px 6px;">⚡ LORA MESH ZERO-CELL</span>`;
          } else if (combined.includes("INTERNET")) {
            channelBadge = `<span class="chip" style="color:#2ecc71; border-color:#2ecc71; background:rgba(46,204,113,0.12); font-size:10px; padding:1px 6px;">🌐 INTERNET DIRECT</span>`;
          }

          let mediaBadge = "";
          if (r.media_type === "video") {
            mediaBadge = `<span class="chip" style="color:#c084fc; border-color:#c084fc; background:rgba(192,132,252,0.12); font-size:10px; padding:1px 6px;">🎥 Video Evidence</span>`;
          } else if (r.media_type === "image" || r.media_url) {
            mediaBadge = `<span class="chip" style="color:#38bdf8; border-color:#38bdf8; background:rgba(56,189,248,0.12); font-size:10px; padding:1px 6px;">📷 Photo Evidence</span>`;
          }

          const gpsBadge = (r.latitude && r.longitude)
            ? `<span class="chip" style="font-size:10px; padding:1px 6px; font-family:var(--font-mono); color:var(--glacier);">📍 ${r.latitude.toFixed(3)}°N, ${r.longitude.toFixed(3)}°E</span>`
            : "";

          return `
      <div class="report-item">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="badge ${r.urgency}">${r.urgency}</span>
            <b>${r.district}</b> 
            ${channelBadge}
            ${mediaBadge}
            ${gpsBadge}
            <span class="ts">${r.timestamp}</span>
          </div>
          <span class="verify-badge ${status}">${status}</span>
        </div>
        <div style="margin-top:6px; color:var(--text-muted); line-height:1.4;">${r.description || "(no description)"}</div>
        ${r.official_notes ? `<div style="margin-top:4px; font-size:11px; color:var(--text-faint); font-family:var(--font-mono);">${r.official_notes}</div>` : ""}
        ${verifyButtons}
      </div>`;
        })
        .join("")
    : `<div class="risk-meta">No field reports submitted yet.</div>`;
}


let cachedSubscribers = {};

async function loadAlertsPanel() {
  const health = await api("/api/health");
  const banner = document.getElementById("alertModeBanner");
  if (banner) {
    banner.textContent = health.fast2sms_live
      ? "LIVE MODE: Fast2SMS Indian SMS Gateway active -- real SMS will be delivered to Indian (+91) numbers."
      : "DEMO SIMULATION MODE: Fast2SMS sandbox active -- realistic dispatch receipts generated for hackathon demo.";
    banner.style.color = health.fast2sms_live ? "var(--risk-low)" : "var(--risk-moderate)";
  }

  // Load subscriber directory info
  try {
    const subData = await api("/api/subscribers");
    cachedSubscribers = subData.districts || {};
    const totalEl = document.getElementById("totalSubscribersCount");
    if (totalEl) totalEl.textContent = (subData.total_citizens || 0).toLocaleString();
  } catch (err) {
    console.warn("Could not load subscriber directory:", err);
  }

  const massBtn = document.getElementById("btnMassBroadcast");
  const massFeedback = document.getElementById("massBroadcastFeedback");
  if (massBtn) {
    massBtn.onclick = async () => {
      massBtn.disabled = true;
      massBtn.innerHTML = "<span>⏳</span> DISPATCHING MASS EMERGENCY BROADCAST TO REGISTERED DIRECTORY...";
      if (massFeedback) {
        massFeedback.style.display = "block";
        massFeedback.style.background = "rgba(88,166,255,0.1)";
        massFeedback.style.border = "1px solid var(--glacier)";
        massFeedback.style.color = "var(--text)";
        massFeedback.innerHTML = "Broadcasting localized emergency SMS across all high/severe risk sectors...";
      }

      const lang = document.getElementById("langSelect")?.value || "English";
      try {
        const res = await apiPost("/api/alerts/broadcast-mass", {
          rainfall: state.rainfall,
          soil: state.soil,
          language: lang,
        });

        if (massFeedback) {
          if (res.sectors_alerted > 0) {
            massFeedback.style.background = "rgba(46,204,113,0.12)";
            massFeedback.style.border = "1px solid var(--risk-low)";
            massFeedback.style.color = "var(--risk-low)";
            massFeedback.innerHTML = `<b>✅ Mass Broadcast Completed:</b> Reached <b>${(res.total_citizens_reached || 0).toLocaleString()} registered citizens & emergency officials</b> across ${res.sectors_alerted} critical sectors: ${res.sectors.join(", ")}.`;
          } else {
            massFeedback.style.background = "rgba(255,255,255,0.05)";
            massFeedback.style.border = "1px solid var(--contour)";
            massFeedback.style.color = "var(--text-muted)";
            massFeedback.innerHTML = `ℹ️ ${res.message}`;
          }
        }
      } catch (e) {
        if (massFeedback) {
          massFeedback.style.background = "rgba(231,76,60,0.15)";
          massFeedback.style.border = "1px solid var(--risk-severe)";
          massFeedback.style.color = "var(--risk-severe)";
          massFeedback.textContent = "Mass broadcast failed: " + e.message;
        }
      }

      massBtn.disabled = false;
      massBtn.innerHTML = `<span>🚨</span> MASS EMERGENCY BROADCAST &mdash; DISPATCH TO ALL HIGH/SEVERE DISTRICTS`;
      loadDispatchLog();
    };
  }

  const { districts } = await api(`/api/risk?rainfall=${state.rainfall}&soil=${state.soil}`);
  const critical = districts.filter((d) => d.risk_label === "High" || d.risk_label === "Severe");
  const lang = document.getElementById("langSelect")?.value || "English";

  const cards = await Promise.all(
    critical.map(async (d) => {
      const { message } = await api(`/api/alert-text?district=${encodeURIComponent(d.district)}&risk=${d.risk_label}&language=${lang}`);
      const distInfo = cachedSubscribers[d.district] || {};
      const regCount = (distInfo.total_registered || 450).toLocaleString();
      const groups = distInfo.groups || ["DDMA Cell", "SDRF Squad", "Registered Residents"];
      const groupsHtml = groups.map((g) => `<span class="tag-pill">🏷️ ${g}</span>`).join(" ");

      return `
        <div class="alert-card ${d.risk_label}" data-district="${d.district}" data-risk="${d.risk_label}">
          <div class="alert-row">
            <div class="risk-card-title">
              ${d.district} <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(${distInfo.state || "NER"})</span>
              <span class="risk-badge">${d.risk_label}</span>
            </div>
            <span class="sub-badge">👥 ${regCount} Registered Contacts</span>
          </div>

          <div class="district-meta-row">
            <div class="tag-group">${groupsHtml}</div>
          </div>

          <div class="alert-msg">${message}</div>

          <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin-top:12px;">
            <button class="btn-broadcast-district" data-district="${d.district}" data-risk="${d.risk_label}">
              <span>📢</span> Broadcast to ${d.district} Directory (${regCount} Contacts)
            </button>
            <button type="button" class="chip" style="font-size:11px; padding:4px 8px; cursor:pointer;" onclick="toggleTestPhone('${d.district}')">
              🧪 Test Single Number
            </button>
          </div>

          <div class="test-phone-box" id="test-phone-${d.district}" style="display:none;">
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">Custom phone dispatch test (e.g. your personal mobile):</div>
            <div class="phone-row">
              <input class="phone-input" placeholder="98XXXXXXXX (Indian 10-digit)" value="9876543210" />
              <button class="btn btn-send">Dispatch Test SMS</button>
            </div>
            <div class="send-result"></div>
          </div>

          <div class="send-result district-broadcast-result" id="bcast-result-${d.district}"></div>
        </div>`;
    })
  );

  document.getElementById("alertList").innerHTML = cards.length
    ? cards.join("")
    : `<div class="risk-meta">No districts currently at High or Severe risk. Adjust rainfall or soil sliders to test escalation.</div>`;

  // Wire up District Broadcast buttons
  document.querySelectorAll(".btn-broadcast-district").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const district = btn.dataset.district;
      const risk = btn.dataset.risk;
      const resultEl = document.getElementById(`bcast-result-${district}`);
      btn.disabled = true;
      btn.innerHTML = `<span>⏳</span> Dispatching to ${district} Directory...`;

      try {
        const res = await apiPost("/api/alerts/broadcast-district", { district, risk, language: lang });
        btn.disabled = false;
        btn.innerHTML = `<span>✅</span> Broadcast Dispatched!`;
        setTimeout(() => {
          const regCount = (cachedSubscribers[district]?.total_registered || 450).toLocaleString();
          btn.innerHTML = `<span>📢</span> Broadcast to ${district} Directory (${regCount} Contacts)`;
        }, 3000);

        if (resultEl) {
          resultEl.className = "send-result ok";
          resultEl.textContent = `✅ ${res.detail}`;
        }
        loadDispatchLog();
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<span>❌</span> Broadcast Error`;
        if (resultEl) {
          resultEl.className = "send-result err";
          resultEl.textContent = `Error: ${err.message}`;
        }
      }
    });
  });

  // Wire up Single Test SMS buttons
  document.querySelectorAll(".btn-send").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".alert-card");
      const phone = card.querySelector(".phone-input").value.trim();
      const district = card.dataset.district;
      const risk = card.dataset.risk;
      const resultEl = card.querySelector(".send-result");
      btn.disabled = true;
      const res = await apiPost("/api/alerts/send", { district, risk, language: lang, phone });
      btn.disabled = false;
      resultEl.className = `send-result ${res.status === "Sent" || res.status === "Simulated" ? "ok" : "err"}`;
      resultEl.textContent = `${res.status}: ${res.detail}`;
      loadDispatchLog();
    });
  });

  loadDispatchLog();
}

function toggleTestPhone(district) {
  const box = document.getElementById(`test-phone-${district}`);
  if (box) {
    box.style.display = box.style.display === "none" ? "block" : "none";
  }
}
window.toggleTestPhone = toggleTestPhone;

function openSubscribersModal() {
  const modal = document.getElementById("subscribersModal");
  if (modal) {
    modal.style.display = "flex";
    populateSubscribersDirectory();
  }
}
window.openSubscribersModal = openSubscribersModal;

function closeSubscribersModal() {
  const modal = document.getElementById("subscribersModal");
  if (modal) modal.style.display = "none";
}
window.closeSubscribersModal = closeSubscribersModal;

function switchDirTab(tab) {
  const btnView = document.getElementById("tabDirView");
  const btnAdd = document.getElementById("tabDirAdd");
  const contentPrev = document.getElementById("dirTabContentView");
  const contentAdd = document.getElementById("dirTabContentAdd");

  if (tab === "view") {
    btnView.classList.add("active");
    btnAdd.classList.remove("active");
    contentPrev.style.display = "block";
    contentAdd.style.display = "none";
    populateSubscribersDirectory();
  } else {
    btnAdd.classList.add("active");
    btnView.classList.remove("active");
    contentPrev.style.display = "none";
    contentAdd.style.display = "block";
    const sel = document.getElementById("bulkAddDistrict");
    if (sel && districtNames.length > 0) {
      sel.innerHTML = districtNames.map((d) => `<option value="${d}">${d}</option>`).join("");
    }
  }
}
window.switchDirTab = switchDirTab;

async function populateSubscribersDirectory() {
  const listEl = document.getElementById("dirDistrictList");
  if (!listEl) return;
  try {
    const data = await api("/api/subscribers");
    cachedSubscribers = data.districts || {};
    const countEl = document.getElementById("dirModalCount");
    if (countEl) countEl.textContent = data.total_districts || Object.keys(cachedSubscribers).length;

    const cards = Object.values(cachedSubscribers).map((dist) => {
      const groups = (dist.groups || []).map((g) => `<span class="tag-pill">🛡️ ${g}</span>`).join(" ");
      const samplePhones = (dist.contacts || []).slice(0, 4).map((p) => `<span class="dir-contact-tag">📱 +91 ${p}</span>`).join(" ");
      return `
        <div class="dir-district-card">
          <div class="dir-district-title">
            <span>${dist.district}, ${dist.state || "NER"}</span>
            <span class="sub-badge" style="font-size:12px;">👥 ${(dist.total_registered || 0).toLocaleString()} Registered</span>
          </div>
          <div style="font-size:11.5px; color:var(--text-muted); margin:4px 0;">Language: <b>${dist.primary_language || "English"}</b></div>
          <div class="tag-group" style="margin:6px 0;">${groups}</div>
          <div class="dir-contacts-list">${samplePhones} ${dist.contacts && dist.contacts.length > 4 ? `<span style="font-size:10.5px; color:var(--text-muted);">+${dist.contacts.length - 4} more</span>` : ""}</div>
        </div>
      `;
    });
    listEl.innerHTML = cards.join("");
  } catch (err) {
    listEl.innerHTML = `<div class="risk-meta">Failed to load directory: ${err.message}</div>`;
  }
}
window.populateSubscribersDirectory = populateSubscribersDirectory;

async function handleBulkAddSubmit(event) {
  event.preventDefault();
  const district = document.getElementById("bulkAddDistrict").value;
  const group = document.getElementById("bulkAddGroup").value;
  const rawPhones = document.getElementById("bulkAddPhones").value;
  const resultEl = document.getElementById("bulkAddResult");
  const btnSubmit = document.getElementById("btnSubmitBulkAdd");

  const phones = rawPhones
    .split(/[\n,; ]+/)
    .map((p) => p.replace(/[^0-9]/g, "").slice(-10))
    .filter((p) => p.length === 10);

  if (phones.length === 0) {
    resultEl.style.display = "block";
    resultEl.className = "send-result err";
    resultEl.textContent = "Please enter at least one valid 10-digit Indian phone number.";
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Saving to Database...";

  try {
    const res = await apiPost("/api/subscribers/bulk-add", {
      district,
      group,
      phones,
    });

    resultEl.style.display = "block";
    resultEl.className = "send-result ok";
    resultEl.innerHTML = `<b>✅ Success:</b> ${res.message} Total contacts in ${district}: ${res.total_registered}.`;
    document.getElementById("bulkAddPhones").value = "";

    await populateSubscribersDirectory();
    await loadAlertsPanel();
  } catch (err) {
    resultEl.style.display = "block";
    resultEl.className = "send-result err";
    resultEl.textContent = `Error: ${err.message}`;
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "💾 Add Batch to Database";
  }
}
window.handleBulkAddSubmit = handleBulkAddSubmit;

async function loadDispatchLog() {
  const { log } = await api("/api/alerts/log");
  document.getElementById("dispatchLog").innerHTML = log.length
    ? log
        .slice(0, 15)
        .map(
          (l) => `
      <div class="report-item">
        <b>${l.district}</b> <span class="ts">${l.timestamp}</span><br>
        <span style="color:var(--text-muted)">${l.status} &middot; ${l.language} &middot; ${l.phone || "no phone"} &middot; ${l.gateway || "Fast2SMS"}</span>
      </div>`
        )
        .join("")
    : `<div class="risk-meta">No alerts dispatched yet.</div>`;
}

async function initLanguages() {
  const { languages } = await api("/api/translations");
  document.getElementById("langSelect").innerHTML = languages.map((l) => `<option>${l}</option>`).join("");
}

async function checkHealth() {
  const el = document.getElementById("apiStatus");
  try {
    await api("/api/health");
    el.textContent = "connected";
    el.className = "ok";
  } catch {
    el.textContent = "unreachable -- start api.py";
    el.className = "bad";
  }
}

async function loadSensors() {
  try {
    const data = await api(`/api/sensors?rainfall=${state.rainfall}&soil=${state.soil}`);
    const sensors = data.sensors || [];

    const elTotal = document.getElementById("sensorCountTotal");
    const elOnline = document.getElementById("sensorCountOnline");
    const elAlerts = document.getElementById("sensorCountAlerts");
    const elPeak = document.getElementById("sensorPeakDisp");

    if (elTotal) elTotal.textContent = data.total || sensors.length;
    if (elOnline) elOnline.textContent = data.online || sensors.length;
    if (elAlerts) elAlerts.textContent = data.alerts_active || 0;
    if (elPeak) elPeak.textContent = `${(data.highest_displacement || 0).toFixed(2)} mm/h`;

    const tbody = document.getElementById("sensorTableBody");
    if (!tbody) return;

    if (!sensors.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--text-faint);">No active telemetry</td></tr>';
      return;
    }

    tbody.innerHTML = sensors
      .map((s) => {
        const badgeClass =
          s.status === "CRITICAL ALERT"
            ? "CRITICAL"
            : s.status === "WARNING"
            ? "WARNING"
            : s.status === "ADVISORY"
            ? "ADVISORY"
            : "NORMAL";
        const isBreached = s.threshold_breached;
        return `
        <tr style="${isBreached ? "background:rgba(226,84,63,0.06);" : ""}">
          <td class="mono" style="font-weight:700; color:var(--glacier);">${s.sensor_id}</td>
          <td><b>${s.name}</b><br><span style="font-size:10px; color:var(--text-faint);">${s.latitude.toFixed(3)}°N, ${s.longitude.toFixed(3)}°E</span></td>
          <td>${s.district}, ${s.state}</td>
          <td style="color:var(--text-muted); font-size:11px;">${s.sensor_type}</td>
          <td class="mono">${s.rainfall_1h_mm} mm/h</td>
          <td class="mono" style="color:${s.soil_moisture_pct > 80 ? "var(--risk-severe)" : "inherit"}; font-weight:${s.soil_moisture_pct > 80 ? "700" : "normal"};">${s.soil_moisture_pct}%</td>
          <td class="mono">${s.pore_pressure_kpa} kPa</td>
          <td class="mono" style="color:${s.displacement_rate_mm_hr > 1.0 ? "var(--risk-severe)" : "inherit"}; font-weight:${s.displacement_rate_mm_hr > 1.0 ? "700" : "normal"};">${s.displacement_rate_mm_hr} mm/h</td>
          <td><span style="font-size:10px; padding:2px 5px; border-radius:3px; background:rgba(255,255,255,0.06); font-family:var(--font-mono);">${s.telemetry}</span></td>
          <td><span class="sensor-status-badge ${badgeClass}">${s.status}</span></td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    console.error("Failed to load sensors:", err);
  }
}
window.loadSensors = loadSensors;

window.addEventListener("DOMContentLoaded", async () => {
  initNav();
  initMobileNav();
  initMap();
  initSliders();
  initRoadFilters();
  initFieldReport();
  await checkHealth();
  await initLanguages();
  await loadDashboard();
  loadSensors();

  const btnOpenDir = document.getElementById("btnOpenSubscribersModal");
  if (btnOpenDir) btnOpenDir.addEventListener("click", openSubscribersModal);
  const btnCloseDir = document.getElementById("btnCloseSubscribersModal");
  if (btnCloseDir) btnCloseDir.addEventListener("click", closeSubscribersModal);
  const modalDir = document.getElementById("subscribersModal");
  if (modalDir) {
    modalDir.addEventListener("click", (e) => {
      if (e.target === modalDir) closeSubscribersModal();
    });
  }

  // 30s background telemetry refresh
  setInterval(() => {
    const activeTab = document.querySelector(".nav-item.active")?.dataset.tab;
    if (activeTab === "sensors") loadSensors();
  }, 30000);
});
