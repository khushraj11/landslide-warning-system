"""
Offline Emergency SOS Relay module with LoRa Mesh & RF Simulation.

Implements the SOS data model, server-side validation, duplicate- and
hop-count-protected store-and-forward logic, and the LoRa Mesh relay
simulation (India IN865 band, SF10, multi-hop mountain topology).
"""
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import pandas as pd
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, field_validator

from comm_layer import (
    LoRaMeshSimulatorAdapter,
    calculate_lora_airtime,
    generate_lora_packet_hex,
)

router = APIRouter(prefix="/api/sos", tags=["sos"])

SOS_LOG_FILE = "data/sos_log.csv"
MAX_HOPS_ALLOWED = 20
MAX_MESSAGE_LENGTH = 500
MAX_PEOPLE_AFFECTED = 10000
MESSAGE_TTL_HOURS = 24

VALID_SEVERITIES = {"LOW", "MODERATE", "HIGH", "CRITICAL"}

_sos_store: dict = {}


def _load_store():
    if os.path.exists(SOS_LOG_FILE):
        try:
            df = pd.read_csv(SOS_LOG_FILE, keep_default_na=False)
            for _, row in df.iterrows():
                _sos_store[row["message_id"]] = row.to_dict()
        except Exception:
            pass


_load_store()


def _persist_store():
    os.makedirs("data", exist_ok=True)
    if _sos_store:
        # Exclude complex lists/dicts if saving to simple CSV, or serialize them safely
        clean_rows = []
        for v in _sos_store.values():
            row = dict(v)
            if "hop_history" in row and isinstance(row["hop_history"], (list, dict)):
                del row["hop_history"]
            clean_rows.append(row)
        pd.DataFrame(clean_rows).to_csv(SOS_LOG_FILE, index=False)


class SOSCreate(BaseModel):
    device_id: str
    type: str = "LANDSLIDE_SOS"
    latitude: float
    longitude: float
    people_affected: int = 1
    severity: str = "CRITICAL"
    message: Optional[str] = ""
    max_hops: int = 8

    @field_validator("latitude")
    @classmethod
    def valid_lat(cls, v):
        if not (-90 <= v <= 90):
            raise ValueError("latitude out of range")
        return v

    @field_validator("longitude")
    @classmethod
    def valid_lon(cls, v):
        if not (-180 <= v <= 180):
            raise ValueError("longitude out of range")
        return v

    @field_validator("severity")
    @classmethod
    def valid_severity(cls, v):
        v = v.upper()
        if v not in VALID_SEVERITIES:
            raise ValueError(f"severity must be one of {sorted(VALID_SEVERITIES)}")
        return v

    @field_validator("people_affected")
    @classmethod
    def valid_people(cls, v):
        if v < 0 or v > MAX_PEOPLE_AFFECTED:
            raise ValueError("people_affected out of allowed range")
        return v

    @field_validator("message")
    @classmethod
    def valid_message(cls, v):
        if v and len(v) > MAX_MESSAGE_LENGTH:
            raise ValueError(f"message exceeds {MAX_MESSAGE_LENGTH} characters")
        return v

    @field_validator("max_hops")
    @classmethod
    def valid_max_hops(cls, v):
        if v < 1 or v > MAX_HOPS_ALLOWED:
            raise ValueError(f"max_hops must be between 1 and {MAX_HOPS_ALLOWED}")
        return v


class SOSSyncItem(BaseModel):
    message_id: str
    device_id: str
    type: str = "LANDSLIDE_SOS"
    latitude: float
    longitude: float
    people_affected: int = 1
    severity: str = "CRITICAL"
    message: Optional[str] = ""
    max_hops: int = 8
    client_timestamp: str


def _new_message_id() -> str:
    return f"SOS-{uuid.uuid4().hex[:6].upper()}"


def _validate_hop_count(hop_count: int, max_hops: int):
    if hop_count < 0 or hop_count > max_hops or hop_count > MAX_HOPS_ALLOWED:
        raise HTTPException(status_code=400, detail="invalid hop_count")


def _is_expired(record: dict) -> bool:
    try:
        ts = datetime.strptime(str(record["timestamp"]), "%Y-%m-%d %H:%M:%S")
        return datetime.now() - ts > timedelta(hours=MESSAGE_TTL_HOURS)
    except Exception:
        return False


def create_sos_record(payload: SOSCreate, message_id: Optional[str] = None, source: str = "online") -> dict:
    mid = message_id or _new_message_id()

    if mid in _sos_store:
        return _sos_store[mid]

    raw_hex = generate_lora_packet_hex(
        mid, payload.latitude, payload.longitude, payload.severity, payload.people_affected
    )
    airtime = calculate_lora_airtime(payload_bytes=32, sf=10, bw_khz=125)

    record = {
        "message_id": mid,
        "device_id": payload.device_id,
        "type": payload.type,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "people_affected": payload.people_affected,
        "severity": payload.severity,
        "message": payload.message or "",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "hop_count": 0,
        "max_hops": payload.max_hops,
        "status": "RECEIVED_BY_GATEWAY" if source == "online" else "OFFLINE_STORED",
        "source": source,
        "current_hop_label": "Node A: Stranded Citizen / Sensor (Origin)",
        # LoRa RF Telemetry
        "lora_band": "IN865 (India ISM)",
        "lora_frequency_mhz": 865.200,
        "lora_sf": 10,
        "lora_bw_khz": 125,
        "lora_cr": "4/5",
        "lora_airtime_ms": airtime,
        "lora_packet_hex": raw_hex,
        "rssi_dbm": -84,
        "snr_db": +8.2,
        "current_node_callsign": "LORA-NODE-CITIZEN",
        "current_node_role": "Originator Beacon",
        "current_node_lat": payload.latitude,
        "current_node_lon": payload.longitude,
        "hop_history": [
            {
                "hop_index": 0,
                "callsign": "LORA-NODE-CITIZEN",
                "role": "Originator Beacon",
                "label": "Node A: Stranded Citizen / Sensor (Origin)",
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "rssi_dbm": -84,
                "snr_db": +8.2,
                "status": "OFFLINE_STORED",
            }
        ],
    }
    _sos_store[mid] = record
    _persist_store()
    return record


class SOSBroadcaster:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


broadcaster = SOSBroadcaster()
relay_adapter = LoRaMeshSimulatorAdapter(hop_delay_seconds=0.7)


@router.post("")
def submit_sos(payload: SOSCreate):
    return create_sos_record(payload, source="online")


@router.get("/lora-info")
def get_lora_info():
    """Returns technical specs of the LoRa Mesh mountain survivability network."""
    return {
        "network_name": "Sentinel Himalayan LoRa Mesh",
        "standard": "IN865 (India ISM Sub-GHz)",
        "frequency_mhz": 865.2,
        "modulation": "Chirp Spread Spectrum (CSS)",
        "spreading_factor": "SF10 (High Sensitivity / Rain Penetration)",
        "bandwidth_khz": 125,
        "coding_rate": "4/5",
        "tx_power_dbm": 14,
        "packet_payload_bytes": 32,
        "estimated_airtime_ms": 246.2,
        "link_budget_db": 148,
        "topology": "Ad-Hoc Multi-Hop Mountain Relay",
    }


@router.post("/sync")
def sync_offline_sos(items: List[SOSSyncItem]):
    results = []
    for item in items:
        if item.message_id in _sos_store:
            existing = _sos_store[item.message_id]
            existing["status"] = "DELIVERED"
            _persist_store()
            results.append(existing)
            continue

        try:
            create_payload = SOSCreate(
                device_id=item.device_id, type=item.type,
                latitude=item.latitude, longitude=item.longitude,
                people_affected=item.people_affected, severity=item.severity,
                message=item.message, max_hops=item.max_hops,
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        record = create_sos_record(create_payload, message_id=item.message_id, source="offline-sync")
        record["status"] = "DELIVERED"
        _persist_store()
        results.append(record)
    return {"synced": results}


@router.post("/relay/{message_id}")
async def relay_hop(message_id: str):
    if message_id not in _sos_store:
        raise HTTPException(status_code=404, detail="unknown message_id")
    record = _sos_store[message_id]
    new_hop = record["hop_count"] + 1
    _validate_hop_count(new_hop, record["max_hops"])
    record["hop_count"] = new_hop
    record["status"] = "RELAYING" if new_hop < record["max_hops"] else "RECEIVED_BY_GATEWAY"
    _persist_store()
    await broadcaster.broadcast({"event": "relay", "record": record})
    return record


@router.post("/simulate-relay/{message_id}")
async def simulate_relay(message_id: str):
    """
    Runs the full LoRa Mesh hop-by-hop relay simulation:
    Citizen Node -> Ridge Repeater -> Valley Relay -> NDRF Gateway -> Central SEOC.
    Broadcasts real-time RF metrics (RSSI, SNR, Callsign, Coordinates) over WebSocket.
    """
    if message_id not in _sos_store:
        raise HTTPException(status_code=404, detail="unknown message_id")
    record = _sos_store[message_id]

    async def on_hop(updated):
        record.update(updated)
        _persist_store()
        await broadcaster.broadcast({"event": "relay_hop", "record": dict(record)})

    relay_adapter.set_receive_callback(on_hop)
    await relay_adapter.send(record)
    return record


@router.get("/active")
def list_active_sos():
    active = []
    for record in list(_sos_store.values()):
        if _is_expired(record):
            record["status"] = "EXPIRED"
            continue
        active.append(record)
    active.sort(key=lambda r: str(r.get("timestamp", "")), reverse=True)
    return {"sos": active}


@router.websocket("/ws")
async def sos_websocket(websocket: WebSocket):
    await broadcaster.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)
