#!/usr/bin/env python3
import os
import requests
import subprocess
from urllib.parse import urljoin
from flask import Flask, render_template, request, Response, jsonify
import logging

app = Flask(__name__, static_url_path='/static')

# Balanced logging - keep useful info, reduce noise
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)

# Keep werkzeug for request logs, reduce urllib3 debug spam
logging.getLogger('urllib3.connectionpool').setLevel(logging.INFO)
logging.getLogger('werkzeug').setLevel(logging.INFO)

DOMINO_DOMAIN = os.environ.get("DOMINO_DOMAIN", "")
DOMINO_API_KEY = os.environ.get("DOMINO_API_KEY", "")

logger.info(f"DOMINO_DOMAIN: {DOMINO_DOMAIN}")
logger.info(f"DOMINO_API_KEY: {'***' if DOMINO_API_KEY else 'NOT SET'}")

# Test curl command at startup
def test_api_connectivity():
    if not DOMINO_DOMAIN or not DOMINO_API_KEY:
        logger.error("Missing DOMINO_DOMAIN or DOMINO_API_KEY environment variables")
        return
    
    test_url = f"{DOMINO_DOMAIN}/api/governance/v1/bundles"
    
    # Build the exact curl command
    curl_cmd_str = f"curl -s -w 'HTTP_CODE:%{{http_code}}' -H 'X-Domino-Api-Key: {DOMINO_API_KEY}' -H 'Accept: application/json' '{test_url}'"
    curl_cmd = [
        'curl', '-s', '-w', 'HTTP_CODE:%{http_code}',
        '-H', f'X-Domino-Api-Key: {DOMINO_API_KEY}',
        '-H', 'Accept: application/json',
        test_url
    ]
    
    try:
        logger.info(f"Testing API connectivity with:")
        logger.info(f"  {curl_cmd_str}")
        result = subprocess.run(curl_cmd, capture_output=True, text=True, timeout=30)
        logger.info(f"Curl exit code: {result.returncode}")
        logger.info(f"Curl stdout: {result.stdout}")
        if result.stderr:
            logger.info(f"Curl stderr: {result.stderr}")
    except subprocess.TimeoutExpired:
        logger.error("Curl command timed out after 30 seconds")
        logger.info(f"Copy/paste to test manually: {curl_cmd_str}")
    except Exception as e:
        logger.error(f"Curl command failed: {str(e)}")
        logger.info(f"Copy/paste to test manually: {curl_cmd_str}")

# Health check endpoints
@app.route("/_stcore/health")
def health():
    return "", 200

@app.route("/_stcore/host-config")
def host_config():
    return "", 200

@app.route("/proxy/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
def proxy_request(path):
    logger.info(f"Proxy request: {request.method} {path}")
    
    if request.method == "OPTIONS":
        return "", 204
    
    # Get target URL from query param
    target_base = request.args.get('target')
    if not target_base:
        error_msg = "Missing target URL. Use ?target=https://api.example.com"
        logger.error(error_msg)
        return jsonify({"error": error_msg}), 400
    
    # Build upstream URL
    upstream_url = urljoin(target_base.rstrip("/") + "/", path)
    
    # Forward headers (exclude hop-by-hop headers and conflicting auth)
    forward_headers = {}
    skip_headers = {
        "host", "content-length", "transfer-encoding", "connection", "keep-alive",
        "authorization"  # Skip this - conflicts with X-Domino-Api-Key
    }
    
    for key, value in request.headers:
        if key.lower() not in skip_headers:
            forward_headers[key] = value
    
    # Filter out the 'target' parameter from upstream request
    upstream_params = {k: v for k, v in request.args.items() if k != 'target'}
    
    logger.info(f"Making upstream request: {request.method} {upstream_url}")
    if upstream_params:
        logger.info(f"Upstream params: {upstream_params}")
    
    # Log the equivalent curl command for debugging
    headers_str = " ".join([f"-H '{k}: {v}'" for k, v in forward_headers.items()])
    params_str = "&".join([f"{k}={v}" for k, v in upstream_params.items()])
    final_url = f"{upstream_url}?{params_str}" if params_str else upstream_url
    curl_equivalent = f"curl -X {request.method} {headers_str} '{final_url}'"
    logger.info(f"Equivalent curl command:")
    logger.info(f"  {curl_equivalent}")
    
    try:
        # Make the upstream request
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
        
        # Log response body for debugging (truncated)
        if resp.status_code >= 400:
            try:
                # Get a copy of the content for logging
                content = resp.content
                logger.error(f"Upstream error response body: {content[:1000].decode('utf-8', errors='ignore')}")
                # Create new response with the content
                response_headers = []
                hop_by_hop = {"content-encoding", "transfer-encoding", "connection", "keep-alive"}
                
                for key, value in resp.headers.items():
                    if key.lower() not in hop_by_hop:
                        response_headers.append((key, value))
                
                return Response(
                    content,
                    status=resp.status_code,
                    headers=response_headers
                )
            except Exception as e:
                logger.error(f"Error reading response content: {str(e)}")
        
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
        return jsonify({"error": error_msg}), 502
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(error_msg)
        return jsonify({"error": error_msg}), 500

# Page routes
def safe_domino_config():
    return {
        "PROJECT_ID": os.environ.get("DOMINO_PROJECT_ID", ""),
        "RUN_HOST_PATH": os.environ.get("DOMINO_RUN_HOST_PATH", ""),
        "API_BASE": DOMINO_DOMAIN,
        "API_KEY": DOMINO_API_KEY,   
    }

@app.route("/")
def home():
    return render_template("index.html", DOMINO=safe_domino_config())

@app.route("/original")
def original():
    return render_template("original_index.html", DOMINO=safe_domino_config())

if __name__ == "__main__":
    # Test API connectivity on startup
    test_api_connectivity()
    
    port = int(os.environ.get("PORT", 8888))
    logger.info(f"Starting Flask app on port {port}")
    app.run(host="0.0.0.0", port=port, debug=True)