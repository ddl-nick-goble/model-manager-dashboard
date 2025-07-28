from pathlib import Path

def get_artifact_path(filename):
    ARTIFACT_DIR = Path("/mnt/artifacts/results")
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    fn = ARTIFACT_DIR / filename
    return fn
