# SENTINEL: AI-Powered Landslide Early Warning & Evacuation System (NER Sector)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![Leaflet GIS](https://img.shields.io/badge/GIS-Google%20Maps%20%2B%20Leaflet-4285F4.svg)](https://leafletjs.com)
[![LoRa Mesh](https://img.shields.io/badge/Mesh-LoRa%20IN865%20Offline-7952B3.svg)](https://lora-alliance.org)
[![Disaster Authority](https://img.shields.io/badge/Alerts-Fast2SMS%20National%20Gateway-FF5722.svg)](https://www.fast2sms.com)

SENTINEL is an end-to-end mission-critical disaster management architecture specifically engineered for the 8 North Eastern States (NER) of India (Sikkim, Meghalaya, Arunachal Pradesh, Nagaland, Mizoram, Assam, Manipur, Tripura).

---

## 🌟 Key Capabilities

### 1. 📱 Citizen Lifeline Mobile App (`/citizen`)
- **Google Maps Navigation Engine**: Real-time Google Streets, Satellite Hybrid, and Terrain layers with live blue GPS pulsing dot and directional flashlight cone.
- **NER Safe Geotechnical Bypass Routes**: Turn-by-turn navigation that routes citizens around active highway landslide choke points (e.g. Sikkim NH-10, Meghalaya NH-6, Arunachal NH-13, Nagaland NH-29, Mizoram NH-306) to high-ground relief camps.
- **Dual-Mode Offline SOS**: Automatic fallback from Fast2SMS Indian telecom gateway to simulated LoRa IN865 packet radio mesh whenever internet is disconnected.
- **High-Precision GNSS Telemetry**: Tracks GPS accuracy (±3.8 m), MSL elevation, heading bearing, and NavIC lock.

### 2. 🏛️ State Emergency Operations Center (SEOC) Command Center (`/command`)
- **Live GIS Command Map**: Real-time visualization of sensor telemetry, geotechnical risk zones, road blockage choke points, and evacuation buffer corridors.
- **Mass Emergency Broadcasts**: One-click broadcast dispatch via Fast2SMS DLT gateway to all affected districts.
- **Field Teams Dispatch & Tracking**: Coordinate SDRF, NDRF, and BRO (Border Roads Organisation) clearance teams.

---

## 🚀 Quickstart

### Prerequisites
- Python 3.10+
- Modern Web Browser (or Android Device for APK)

### Installation
```bash
git clone https://github.com/khushraj11/landslide-warning-system.git
cd landslide-warning-system

# Setup virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Run the Unified Server
```bash
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

- **Citizen Mobile Web App**: [http://localhost:8000/citizen](http://localhost:8000/citizen)
- **Officials Command Center**: [http://localhost:8000/command](http://localhost:8000/command)
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 📱 Android APK Generation

The repository includes:
1. **GitHub Actions CI/CD Pipeline** (`.github/workflows/build-apk.yml`) that automatically compiles `sentinel-citizen.apk` on every push.
2. **Progressive Web App (PWA)**: Open `http://<YOUR_IP>:8000/citizen` in Chrome on Android and tap **"Add to Home Screen"** for full-screen offline native app experience.
