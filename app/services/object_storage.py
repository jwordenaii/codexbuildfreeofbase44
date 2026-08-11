"""
object_storage.py — S3-compatible blob storage for real uploaded files.

WHY THIS EXISTS (verified 2026-07-26):

Staff photos, signed worker documents, drone captures and lidar scans are
files people actually upload. They were being written under
durable_storage.durable_data_dir(), which sounds safe but resolves to /tmp on
this deployment, because `flyctl volumes list -a jworden-api` returns an empty
table — there is no volume mounted. Every redeploy destroyed them.

Postgres (see durable_kv.py) fixed the small control-plane state, but blobs do
not belong in a database column: a 50MB signed PDF in a TEXT field is a
different kind of mistake. Object storage is the right home, and it is also
the only option that behaves correctly with the two machines this app runs —
both read and write the same bucket, unlike a volume, which attaches to one
machine and silently diverges.

CONFIGURATION
Fly's Tigris add-on sets these automatically when a bucket is attached:

    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
    AWS_ENDPOINT_URL_S3     (e.g. https://fly.storage.tigris.dev)
    AWS_REGION
    BUCKET_NAME

Any S3-compatible provider works; override the bucket with OBJECT_STORAGE_BUCKET.

FALLBACK
When the bucket is not configured, every call transparently falls back to the
local filesystem under durable_data_dir(). That keeps local development and
the test suite working with no setup, and means deploying this code before the
bucket exists changes nothing rather than breaking uploads. `enabled()` reports
which mode is live so an operator can tell the difference instead of guessing.
"""

from __future__ import annotations

import logging
import os
import shutil
from pathlib import Path

from .durable_storage import durable_data_dir

logger = logging.getLogger(__name__)

_client = None
_client_checked = False


def bucket_name() -> str:
    return (
        os.getenv("OBJECT_STORAGE_BUCKET")
        or os.getenv("BUCKET_NAME")
        or ""
    ).strip()


def _client_or_none():
    """Lazily build the boto3 client. Returns None when unconfigured."""
    global _client, _client_checked
    if _client_checked:
        return _client
    _client_checked = True

    if not bucket_name():
        logger.info("object_storage: no bucket configured — using local disk fallback")
        return None
    if not (os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY")):
        logger.warning(
            "object_storage: bucket %s set but AWS credentials are missing — "
            "falling back to local disk, uploads will NOT survive a redeploy",
            bucket_name(),
        )
        return None

    try:
        import boto3  # noqa: PLC0415

        endpoint = (os.getenv("AWS_ENDPOINT_URL_S3") or os.getenv("AWS_ENDPOINT_URL") or "").strip()
        _client = boto3.client(
            "s3",
            endpoint_url=endpoint or None,
            region_name=(os.getenv("AWS_REGION") or "auto").strip(),
        )
        logger.info("object_storage: using bucket %s at %s", bucket_name(), endpoint or "aws")
    except Exception as exc:  # noqa: BLE001
        logger.error("object_storage: client init failed, using local disk: %s", exc)
        _client = None
    return _client


def enabled() -> bool:
    """True when writes go to object storage rather than ephemeral local disk."""
    return _client_or_none() is not None


def _check_key(key: str) -> str:
    """
    Validate a key for BOTH backends, not just the disk one.

    A ".." segment is harmless in S3 (keys are opaque strings, not paths) but
    becomes a traversal the moment such an object is written back to disk —
    during the local fallback, or a future export/restore. Rejecting it in one
    place keeps the two backends from disagreeing about what is storable.
    """
    safe = Path(str(key).replace("\\", "/")).as_posix().lstrip("/")
    if not safe or ".." in safe.split("/"):
        raise ValueError(f"unsafe object key: {key!r}")
    return safe


def _local_path(key: str) -> Path:
    return durable_data_dir() / "jworden_objects" / _check_key(key)


def put(key: str, data: bytes, content_type: str | None = None) -> bool:
    """
    Store bytes at `key`. Returns True if it landed in object storage,
    False if it fell back to local disk (i.e. will not survive a redeploy).
    Raises only on a genuinely unusable key.
    """
    _check_key(key)
    client = _client_or_none()
    if client is not None:
        try:
            extra = {"ContentType": content_type} if content_type else {}
            client.put_object(Bucket=bucket_name(), Key=key, Body=data, **extra)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("object_storage: put(%s) failed, writing locally: %s", key, exc)

    path = _local_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return False


def get(key: str) -> bytes | None:
    """Fetch bytes, or None if absent. Checks object storage then local disk."""
    _check_key(key)
    client = _client_or_none()
    if client is not None:
        try:
            resp = client.get_object(Bucket=bucket_name(), Key=key)
            return resp["Body"].read()
        except Exception as exc:  # noqa: BLE001
            # A miss is normal for files written before the bucket existed, so
            # fall through to disk rather than treating this as an error.
            logger.debug("object_storage: get(%s) miss (%s), trying local", key, exc)

    path = _local_path(key)
    try:
        return path.read_bytes()
    except (OSError, ValueError):
        return None


def delete(key: str) -> bool:
    client = _client_or_none()
    ok = False
    if client is not None:
        try:
            client.delete_object(Bucket=bucket_name(), Key=key)
            ok = True
        except Exception as exc:  # noqa: BLE001
            logger.error("object_storage: delete(%s) failed: %s", key, exc)
    try:
        _local_path(key).unlink()
        ok = True
    except (OSError, ValueError):
        pass
    return ok


def exists(key: str) -> bool:
    client = _client_or_none()
    if client is not None:
        try:
            client.head_object(Bucket=bucket_name(), Key=key)
            return True
        except Exception:  # noqa: BLE001
            pass
    try:
        return _local_path(key).is_file()
    except ValueError:
        return False


def migrate_local_tree(local_root: Path, key_prefix: str) -> dict:
    """
    Copy any files still sitting on local disk up into the bucket.

    Used once after a bucket is first attached, so uploads made during the
    file-only era are not stranded. Safe to re-run: existing keys are skipped.
    """
    result = {"uploaded": 0, "skipped": 0, "failed": 0, "enabled": enabled()}
    if not enabled() or not local_root.exists():
        return result
    for path in local_root.rglob("*"):
        if not path.is_file():
            continue
        key = f"{key_prefix}/{path.relative_to(local_root).as_posix()}"
        try:
            if exists(key):
                result["skipped"] += 1
                continue
            if put(key, path.read_bytes()):
                result["uploaded"] += 1
            else:
                result["failed"] += 1
        except Exception as exc:  # noqa: BLE001
            logger.error("object_storage: migrate %s failed: %s", path, exc)
            result["failed"] += 1
    return result


def storage_status() -> dict:
    """Operator-facing summary — used by the admin health surface."""
    return {
        "enabled": enabled(),
        "bucket": bucket_name() or None,
        "endpoint": (os.getenv("AWS_ENDPOINT_URL_S3") or "").strip() or None,
        "fallback_path": str(durable_data_dir() / "jworden_objects"),
        "warning": (
            None
            if enabled()
            else "Object storage is NOT configured. Uploaded files are on local "
                 "disk and will be lost on the next redeploy."
        ),
        "local_disk_free_mb": (
            round(shutil.disk_usage(durable_data_dir()).free / 1_048_576)
            if durable_data_dir().exists()
            else None
        ),
    }
