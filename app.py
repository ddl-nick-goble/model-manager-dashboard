#!/usr/bin/env python3
import os
import requests
from urllib.parse import urljoin
from flask import Flask, render_template, request, Response, jsonify
import logging

app = Flask(__name__, static_url_path='/static')

# Add logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

DOMINO_DOMAIN = os.environ.get("DOMINO_DOMAIN", "")
DOMINO_API_KEY = os.environ.get("DOMINO_API_KEY", "")

logger.info(f"DOMINO_DOMAIN: {DOMINO_DOMAIN}")
logger.info(f"DOMINO_API_KEY: {'***' if DOMINO_API_KEY else 'NOT SET'}")

# ---- Health stubs Domino pokes ----
@app.route("/_stcore/health")
def health():
    return "", 200

@app.route("/_stcore/host-config")
def host_config():
    return "", 200

@app.route("/proxy/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
def proxy_request(path):
    logger.info(f"Proxy request: {request.method} {path}")
    logger.info(f"Query params: {dict(request.args)}")
    logger.info(f"Headers: {dict(request.headers)}")
    
    if request.method == "OPTIONS":
        return "", 204
    
    # Get target URL from query param or header
    target_base = request.args.get('target') or request.headers.get('X-Target-URL')
    if not target_base:
        error_msg = "Missing target URL. Use ?target=https://api.example.com or X-Target-URL header"
        logger.error(error_msg)
        return jsonify({"error": error_msg}), 400
    
    logger.info(f"Target base: {target_base}")
    
    # Build upstream URL
    upstream_url = urljoin(target_base.rstrip("/") + "/", path)
    logger.info(f"Upstream URL: {upstream_url}")
    
    # Forward headers (exclude hop-by-hop headers)
    forward_headers = {}
    skip_headers = {"host", "content-length", "transfer-encoding", "connection", "keep-alive"}
    
    for key, value in request.headers:
        if key.lower() not in skip_headers:
            forward_headers[key] = value
    
    logger.info(f"Forward headers: {forward_headers}")
    
    try:
        # Make the upstream request
        logger.info(f"Making upstream request: {request.method} {upstream_url}")
        
        # Filter out the 'target' parameter from upstream request
        upstream_params = {k: v for k, v in request.args.items() if k != 'target'}
        logger.info(f"Upstream params: {upstream_params}")
        
        resp = requests.request(
            method=request.method,
            url=upstream_url,
            params=upstream_params,
            data=request.get_data(),
            headers=forward_headers,
            timeout=30,
            stream=True
        )
        
        logger.info(f"Upstream response: {resp.status_code}")
        logger.info(f"Upstream response headers: {dict(resp.headers)}")
        
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
        error_msg = f"Proxy request failed: {str(e)}"
        logger.error(error_msg)
        logger.exception("Full exception details:")
        return jsonify({"error": error_msg}), 502
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(error_msg)
        logger.exception("Full exception details:")
        return jsonify({"error": error_msg}), 500

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