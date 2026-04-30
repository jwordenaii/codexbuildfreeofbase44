"""
Celery application factory for JWordenAI background task processing.

Broker: Redis (REDIS_URL env var, defaults to localhost)
Result backend: Redis (same URL)

Workers are started with:
    celery -A app.celery_app worker --loglevel=info --concurrency=4

Periodic tasks (Celery Beat):
    celery -A app.celery_app beat --loglevel=info

Beat schedule (see CELERYBEAT_SCHEDULE below):
  - scrape_virginia_lis  — runs every 6 hours
  - process_vision_queue — runs every 15 minutes
"""

import os

from celery import Celery
from celery.schedules import crontab

_BROKER_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", _BROKER_URL)

celery_app = Celery(
    "jworden_tasks",
    broker=_BROKER_URL,
    backend=_RESULT_BACKEND,
    include=[
        "app.tasks.scraper",
        "app.tasks.vision",
        "app.tasks.cache_warmer",
        "app.tasks.email_tasks",
        "app.tasks.vector_tasks",
    ],
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Timezone
    timezone="America/New_York",
    enable_utc=True,

    # Retries
    task_acks_late=True,
    task_reject_on_worker_lost=True,

    # Result expiry — keep results for 1 hour (dashboard polling)
    result_expires=3600,

    # Beat schedule — long-running periodic tasks
    beat_schedule={
        "scrape-virginia-lis-every-6h": {
            "task": "app.tasks.scraper.scrape_virginia_lis",
            "schedule": crontab(minute=0, hour="*/6"),
            "kwargs": {"max_pages": 10},
        },
        "process-vision-queue-every-15m": {
            "task": "app.tasks.vision.process_vision_batch",
            "schedule": crontab(minute="*/15"),
            "kwargs": {"batch_size": 20},
        },
        # Pre-load hot data into Redis every 5 minutes.
        # Keeps analytics, KPI wall, and CRM lead caches warm so the first
        # request after a TTL expiry is served from Redis, not the database.
        "warm-cache-every-5m": {
            "task": "app.tasks.cache_warmer.warm_cache_task",
            "schedule": crontab(minute="*/5"),
        },
    },
)
