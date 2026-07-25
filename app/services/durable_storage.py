"""
durable_storage.py — shared "give me a directory that survives a redeploy"
helper, extracted from runtime_config.py's existing smart-fallback logic.

drone_capture.py, lidar_ingest.py, roller_telemetry.py, and dispatch_engine.py
were each independently defaulting straight to /tmp/... with no attempt to
find a mounted volume first — meaning captured drone/lidar files and roller/
dispatch state were silently lost on every Fly redeploy. runtime_config.py
already had the right fallback chain (explicit env var -> legacy Railway
mount -> /data if a volume is mounted there -> /tmp as last resort); this
module makes that logic reusable instead of duplicated (badly) four times.
"""

from __future__ import annotations

import os
from pathlib import Path


def durable_data_dir(explicit: str | None = None) -> Path:
    """
    Resolve a base directory that survives a redeploy if at all possible.

    Priority: explicit env var value -> legacy RAILWAY_VOLUME_MOUNT_PATH ->
    /data if a volume is mounted there and writable -> /tmp as a last resort
    (ephemeral on Fly.io — callers should treat this as "no volume mounted").
    """
    if explicit and explicit.strip():
        return Path(explicit.strip())

    railway_mount = (os.environ.get("RAILWAY_VOLUME_MOUNT_PATH") or "").strip()
    if railway_mount:
        return Path(railway_mount)

    data_dir = Path("/data")
    try:
        if data_dir.exists() and os.access(data_dir, os.W_OK):
            return data_dir
    except Exception:  # noqa: BLE001
        pass

    if os.name == "nt":
        return Path.cwd() / ".runtime"

    return Path("/tmp")
