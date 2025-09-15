#!/usr/bin/env python3
import os
import requests
from urllib.parse import urljoin
from flask import Flask, render_template, request, Response
from flask_cors import CORS

app = Flask(__name__, static_url_path='/static')

# Only the front-end origin needs to call this app
ALLOWED_ORIGINS = list(set([o.strip() for o in set([os.environ.get(
    "DOMINO_DOMAIN",
    "https://apps.se-demo.domino.tech"
),     "https://apps.se-demo.domino.tech",     "https://se-demo.domino.tech"])
]))

print("ALLOWED_ORIGINS:", ALLOWED_ORIGINS)

CORS(
    app,
    origins=ALLOWED_ORIGINS,
    supports_credentials=False,  # set True only if you actually use cookies
    methods=["GET","POST","PUT","DELETE","OPTIONS","PATCH"],
    allow_headers=["Authorization","Content-Type","X-Domino-Api-Key","Accept"]
)

DOMINO_DOMAIN = os.environ.get("DOMINO_DOMAIN", "https://se-demo.domino.tech").rstrip("/")
print('domino domain here', DOMINO_DOMAIN)
DOMINO_API_KEY = os.environ.get("DOMINO_API_KEY", "")

# ---- Health stubs Domino pokes ----
@app.route("/_stcore/health")
def health():
    return "", 200

@app.route("/_stcore/host-config")
def host_config():
    return "", 200

# ---- SAME-ORIGIN PROXY → kills browser CORS ----
@app.route("/proxy/governance/<path:path>", methods=["GET","POST","PUT","DELETE","PATCH","OPTIONS"])
def proxy_governance(path):
    # CORS preflight; Flask-CORS will add headers
    if request.method == "OPTIONS":
        return ("", 204)

    upstream = urljoin(DOMINO_DOMAIN + "/", f"api/governance/v1/{path}")

    # Only send what we intend upstream
    fwd_headers = {
        "X-Domino-Api-Key": DOMINO_API_KEY,
        "Accept": request.headers.get("Accept", "application/json"),
        "Content-Type": request.headers.get("Content-Type", "application/json"),
    }

    resp = requests.request(
        method=request.method,
        url=upstream,
        params=request.args,          # ?bundleId=...
        data=request.get_data(),      # body passthrough
        headers=fwd_headers,
        timeout=60,
        stream=True
    )

    # Build a clean streaming response back to browser
    hop_by_hop = {"content-encoding","transfer-encoding","connection","keep-alive"}
    passthrough = [(k, v) for k, v in resp.raw.headers.items() if k.lower() not in hop_by_hop]

    return Response(
        resp.iter_content(chunk_size=8192),
        status=resp.status_code,
        headers=passthrough,
        content_type=resp.headers.get("Content-Type"),
        direct_passthrough=True
    )

# ---- Page routes ----
def safe_domino_config():
    return {
        "PROJECT_ID": os.environ.get("DOMINO_PROJECT_ID", ""),
        "RUN_HOST_PATH": os.environ.get("DOMINO_RUN_HOST_PATH", ""),
        # Kept for reference, but your JS will hit the proxy now:
        "API_BASE": DOMINO_DOMAIN,
        # Keep the key server-side; don’t expose it to JS anymore
        "API_KEY": os.environ.get("DOMINO_API_KEY", ""),   
    }

@app.route("/")
def home():
    return render_template("index.html", DOMINO=safe_domino_config())

@app.route("/original")
def original():
    return render_template("original_index.html", DOMINO=safe_domino_config())

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8888))
    app.run(host="0.0.0.0", port=port, debug=True)
