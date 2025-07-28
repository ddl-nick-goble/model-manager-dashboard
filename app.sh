#!/usr/bin/env bash
set -euo pipefail

# to use, run PORT=8501 bash app.sh
# run this if needed pkill -f streamlit

# Default to prod port 8888, but allow override via ENV or CLI arg
PORT="${PORT:-${1:-8888}}"


# Try to kill any existing Streamlit processes (ignore errors)
if ! pkill -f streamlit 2>/dev/null; then
  echo "No existing Streamlit process found."
else
  echo "Previous Streamlit process killed."
fi

mkdir -p .streamlit

cat > .streamlit/config.toml <<EOF
[browser]
gatherUsageStats = true

[server]
address = "0.0.0.0"
port = $PORT
enableCORS = false
enableXsrfProtection = false

[theme]
primaryColor = "#543FDD"
backgroundColor = "#FFFFFF"
secondaryBackgroundColor = "#FAFAFA"
textColor = "#2E2E38"
EOF

cat > .streamlit/pages.toml <<EOF
[[pages]]
path = "home_page.py"
name = "Home"

[[pages]]
path = "rate_curves_page.py"
name = "Rate Curves"

[[pages]]
path = "rate_curve_surface.py"
name = "Rate Curve Surface"

[[pages]]
path = "rate_simulations_page.py"
name = "Rate Simulations"

[[pages]]
path = "treasury_inventory.py"
name = "Treasury Inventory"

[[pages]]
path = "treasury_risk.py"
name = "Treasury Risk"

[[pages]]
path = "interest_rate_page.py"
name = "Overnight Rates"
EOF

# Run the app
streamlit run apps/dashboard.py
