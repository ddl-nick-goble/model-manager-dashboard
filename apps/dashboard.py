import streamlit as st
import altair as alt
import importlib

# 1) Page config + styling
st.set_page_config(layout="wide")
with open("style.css") as f:
    st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

@alt.theme.register('domino', enable=True)
def domino_theme():
    return {
        "config": {
            "background": "#FFFFFF",
            "axis": {
                "domainColor": "#D6D6D6",
                "gridColor": "#D6D6D6",
                "labelColor": "#2E2E38",
                "titleColor": "#2E2E38",
                "labelFont": "Inter",
                "titleFont": "Inter"
            },
            "legend": {
                "labelColor": "#2E2E38",
                "titleColor": "#2E2E38",
                "labelFont": "Inter",
                "titleFont": "Inter"
            },
            "title": {
                "color": "#2E2E38",
                "font": "Inter"
            }
        }
    }


# 2) Define your pages and emojis (just for labels—no validator here)
PAGES = {
    "🏠 Home":              "home_page",
    "📈 Rate Curves":       "rate_curves_page",
    "📊 Rate Curve Surface":"rate_curve_surface",
    "🔄 Rate Curve Simulations":       "rate_simulations_page",
    "💼 Bond Inventory":         "treasury_inventory",
    "⚠️ Bond Risk":             "treasury_risk",
    "⏰ Overnight Rates":   "interest_rate_page",
}

# 3) Sidebar nav
choice = st.sidebar.radio("Navigate", list(PAGES.keys()))
module_name = PAGES[choice]

# 4) Dynamically load & run the selected page
page = importlib.import_module(module_name)
page.app()
