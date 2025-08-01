import requests

url = "https://se-demo.domino.tech/assets/public-api.json"
output_path = "swagger.json"

with requests.get(url, stream=True) as r:
    r.raise_for_status()
    with open(output_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)

print(f"Downloaded Swagger JSON to {output_path}")
