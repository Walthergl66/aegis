"""Runs persistent backup jobs requested by web clients."""

from __future__ import annotations

import asyncio
import logging

from backup import offsite as offsite_mod
from backup import runner
from services import audit as audit_srv
from services import backup_history as history_srv
from services import backup_jobs as jobs_srv
from services import projects as projects_srv

logger = logging.getLogger(__name__)


async def run_forever() -> None:
    while True:
        job = await asyncio.to_thread(jobs_srv.claim_next)
        if job is None:
            await asyncio.sleep(1)
            continue
        await _run(job)


async def _run(job: dict) -> None:
    try:
        project = projects_srv.get_project(job["project_id"], include_secret=True)
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo cargar el proyecto del trabajo %s", job["id"])
        jobs_srv.finish(job["id"], "failed", "No se pudo cargar el proyecto.", None)
        return
    if project is None or not project["activo"]:
        detail = "El proyecto ya no está activo."
        history_id = history_srv.record(job["project_id"], "error", detalle=detail)
        jobs_srv.finish(job["id"], "failed", detail, history_id)
        return

    try:
        result = await asyncio.to_thread(runner.run_backup, project)
        history_id = history_srv.record(
            project["id"], "ok" if result.ok else "error",
            tamaño_archivo=result.tamaño_archivo,
            ruta_archivo=result.ruta_archivo,
            detalle=result.detalle,
        )
        status = "completed" if result.ok else "failed"
        jobs_srv.finish(job["id"], status, result.detalle, history_id)
        audit_srv.log_action(
            "web_backup", "ok" if result.ok else "error",
            web_user_id=job["requested_by"], project_id=project["id"],
            detalle=f"job={job['id']}: {result.detalle}",
        )
        if result.ok:
            await asyncio.to_thread(offsite_mod.sync_new_backups)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falló el trabajo de backup web %s", job["id"])
        detail = "Error interno al ejecutar el backup. Revisa los logs del servidor."
        history_id = history_srv.record(project["id"], "error", detalle=detail)
        jobs_srv.finish(job["id"], "failed", detail, history_id)
        audit_srv.log_action("web_backup", "error", web_user_id=job["requested_by"],
                             project_id=project["id"], detalle=f"job={job['id']}: fallo interno")
