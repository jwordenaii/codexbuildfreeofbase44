"""
Celery task: vision model batch inference for lot auto-measurement.

This task processes a queue of project photos stored in the ``vision_queue``
Redis list and runs them through the PyTorch segmentation model to detect
pavement boundaries and measure lot area.

Architecture:
  Frontend → POST /api/v1/ai/vision-measure (enqueue job)
       ↓
  Redis vision_queue (job IDs)
       ↓
  Celery worker: process_vision_batch (this task, runs every 15 min)
       ↓
  PyTorch model inference → OpenCV corner refinement
       ↓
  Results stored in Redis (key: vision:result:{job_id})

Production setup (see README for Cloud Run deployment):
  - Deploy the PyTorch inference container to Google Cloud Run
  - Set VISION_INFERENCE_URL to point to the Cloud Run endpoint
  - The task will delegate to Cloud Run instead of running locally

Environment variables:
  VISION_INFERENCE_URL  — URL of the Cloud Run PyTorch inference service
  REDIS_URL             — Redis connection URL
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

from ..celery_app import celery_app

logger = logging.getLogger(__name__)

_VISION_INFERENCE_URL = os.getenv("VISION_INFERENCE_URL", "")
_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


def _run_local_inference(image_bytes: bytes) -> dict:
    """
    Stub local inference when PyTorch/Cloud Run is not available.

    In production, replace this with:
      1. Load a torchscript model from disk: torch.jit.load("model.pt")
      2. Pre-process the image tensor
      3. Run model inference to get a segmentation mask
      4. Post-process with OpenCV for sub-pixel corner detection
      5. Return area/perimeter measurements

    Returns a mock measurement result for development.
    """
    return {
        "engine": "stub",
        "lot_detected": True,
        "area_sqft": 8_450.0,
        "perimeter_ft": 412.0,
        "confidence": 0.91,
        "measurements": [
            {"label": "main_lot", "area_sqft": 8_200.0, "perimeter_ft": 395.0},
            {"label": "access_aisle", "area_sqft": 250.0, "perimeter_ft": 88.0},
        ],
        "notes": (
            "Set VISION_INFERENCE_URL to the PyTorch Cloud Run endpoint to enable "
            "real vision-based lot measurement. This is a demonstration response."
        ),
    }


def _run_cloud_run_inference(image_bytes: bytes) -> dict:
    """
    Delegate inference to the Google Cloud Run PyTorch service.
    """
    import base64
    import httpx

    payload = {"image_b64": base64.b64encode(image_bytes).decode()}
    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(f"{_VISION_INFERENCE_URL}/infer", json=payload)
            resp.raise_for_status()
            result = resp.json()
            result["engine"] = "pytorch_cloud_run"
            return result
    except Exception as exc:  # noqa: BLE001
        logger.error("Cloud Run inference failed: %s — falling back to stub", exc)
        stub = _run_local_inference(image_bytes)
        stub["engine"] = "stub_fallback"
        stub["error"] = str(exc)
        return stub


def run_vision_inference(image_bytes: bytes) -> dict:
    """
    Run vision inference for a single image.

    Delegates to Cloud Run if VISION_INFERENCE_URL is set,
    otherwise uses the local stub.
    """
    if _VISION_INFERENCE_URL:
        return _run_cloud_run_inference(image_bytes)
    return _run_local_inference(image_bytes)


@celery_app.task(
    name="app.tasks.vision.process_vision_batch",
    bind=True,
    max_retries=2,
    default_retry_delay=120,
    soft_time_limit=480,
    time_limit=600,
)
def process_vision_batch(self, batch_size: int = 20) -> dict:
    """
    Celery task: process pending vision inference jobs from the Redis queue.

    Job format in Redis list ``vision_queue``:
        {"job_id": "<uuid>", "image_b64": "<base64>", "site_id": <int|null>}

    Results are stored in Redis at key ``vision:result:<job_id>``
    with a 24-hour TTL so the frontend can poll for results.
    """
    import base64
    import redis as redis_client

    r = redis_client.from_url(_REDIS_URL, decode_responses=False)

    processed = 0
    failed = 0

    for _ in range(batch_size):
        raw = r.lpop("vision_queue")
        if raw is None:
            break   # Queue is empty

        try:
            job = json.loads(raw)
            job_id = job["job_id"]
            image_bytes = base64.b64decode(job["image_b64"])

            result = run_vision_inference(image_bytes)
            result["job_id"] = job_id
            result["site_id"] = job.get("site_id")
            result["completed_at"] = datetime.now(timezone.utc).isoformat()

            # Store result with 24-hour TTL
            r.setex(
                f"vision:result:{job_id}",
                86_400,
                json.dumps(result),
            )
            processed += 1
            logger.info("Vision job %s completed: area=%.0f sqft", job_id, result.get("area_sqft", 0))

        except Exception as exc:  # noqa: BLE001
            failed += 1
            logger.error("Vision job failed: %s", exc)

    summary = {
        "status": "completed",
        "processed": processed,
        "failed": failed,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("Vision batch complete: %s", summary)
    return summary
