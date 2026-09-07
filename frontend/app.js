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
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
      if (btn.dataset.tab === "roads") loadRoads();
      if (btn.dataset.tab === "weather") loadForecast();
      if (btn.dataset.tab === "alerts") loadAlertsPanel();
      if (btn.dataset.tab === "field") loadFieldReports();
    });
  });
}

let nerCorridorsLayer = null;

function initMap() {
  map = L.map("map", { zoomControl: true }).setView([25.8, 92.5], 6);

  const streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  });
  const satLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles &copy; Esri" }
  ).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  nerCorridorsLayer = L.layerGroup().addTo(map);

  L.control.layers(
    { "Street Map": streetLayer, "Satellite Imagery": satLayer },
    { "Stations & Evacuation Buffers": markersLayer, "NER Safe Evacuation Routes": nerCorridorsLayer }
  ).addTo(map);
}


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
          🌧️ Rainfall: <b>${d.rainfall_mm.toFixed(0)} mm</b><br>
          💧 Saturation: <b>${d.soil_moisture_pct.toFixed(0)}%</b><br>
          📐 Slope Angle: <b>${d.slope_angle_deg.toFixed(1)}°</b>
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
             Safe Camps: ${c.safest_alternate.shelters_en_route.join(", ")}
           </div>`
        ).addTo(nerCorridorsLayer);
      }
    });
  } catch (err) {
    console.warn("Could not load NER corridors on command map", err);
  }
}


function riskCardHTML(title, riskLabel, metaLine, extraRight = "") {
  return `
    <div class="risk-card ${riskLabel}">
      <div class="risk-card-title">${title}
        <span class="risk-badge">${riskLabel}</span> ${extraRight}
      </div>
      <div class="risk-meta">${metaLine}</div>
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
        `conf ${(d.confidence * 100).toFixed(0)}% &middot; rain ${d.rainfall_mm.toFixed(0)}mm &middot; soil ${d.soil_moisture_pct.toFixed(0)}%`
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
  const activeTab = document.querySelector(".nav-item.active").dataset.tab;
  if (activeTab === "roads") loadRoads();
  if (activeTab === "alerts") loadAlertsPanel();
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
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
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

function initFieldReport() {
  document.getElementById("fr-photo").addEventListener("change", (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById("fr-preview");
    if (file) {
      preview.src = URL.createObjectURL(file);
      preview.style.display = "block";
    }
  });

  document.getElementById("fieldForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const district = document.getElementById("fr-district").value;
    const description = document.getElementById("fr-desc").value;
    const coords = districtCoords(district);

    const result = await apiPost("/api/field-report", {
      district, latitude: coords[0], longitude: coords[1], description,
    });

    const box = document.getElementById("fr-result");
    box.className = `form-result show ${result.urgency === "Urgent" ? "urgent" : "routine"}`;
    box.textContent =
      result.urgency === "Urgent"
        ? `Flagged URGENT (keywords: ${result.keywords_hit.join(", ")}) -- prioritized for dispatch.`
        : "Submitted and logged for review.";

    document.getElementById("fr-desc").value = "";
    loadFieldReports();
  });
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

          return `
      <div class="report-item">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="badge ${r.urgency}">${r.urgency}</span>
            <b>${r.district}</b> 
            ${channelBadge}
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


async function loadAlertsPanel() {
  const health = await api("/api/health");
  const banner = document.getElementById("alertModeBanner");
  banner.textContent = health.fast2sms_live
    ? "LIVE MODE: Fast2SMS Indian SMS Gateway active -- real SMS will be delivered to Indian (+91) numbers."
    : "DEMO SIMULATION MODE: Fast2SMS sandbox active -- realistic dispatch receipts generated for hackathon demo.";
  banner.style.color = health.fast2sms_live ? "var(--risk-low)" : "var(--risk-moderate)";

  const massBtn = document.getElementById("btnMassBroadcast");
  if (massBtn) {
    massBtn.onclick = async () => {
      massBtn.disabled = true;
      massBtn.innerHTML = "<span>⏳</span> BROADCASTING TO ALL HIGH/SEVERE SECTORS...";
      const { districts } = await api(`/api/risk?rainfall=${state.rainfall}&soil=${state.soil}`);
      const critical = districts.filter((d) => d.risk_label === "High" || d.risk_label === "Severe");
      const lang = document.getElementById("langSelect").value || "English";

      let sent = 0;
      for (const d of critical) {
        await apiPost("/api/alerts/send", { district: d.district, risk: d.risk_label, language: lang, phone: "9876543210" });
        sent++;
      }
      massBtn.disabled = false;
      massBtn.innerHTML = `<span>✅</span> BROADCAST COMPLETED (${sent} DISTRICTS ALERTED)`;
      setTimeout(() => {
        massBtn.innerHTML = `<span>🚨</span> MASS EMERGENCY BROADCAST &mdash; DISPATCH TO ALL HIGH/SEVERE DISTRICTS`;
      }, 3500);
      loadDispatchLog();
    };
  }

  const { districts } = await api(`/api/risk?rainfall=${state.rainfall}&soil=${state.soil}`);
  const critical = districts.filter((d) => d.risk_label === "High" || d.risk_label === "Severe");
  const lang = document.getElementById("langSelect").value || "English";

  const cards = await Promise.all(
    critical.map(async (d) => {
      const { message } = await api(`/api/alert-text?district=${encodeURIComponent(d.district)}&risk=${d.risk_label}&language=${lang}`);
      return `
        <div class="alert-card ${d.risk_label}" data-district="${d.district}" data-risk="${d.risk_label}">
          <div class="alert-row">
            <div class="risk-card-title">${d.district} <span class="risk-badge">${d.risk_label}</span></div>
          </div>
          <div class="alert-msg">${message}</div>
          <div class="phone-row">
            <input class="phone-input" placeholder="98XXXXXXXX (Indian 10-digit)" value="9876543210" />
            <button class="btn btn-send">Dispatch SMS</button>
          </div>
          <div class="send-result"></div>
        </div>`;
    })
  );

  document.getElementById("alertList").innerHTML = cards.length
    ? cards.join("")
    : `<div class="risk-meta">No districts currently at High or Severe risk. Adjust sliders to test escalation.</div>`;

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

async function loadDispatchLog() {
  const { log } = await api("/api/alerts/log");
  document.getElementById("dispatchLog").innerHTML = log.length
    ? log
        .slice(0, 15)
        .map(
          (l) => `
      <div class="report-item">
        <b>${l.district}</b> <span class="ts">${l.timestamp}</span><br>
        <span style="color:var(--text-muted)">${l.status} &middot; ${l.language} &middot; ${l.phone || "no phone"}</span>
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

window.addEventListener("DOMContentLoaded", async () => {
  initNav();
  initMap();
  initSliders();
  initRoadFilters();
  initFieldReport();
  await checkHealth();
  await initLanguages();
  await loadDashboard();
});
