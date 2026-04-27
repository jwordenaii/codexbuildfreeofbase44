import importlib
import os
import sys
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture()
def app_modules(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / 'test.db'
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{db_path}')
    monkeypatch.setenv('JWORDEN_MASTER_KEY', 'test-master-key')
    monkeypatch.setenv('JWT_SECRET_KEY', 'test-jwt-secret')
    monkeypatch.setenv('AUTO_CREATE_TABLES', 'true')
    monkeypatch.delenv('REDIS_URL', raising=False)
    monkeypatch.delenv('CELERY_BROKER_URL', raising=False)

    import app.database as dbmod
    import app.models as modelsmod
    import app.main as mainmod

    dbmod = importlib.reload(dbmod)
    modelsmod = importlib.reload(modelsmod)
    mainmod = importlib.reload(mainmod)

    dbmod.Base.metadata.create_all(bind=dbmod.engine)
    return mainmod, dbmod


@pytest.fixture()
async def client(app_modules):
    mainmod, _ = app_modules
    transport = ASGITransport(app=mainmod.app)
    async with AsyncClient(transport=transport, base_url='http://testserver') as c:
        yield c


@pytest.fixture()
def auth_headers():
    return {'Authorization': 'Bearer test-master-key'}
