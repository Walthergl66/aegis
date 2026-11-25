"""Capa de acceso a la base de datos.

Supabase/PostgreSQL es el backend compartido en producción. SQLite queda
disponible para desarrollo y pruebas locales.
"""

from __future__ import annotations

import sqlite3
import re
from pathlib import Path
from typing import Any, Iterable

from core.config import settings

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # SQLite-only environments (e.g. lightweight tests)
    psycopg = None
    dict_row = None

INTEGRITY_ERRORS = (sqlite3.IntegrityError,) + (
    (psycopg.IntegrityError,) if psycopg is not None else ()
)

# Versión del esquema. Se incrementa con cada migración incremental para
# poder auditar en qué estado está una base existente.
SCHEMA_VERSION = 4

# Nombre del grupo creado de forma diferida para una conexión PostgreSQL directa.
DEFAULT_GROUP_NAME = "Conexiones directas"


class _PostgresConnection:
    """Small adapter preserving the DB helpers' sqlite-style `?` placeholders."""

    def __init__(self, conn):
        self._conn = conn

    def __enter__(self):
        self._conn.__enter__()
        return self

    def __exit__(self, exc_type, exc, tb):
        return self._conn.__exit__(exc_type, exc, tb)

    def execute(self, sql: str, params: Iterable[Any] = ()):
        sql = sql.replace("datetime('now')", "CURRENT_TIMESTAMP::text")
        sql = re.sub(r"\bowner_user_id\s+IS\s+\?", "owner_user_id IS NOT DISTINCT FROM ?", sql)
        return self._conn.execute(sql.replace("?", "%s"), tuple(params))

    def executemany(self, sql: str, seq_of_params: Iterable[Iterable[Any]]):
        sql = sql.replace("datetime('now')", "CURRENT_TIMESTAMP::text")
        sql = re.sub(r"\bowner_user_id\s+IS\s+\?", "owner_user_id IS NOT DISTINCT FROM ?", sql)
        return self._conn.executemany(sql.replace("?", "%s"), seq_of_params)


def connect():
    cfg = settings()
    if cfg.database_url:
        if psycopg is None:
            raise RuntimeError("DATABASE_URL requiere instalar psycopg[binary].")
        return _PostgresConnection(
            psycopg.connect(
                cfg.database_url,
                sslmode="require",
                connect_timeout=10,
                row_factory=dict_row,
                prepare_threshold=None,
            )
        )
    conn = sqlite3.connect(settings().db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def init_db() -> None:
    """Aplica el esquema PostgreSQL o inicializa/migra la SQLite local."""
    cfg = settings()
    if cfg.database_url:
        if psycopg is None:
            raise RuntimeError("DATABASE_URL requiere instalar psycopg[binary].")
        schema = Path(__file__).resolve().parent.parent / "db" / "schema.postgres.sql"
        with connect() as conn:
            for statement in schema.read_text(encoding="utf-8").split(";"):
                if statement.strip():
                    conn.execute(statement)
        return

    db_path: Path = cfg.db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if not db_path.exists() or db_path.stat().st_size == 0:
        schema = Path(__file__).resolve().parent.parent / "db" / "schema.sql"
        with connect() as conn:
            conn.executescript(schema.read_text(encoding="utf-8"))
    _migrate()


def _migrate() -> None:
    """Migraciones incrementales para bases de datos existentes."""
    statements = [
        "ALTER TABLE users ADD COLUMN supabase_pat_encrypted TEXT",
        "ALTER TABLE web_users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE web_users ADD COLUMN locked_until TEXT",
        "ALTER TABLE projects ADD COLUMN schedule TEXT",
        "ALTER TABLE projects ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE web_users ADD COLUMN totp_secret TEXT",
        "ALTER TABLE web_users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0",
        # v2: soporte de PostgreSQL genérico además de Supabase.
        "ALTER TABLE accounts ADD COLUMN provider TEXT NOT NULL DEFAULT 'supabase'",
        "ALTER TABLE projects ADD COLUMN provider TEXT NOT NULL DEFAULT 'supabase'",
        "ALTER TABLE projects ADD COLUMN backup_options TEXT",
        "ALTER TABLE web_users ADD COLUMN totp_pending_secret TEXT",
        "ALTER TABLE accounts ADD COLUMN owner_user_id INTEGER REFERENCES web_users(id) ON DELETE SET NULL",
        "ALTER TABLE projects ADD COLUMN owner_user_id INTEGER REFERENCES web_users(id) ON DELETE SET NULL",
        """
        CREATE TABLE IF NOT EXISTS refresh_sessions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            token_hash TEXT NOT NULL UNIQUE,
            user_id    INTEGER NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
            username   TEXT NOT NULL,
            rol        TEXT NOT NULL,
            created_at REAL NOT NULL,
            expires_at REAL NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS access_token_revocations (
            jti TEXT PRIMARY KEY,
            expires_at INTEGER NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS backup_jobs (
            id              TEXT PRIMARY KEY,
            project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            requested_by    INTEGER REFERENCES web_users(id) ON DELETE SET NULL,
            idempotency_key TEXT NOT NULL,
            status          TEXT NOT NULL,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            started_at      TEXT,
            finished_at     TEXT,
            history_id      INTEGER REFERENCES backup_history(id) ON DELETE SET NULL,
            detail          TEXT,
            UNIQUE (requested_by, idempotency_key)
        )
        """,
    ]
    with connect() as conn:
        for statement in statements:
            try:
                conn.execute(statement)
            except sqlite3.OperationalError as exc:
                # ALTER TABLE repetido es la única excepción esperada aquí.
                # No ocultar errores de esquema o de disco.
                if not (statement.lstrip().upper().startswith("ALTER TABLE")
                        and "duplicate column name" in str(exc).lower()):
                    raise
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user ON refresh_sessions (user_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_refresh_sessions_expiry ON refresh_sessions (expires_at)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_access_token_revocations_expiry "
            "ON access_token_revocations (expires_at)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_backup_jobs_queue "
            "ON backup_jobs (status, created_at)"
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_accounts_owner ON accounts (owner_user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects (owner_user_id)")
        # La instalación anterior compartía recursos entre sus usuarios. Para
        # conservarla sin exponerla a las cuentas nuevas, se asigna al usuario
        # más antiguo; si aún no hay cuenta, el primer registro reclamará huérfanos.
        conn.execute(
            "UPDATE accounts SET owner_user_id = (SELECT MIN(id) FROM web_users) "
            "WHERE owner_user_id IS NULL AND EXISTS (SELECT 1 FROM web_users)"
        )
        conn.execute(
            "UPDATE projects SET owner_user_id = (SELECT MIN(id) FROM web_users) "
            "WHERE owner_user_id IS NULL AND EXISTS (SELECT 1 FROM web_users)"
        )
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")


def fetch_one(sql: str, params: Iterable[Any] = ()):
    with connect() as conn:
        return conn.execute(sql, tuple(params)).fetchone()


def fetch_all(sql: str, params: Iterable[Any] = ()):
    with connect() as conn:
        return conn.execute(sql, tuple(params)).fetchall()


def execute(sql: str, params: Iterable[Any] = ()) -> int:
    """Ejecuta una escritura y devuelve el id de la última fila insertada (o -1)."""
    with connect() as conn:
        if settings().database_url:
            match = re.match(r"\s*INSERT\s+INTO\s+(\w+)", sql, re.IGNORECASE)
            if match and "returning" not in sql.lower():
                table = match.group(1).lower()
                if table in {
                    "accounts", "projects", "users", "permissions", "web_users",
                    "backup_history", "audit_log", "refresh_sessions",
                }:
                    cur = conn.execute(sql.rstrip().rstrip(";") + " RETURNING id", params)
                    row = cur.fetchone()
                    return int(row["id"]) if row else -1
                conn.execute(sql, params)
                return -1
            cur = conn.execute(sql, params)
            return -1
        cur = conn.execute(sql, tuple(params))
        return cur.lastrowid if cur.lastrowid is not None else -1


def execute_many(sql: str, seq_of_params: Iterable[Iterable[Any]]) -> None:
    with connect() as conn:
        conn.executemany(sql, seq_of_params)
