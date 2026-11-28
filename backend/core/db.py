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
    return _PostgresConnection(
        psycopg.connect(
            cfg.database_url,
            sslmode="require",
            connect_timeout=10,
            row_factory=dict_row,
            prepare_threshold=None,
        )
    )


def init_db() -> None:
    """Aplica el esquema PostgreSQL y las migraciones pendientes."""
    db_dir = Path(__file__).resolve().parent.parent / "db"
    schema = db_dir / "schema.postgres.sql"
    migrations_dir = db_dir / "migrations" / "postgres"

    with connect() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS schema_migrations (
                   version TEXT PRIMARY KEY,
                   applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
               )"""
        )
        applied = {
            row["version"]
            for row in conn.execute("SELECT version FROM schema_migrations").fetchall()
        }
        legacy_rename = migrations_dir / "0000_remove_legacy_entities.sql"
        if legacy_rename.is_file() and "0000" not in applied:
            conn.execute(legacy_rename.read_text(encoding="utf-8"))
            conn.execute(
                "INSERT INTO schema_migrations (version) VALUES (?)", ("0000",)
            )

        for statement in schema.read_text(encoding="utf-8").split(";"):
            if statement.strip():
                conn.execute(statement)
        applied = {
            row["version"]
            for row in conn.execute("SELECT version FROM schema_migrations").fetchall()
        }

        for migration in sorted(migrations_dir.glob("*.sql")):
            version = migration.stem.split("_", 1)[0]
            if version in applied:
                continue
            conn.execute(migration.read_text(encoding="utf-8"))
            conn.execute("INSERT INTO schema_migrations (version) VALUES (?)", (version,))


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
