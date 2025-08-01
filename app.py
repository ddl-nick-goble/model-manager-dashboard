#!/usr/bin/env python3
import os
from flask import Flask, render_template

app = Flask(__name__, static_url_path='/static')

# Domino health‐check stubs (avoid 404s)
@app.route("/_stcore/health")
def health():
    return "", 200

@app.route("/_stcore/host-config")
def host_config():
    return "", 200

@app.route("/")
def home():
    project_id = os.environ.get("DOMINO_PROJECT_ID", "")
    return render_template("index.html", project_id=project_id)

@app.route("/original")
def original():
    project_id = os.environ.get("DOMINO_PROJECT_ID", "")
    return render_template("original_index.html", project_id=project_id)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8888))
    app.run(host="0.0.0.0", port=port)
