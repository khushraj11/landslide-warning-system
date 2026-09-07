"""
Shared visual theme for the Landslide Early Warning System.
Import and call apply_theme() at the top of every page (after st.set_page_config)
to get a consistent, polished dashboard look across the whole app.
"""
import streamlit as st

THEME_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

html, body, [class*="css"] {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.stApp {
    background: radial-gradient(circle at 15% 0%, #0f1b2d 0%, #0a0e17 45%, #060810 100%);
}

section[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #0d1420 0%, #0a0e17 100%);
    border-right: 1px solid rgba(255,255,255,0.06);
}
section[data-testid="stSidebar"] .stRadio label,
section[data-testid="stSidebar"] a {
    font-weight: 500;
}

h1 {
    font-weight: 800 !important;
    letter-spacing: -0.02em;
    background: linear-gradient(90deg, #ffffff 0%, #a8c5ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
h2, h3 {
    font-weight: 700 !important;
    letter-spacing: -0.01em;
}

div[data-testid="stMetric"] {
    background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 18px 20px 14px 20px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.25);
    transition: transform 0.15s ease, border-color 0.15s ease;
}
div[data-testid="stMetric"]:hover {
    transform: translateY(-2px);
    border-color: rgba(255,255,255,0.18);
}
div[data-testid="stMetricValue"] {
    font-weight: 800 !important;
    font-size: 2rem !important;
}
div[data-testid="stMetricLabel"] {
    opacity: 0.7;
    font-weight: 600 !important;
    text-transform: uppercase;
    font-size: 0.72rem !important;
    letter-spacing: 0.06em;
}

.stButton > button {
    border-radius: 10px !important;
    font-weight: 600 !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    transition: all 0.15s ease !important;
}
.stButton > button:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(0,0,0,0.3);
}
.stButton > button[kind="primary"] {
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%) !important;
    border: none !important;
}

div[data-testid="stSlider"] {
    padding-top: 4px;
}

div[data-testid="stAlert"] {
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.08);
}

.stTextInput input, .stSelectbox div[data-baseweb="select"], .stTextArea textarea {
    border-radius: 10px !important;
}

div[data-testid="stDataFrame"] {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.08);
}

.rc-card {
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 10px;
    background: linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
    border-left-width: 5px;
    border-left-style: solid;
    box-shadow: 0 2px 12px rgba(0,0,0,0.2);
    transition: transform 0.12s ease;
}
.rc-card:hover {
    transform: translateX(3px);
}
.rc-title {
    font-weight: 700;
    font-size: 1.02rem;
    color: #f5f7fa;
}
.rc-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-left: 8px;
}
.rc-meta {
    color: rgba(255,255,255,0.65);
    font-size: 0.85rem;
    margin-top: 4px;
}

hr {
    border-color: rgba(255,255,255,0.08) !important;
}
</style>
"""

RISK_COLORS = {
    "Low": "#2ecc71",
    "Moderate": "#f1c40f",
    "High": "#e67e22",
    "Severe": "#e74c3c",
}


def apply_theme():
    st.markdown(THEME_CSS, unsafe_allow_html=True)


def risk_card(title, risk_label, meta_line, subtitle=None):
    color = RISK_COLORS.get(risk_label, "#888888")
    subtitle_html = f" &mdash; {subtitle}" if subtitle else ""
    st.markdown(
        f"""
        <div class="rc-card" style="border-left-color:{color};">
            <span class="rc-title">{title}</span>
            <span class="rc-badge" style="background:{color}22; color:{color}; border:1px solid {color}55;">
                {risk_label}
            </span>{subtitle_html}
            <div class="rc-meta">{meta_line}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
