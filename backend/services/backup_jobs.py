"""Persistent queue for backups requested from the web app."""

from __future__ import annotations

from uuid import uuid4

from core import db


def create(project_id: int, requested_by: int, idempotency_key: str) -> dict:
    job_id = uuid4().hex
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO backup_jobs (id, project_id, requested_by, idempotency_key, status)
            VALUES (?, ?, ?, ?, 'queued')
            ON CONFLICT (requested_by, idempotency_key) DO NOTHING
            """,
            (job_id, project_id, requested_by, idempotency_key),
        )
        row = conn.execute(
            "SELECT * FROM backup_jobs WHERE requested_by = ? AND idempotency_key = ?",
            (requested_by, idempotency_key),
        ).fetchone()
    if row["project_id"] != project_id:
        raise ValueError("La clave idempotente ya se usó para otro proyecto.")
    return dict(row)


def get(job_id: str) -> dict | None:
    row = db.fetch_one(
        """SELECT j.*, p.slug FROM backup_jobs j
           JOIN projects p ON p.id = j.project_id WHERE j.id = ?""",
        (job_id,),
    )
    return dict(row) if row else None


def claim_next() -> dict | None:
    with db.connect() as conn:
        row = conn.execute(
            "SELECT id FROM backup_jobs WHERE status = 'queued' ORDER BY created_at, id LIMIT 1"
        ).fetchone()
        if row is None:
            return None
        changed = conn.execute(
            """UPDATE backup_jobs SET status = 'running', started_at = datetime('now')
               WHERE id = ? AND status = 'queued'""",
            (row['id'],),
        ).rowcount
        if not changed:
            return None
        job = conn.execute("SELECT * FROM backup_jobs WHERE id = ?", (row['id'],)).fetchone()
    return dict(job)


def finish(job_id: str, status: str, detail: str, history_id: int | None) -> None:
    db.execute(
        """UPDATE backup_jobs SET status = ?, detail = ?, history_id = ?,
           finished_at = datetime('now') WHERE id = ?""",
        (status, detail, history_id, job_id),
    )


def interrupt_running() -> int:
    with db.connect() as conn:
        cur = conn.execute(
            """UPDATE backup_jobs SET status = 'interrupted',
               finished_at = datetime('now'),
               detail = 'El proceso terminó durante la ejecución.'
               WHERE status = 'running'"""
        )
        return cur.rowcount
