#!/usr/bin/env python3
import os
from flask import Flask, render_template, request
from flask_cors import CORS
from flask_cors import CORS

app = Flask(__name__, static_url_path='/static')

# Nuclear option - disable all CORS restrictions
ALLOWED_ORIGINS = [os.environ.get("DOMINO_DOMAIN", "https://se-demo.domino.tech"), "https://apps.se-demo.domino.tech"]

print('allowed origins...', ALLOWED_ORIGINS)

CORS(
    app,
    origins=ALLOWED_ORIGINS,               # e.g. "https://se-demo.domino.tech"
    methods=["GET","POST","PUT","DELETE","OPTIONS"],
    allow_headers=["Authorization","Content-Type","X-Domino-Api-Key","Accept"]
)

# Remove the manual after_request CORS block to avoid conflicts

@app.after_request
def after_request(response):
    # Manual CORS headers as backup
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', '*')
    response.headers.add('Access-Control-Allow-Methods', '*')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route("/_stcore/health")
def health():
    return "", 200

@app.route("/_stcore/host-config") 
def host_config():
    return "", 200

def safe_domino_config():
    """POC whitelist — add/remove keys as needed."""
    # Use the external Domino domain directly 
    domino_domain = os.environ.get("DOMINO_DOMAIN", "https://se-demo.domino.tech")
    if not domino_domain.startswith('http'):
        domino_domain = f"https://{domino_domain}"
        
    return {
        "PROJECT_ID": os.environ.get("DOMINO_PROJECT_ID", ""),
        "RUN_HOST_PATH": os.environ.get("DOMINO_RUN_HOST_PATH", ""),
        "API_BASE": domino_domain,  # Point directly to external API
        "API_KEY": os.environ.get("DOMINO_API_KEY", ""),
    }

@app.route("/")
def home():
    config = safe_domino_config()
    print(f"Config: {config}")
    return render_template("index.html", DOMINO=config)

@app.route("/original")
def original():
    return render_template("original_index.html", DOMINO=safe_domino_config())

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8888))
    app.run(host="0.0.0.0", port=port, debug=True)