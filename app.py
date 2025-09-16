#!/usr/bin/env python3
import os
import requests
from urllib.parse import urljoin
from flask import Flask, render_template, request, Response

app = Flask(__name__, static_url_path='/static')


DOMINO_DOMAIN = os.environ.get("DOMINO_DOMAIN", "")
DOMINO_API_KEY = os.environ.get("DOMINO_API_KEY", "")

# ---- Health stubs Domino pokes ----
@app.route("/_stcore/health")
def health():
    return "", 200

@app.route("/_stcore/host-config")
def host_config():
    return "", 200

@app.route("/proxy/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
def proxy_request(path):
    if request.method == "OPTIONS":
        return "", 204
    
    # Get target URL from query param or header
    target_base = request.args.get('target') or request.headers.get('X-Target-URL')
    if not target_base:
        return {"error": "Missing target URL. Use ?target=https://api.example.com or X-Target-URL header"}, 400
    
    # Build upstream URL
    upstream_url = urljoin(target_base.rstrip("/") + "/", path)
    
    # Forward headers (exclude hop-by-hop headers)
    forward_headers = {}
    skip_headers = {"host", "content-length", "transfer-encoding", "connection", "keep-alive"}
    
    for key, value in request.headers:
        if key.lower() not in skip_headers:
            forward_headers[key] = value
    
    try:
        # Make the upstream request
        resp = requests.request(
            method=request.method,
            url=upstream_url,
            params=request.args,
            data=request.get_data(),
            headers=forward_headers,
            timeout=30,
            stream=True
        )
        
        # Forward response headers (exclude hop-by-hop)
        response_headers = []
        hop_by_hop = {"content-encoding", "transfer-encoding", "connection", "keep-alive"}
        
        for key, value in resp.headers.items():
            if key.lower() not in hop_by_hop:
                response_headers.append((key, value))
        
        return Response(
            resp.iter_content(chunk_size=8192),
            status=resp.status_code,
            headers=response_headers,
            direct_passthrough=True
        )
        
    except requests.RequestException as e:
        return {"error": f"Proxy request failed: {str(e)}"}, 502


# ---- Page routes ----
def safe_domino_config():
    return {
        "PROJECT_ID": os.environ.get("DOMINO_PROJECT_ID", ""),
        "RUN_HOST_PATH": os.environ.get("DOMINO_RUN_HOST_PATH", ""),
        "API_BASE": DOMINO_DOMAIN,
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
