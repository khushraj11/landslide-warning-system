"""
AI-Based Landslide Early Warning Dashboard
Loads the trained Random Forest model and shows a live GIS risk map (with a
satellite imagery layer), adjustable simulation controls, road connectivity
status, a weather-linked forecast, multilingual alerts, and a triage-ranked
district table.
"""
import streamlit as st
import pandas as pd
import numpy as np
import joblib
import folium
from streamlit_folium import st_folium
from utils.translations import get_alert, ALERT_TEMPLATES

st.set_page_config(
    page_title="Landslide Early Warning System - NER",
    page_icon="mountain",
    layout="wide"
)

from utils.theme import apply_theme
apply_theme()

RISK_COLORS = {
    "Low": "#2ecc71",
    "Moderate": "#f1c40f",
    "High": "#e67e22",
    "Severe": "#e74c3c",
}

CONNECTIVITY_STATUS = {
    "Low": ("Clear", "#2ecc71"),
    "Moderate": ("Monitor", "#f1c40f"),
    "High": ("At Risk", "#e67e22"),
    "Severe": ("Likely Blocked", "#e74c3c"),
}

@st.cache_resource
def load_model():
    model = joblib.load("models/landslide_risk_model.pkl")
    label_order = joblib.load("models/label_order.pkl")
    return model, label_order

@st.cache_data
def load_base_data():
    df = pd.read_csv("data/landslide_training_data.csv")
    district_df = df.groupby("district").agg({
        "latitude": "mean",
        "longitude": "mean",
        "rainfall_mm": "mean",
        "soil_moisture_pct": "mean",
        "slope_angle_deg": "mean",
        "historical_landslides": "mean",
    }).reset_index()
    return district_df

def predict_risk(model, label_order, district_df, rainfall_multiplier, soil_offset):
    features = district_df.copy()
    features["rainfall_mm"] = features["rainfall_mm"] * rainfall_multiplier
    features["soil_moisture_pct"] = np.clip(
        features["soil_moisture_pct"] + soil_offset, 0, 100
    )

    X = features[["rainfall_mm", "soil_moisture_pct", "slope_angle_deg", "historical_landslides"]]
    preds = model.predict(X)
    probs = model.predict_proba(X)

    features["risk_label"] = [label_order[p] for p in preds]
    features["confidence"] = probs.max(axis=1)
    return features

def build_forecast(current_rainfall, current_soil, days=5):
    """Synthetic 5-day forward trend -- placeholder for a live IMD API feed."""
    rng = np.random.default_rng(42)
    trend = rng.normal(loc=1.05, scale=0.15, size=days).cumprod()
    forecast_rainfall = current_rainfall * trend
    forecast_soil = np.clip(current_soil + rng.normal(0, 5, size=days).cumsum(), 0, 100)
    return forecast_rainfall, forecast_soil

def build_map(result_df):
    """Builds the GIS risk map with both a street layer and a real satellite
    imagery layer (Esri World Imagery), switchable via the layer control in
    the top-right corner of the map. In production this satellite layer
    would be paired with a change-detection feed (e.g. Sentinel Hub / NASA
    EOSDIS) to flag fresh slope scarring automatically."""
    m = folium.Map(location=[25.8, 92.5], zoom_start=6, tiles=None)

    folium.TileLayer(
        tiles="OpenStreetMap",
        name="Street Map",
        control=True,
    ).add_to(m)

    folium.TileLayer(
        tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attr="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN",
        name="Satellite Imagery",
        control=True,
    ).add_to(m)

    for _, row in result_df.iterrows():
        color = RISK_COLORS[row["risk_label"]]
        folium.CircleMarker(
            location=[row["latitude"], row["longitude"]],
            radius=10 + (row["confidence"] * 8),
            popup=folium.Popup(
                f"<b>{row['district']}</b><br>"
                f"Risk: <b>{row['risk_label']}</b><br>"
                f"Confidence: {row['confidence']:.0%}<br>"
                f"Rainfall: {row['rainfall_mm']:.0f}mm<br>"
                f"Soil Moisture: {row['soil_moisture_pct']:.0f}%",
                max_width=250
            ),
            tooltip=f"{row['district']} - {row['risk_label']}",
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=0.7,
            weight=2,
        ).add_to(m)

    folium.LayerControl(collapsed=False).add_to(m)
    return m

def main():
    st.title("AI-Based Landslide Early Warning System")
    st.caption("North Eastern Region (NER) - Real-time Risk Monitoring and Triage Dashboard")

    model, label_order = load_model()
    base_df = load_base_data()

    st.sidebar.header("Live Simulation Controls")
    st.sidebar.write("Adjust these to simulate changing weather conditions:")

    rainfall_multiplier = st.sidebar.slider(
        "Rainfall Intensity Multiplier", 0.5, 3.0, 1.0, 0.1,
        help="1.0 = normal conditions, 3.0 = extreme rainfall event"
    )
    soil_offset = st.sidebar.slider(
        "Soil Moisture Adjustment (%)", -20, 40, 0, 5,
        help="Simulates ground saturation from prolonged rain"
    )

    st.sidebar.markdown("---")
    st.sidebar.info("Try setting rainfall to 2.5x+ to see districts escalate to Severe risk.")

    st.sidebar.markdown("---")
    st.sidebar.header("Alert Language")
    language = st.sidebar.selectbox("Choose notification language", list(ALERT_TEMPLATES.keys()))

    result_df = predict_risk(model, label_order, base_df, rainfall_multiplier, soil_offset)

    col1, col2, col3, col4 = st.columns(4)
    risk_counts = result_df["risk_label"].value_counts()
    col1.metric("Low Risk", int(risk_counts.get("Low", 0)))
    col2.metric("Moderate Risk", int(risk_counts.get("Moderate", 0)))
    col3.metric("High Risk", int(risk_counts.get("High", 0)))
    col4.metric("Severe Risk", int(risk_counts.get("Severe", 0)))

    st.markdown("---")

    map_col, table_col = st.columns([3, 2])

    with map_col:
        st.subheader("Risk Map - NER Districts")
        st.caption("Use the layer control (top-right of the map) to switch between street view and live satellite imagery.")
        m = build_map(result_df)
        st_folium(m, width=700, height=500)

    with table_col:
        st.subheader("Triage - Dispatch Priority")
        risk_rank = {"Severe": 0, "High": 1, "Moderate": 2, "Low": 3}
        display_df = result_df.copy()
        display_df["_rank"] = display_df["risk_label"].map(risk_rank)
        display_df = display_df.sort_values(["_rank", "confidence"], ascending=[True, False])

        for _, row in display_df.iterrows():
            color = RISK_COLORS[row["risk_label"]]
            st.markdown(
                f"""
                <div style="padding:10px; margin-bottom:8px; border-radius:8px;
                            border-left: 6px solid {color}; background: rgba(255,255,255,0.07); color:#f5f7fa; border: 1px solid rgba(255,255,255,0.1);">
                    <b>{row['district']}</b> -
                    <span style="color:{color}; font-weight:bold;">{row['risk_label']}</span><br>
                    <small>Confidence: {row['confidence']:.0%} |
                    Rainfall: {row['rainfall_mm']:.0f}mm |
                    Soil: {row['soil_moisture_pct']:.0f}%</small>
                </div>
                """,
                unsafe_allow_html=True
            )

    st.markdown("---")

    # --- Road Connectivity Status ---
    st.subheader("Road Connectivity Status")
    conn_cols = st.columns(4)
    for idx, (_, row) in enumerate(display_df.iterrows()):
        status_text, status_color = CONNECTIVITY_STATUS[row["risk_label"]]
        with conn_cols[idx % 4]:
            st.markdown(
                f"""
                <div style="padding:8px; margin-bottom:8px; border-radius:6px;
                            background-color:{status_color}22; border:1px solid {status_color};">
                    <b>{row['district']}</b><br>
                    <span style="color:{status_color}; font-weight:bold;">{status_text}</span>
                </div>
                """,
                unsafe_allow_html=True
            )

    st.markdown("---")

    # --- Weather-linked Forecast ---
    st.subheader("Weather-linked Risk Forecast (Next 5 Days)")
    forecast_district = st.selectbox("Select district for forecast", sorted(result_df["district"].unique()))
    row = result_df[result_df["district"] == forecast_district].iloc[0]
    rainfall_forecast, soil_forecast = build_forecast(row["rainfall_mm"], row["soil_moisture_pct"])

    fc1, fc2 = st.columns(2)
    with fc1:
        st.caption("Projected rainfall (mm)")
        st.line_chart(pd.DataFrame({"Rainfall (mm)": rainfall_forecast}, index=[f"Day {i+1}" for i in range(5)]))
    with fc2:
        st.caption("Projected soil moisture (%)")
        st.line_chart(pd.DataFrame({"Soil Moisture (%)": soil_forecast}, index=[f"Day {i+1}" for i in range(5)]))

    st.caption(
        "Forecast shown here is a synthetic projection for demo purposes. "
        "In production this panel would consume live IMD short-range forecast data."
    )

    st.markdown("---")

    # --- Multilingual Alerts ---
    st.subheader(f"Emergency Alerts ({language})")
    priority_districts = display_df[display_df["risk_label"].isin(["Severe", "High"])]
    if priority_districts.empty:
        st.success("No High or Severe risk districts currently -- no emergency alerts to issue.")
    else:
        for _, row in priority_districts.iterrows():
            alert_text = get_alert(row["district"], row["risk_label"], language)
            color = RISK_COLORS[row["risk_label"]]
            st.markdown(
                f"""
                <div style="padding:12px; margin-bottom:10px; border-radius:8px;
                            border-left: 6px solid {color}; background-color:#fff8f0;">
                    {alert_text}
                </div>
                """,
                unsafe_allow_html=True
            )

    st.markdown("---")
    st.caption(
        "Demo system using synthetic sensor data modeled on real NER rainfall and terrain patterns, "
        "combined with a live Esri satellite imagery layer on the map above. "
        "Architecture designed to integrate live IMD weather API, Sentinel Hub / NASA satellite "
        "change-detection feeds, and IoT soil sensors. "
        "Use the 'Field Report' page in the sidebar to upload geo-tagged photos of slope damage."
    )

if __name__ == "__main__":
    main()
