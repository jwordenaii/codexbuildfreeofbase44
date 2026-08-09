"""
Tests for object storage — the home for real uploaded files.

WHY: staff check-in photos, signed worker compliance documents (I-9s,
licences, certifications), drone captures and lidar scans were being written
to a path that resolves to /tmp on this deployment, because jworden-api has no
Fly volume mounted. Every redeploy destroyed them.

Two behaviours matter and are tested here:

  1. With a bucket configured, bytes go to object storage and come back.
  2. With NO bucket configured, nothing explodes — writes fall back to local
     disk and `put()` returns False so callers can log the fact that the file
     is not durable. Deploying this code before the bucket exists must be a
     no-op, not an outage.
"""

import io
from pathlib import Path

import pytest

from app.services import object_storage


class FakeS3:
    """Minimal in-memory stand-in for the boto3 S3 client surface we use."""

    def __init__(self):
        self.store: dict[tuple[str, str], bytes] = {}
        self.content_types: dict[tuple[str, str], str] = {}

    def put_object(self, Bucket, Key, Body, **extra):  # noqa: N803
        self.store[(Bucket, Key)] = Body
        if "ContentType" in extra:
            self.content_types[(Bucket, Key)] = extra["ContentType"]
        return {}

    def get_object(self, Bucket, Key):  # noqa: N803
        if (Bucket, Key) not in self.store:
            raise KeyError("NoSuchKey")
        return {"Body": io.BytesIO(self.store[(Bucket, Key)])}

    def head_object(self, Bucket, Key):  # noqa: N803
        if (Bucket, Key) not in self.store:
            raise KeyError("404")
        return {}

    def delete_object(self, Bucket, Key):  # noqa: N803
        self.store.pop((Bucket, Key), None)
        return {}


@pytest.fixture()
def bucket(monkeypatch, tmp_path):
    """Object storage configured and reachable."""
    fake = FakeS3()
    monkeypatch.setenv("OBJECT_STORAGE_BUCKET", "test-bucket")
    monkeypatch.setattr(object_storage, "_client", fake)
    monkeypatch.setattr(object_storage, "_client_checked", True)
    monkeypatch.setattr(object_storage, "durable_data_dir", lambda *a: tmp_path)
    return fake


@pytest.fixture()
def no_bucket(monkeypatch, tmp_path):
    """No object storage — the state production is in until a bucket is attached."""
    monkeypatch.delenv("OBJECT_STORAGE_BUCKET", raising=False)
    monkeypatch.delenv("BUCKET_NAME", raising=False)
    monkeypatch.setattr(object_storage, "_client", None)
    monkeypatch.setattr(object_storage, "_client_checked", True)
    monkeypatch.setattr(object_storage, "durable_data_dir", lambda *a: tmp_path)
    return tmp_path


# ── with a bucket ─────────────────────────────────────────────────────────────

def test_roundtrip_through_bucket(bucket):
    assert object_storage.enabled() is True
    assert object_storage.put("staff-docs/7/i9/signed.pdf", b"PDF-BYTES", "application/pdf") is True
    assert object_storage.get("staff-docs/7/i9/signed.pdf") == b"PDF-BYTES"
    assert object_storage.exists("staff-docs/7/i9/signed.pdf") is True
    assert bucket.content_types[("test-bucket", "staff-docs/7/i9/signed.pdf")] == "application/pdf"


def test_delete_removes_object(bucket):
    object_storage.put("k", b"v")
    object_storage.delete("k")
    assert object_storage.get("k") is None
    assert object_storage.exists("k") is False


def test_missing_key_returns_none(bucket):
    assert object_storage.get("never/written") is None


def test_bucket_write_failure_falls_back_to_disk(bucket, monkeypatch, tmp_path):
    """A provider outage must not lose the upload outright."""
    def boom(**_kwargs):
        raise RuntimeError("tigris unavailable")

    monkeypatch.setattr(bucket, "put_object", boom)
    assert object_storage.put("k", b"payload") is False   # signalled as non-durable
    assert object_storage.get("k") == b"payload"          # but not lost


# ── without a bucket (current production state) ───────────────────────────────

def test_no_bucket_still_stores_and_reports_non_durable(no_bucket):
    assert object_storage.enabled() is False
    # False == "did not reach object storage", which is what callers log on.
    assert object_storage.put("staff-photos/3/x.jpg", b"JPEG") is False
    assert object_storage.get("staff-photos/3/x.jpg") == b"JPEG"


def test_status_warns_loudly_when_unconfigured(no_bucket):
    status = object_storage.storage_status()
    assert status["enabled"] is False
    assert "lost" in (status["warning"] or "").lower()


def test_status_is_clean_when_configured(bucket):
    status = object_storage.storage_status()
    assert status["enabled"] is True
    assert status["warning"] is None
    assert status["bucket"] == "test-bucket"


# ── key safety ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("key", ["../escape", "a/../../etc/passwd", "x/../../../y"])
def test_traversal_keys_are_refused(no_bucket, key):
    """A filename must never be able to walk out of the storage root."""
    with pytest.raises(ValueError):
        object_storage.put(key, b"x")


def test_migration_copies_stranded_local_files(bucket, tmp_path):
    """
    Files written during the disk-only era must be recoverable once a bucket
    is attached, otherwise attaching one silently orphans existing uploads.
    """
    legacy = tmp_path / "legacy_docs"
    (legacy / "12" / "i9").mkdir(parents=True)
    (legacy / "12" / "i9" / "scan.pdf").write_bytes(b"OLD-DOC")

    result = object_storage.migrate_local_tree(legacy, "staff-docs")
    assert result["uploaded"] == 1
    assert object_storage.get("staff-docs/12/i9/scan.pdf") == b"OLD-DOC"

    # Re-running must be safe.
    again = object_storage.migrate_local_tree(legacy, "staff-docs")
    assert again["uploaded"] == 0 and again["skipped"] == 1


def test_migration_is_a_noop_without_a_bucket(no_bucket, tmp_path):
    legacy = tmp_path / "legacy"
    legacy.mkdir()
    (legacy / "f.bin").write_bytes(b"x")
    assert object_storage.migrate_local_tree(legacy, "p")["uploaded"] == 0


def test_staff_router_keys_are_derived_from_existing_columns():
    """
    Keys must be reconstructible from columns already on the row, so finding a
    file later needs no schema migration.
    """
    from app.routers import staff_router

    assert staff_router.photo_key(4, "4_selfie.jpg") == "staff-photos/4/4_selfie.jpg"
    assert staff_router.doc_key(9, "i9", "scan.pdf") == "staff-docs/9/i9/scan.pdf"
