"""
Weather-Linked Risk Forecast page.
Projects each district's landslide risk 1-3 days ahead using a simulated
rainfall trend (deterministic per district, seeded so results are stable
across reruns). Runs the SAME trained model against the projected
conditions each day, so this is a genuine forward risk projection, not
just a rainfall chart. Built as the swap-in point for a live IMD API
forecast feed -- only load_forecast() needs to change to go live.
"""
import streamlit as st
import pandas as pd
import numpy as np
import joblib

st.set_page_config(page_title="Weather Forecast - Landslide Warning System", layout="wide")

from utils.theme import apply_theme
apply_theme()

RISK_COLORS = {
    "Low": "#2ecc71",
    "Moderate": "#f1c40f",
    "High": "#e67e22",
    "Severe": "#e74c3c",
}
RISK_RANK = {"Low": 0, "Moderate": 1, "High": 2, "Severe": 3}


@st.cache_resource
def load_model():
    model = joblib.load("models/landslide_risk_model.pkl")
    label_order = joblib.load("models/label_order.pkl")
    return model, label_order


@st.cache_data
def load_base_data():
    df = pd.read_csv("data/landslide_training_data.csv")
    district_df = df.groupby("district").agg({
        "rainfall_mm": "mean",
        "soil_moisture_pct": "mean",
        "slope_angle_deg": "mean",
        "historical_landslides": "mean",
    }).reset_index()
    return district_df


def simulate_forecast(base_df, days=3):
    """
    Placeholder for a live IMD API call. Each district gets a deterministic
    (seeded by district name) day-over-day rainfall trend so the demo is
    reproducible. Soil moisture drifts upward with cumulative rainfall,
    same physical relationship real IoT soil sensors would show.
    Swap this function body for a real IMD forecast fetch to go live.
    """
    records = []
    for _, row in base_df.iterrows():
        seed = abs(hash(row["district"])) % (2**32)
        rng = np.random.default_rng(seed)
        rainfall = row["rainfall_mm"]
        soil = row["soil_moisture_pct"]
        for day in range(1, days + 1):
            daily_delta = rng.uniform(-0.15, 0.45)  # slight upward bias = monsoon buildup
            rainfall = max(0, rainfall * (1 + daily_delta))
            soil = float(np.clip(soil + rainfall * 0.02, 0, 100))
            records.append({
                "district": row["district"],
                "day": day,
                "rainfall_mm": rainfall,
                "soil_moisture_pct": soil,
                "slope_angle_deg": row["slope_angle_deg"],
                "historical_landslides": row["historical_landslides"],
            })
    return pd.DataFrame(records)


def score_forecast(model, label_order, forecast_df):
    X = forecast_df[["rainfall_mm", "soil_moisture_pct", "slope_angle_deg", "historical_landslides"]]
    preds = model.predict(X)
    probs = model.predict_proba(X)
    forecast_df = forecast_df.copy()
    forecast_df["risk_label"] = [label_order[p] for p in preds]
    forecast_df["confidence"] = probs.max(axis=1)
    return forecast_df


def main():
    st.title("Weather-Linked Risk Forecast")
    st.caption("3-day forward risk projection per district, driven by simulated rainfall trends. "
               "Architecture point where a live IMD API forecast plugs in.")

    model, label_order = load_model()
    base_df = load_base_data()

    days = st.slider("Forecast horizon (days)", 1, 5, 3)
    forecast_df = simulate_forecast(base_df, days=days)
    scored_df = score_forecast(model, label_order, forecast_df)

    st.subheader("Escalation Watch")
    escalations = []
    for district, grp in scored_df.groupby("district"):
        grp = grp.sort_values("day")
        start_rank = RISK_RANK[grp.iloc[0]["risk_label"]]
        end_rank = RISK_RANK[grp.iloc[-1]["risk_label"]]
        if end_rank > start_rank:
            escalations.append({
                "district": district,
                "from": grp.iloc[0]["risk_label"],
                "to": grp.iloc[-1]["risk_label"],
                "on_day": int(grp[grp["risk_label"] == grp.iloc[-1]["risk_label"]].iloc[0]["day"]),
            })

    if escalations:
        for e in escalations:
            color = RISK_COLORS[e["to"]]
            st.markdown(
                f"""
                <div style="padding:10px; margin-bottom:6px; border-radius:8px;
                            border-left: 6px solid {color}; background: rgba(255,255,255,0.07); color:#f5f7fa; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 2px 12px rgba(0,0,0,0.25);">
                    <b>{e['district']}</b>: projected to escalate from
                    <b>{e['from']}</b> &rarr; <b style="color:{color};">{e['to']}</b>
                    by Day {e['on_day']}. Recommend pre-positioning response teams.
                </div>
                """,
                unsafe_allow_html=True
            )
    else:
        st.info("No districts currently projected to escalate over the selected horizon.")

    st.markdown("---")

    st.subheader("Risk Trend by District")
    district_pick = st.selectbox("District", sorted(scored_df["district"].unique()))
    d_df = scored_df[scored_df["district"] == district_pick].sort_values("day")

    chart_col, table_col = st.columns([2, 1])
    with chart_col:
        st.line_chart(d_df.set_index("day")[["rainfall_mm", "soil_moisture_pct"]])
    with table_col:
        for _, r in d_df.iterrows():
            color = RISK_COLORS[r["risk_label"]]
            st.markdown(
                f"""
                <div style="padding:8px; margin-bottom:6px; border-radius:6px;
                            border-left: 5px solid {color}; background: rgba(255,255,255,0.07); color:#f5f7fa; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 2px 12px rgba(0,0,0,0.25);">
                    <b>Day {r['day']}</b>: <span style="color:{color}; font-weight:bold;">
                    {r['risk_label']}</span> ({r['confidence']:.0%})<br>
                    <small>Rain: {r['rainfall_mm']:.0f}mm | Soil: {r['soil_moisture_pct']:.0f}%</small>
                </div>
                """,
                unsafe_allow_html=True
            )

    st.markdown("---")
    st.caption(
        "Forecast uses a simulated rainfall trend (seeded per district) scored through the same "
        "trained model as the live dashboard. Replace simulate_forecast() with a live IMD API call "
        "to go into production -- no other code changes needed."
    )


if __name__ == "__main__":
    main()
