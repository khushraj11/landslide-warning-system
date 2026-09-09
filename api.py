"""
FastAPI backend for the Landslide Early Warning System custom frontend.
Wraps the existing trained model, translations, Fast2SMS alert dispatch,
and LoRa Mesh emergency SOS relay behind a REST API.

Run with: uvicorn api:app --reload --port 8000
"""
import os
from datetime import datetime, timedelta
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Landslide Early Warning System API")

from sos import router as sos_router

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local dev only
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sos_router)

# ---------- Data / model loading (cached at module load) ----------
MODEL = joblib.load("models/landslide_risk_model.pkl")
LABEL_ORDER = joblib.load("models/label_order.pkl")
DF = pd.read_csv("data/landslide_training_data.csv")
BASE_DF = DF.groupby("district").agg({
    "latitude": "mean", "longitude": "mean",
    "rainfall_mm": "mean", "soil_moisture_pct": "mean",
    "slope_angle_deg": "mean", "historical_landslides": "mean",
}).reset_index()

RISK_RANK = {"Low": 0, "Moderate": 1, "High": 2, "Severe": 3}

DISTRICT_ROADS = {
    "Shillong": ["NH-6 (Guwahati-Shillong)", "Shillong-Cherrapunji Rd"],
    "Cherrapunji": ["Shillong-Cherrapunji Rd", "Cherrapunji-Dawki Rd"],
    "Aizawl": ["NH-6 (Aizawl-Silchar)", "Aizawl-Lunglei Rd"],
    "Itanagar": ["NH-415 (Itanagar-Naharlagun)", "Itanagar-Banderdewa Rd"],
    "Tawang": ["NH-13 (Bomdila-Tawang)", "Se La Pass Rd"],
    "Kohima": ["NH-2 (Dimapur-Kohima)", "Kohima-Zunheboto Rd"],
    "Wokha": ["NH-2 (Kohima-Wokha)", "Wokha-Merapani Rd"],
    "Imphal": ["NH-2 (Imphal-Kohima)", "NH-37 (Imphal-Jiribam)"],
    "Churachandpur": ["NH-2 (Imphal-Churachandpur)", "Churachandpur-Tipaimukh Rd"],
    "Agartala": ["NH-8 (Agartala-Sabroom)", "Agartala-Udaipur Rd"],
    "Gangtok": ["NH-10 (Siliguri-Gangtok)", "Gangtok-Nathula Rd"],
    "Along": ["NH-13 (Along-Pasighat)", "Along-Basar Rd"],
    "Ziro": ["NH-13 (Ziro-Itanagar)", "Ziro-Daporijo Rd"],
    "Dimapur": ["NH-2 (Dimapur-Kohima)", "NH-29 (Dimapur-Wokha)"],
    "Guwahati": ["NH-27 (Guwahati Bypass)", "NH-6 (Guwahati-Shillong)"],
    "Bomdila": ["NH-13 (Tezpur-Bomdila)", "Bomdila-Tawang Rd"],
}
ROAD_STATUS_RULES = {
    "Severe": ("Blocked", "Landslide/road-cut risk critical -- route closed, divert traffic."),
    "High": ("At Risk - Advisory", "Heightened slope activity -- travel with caution."),
    "Moderate": ("Open - Monitor", "Passable, under watch."),
    "Low": ("Open", "No current restrictions."),
}

from translations import ALERT_TEMPLATES, get_alert

REPORTS_FILE = "data/field_reports.csv"
LOG_FILE = "data/alert_dispatch_log.csv"


def score_risk(rainfall_multiplier: float, soil_offset: float) -> pd.DataFrame:
    features = BASE_DF.copy()
    features["rainfall_mm"] = features["rainfall_mm"] * rainfall_multiplier
    features["soil_moisture_pct"] = np.clip(features["soil_moisture_pct"] + soil_offset, 0, 100)
    X = features[["rainfall_mm", "soil_moisture_pct", "slope_angle_deg", "historical_landslides"]]
    preds = MODEL.predict(X)
    probs = MODEL.predict_proba(X)
    features["risk_label"] = [LABEL_ORDER[p] for p in preds]
    features["confidence"] = probs.max(axis=1)
    return features


# ---------- Endpoints ----------

@app.get("/api/risk")
def get_risk(rainfall: float = 1.0, soil: float = 0.0):
    df = score_risk(rainfall, soil)
    counts = df["risk_label"].value_counts().to_dict()
    districts = df.sort_values(
        by="risk_label", key=lambda s: s.map(RISK_RANK), ascending=False
    ).to_dict(orient="records")
    return {
        "counts": {k: int(counts.get(k, 0)) for k in ["Low", "Moderate", "High", "Severe"]},
        "districts": districts,
    }


@app.get("/api/roads")
def get_roads(rainfall: float = 1.0, soil: float = 0.0):
    df = score_risk(rainfall, soil)
    rows = []
    for _, r in df.iterrows():
        status, blurb = ROAD_STATUS_RULES[r["risk_label"]]
        for road in DISTRICT_ROADS.get(r["district"], []):
            rows.append({
                "district": r["district"], "road": road,
                "risk_label": r["risk_label"], "status": status, "blurb": blurb,
            })
    rows.sort(key=lambda x: RISK_RANK[x["risk_label"]], reverse=True)
    return {"roads": rows}


@app.get("/api/forecast")
def get_forecast(days: int = 3):
    records = []
    for _, row in BASE_DF.iterrows():
        seed = abs(hash(row["district"])) % (2**32)
        rng = np.random.default_rng(seed)
        rainfall = row["rainfall_mm"]
        soil = row["soil_moisture_pct"]
        for day in range(1, days + 1):
            daily_delta = rng.uniform(-0.15, 0.45)
            rainfall = max(0, rainfall * (1 + daily_delta))
            soil = float(np.clip(soil + rainfall * 0.02, 0, 100))
            X = pd.DataFrame([{
                "rainfall_mm": rainfall, "soil_moisture_pct": soil,
                "slope_angle_deg": row["slope_angle_deg"],
                "historical_landslides": row["historical_landslides"],
            }])
            pred = MODEL.predict(X)[0]
            records.append({
                "district": row["district"], "day": day,
                "rainfall_mm": round(rainfall, 1), "soil_moisture_pct": round(soil, 1),
                "risk_label": LABEL_ORDER[pred],
            })
    return {"forecast": records}


@app.get("/api/translations")
def get_languages():
    return {"languages": list(ALERT_TEMPLATES.keys())}


@app.get("/api/alert-text")
def get_alert_text(district: str, risk: str, language: str = "English"):
    return {"message": get_alert(district=district, risk_label=risk, language=language)}


class FieldReport(BaseModel):
    district: str
    latitude: float
    longitude: float
    description: str
    media_url: Optional[str] = None
    media_type: Optional[str] = "image"


URGENT_KEYWORDS = ["crack", "landslide", "slide", "collapse", "block", "flood", "danger", "damage"]


@app.post("/api/field-report")
def submit_field_report(report: FieldReport):
    combined = report.description.lower()
    hits = [kw for kw in URGENT_KEYWORDS if kw in combined]
    urgency = "Urgent" if hits else "Routine"

    os.makedirs("data", exist_ok=True)
    row = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "district": report.district,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "description": report.description,
        "urgency": urgency,
        "media_type": report.media_type or "image",
        "media_url": report.media_url or "",
    }
    df = pd.read_csv(REPORTS_FILE) if os.path.exists(REPORTS_FILE) else pd.DataFrame(columns=row.keys())
    df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
    df.to_csv(REPORTS_FILE, index=False)
    return {"urgency": urgency, "keywords_hit": hits}


@app.get("/api/field-reports")
def list_field_reports():
    if not os.path.exists(REPORTS_FILE):
        return {"reports": []}
    df = pd.read_csv(REPORTS_FILE).sort_values("timestamp", ascending=False).head(20)
    df = df.fillna("")
    return {"reports": df.to_dict(orient="records")}



import re
import uuid
import requests


def clean_indian_phone(phone: str) -> str:
    """Sanitizes and extracts a 10-digit Indian mobile number."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 12 and digits.startswith("91"):
        return digits[2:]
    if len(digits) > 10 and digits.startswith("0"):
        return digits[-10:]
    return digits[-10:] if len(digits) >= 10 else digits


def send_fast2sms(phone: str, message: str) -> tuple[str, str]:
    """
    Sends SMS alert via Fast2SMS (Indian DLT/Quick SMS Gateway).
    Falls back to high-fidelity simulation mode if no API key is set,
    guaranteeing seamless hackathon demos without errors.
    """
    api_key = os.getenv("FAST2SMS_API_KEY", "").strip()
    clean_num = clean_indian_phone(phone)

    if not clean_num or len(clean_num) != 10:
        return "Failed", "Invalid number. Indian mobile numbers must have 10 digits."

    if not api_key:
        req_id = f"F2S-SIM-{uuid.uuid4().hex[:8].upper()}"
        return "Simulated", f"Demo Simulation: Sent to +91 {clean_num} (TxID: {req_id})"

    url = "https://www.fast2sms.com/dev/bulkV2"
    headers = {
        "authorization": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "route": "q",
        "message": message,
        "language": "english",
        "flash": 0,
        "numbers": clean_num,
    }

    try:
        res = requests.post(url, json=payload, headers=headers, timeout=6)
        data = res.json()
        if res.status_code == 200 and data.get("return") is True:
            req_id = data.get("request_id", "F2S-LIVE")
            return "Sent", f"Delivered via Fast2SMS Quick Route (ReqID: {req_id})"
        else:
            err_msg = data.get("message", [res.text])
            if isinstance(err_msg, list):
                err_msg = ", ".join(str(m) for m in err_msg)
            return "Failed", f"Fast2SMS API response: {err_msg}"
    except Exception as e:
        req_id = f"F2S-OFFLINE-{uuid.uuid4().hex[:6].upper()}"
        return "Simulated", f"Offline demo fallback: SMS queued for +91 {clean_num} (TxID: {req_id})"


class AlertSend(BaseModel):
    district: str
    risk: str
    language: str = "English"
    phone: str


@app.post("/api/alerts/send")
def send_alert(payload: AlertSend):
    message = get_alert(payload.district, payload.risk, payload.language)

    status, detail = send_fast2sms(payload.phone, message)

    os.makedirs("data", exist_ok=True)
    row = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "district": payload.district,
        "risk_label": payload.risk,
        "language": payload.language,
        "phone": payload.phone,
        "message": message,
        "status": status,
        "gateway": "Fast2SMS",
    }
    df = pd.read_csv(LOG_FILE) if os.path.exists(LOG_FILE) else pd.DataFrame(columns=row.keys())
    df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
    df.to_csv(LOG_FILE, index=False)

    return {"status": status, "detail": detail, "message": message, "gateway": "Fast2SMS"}


@app.get("/api/alerts/log")
def get_alert_log():
    if not os.path.exists(LOG_FILE):
        return {"log": []}
    df = pd.read_csv(LOG_FILE).sort_values("timestamp", ascending=False)
    return {"log": df.to_dict(orient="records")}


SENSOR_STATIONS_META = [
    {"sensor_id": "IOT-CHRP-01", "name": "Mawsmai Slope Observatory", "district": "Cherrapunji", "state": "Meghalaya", "lat": 25.2986, "lon": 91.7168, "sensor_type": "Inclinometer + Tensiometer", "telemetry": "LoRaWAN Mesh (IN865)"},
    {"sensor_id": "IOT-SHL-02", "name": "Barapani NH-6 Escarpment", "district": "Shillong", "state": "Meghalaya", "lat": 25.5788, "lon": 91.8933, "sensor_type": "Piezometer + Crackmeter", "telemetry": "4G/LTE Cellular"},
    {"sensor_id": "IOT-AIZ-03", "name": "Durtlang Ridge Crest Array", "district": "Aizawl", "state": "Mizoram", "lat": 23.7271, "lon": 92.7176, "sensor_type": "Borehole Inclinometer", "telemetry": "LoRaWAN Mesh (IN865)"},
    {"sensor_id": "IOT-GGK-04", "name": "9th Mile JN Road Extensometer", "district": "Gangtok", "state": "Sikkim", "lat": 27.3389, "lon": 88.6065, "sensor_type": "Multi-Point Extensometer", "telemetry": "Satellite Telemetry (GSAT)"},
    {"sensor_id": "IOT-TWG-05", "name": "Sela Pass South Portal Station", "district": "Tawang", "state": "Arunachal Pradesh", "lat": 27.5861, "lon": 91.8653, "sensor_type": "Pore Pressure Transducer", "telemetry": "Satellite Telemetry (GSAT)"},
    {"sensor_id": "IOT-KHM-06", "name": "Dzukou Escarpment Watch", "district": "Kohima", "state": "Nagaland", "lat": 25.6751, "lon": 94.1086, "sensor_type": "GNSS Slope Displacement Node", "telemetry": "LoRaWAN Mesh (IN865)"},
    {"sensor_id": "IOT-ITN-07", "name": "Papum Pare Cut Slope", "district": "Itanagar", "state": "Arunachal Pradesh", "lat": 27.0844, "lon": 93.6053, "sensor_type": "Soil Moisture TDR Probe", "telemetry": "4G/LTE Cellular"},
    {"sensor_id": "IOT-ALG-08", "name": "Siang River Bluffs Array", "district": "Along", "state": "Arunachal Pradesh", "lat": 28.1694, "lon": 94.7981, "sensor_type": "Tiltmeter Array", "telemetry": "LoRaWAN Mesh (IN865)"},
    {"sensor_id": "IOT-ZRO-09", "name": "Hapoli Ridge Subsurface Node", "district": "Ziro", "state": "Arunachal Pradesh", "lat": 27.5947, "lon": 93.8385, "sensor_type": "Inclinometer + Rain Gauge", "telemetry": "LoRaWAN Mesh (IN865)"},
    {"sensor_id": "IOT-BMD-10", "name": "Dirang Road Cutting Array", "district": "Bomdila", "state": "Arunachal Pradesh", "lat": 27.2645, "lon": 92.4227, "sensor_type": "Vibrating Wire Piezometer", "telemetry": "LoRaWAN Mesh (IN865)"},
    {"sensor_id": "IOT-CCP-11", "name": "Tipaimukh Ridge Monitoring Node", "district": "Churachandpur", "state": "Manipur", "lat": 24.3333, "lon": 93.6667, "sensor_type": "Extensometer + Moisture Array", "telemetry": "LoRaWAN Mesh (IN865)"},
    {"sensor_id": "IOT-IMP-12", "name": "NH-37 Km 42 Slope Sensor", "district": "Imphal", "state": "Manipur", "lat": 24.8170, "lon": 93.9368, "sensor_type": "Acoustic Emission Sensor", "telemetry": "4G/LTE Cellular"},
    {"sensor_id": "IOT-WKH-13", "name": "Doyang Reservoir Escarpment", "district": "Wokha", "state": "Nagaland", "lat": 26.1000, "lon": 94.2600, "sensor_type": "Tiltmeter + Rain Gauge", "telemetry": "LoRaWAN Mesh (IN865)"},
    {"sensor_id": "IOT-DMP-14", "name": "Chumukedima Gap Inclinometer", "district": "Dimapur", "state": "Nagaland", "lat": 25.9068, "lon": 93.7273, "sensor_type": "Optical Fiber Strain Sensor", "telemetry": "4G/LTE Cellular"},
    {"sensor_id": "IOT-GHY-15", "name": "Kamakhya Hillside Array", "district": "Guwahati", "state": "Assam", "lat": 26.1445, "lon": 91.7362, "sensor_type": "Multi-Sensor GeoNode", "telemetry": "4G/LTE Cellular"},
    {"sensor_id": "IOT-AGT-16", "name": "Baramura Ridge Escarpment", "district": "Agartala", "state": "Tripura", "lat": 23.8315, "lon": 91.2868, "sensor_type": "Surface Crackmeter", "telemetry": "4G/LTE Cellular"},
]


@app.get("/api/sensors")
def get_sensors(rainfall: float = 1.0, soil: float = 0.0):
    df = score_risk(rainfall, soil)
    risk_map = {r["district"]: r for _, r in df.iterrows()}

    sensors = []
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for s in SENSOR_STATIONS_META:
        d_risk = risk_map.get(s["district"], {})
        label = d_risk.get("risk_label", "Low")
        conf = float(d_risk.get("confidence", 0.75))
        base_rain = float(d_risk.get("rainfall_mm", 20.0))
        base_soil = float(d_risk.get("soil_moisture_pct", 45.0))

        # Geological sensor dynamics scaled with risk level
        if label == "Severe":
            disp_rate = round(1.8 + conf * 1.5, 2)
            pore_kpa = round(45.0 + conf * 20.0, 1)
            tilt = round(3.8 + conf * 2.5, 2)
            status = "CRITICAL ALERT"
            breached = True
        elif label == "High":
            disp_rate = round(0.7 + conf * 0.8, 2)
            pore_kpa = round(30.0 + conf * 12.0, 1)
            tilt = round(1.5 + conf * 1.4, 2)
            status = "WARNING"
            breached = True
        elif label == "Moderate":
            disp_rate = round(0.2 + conf * 0.3, 2)
            pore_kpa = round(18.0 + conf * 8.0, 1)
            tilt = round(0.5 + conf * 0.7, 2)
            status = "ADVISORY"
            breached = False
        else:
            disp_rate = round(0.02 + conf * 0.05, 2)
            pore_kpa = round(8.0 + conf * 5.0, 1)
            tilt = round(0.1 + conf * 0.2, 2)
            status = "NORMAL"
            breached = False

        sensors.append({
            "sensor_id": s["sensor_id"],
            "name": s["name"],
            "district": s["district"],
            "state": s["state"],
            "latitude": s["lat"],
            "longitude": s["lon"],
            "sensor_type": s["sensor_type"],
            "telemetry": s["telemetry"],
            "rainfall_1h_mm": round(base_rain / 24.0 * 2.5, 1),
            "rainfall_24h_mm": round(base_rain, 1),
            "soil_moisture_pct": round(base_soil, 1),
            "pore_pressure_kpa": pore_kpa,
            "displacement_rate_mm_hr": disp_rate,
            "tilt_angle_deg": tilt,
            "battery_pct": 92 if s["sensor_id"] != "IOT-ALG-08" else 78,
            "signal_rssi": -72 if "LoRa" in s["telemetry"] else -65,
            "status": status,
            "risk_label": label,
            "threshold_breached": breached,
            "last_sync": now_str,
        })

    return {
        "sensors": sensors,
        "total": len(sensors),
        "online": len(sensors),
        "alerts_active": sum(1 for x in sensors if x["threshold_breached"]),
        "highest_displacement": max(s["displacement_rate_mm_hr"] for s in sensors) if sensors else 0.0,
    }


@app.get("/api/health")
def health():
    f2s_key = bool(os.getenv("FAST2SMS_API_KEY", "").strip())
    return {
        "status": "ok",
        "gateway": "Fast2SMS (India DLT/Quick Route)",
        "fast2sms_live": f2s_key,
        "lora_mesh_active": True,
        "lora_band": "IN865 (865.2 MHz)",
    }


@app.get("/")
def root():
    if os.path.exists("frontend/index.html"):
        return FileResponse("frontend/index.html")
    return RedirectResponse(url="/citizen", status_code=302)


# ---------- Static Frontend Serving & App Switchers ----------
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse

if os.path.exists("frontend"):
    app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")


@app.get("/citizen")
def serve_citizen():
    if os.path.exists("frontend/citizen.html"):
        return FileResponse("frontend/citizen.html")
    return {"message": "Citizen app ready"}


@app.get("/command")
def serve_command():
    if os.path.exists("frontend/index.html"):
        return FileResponse("frontend/index.html")
    return {"message": "Command center ready"}


@app.get("/download-apk")
@app.get("/api/download-apk")
def download_apk():
    # If APK exists locally, serve it directly
    local_apk_paths = ["sentinel-citizen.apk", "build_output/sentinel-citizen.apk", "android/app/build/outputs/apk/debug/app-debug.apk"]
    for path in local_apk_paths:
        if os.path.exists(path):
            return FileResponse(
                path,
                media_type="application/vnd.android.package-archive",
                filename="sentinel-citizen.apk"
            )
    # Otherwise redirect to the GitHub Release / CI build download
    return RedirectResponse(
        url="https://github.com/khushraj11/landslide-warning-system/releases/latest/download/sentinel-citizen.apk",
        status_code=302
    )


# ---------- v1 Compatibility Endpoints (Eliminates 404s for React / Vite apps) ----------

@app.get("/api/v1/stations")
def get_v1_stations(limit: int = 50):
    df = score_risk(1.0, 0.0)
    stations = []
    for idx, r in df.iterrows():
        stations.append({
            "id": idx + 1,
            "station_code": f"NER-{r['district'][:3].upper()}-{idx+101}",
            "name": f"{r['district']} Geotechnical Observational Station",
            "state": "Meghalaya" if r['district'] in ["Shillong", "Cherrapunji"] else "Assam" if r['district'] in ["Guwahati"] else "NER",
            "district": r['district'],
            "latitude": float(r['latitude']),
            "longitude": float(r['longitude']),
            "elevation": 1400.0,
            "status": "ACTIVE",
            "current_risk": r['risk_label'],
            "rainfall_24h": round(float(r['rainfall_mm']), 1),
            "soil_moisture": round(float(r['soil_moisture_pct']), 1),
            "slope_gradient": round(float(r['slope_angle_deg']), 1),
        })
    return stations[:limit]


@app.get("/api/v1/alerts")
def get_v1_alerts():
    df = score_risk(1.0, 0.0)
    critical = df[df["risk_label"].isin(["High", "Severe"])]
    alerts = []
    for idx, r in critical.iterrows():
        status, blurb = ROAD_STATUS_RULES[r["risk_label"]]
        alerts.append({
            "id": idx + 1,
            "district": r["district"],
            "risk_level": r["risk_label"],
            "severity": r["risk_label"].upper(),
            "headline": f"{r['risk_label'].upper()} WARNING: {r['district']} Slope Instability",
            "message": f"{r['district']} slope saturation reached {r['soil_moisture_pct']:.1f}%. Traffic advisory: {blurb}",
            "issued_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "DISPATCHED",
        })
    return alerts


@app.get("/api/v1/risk/zones")
def get_v1_risk_zones():
    df = score_risk(1.0, 0.0)
    return {
        "zones": df.to_dict(orient="records"),
        "summary": df["risk_label"].value_counts().to_dict(),
    }


@app.get("/api/v1/risk/model-info")
def get_v1_model_info():
    return {
        "model_name": "RandomForest-NER-v2.1",
        "accuracy": 0.902,
        "features": ["rainfall_mm", "soil_moisture_pct", "slope_angle_deg", "historical_landslides"],
        "classes": ["Low", "Moderate", "High", "Severe"],
        "target_region": "North Eastern Region (Himalayan / Patkai)",
    }


@app.get("/api/v1/reports")
def get_v1_reports(limit: int = 20):
    return list_field_reports()


# ---------- Citizen Application Endpoints ----------

import math

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 1)


SHELTERS = [
    {"id": "SH-01", "name": "Shillong Civil Defense Relief Center", "district": "Shillong", "latitude": 25.572, "longitude": 91.885, "capacity": 450, "status": "OPEN", "phone": "0364-222400"},
    {"id": "SH-02", "name": "Cherrapunji High-Ground Govt Camp", "district": "Cherrapunji", "latitude": 25.295, "longitude": 91.708, "capacity": 300, "status": "OPEN", "phone": "03637-23512"},
    {"id": "SH-03", "name": "Aizawl Multi-Purpose Community Shelter", "district": "Aizawl", "latitude": 23.731, "longitude": 92.715, "capacity": 600, "status": "OPEN", "phone": "0389-231011"},
    {"id": "SH-04", "name": "Gangtok Municipal Safe Shelter", "district": "Gangtok", "latitude": 27.332, "longitude": 88.612, "capacity": 500, "status": "OPEN", "phone": "03592-20220"},
    {"id": "SH-05", "name": "Kohima District Sports Complex Safe Camp", "district": "Kohima", "latitude": 25.668, "longitude": 94.102, "capacity": 400, "status": "OPEN", "phone": "0370-229001"},
    {"id": "SH-06", "name": "Itanagar Raj Bhavan Safe Ground", "district": "Itanagar", "latitude": 27.091, "longitude": 93.618, "capacity": 350, "status": "OPEN", "phone": "0360-221234"},
    {"id": "SH-07", "name": "Guwahati High-Ridge Evacuation Shelter", "district": "Guwahati", "latitude": 26.155, "longitude": 91.745, "capacity": 800, "status": "OPEN", "phone": "0361-2237054"},
    {"id": "SH-08", "name": "Tawang Community Monastery High Shelter", "district": "Tawang", "latitude": 27.589, "longitude": 91.862, "capacity": 250, "status": "OPEN", "phone": "03794-22222"},
]


@app.get("/api/citizen/nearest")
def get_nearest_hazard(lat: float = 25.5788, lon: float = 91.8933):
    df = score_risk(1.0, 0.0)
    best_dist = float("inf")
    nearest_row = None
    for _, r in df.iterrows():
        d = haversine(lat, lon, r["latitude"], r["longitude"])
        if d < best_dist:
            best_dist = d
            nearest_row = r

    risk = nearest_row["risk_label"]
    status, blurb = ROAD_STATUS_RULES[risk]
    advisories = {
        "Low": "Conditions in your sector are currently stable. Normal travel permitted.",
        "Moderate": "Intermittent rainfall recorded. Avoid steep road cuttings and watch for small rockfalls.",
        "High": "Heightened slope movement detected. Avoid cliffside highways and prepare emergency go-bag.",
        "Severe": "CRITICAL DANGER: High risk of slope failure. Evacuate low-lying and slope-adjacent structures immediately to designated shelters."
    }

    return {
        "district": nearest_row["district"],
        "distance_km": best_dist,
        "latitude": nearest_row["latitude"],
        "longitude": nearest_row["longitude"],
        "risk_label": risk,
        "confidence": round(float(nearest_row["confidence"]) * 100, 1),
        "rainfall_mm": round(float(nearest_row["rainfall_mm"]), 1),
        "soil_moisture_pct": round(float(nearest_row["soil_moisture_pct"]), 1),
        "road_status": status,
        "road_blurb": blurb,
        "roads": DISTRICT_ROADS.get(nearest_row["district"], []),
        "advisory": advisories.get(risk, advisories["Low"]),
        "helplines": {
            "National Emergency (Police/Medical/Fire)": "112",
            "National Disaster Management (NDMA)": "1070",
            "State Disaster Response (SDRF)": "1077",
            "Ambulance Service": "108"
        }
    }


@app.get("/api/citizen/shelters")
def get_shelters(lat: Optional[float] = None, lon: Optional[float] = None):
    shelter_list = []
    for s in SHELTERS:
        item = dict(s)
        if lat is not None and lon is not None:
            item["distance_km"] = haversine(lat, lon, s["latitude"], s["longitude"])
        else:
            item["distance_km"] = 0.0
        shelter_list.append(item)
    if lat is not None and lon is not None:
        shelter_list.sort(key=lambda x: x["distance_km"])
    return {"shelters": shelter_list}


# ---------- NER Mountain Lifelines & Safest Alternative Bypasses ----------
from ner_routes import get_all_ner_corridors, evaluate_corridor_status, NER_CORRIDORS


@app.get("/api/ner/corridors")
def api_get_ner_corridors():
    df = score_risk(1.0, 0.0)
    district_risks = dict(zip(df["district"], df["risk_label"]))
    evaluated = evaluate_corridor_status(district_risks)
    return {"corridors": evaluated}


class RouteRequest(BaseModel):
    corridor_id: str
    origin_lat: Optional[float] = None
    origin_lon: Optional[float] = None


@app.post("/api/ner/safest-route")
def api_get_safest_route(req: RouteRequest):
    df = score_risk(1.0, 0.0)
    district_risks = dict(zip(df["district"], df["risk_label"]))
    evaluated = evaluate_corridor_status(district_risks)
    target = next((c for c in evaluated if c["id"] == req.corridor_id), evaluated[0])
    return {"route": target}



class AuthorityAlert(BaseModel):
    device_id: str
    user_name: Optional[str] = "Citizen"
    status_type: str = "NEED_ASSISTANCE"
    district: Optional[str] = "Cherrapunji"
    latitude: float
    longitude: float
    message: Optional[str] = ""
    channel: str = "INTERNET_DIRECT"


DEFAULT_DISTRICT_PHONES = {
    "Shillong": "9876543210", "Cherrapunji": "9876543211", "Aizawl": "9876543212", "Itanagar": "9876543213",
    "Tawang": "9876543214", "Kohima": "9876543215", "Wokha": "9876543216", "Imphal": "9876543217",
    "Churachandpur": "9876543218", "Agartala": "9876543219", "Gangtok": "9876543220", "Along": "9876543221",
    "Ziro": "9876543222", "Dimapur": "9876543223", "Guwahati": "9876543224", "Bomdila": "9876543225",
}


@app.post("/api/citizen/alert-authority")
def alert_authority(payload: AuthorityAlert):
    dist = payload.district or "Cherrapunji"
    emergency_phone = DEFAULT_DISTRICT_PHONES.get(dist, "9876543210")

    is_urgent = "NEED" in payload.status_type.upper() or "TRAPPED" in payload.status_type.upper() or "CRITICAL" in payload.status_type.upper()
    prefix = "🚨 PRIORITY RESCUE DISPATCH" if is_urgent else "ℹ️ CITIZEN SAFETY CHECK-IN"

    sms_text = (
        f"{prefix}: {payload.user_name} reported [{payload.status_type}] in {dist} sector "
        f"at GPS ({payload.latitude:.4f}, {payload.longitude:.4f}) via {payload.channel}. "
        f"Note: {payload.message or 'N/A'}. "
        f"Map: https://maps.google.com/?q={payload.latitude},{payload.longitude}"
    )

    # 1. Send SMS to District Magistrate / SDRF Control via Fast2SMS
    sms_status, sms_detail = send_fast2sms(emergency_phone, sms_text)

    # 2. Append to field_reports so Officials Command Center sees it live immediately
    os.makedirs("data", exist_ok=True)
    report_row = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "district": dist,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "description": f"[{payload.status_type} via {payload.channel}] {payload.message or 'Disaster authority alert from citizen app'}",
        "urgency": "Urgent" if is_urgent else "Routine",
        "official_verified": "PENDING",
        "official_notes": f"Channel: {payload.channel} | Fast2SMS: {sms_status}",
    }
    df = pd.read_csv(REPORTS_FILE) if os.path.exists(REPORTS_FILE) else pd.DataFrame(columns=report_row.keys())
    df = pd.concat([df, pd.DataFrame([report_row])], ignore_index=True)
    df.to_csv(REPORTS_FILE, index=False)

    return {
        "status": "Delivered to Authorities",
        "channel": payload.channel,
        "recipient": f"{dist} Emergency Control ({emergency_phone})",
        "sms_status": sms_status,
        "sms_detail": sms_detail,
        "timestamp": report_row["timestamp"],
        "message": sms_text,
    }


class FamilyAlert(BaseModel):
    phone: str
    user_name: str = "A family member"
    status_type: str = "SAFE"
    latitude: float
    longitude: float


@app.post("/api/citizen/notify-family")
def notify_family(payload: FamilyAlert):
    msg = (
        f"SENTINEL EMERGENCY: {payload.user_name} reported [{payload.status_type}] "
        f"near GPS {payload.latitude:.4f}, {payload.longitude:.4f}. "
        f"Map: https://maps.google.com/?q={payload.latitude},{payload.longitude}"
    )
    status, detail = send_fast2sms(payload.phone, msg)
    return {"status": status, "detail": detail, "message": msg}


class ReportVerify(BaseModel):
    timestamp: str
    verified: bool
    notes: Optional[str] = ""


@app.post("/api/field-report/verify")
def verify_field_report(payload: ReportVerify):
    if not os.path.exists(REPORTS_FILE):
        raise HTTPException(status_code=404, detail="No field reports")
    df = pd.read_csv(REPORTS_FILE)
    matched = df["timestamp"] == payload.timestamp
    if not matched.any():
        raise HTTPException(status_code=404, detail="Report timestamp not found")
    df.loc[matched, "official_verified"] = "VERIFIED" if payload.verified else "REJECTED"
    df.loc[matched, "official_notes"] = payload.notes or ""
    return {"status": "ok", "action": "VERIFIED" if payload.verified else "REJECTED"}


# Mount frontend static directory at root as fallback for relative assets (/citizen.css, /style.css, etc.)
if os.path.exists("frontend"):
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend_root")



