"""
Road Connectivity Status page.
Maps each district's live risk level (from the trained model) onto its
key highway/road segments, so field teams and district admins can see
at a glance which routes are open, under advisory, or blocked -- without
needing a live traffic feed. This is a rules-based mock layer (risk ->
road status) designed so it can be swapped for a real road-sensor /
traffic-API feed later without changing the UI.
"""
import streamlit as st
import pandas as pd
import joblib

st.set_page_config(page_title="Road Connectivity - Landslide Warning System", layout="wide")

from utils.theme import apply_theme
apply_theme()

# Key road/highway segments per district. In production this would come
# from a roads/GIS layer (e.g. state PWD or NHAI data) joined on district.
DISTRICT_ROADS = {
    "Shillong":       ["NH-6 (Guwahati-Shillong)", "Shillong-Cherrapunji Rd"],
    "Cherrapunji":    ["Shillong-Cherrapunji Rd", "Cherrapunji-Dawki Rd"],
    "Aizawl":         ["NH-6 (Aizawl-Silchar)", "Aizawl-Lunglei Rd"],
    "Itanagar":       ["NH-415 (Itanagar-Naharlagun)", "Itanagar-Banderdewa Rd"],
    "Tawang":         ["NH-13 (Bomdila-Tawang)", "Se La Pass Rd"],
    "Kohima":         ["NH-2 (Dimapur-Kohima)", "Kohima-Zunheboto Rd"],
    "Wokha":          ["NH-2 (Kohima-Wokha)", "Wokha-Merapani Rd"],
    "Imphal":         ["NH-2 (Imphal-Kohima)", "NH-37 (Imphal-Jiribam)"],
    "Churachandpur":  ["NH-2 (Imphal-Churachandpur)", "Churachandpur-Tipaimukh Rd"],
    "Agartala":       ["NH-8 (Agartala-Sabroom)", "Agartala-Udaipur Rd"],
    "Gangtok":        ["NH-10 (Siliguri-Gangtok)", "Gangtok-Nathula Rd"],
    "Along":          ["NH-13 (Along-Pasighat)", "Along-Basar Rd"],
    "Ziro":           ["NH-13 (Ziro-Itanagar)", "Ziro-Daporijo Rd"],
    "Dimapur":        ["NH-2 (Dimapur-Kohima)", "NH-29 (Dimapur-Wokha)"],
    "Guwahati":       ["NH-27 (Guwahati Bypass)", "NH-6 (Guwahati-Shillong)"],
    "Bomdila":        ["NH-13 (Tezpur-Bomdila)", "Bomdila-Tawang Rd"],
}

# risk_label -> (status, colour, blurb)
ROAD_STATUS_RULES = {
    "Severe":   ("Blocked",              "#e74c3c", "Landslide/road-cut risk critical -- route closed, divert traffic."),
    "High":     ("At Risk - Advisory",   "#e67e22", "Heightened slope activity -- travel with caution, avoid night transit."),
    "Moderate": ("Open - Monitor",       "#f1c40f", "Passable, under watch. Re-check before dispatching heavy vehicles."),
    "Low":      ("Open",                 "#2ecc71", "No current restrictions."),
}


@st.cache_resource
def load_model():
    model = joblib.load("models/landslide_risk_model.pkl")
    label_order = joblib.load("models/label_order.pkl")
    return model, label_order


@st.cache_data
def load_district_risk(_model, label_order):
    df = pd.read_csv("data/landslide_training_data.csv")
    district_df = df.groupby("district").agg({
        "rainfall_mm": "mean",
        "soil_moisture_pct": "mean",
        "slope_angle_deg": "mean",
        "historical_landslides": "mean",
    }).reset_index()

    X = district_df[["rainfall_mm", "soil_moisture_pct", "slope_angle_deg", "historical_landslides"]]
    preds = _model.predict(X)
    district_df["risk_label"] = [label_order[p] for p in preds]
    return district_df


def main():
    st.title("Road Connectivity Status")
    st.caption("District road segments mapped to live landslide risk. Swap-in point for a real traffic/PWD feed.")

    model, label_order = load_model()
    risk_df = load_district_risk(model, label_order)

    # Build one row per road segment
    rows = []
    for _, r in risk_df.iterrows():
        status, color, blurb = ROAD_STATUS_RULES[r["risk_label"]]
        for road in DISTRICT_ROADS.get(r["district"], []):
            rows.append({
                "district": r["district"],
                "road": road,
                "risk_label": r["risk_label"],
                "status": status,
                "color": color,
                "blurb": blurb,
            })
    road_df = pd.DataFrame(rows)

    # Summary metrics
    status_order = ["Blocked", "At Risk - Advisory", "Open - Monitor", "Open"]
    counts = road_df["status"].value_counts()
    cols = st.columns(4)
    for col, status in zip(cols, status_order):
        col.metric(status, int(counts.get(status, 0)))

    st.markdown("---")

    # Filter
    district_filter = st.multiselect(
        "Filter by district", sorted(road_df["district"].unique()), default=[]
    )
    view_df = road_df if not district_filter else road_df[road_df["district"].isin(district_filter)]

    # Sort worst-first
    rank = {s: i for i, s in enumerate(status_order)}
    view_df = view_df.copy()
    view_df["_rank"] = view_df["status"].map(rank)
    view_df = view_df.sort_values(["_rank", "district"])

    st.subheader(f"Road Segments ({len(view_df)})")
    for _, r in view_df.iterrows():
        st.markdown(
            f"""
            <div style="padding:12px; margin-bottom:8px; border-radius:8px;
                        border-left: 6px solid {r['color']}; background: rgba(255,255,255,0.07); color:#f5f7fa; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 2px 12px rgba(0,0,0,0.25);">
                <b>{r['road']}</b> &mdash; <i>{r['district']}</i><br>
                <span style="color:{r['color']}; font-weight:bold;">{r['status']}</span>
                (district risk: {r['risk_label']})<br>
                <small>{r['blurb']}</small>
            </div>
            """,
            unsafe_allow_html=True
        )

    st.markdown("---")
    st.caption(
        "Status derived from current district risk classification (rules-based mock). "
        "Production version would ingest live PWD/NHAI road-closure feeds and IoT road sensors."
    )


if __name__ == "__main__":
    main()
