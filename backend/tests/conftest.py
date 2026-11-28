"""Fixtures PostgreSQL aisladas en una base de datos de pruebas dedicada."""

from __future__ import annotations

import os

# Permite importar la aplicación en tests sin abrir una conexión. Los tests que
# acceden a datos requieren TEST_DATABASE_URL con una base dedicada cuyo nombre
# incluya "test"; cada fixture limpia solo los schemas/tablas de Aegis.
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
    """Inicializa los schemas en TEST_DATABASE_URL, que debe ser desechable."""
    test_url = os.environ.get("TEST_DATABASE_URL")
    if not test_url:
        pytest.skip("Define TEST_DATABASE_URL para ejecutar pruebas con PostgreSQL")

    import psycopg
    from psycopg import sql
    from psycopg.conninfo import conninfo_to_dict
    from cryptography.fernet import Fernet

    db_name = conninfo_to_dict(test_url).get("dbname", "")
    if "test" not in db_name.lower():
        pytest.fail("TEST_DATABASE_URL debe apuntar a una base dedicada cuyo nombre incluya 'test'.")

    schemas = ("identity", "integrations", "app", "backups", "audit")
    legacy_tables = (
        "backup_jobs", "backup_history", "audit_log", "projects", "accounts",
        "refresh_sessions", "access_token_revocations", "app_users", "web_users",
        "permissions", "users", "schema_migrations",
    )
    with psycopg.connect(test_url, autocommit=True) as admin_conn:
        for schema in schemas:
            admin_conn.execute(sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(sql.Identifier(schema)))
        names = sql.SQL(", ").join(sql.Identifier("public", table) for table in legacy_tables)
        admin_conn.execute(sql.SQL("DROP TABLE IF EXISTS {} CASCADE").format(names))

    monkeypatch.setenv("DATABASE_URL", test_url)
    monkeypatch.setenv("BACKUP_DIR", "/tmp/aegis-test-backups")
    monkeypatch.setenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("BACKUP_ENCRYPTION_KEY", Fernet.generate_key().decode())

    import core.config as cfg
    from core import db as db_mod

    cfg._settings = None
    db_mod.init_db()
    yield db_mod
    cfg._settings = None
