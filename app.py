#!/usr/bin/env python3
import os
from flask import Flask, render_template, request

app = Flask(__name__, static_url_path='/static')

@app.route("/_stcore/health")
def health():
    return "", 200

@app.route("/_stcore/host-config")
def host_config():
    return "", 200

def safe_domino_config():
    """POC whitelist — add/remove keys as needed."""
    return {
        "PROJECT_ID": os.environ.get("DOMINO_PROJECT_ID", ""),
        "RUN_HOST_PATH": os.environ.get("DOMINO_RUN_HOST_PATH", ""),
        "API_BASE": request.url_root.rstrip("/"),   # same-origin base
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
    app.run(host="0.0.0.0", port=port)
