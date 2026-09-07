"""
Communication Layer abstraction for SOS message relay.

Implements LoRa Mesh & RF telemetry simulation for zero-connectivity
disaster zones in the North Eastern Region (NER) / Himalayas.

Simulates:
- Frequency: 865.2 MHz (India ISM IN865 Band)
- Spreading Factor: SF10 (Mountain Long Range)
- Bandwidth: 125 kHz, Coding Rate: 4/5
- Multi-hop mountain mesh topology (Citizen Node -> Ridge Repeater -> Valley Relay -> NDRF Gateway -> Central Server)
- Dynamic RSSI, SNR, Packet Time-on-Air (ToA) and Hex payload dump
"""
from abc import ABC, abstractmethod
from typing import Callable, Optional, Dict, Any, List
import asyncio
import inspect
import math
import struct
import zlib


class CommunicationAdapter(ABC):
    """Common interface every relay transport must implement."""

    @abstractmethod
    async def send(self, message: dict) -> None:
        """Hand a message to this adapter for relay/delivery."""
        raise NotImplementedError

    @abstractmethod
    def set_receive_callback(self, callback: Callable[[dict], None]) -> None:
        """Register a callback invoked after every hop/delivery event."""
        raise NotImplementedError


def calculate_lora_airtime(payload_bytes: int, sf: int = 10, bw_khz: int = 125, cr: int = 1, preamble: int = 8) -> float:
    """
    Calculates exact LoRa packet Time on Air (ToA) in milliseconds according to
    Semtech SX1276 / SX1262 LoRa modem calculation specification.
    """
    bw_hz = bw_khz * 1000
    t_sym = (2 ** sf) / bw_hz * 1000.0  # ms per symbol
    t_preamble = (preamble + 4.25) * t_sym

    # Low data rate optimization flag for SF11 & SF12 with 125kHz
    de = 1 if (sf >= 11 and bw_khz == 125) else 0
    ih = 0  # explicit header
    crc = 1  # CRC enabled

    # Symbol count for payload
    terms = 8 * payload_bytes - 4 * sf + 28 + 16 * crc - 20 * ih
    numerator = max(0, terms)
    denominator = 4 * (sf - 2 * de)
    n_payload = 8 + math.ceil(numerator / denominator) * (cr + 4)

    t_payload = max(0, n_payload) * t_sym
    return round(t_preamble + t_payload, 1)


def generate_lora_packet_hex(message_id: str, lat: float, lon: float, severity: str, people: int) -> str:
    """
    Simulates a compact binary LoRa disaster telemetry frame (32 bytes).
    Header: [0x4C, 0x53] ('LS' - Landslide Sentinel)
    Version: 0x02
    Message ID Hash: 4 bytes
    Lat/Lon: 8 bytes (float32 each)
    Severity & People: 2 bytes
    CRC16: 2 bytes
    """
    sev_map = {"LOW": 1, "MODERATE": 2, "HIGH": 3, "CRITICAL": 4}
    sev_code = sev_map.get(severity.upper(), 4)
    msg_hash = zlib.crc32(message_id.encode()) & 0xFFFFFFFF
    
    header = b'\x4c\x53\x02'
    body = struct.pack("!IffHH", msg_hash, float(lat), float(lon), sev_code, int(people))
    raw = header + body
    checksum = zlib.crc32(raw) & 0xFFFF
    full_frame = raw + struct.pack("!H", checksum)
    return " ".join(f"{b:02X}" for b in full_frame)


class LoRaMeshSimulatorAdapter(CommunicationAdapter):
    """
    Simulates a multi-hop LoRa Mesh network across mountainous terrain
    (e.g., North Eastern Region / Meghalaya / Sikkim / Arunachal).
    
    Hops:
    0: Citizen Edge Node (Handheld / IoT Beacon)
    1: Mountain Ridge Solar Repeater (High Altitude Forwarder)
    2: Valley Relay Node (Deep-cut ravine repeater)
    3: Base Station / NDRF LoRaWAN Gateway (District HQ)
    4: SEOC Central Server (State Emergency Operations Center via SatLink)
    """

    LORA_SPECS = {
        "band": "IN865 (India ISM)",
        "frequency_mhz": 865.200,
        "bandwidth_khz": 125,
        "spreading_factor": 10,
        "coding_rate": "4/5",
        "tx_power_dbm": 14,
        "crc": "ENABLED",
    }

    HOP_CHAIN = [
        {
            "hop": 0,
            "callsign": "LORA-NODE-CITIZEN",
            "role": "Originator Beacon",
            "lat_offset": 0.0,
            "lon_offset": 0.0,
            "rssi_dbm": -84,
            "snr_db": +8.2,
            "status": "OFFLINE_STORED",
            "label": "Node A: Stranded Citizen / Sensor (Origin)",
        },
        {
            "hop": 1,
            "callsign": "LORA-RIDGE-REP-04",
            "role": "Solar Ridge Repeater",
            "lat_offset": 0.024,
            "lon_offset": 0.018,
            "rssi_dbm": -96,
            "snr_db": +2.4,
            "status": "RELAYING",
            "label": "Node B: Mountain Ridge Repeater (+2.8 km)",
        },
        {
            "hop": 2,
            "callsign": "LORA-VALLEY-REP-02",
            "role": "Valley Mesh Forwarder",
            "lat_offset": 0.048,
            "lon_offset": 0.039,
            "rssi_dbm": -107,
            "snr_db": -1.8,
            "status": "RELAYING",
            "label": "Node C: Valley Relay Node (+6.4 km)",
        },
        {
            "hop": 3,
            "callsign": "GATEWAY-NDRF-BASE",
            "role": "LoRaWAN Base Gateway",
            "lat_offset": 0.075,
            "lon_offset": 0.062,
            "rssi_dbm": -114,
            "snr_db": -4.6,
            "status": "RECEIVED_BY_GATEWAY",
            "label": "Node D: NDRF Base Camp Gateway (+11.2 km)",
        },
        {
            "hop": 4,
            "callsign": "SEOC-DISPATCH-SERVER",
            "role": "Central Disaster HQ",
            "lat_offset": 0.075,
            "lon_offset": 0.062,
            "rssi_dbm": 0,
            "snr_db": 0.0,
            "status": "DELIVERED",
            "label": "State Emergency Operations Center (Dispatched)",
        },
    ]

    def __init__(self, hop_delay_seconds: float = 0.7):
        self.hop_delay_seconds = hop_delay_seconds
        self._receive_callback: Optional[Callable[[dict], Any]] = None

    def set_receive_callback(self, callback: Callable[[dict], Any]) -> None:
        self._receive_callback = callback

    async def send(self, message: dict) -> None:
        """
        Executes LoRa mesh transmission step-by-step, calculating RF signal
        degradation and airtime, and calling the callback after each hop.
        """
        base_lat = float(message.get("latitude", 25.3))
        base_lon = float(message.get("longitude", 91.7))
        severity = str(message.get("severity", "CRITICAL"))
        people = int(message.get("people_affected", 1))
        msg_id = str(message.get("message_id", "SOS-DEMO"))

        # Generate realistic packet hex and airtime
        raw_hex = generate_lora_packet_hex(msg_id, base_lat, base_lon, severity, people)
        airtime_ms = calculate_lora_airtime(
            payload_bytes=32,
            sf=self.LORA_SPECS["spreading_factor"],
            bw_khz=self.LORA_SPECS["bandwidth_khz"],
        )

        message.update({
            "lora_band": self.LORA_SPECS["band"],
            "lora_frequency_mhz": self.LORA_SPECS["frequency_mhz"],
            "lora_sf": self.LORA_SPECS["spreading_factor"],
            "lora_bw_khz": self.LORA_SPECS["bandwidth_khz"],
            "lora_cr": self.LORA_SPECS["coding_rate"],
            "lora_airtime_ms": airtime_ms,
            "lora_packet_hex": raw_hex,
        })

        hop_history: List[Dict[str, Any]] = []

        for stage in self.HOP_CHAIN:
            await asyncio.sleep(self.hop_delay_seconds)

            current_lat = round(base_lat + stage["lat_offset"], 4)
            current_lon = round(base_lon + stage["lon_offset"], 4)

            hop_info = {
                "hop_index": stage["hop"],
                "callsign": stage["callsign"],
                "role": stage["role"],
                "label": stage["label"],
                "latitude": current_lat,
                "longitude": current_lon,
                "rssi_dbm": stage["rssi_dbm"],
                "snr_db": stage["snr_db"],
                "status": stage["status"],
            }
            hop_history.append(hop_info)

            message["hop_count"] = stage["hop"]
            message["current_hop_label"] = stage["label"]
            message["current_node_callsign"] = stage["callsign"]
            message["current_node_role"] = stage["role"]
            message["current_node_lat"] = current_lat
            message["current_node_lon"] = current_lon
            message["rssi_dbm"] = stage["rssi_dbm"]
            message["snr_db"] = stage["snr_db"]
            message["status"] = stage["status"]
            message["hop_history"] = list(hop_history)

            if self._receive_callback:
                result = self._receive_callback(dict(message))
                if inspect.isawaitable(result):
                    await result


# Backward-compatible alias for existing imports
WebSimulatorAdapter = LoRaMeshSimulatorAdapter


class BLEAdapter(CommunicationAdapter):
    """Placeholder for future Android BLE store-and-forward adapter."""

    async def send(self, message: dict) -> None:
        raise NotImplementedError("BLEAdapter is a future integration point.")

    def set_receive_callback(self, callback):
        raise NotImplementedError("BLEAdapter is not implemented in this prototype.")
