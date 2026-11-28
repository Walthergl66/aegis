"""Fixtures de prueba aisladas mediante esquemas PostgreSQL temporales."""

from __future__ import annotations

import os
import uuid

# Permite importar la aplicación en tests sin abrir una conexión. Los tests que
# acceden a datos requieren TEST_DATABASE_URL, una base de datos dedicada.
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get("TEST_DATABASE_URL", "postgresql://unused:unused@127.0.0.1/unused"),
)
os.environ.setdefault("ENCRYPTION_KEY", "P0plo0y-XXXXXXXX_TBtQIB0zXJmn1DZBgprYJmGMw=")
os.environ.setdefault("BACKUP_ENCRYPTION_KEY", "aZXt3kxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    from api.rate_limit import limiter

    yield
    try:
        limiter._storage.reset()
    except Exception:  # noqa: BLE001
        pass


@pytest.fixture()
def db(monkeypatch):
    """Crea un esquema efímero en la base declarada por TEST_DATABASE_URL."""
    test_url = os.environ.get("TEST_DATABASE_URL")
    if not test_url:
        pytest.skip("Define TEST_DATABASE_URL para ejecutar pruebas con PostgreSQL")

    import psycopg
    from psycopg.conninfo import make_conninfo
    from cryptography.fernet import Fernet

    schema = f"test_{uuid.uuid4().hex}"
    with psycopg.connect(test_url, autocommit=True) as admin_conn:
        admin_conn.execute(f'CREATE SCHEMA "{schema}"')
    isolated_url = make_conninfo(test_url, options=f"-c search_path={schema}")
    monkeypatch.setenv("DATABASE_URL", isolated_url)
    monkeypatch.setenv("BACKUP_DIR", f"/tmp/aegis-test-{schema}")
    monkeypatch.setenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("BACKUP_ENCRYPTION_KEY", Fernet.generate_key().decode())

    import core.config as cfg
    from core import db as db_mod

    cfg._settings = None
    db_mod.init_db()
    yield db_mod
    cfg._settings = None
    with psycopg.connect(test_url, autocommit=True) as admin_conn:
        admin_conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
