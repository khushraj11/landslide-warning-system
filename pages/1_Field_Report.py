"""
Field reporting page: lets citizens/field officials upload a geo-tagged
photo of cracks, slope movement, or blocked roads. Uses OCR to pull any
visible text (signage, handwritten notes) and simple keyword detection
to flag urgency. Reports are appended to a CSV so they persist and can
be reviewed alongside the sensor-based risk model.
"""
import streamlit as st
import pandas as pd
from PIL import Image
import pytesseract
import os
from datetime import datetime

st.set_page_config(page_title="Field Report - Landslide Warning System", layout="wide")

from utils.theme import apply_theme
apply_theme()

REPORTS_FILE = "data/field_reports.csv"
URGENT_KEYWORDS = ["crack", "landslide", "slide", "collapse", "block", "flood", "danger", "damage"]

DISTRICT_COORDS = {
    "Shillong": (25.5788, 91.8933), "Cherrapunji": (25.3000, 91.7000),
    "Aizawl": (23.7271, 92.7176), "Itanagar": (27.0844, 93.6053),
    "Tawang": (27.5859, 91.8594), "Kohima": (25.6751, 94.1086),
    "Wokha": (26.0997, 94.2650), "Imphal": (24.8170, 93.9368),
    "Churachandpur": (24.3333, 93.6833), "Agartala": (23.8315, 91.2868),
    "Gangtok": (27.3389, 88.6065), "Along": (28.1667, 94.8000),
    "Ziro": (27.5833, 93.8333), "Dimapur": (25.9091, 93.7266),
    "Guwahati": (26.1445, 91.7362), "Bomdila": (27.2645, 92.4159),
}

def load_reports():
    if os.path.exists(REPORTS_FILE):
        return pd.read_csv(REPORTS_FILE)
    return pd.DataFrame(columns=["timestamp", "district", "latitude", "longitude",
                                  "description", "ocr_text", "urgency"])

def save_report(row):
    df = load_reports()
    df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
    os.makedirs("data", exist_ok=True)
    df.to_csv(REPORTS_FILE, index=False)

def detect_urgency(text_blobs):
    combined = " ".join(text_blobs).lower()
    hits = [kw for kw in URGENT_KEYWORDS if kw in combined]
    return ("Urgent" if hits else "Routine"), hits

def main():
    st.title("Field Report - Upload Slope / Road Damage")
    st.caption("For citizens and field officials: report cracks, slope movement, or blocked roads.")

    col1, col2 = st.columns([1, 1])

    with col1:
        district = st.selectbox("District (auto geo-tags the report)", sorted(DISTRICT_COORDS.keys()))
        description = st.text_area("Describe what you observed", placeholder="e.g. Large crack appeared on the hillside near the main road...")
        uploaded_image = st.file_uploader("Upload a photo of the site", type=["jpg", "jpeg", "png"])

        ocr_text = ""
        if uploaded_image is not None:
            image = Image.open(uploaded_image)
            st.image(image, caption="Uploaded photo", use_container_width=True)
            with st.spinner("Reading text from image (OCR)..."):
                try:
                    ocr_text = pytesseract.image_to_string(image).strip()
                except Exception as e:
                    st.warning(f"OCR could not run: {e}")

            if ocr_text:
                st.text_area("Text detected in image (OCR output)", ocr_text, height=100)
            else:
                st.info("No readable text detected in the image -- that's fine, the photo itself is still saved with your report.")

        if st.button("Submit Report", type="primary"):
            urgency, hits = detect_urgency([description, ocr_text])
            lat, lon = DISTRICT_COORDS[district]
            row = {
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "district": district,
                "latitude": lat,
                "longitude": lon,
                "description": description,
                "ocr_text": ocr_text,
                "urgency": urgency,
            }
            save_report(row)
            if urgency == "Urgent":
                st.error(f"Report submitted and flagged URGENT (keywords detected: {', '.join(hits)}). This will be prioritized for dispatch.")
            else:
                st.success("Report submitted successfully and logged for review.")

    with col2:
        st.subheader("Recent Field Reports")
        reports = load_reports()
        if reports.empty:
            st.info("No field reports submitted yet.")
        else:
            reports_sorted = reports.sort_values("timestamp", ascending=False)
            for _, r in reports_sorted.head(10).iterrows():
                badge = "🔴 Urgent" if r["urgency"] == "Urgent" else "🟢 Routine"
                st.markdown(
                    f"**{r['district']}** — {badge}  \n"
                    f"_{r['timestamp']}_  \n"
                    f"{r['description'] if pd.notna(r['description']) and r['description'] else '(no description)'}"
                )
                st.markdown("---")

if __name__ == "__main__":
    main()
