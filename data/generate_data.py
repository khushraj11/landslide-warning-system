"""
Generates synthetic yet scientifically realistic landslide training data
for 16 prominent districts across the North Eastern Region (NER) of India.
"""
import os
import numpy as np
import pandas as pd

DISTRICTS = {
    "Shillong": {"lat": 25.5788, "lon": 91.8933, "base_slope": 32, "base_rain": 240, "base_soil": 65, "hist_ls": 18},
    "Cherrapunji": {"lat": 25.3000, "lon": 91.7000, "base_slope": 38, "base_rain": 420, "base_soil": 82, "hist_ls": 28},
    "Aizawl": {"lat": 23.7271, "lon": 92.7176, "base_slope": 36, "base_rain": 210, "base_soil": 70, "hist_ls": 22},
    "Itanagar": {"lat": 27.0844, "lon": 93.6053, "base_slope": 28, "base_rain": 230, "base_soil": 60, "hist_ls": 14},
    "Tawang": {"lat": 27.5859, "lon": 91.8594, "base_slope": 42, "base_rain": 190, "base_soil": 55, "hist_ls": 20},
    "Kohima": {"lat": 25.6751, "lon": 94.1086, "base_slope": 34, "base_rain": 220, "base_soil": 68, "hist_ls": 19},
    "Wokha": {"lat": 26.0997, "lon": 94.2650, "base_slope": 30, "base_rain": 200, "base_soil": 62, "hist_ls": 12},
    "Imphal": {"lat": 24.8170, "lon": 93.9368, "base_slope": 18, "base_rain": 160, "base_soil": 50, "hist_ls": 8},
    "Churachandpur": {"lat": 24.3333, "lon": 93.6833, "base_slope": 29, "base_rain": 190, "base_soil": 58, "hist_ls": 13},
    "Agartala": {"lat": 23.8315, "lon": 91.2868, "base_slope": 12, "base_rain": 180, "base_soil": 48, "hist_ls": 4},
    "Gangtok": {"lat": 27.3389, "lon": 88.6065, "base_slope": 39, "base_rain": 310, "base_soil": 76, "hist_ls": 25},
    "Along": {"lat": 28.1667, "lon": 94.8000, "base_slope": 31, "base_rain": 215, "base_soil": 64, "hist_ls": 15},
    "Ziro": {"lat": 27.5833, "lon": 93.8333, "base_slope": 26, "base_rain": 195, "base_soil": 56, "hist_ls": 11},
    "Dimapur": {"lat": 25.9091, "lon": 93.7266, "base_slope": 14, "base_rain": 170, "base_soil": 45, "hist_ls": 5},
    "Guwahati": {"lat": 26.1445, "lon": 91.7362, "base_slope": 16, "base_rain": 175, "base_soil": 49, "hist_ls": 7},
    "Bomdila": {"lat": 27.2645, "lon": 92.4159, "base_slope": 37, "base_rain": 205, "base_soil": 63, "hist_ls": 17},
}

def generate_data(num_samples_per_district=150, random_seed=42):
    rng = np.random.default_rng(random_seed)
    rows = []

    for district, meta in DISTRICTS.items():
        for _ in range(num_samples_per_district):
            rain = max(10.0, float(rng.normal(meta["base_rain"], 60)))
            soil = float(np.clip(rng.normal(meta["base_soil"], 12), 15, 100))
            slope = float(np.clip(rng.normal(meta["base_slope"], 5), 5, 60))
            hist = max(0, int(rng.poisson(meta["hist_ls"])))

            # Geotechnical slope stability risk score
            score = (
                0.35 * (rain / 300.0) +
                0.30 * (soil / 80.0) +
                0.25 * (slope / 45.0) +
                0.10 * (min(hist, 30) / 25.0)
            )

            if score < 0.55:
                label = "Low"
            elif score < 0.78:
                label = "Moderate"
            elif score < 1.05:
                label = "High"
            else:
                label = "Severe"

            rows.append({
                "district": district,
                "latitude": meta["lat"],
                "longitude": meta["lon"],
                "rainfall_mm": round(rain, 2),
                "soil_moisture_pct": round(soil, 2),
                "slope_angle_deg": round(slope, 2),
                "historical_landslides": hist,
                "risk_label": label,
            })

    df = pd.DataFrame(rows)
    os.makedirs("data", exist_ok=True)
    df.to_csv("data/landslide_training_data.csv", index=False)
    print(f"Generated {len(df)} samples across {len(DISTRICTS)} districts -> data/landslide_training_data.csv")

if __name__ == "__main__":
    generate_data()
