"""
SQLAlchemy database engine and session factory.

Supports:
  - PostgreSQL in production (set DATABASE_URL to a postgres:// or postgresql:// URI)
  - SQLite as a zero-config fallback for local development
"""

import os
import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)


def get_database_url() -> str:
    database_url = os.getenv('DATABASE_URL', 'sqlite:///./jworden_leads.db')
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    return database_url


_DATABASE_URL = get_database_url()
_connect_args = {'check_same_thread': False} if _DATABASE_URL.startswith('sqlite') else {}

# Pool sizing: SQLite gets minimal settings; PostgreSQL gets a larger pool
# for high-throughput iGrade processing.
_pool_kwargs: dict = {}
if not _DATABASE_URL.startswith("sqlite"):
    _pool_kwargs = {
        # pool_size: steady-state connections kept open.
        # Raised from 10 → 20 to handle concurrent request bursts without
        # waiting for a new connection to be established.
        "pool_size":    int(os.getenv("DB_POOL_SIZE",    "20")),
        # max_overflow: extra connections allowed above pool_size during spikes.
        # Raised from 20 → 40 so burst traffic (10× growth target) doesn't
        # exhaust the pool and return 503s.
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "40")),
        # pool_recycle: close and replace connections idle for 30 minutes.
        # Prevents stale connections after PostgreSQL's idle timeout.
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "1800")),
        # pool_timeout: raise TimeoutError if no connection is available
        # within 30 seconds (prevents indefinite request queuing).
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
    }

engine = create_engine(
    _DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
    echo=False,
    **_pool_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a SQLAlchemy session and guarantees close."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def should_auto_create_tables() -> bool:
    return os.getenv('AUTO_CREATE_TABLES', 'true').strip().lower() in {'1', 'true', 'yes', 'on'}


def create_all_tables() -> None:
    """Create all tables that don't yet exist."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info('Database tables verified/created (url=%s)', _DATABASE_URL.split('@')[-1])
    except Exception as exc:  # noqa: BLE001
        logger.error('Could not create database tables: %s', exc)
        try:
            import sentry_sdk  # noqa: PLC0415
            sentry_sdk.capture_exception(exc)
        except Exception:  # noqa: BLE001
            pass
