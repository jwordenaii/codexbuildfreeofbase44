"""
Vision inference Celery task.

Processes images from the Redis ``vision_queue`` and stores results
with a 24-hour TTL under the ``vision:result:{job_id}`` key.

For production, replace ``run_vision_inference`` with a call to a
Cloud Run PyTorch endpoint (set VISION_INFERENCE_URL env var).
"""

import base64
import json
import logging
import os

logger = logging.getLogger(__name__)


def run_vision_inference(image_bytes: bytes) -> dict:
    """
    Run lot-measurement inference on a raw image.

    Production path: delegates to a Cloud Run PyTorch service when
    VISION_INFERENCE_URL is set.  Returns a stub result otherwise.
    """
    inference_url = os.getenv("VISION_INFERENCE_URL", "")
    if inference_url:
        try:
            import httpx

            resp = httpx.post(
                inference_url,
                json={"image_b64": base64.b64encode(image_bytes).decode()},
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:  # noqa: BLE001
            logger.error("Vision inference request failed: %s", exc)

    # Stub result for dev / offline mode
    return {
        "area_sqft": None,
        "perimeter_ft": None,
        "hma_tons_estimate": None,
        "note": "Vision inference unavailable — set VISION_INFERENCE_URL to enable.",
    }


try:
    from ..celery_app import celery_app

    @celery_app.task(name="app.tasks.vision.process_vision_batch", bind=True, max_retries=3)
    def process_vision_batch(self, batch_size: int = 20):
        """
        Dequeue up to ``batch_size`` items from the Redis vision_queue,
        run inference, and store results under ``vision:result:{job_id}``.
        """
        import redis as redis_client

        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = redis_client.from_url(redis_url, decode_responses=False)
        processed = 0

        for _ in range(batch_size):
            raw = r.lpop("vision_queue")
            if raw is None:
                break

            try:
                payload = json.loads(raw)
                job_id = payload["job_id"]
                image_bytes = base64.b64decode(payload["image_b64"])

                result = run_vision_inference(image_bytes)
                result["job_id"] = job_id
                result["site_id"] = payload.get("site_id")

                r_text = redis_client.from_url(redis_url, decode_responses=True)
                r_text.setex(f"vision:result:{job_id}", 86400, json.dumps(result))
                processed += 1
            except Exception as exc:  # noqa: BLE001
                logger.error("Failed to process vision job: %s", exc)

        return {"processed": processed}

except ImportError:
    # Celery not installed — tasks are unavailable in this environment
    pass
