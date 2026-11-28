"""Acceso exclusivo a PostgreSQL y aplicación de migraciones."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Iterable

import psycopg
from psycopg.rows import dict_row

from core.config import settings

INTEGRITY_ERRORS = (psycopg.IntegrityError,)
DEFAULT_GROUP_NAME = "Conexiones directas"
APP_SEARCH_PATH = "identity, integrations, app, backups, audit, public"


class _PostgresConnection:
    """Adaptador de consultas de PostgreSQL para los servicios existentes."""

    def __init__(self, conn):
        self._conn = conn

    def __enter__(self):
        self._conn.__enter__()
        return self

    def __exit__(self, exc_type, exc, tb):
        return self._conn.__exit__(exc_type, exc, tb)

    @staticmethod
    def _sql(sql: str) -> str:
        sql = sql.replace("datetime('now')", "CURRENT_TIMESTAMP::text")
        sql = re.sub(r"\bowner_user_id\s+IS\s+\?", "owner_user_id IS NOT DISTINCT FROM ?", sql)
        return sql.replace("?", "%s")

    def execute(self, sql: str, params: Iterable[Any] = ()):
        return self._conn.execute(self._sql(sql), tuple(params))

    def executemany(self, sql: str, seq_of_params: Iterable[Iterable[Any]]):
        return self._conn.executemany(self._sql(sql), seq_of_params)


def connect():
    cfg = settings()
    raw = psycopg.connect(
        cfg.database_url,
        sslmode="require",
        connect_timeout=10,
        row_factory=dict_row,
        prepare_threshold=None,
    )
    raw.execute("SET search_path TO " + APP_SEARCH_PATH)
    return _PostgresConnection(raw)


def init_db() -> None:
    """Aplica el esquema PostgreSQL y las migraciones pendientes."""
    db_dir = Path(__file__).resolve().parent.parent / "db"
    schema = db_dir / "schema.postgres.sql"
    migrations_dir = db_dir / "migrations" / "postgres"

    with connect() as conn:
        conn.execute("SET LOCAL search_path TO public")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS schema_migrations (
                   version TEXT PRIMARY KEY,
                   applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
               )"""
        )
        conn.execute("ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY")
        conn.execute("REVOKE ALL ON TABLE public.schema_migrations FROM PUBLIC")
        applied = _applied_migrations(conn)

        _apply_migration(conn, migrations_dir / "0000_remove_legacy_entities.sql", applied)

        # Upgrade the legacy public tables before moving them so the existing
        # reconciliation migration can add missing columns without losing data.
        has_legacy_tables = conn.execute(
            "SELECT to_regclass('public.accounts') IS NOT NULL AS has_legacy_tables"
        ).fetchone()["has_legacy_tables"]
        if has_legacy_tables and "0001" not in applied:
            _apply_migration(conn, migrations_dir / "0001_reconcile_existing_schema.sql", applied)

        _apply_migration(conn, migrations_dir / "0002_modularize_schemas.sql", applied)
        conn.execute("SET LOCAL search_path TO " + APP_SEARCH_PATH)

        for statement in schema.read_text(encoding="utf-8").split(";"):
            if statement.strip():
                conn.execute(statement)

        # A fresh database is created from the current schema, so record the
        # reconciliation baseline without running legacy ALTER statements.
        applied = _applied_migrations(conn)
        if "0001" not in applied:
            conn.execute(
                "INSERT INTO public.schema_migrations (version) VALUES (?)",
                ("0001",),
            )
            applied.add("0001")

        _apply_migration(conn, migrations_dir / "0003_restrict_api_roles.sql", applied)

        applied = _applied_migrations(conn)
        for migration in sorted(migrations_dir.glob("*.sql")):
            version = migration.stem.split("_", 1)[0]
            if version in applied:
                continue
            _apply_migration(conn, migration, applied)


def _applied_migrations(conn) -> set[str]:
    return {
        row["version"]
        for row in conn.execute(
            "SELECT version FROM public.schema_migrations"
        ).fetchall()
    }


def _apply_migration(conn, migration: Path, applied: set[str]) -> None:
    version = migration.stem.split("_", 1)[0]
    if version in applied:
        return
    if not migration.is_file():
        raise RuntimeError(f"Falta la migración PostgreSQL requerida {migration.name}.")
    # Migration SQL uses PostgreSQL format() placeholders such as %I/%L; send
    # it unchanged instead of passing it through the legacy ? placeholder shim.
    conn._conn.execute(migration.read_text(encoding="utf-8"))
    conn.execute(
        "INSERT INTO public.schema_migrations (version) VALUES (?)", (version,)
    )
    applied.add(version)


def fetch_one(sql: str, params: Iterable[Any] = ()):
    with connect() as conn:
        return conn.execute(sql, tuple(params)).fetchone()


def fetch_all(sql: str, params: Iterable[Any] = ()):
    with connect() as conn:
        return conn.execute(sql, tuple(params)).fetchall()


def execute(sql: str, params: Iterable[Any] = ()) -> int:
    """Ejecuta una escritura y devuelve el id insertado cuando corresponde."""
    with connect() as conn:
        match = re.match(r"\s*INSERT\s+INTO\s+(\w+)", sql, re.IGNORECASE)
        if match and "returning" not in sql.lower():
            table = match.group(1).lower()
            if table in {
                "accounts", "projects", "app_users",
                "backup_history", "audit_log", "refresh_sessions",
            }:
                row = conn.execute(sql.rstrip().rstrip(";") + " RETURNING id", params).fetchone()
                return int(row["id"]) if row else -1
            conn.execute(sql, params)
            return -1
        conn.execute(sql, params)
        return -1


def execute_many(sql: str, seq_of_params: Iterable[Iterable[Any]]) -> None:
    with connect() as conn:
        conn.executemany(sql, seq_of_params)
