"""Arranque del servicio API y sus tareas de mantenimiento."""

from __future__ import annotations

import asyncio
import logging
from logging.handlers import RotatingFileHandler
from zoneinfo import ZoneInfo

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from api.app import create_app
from backup import cleanup as cleanup_mod
from backup import offsite as offsite_mod
from backup import scheduler_jobs
from backup import requested_jobs
from core import db as db_core
from core.config import settings
from services import audit as audit_srv
from services import backup_history as history_srv
from services import refresh_tokens as refresh_srv


def _setup_logging() -> None:
    cfg = settings()
    log_dir = cfg.backup_dir.parent / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(getattr(logging, cfg.log_level, logging.INFO))
    formatter = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    root.addHandler(console)
    file_handler = RotatingFileHandler(
        log_dir / "app.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def retention_purge() -> dict:
    cfg = settings()
    return {
        "audit": audit_srv.purge_old(cfg.audit_retention_days),
        "history": history_srv.purge_old(cfg.history_retention_days),
        "sessions": refresh_srv.purge_expired_sessions(),
    }


async def retention_purge_job(log: logging.Logger) -> None:
    try:
        removal = await asyncio.to_thread(retention_purge)
        log.info("Purga de retención: audit=%d history=%d sessions=%d",
                 removal["audit"], removal["history"], removal["sessions"])
    except Exception:  # noqa: BLE001
        log.exception("Falló la purga de retención")


def setup_scheduler(log: logging.Logger) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone=ZoneInfo("UTC"))
    scheduler.add_job(
        retention_purge_job,
        CronTrigger(day_of_week="mon", hour=4, minute=0, timezone=ZoneInfo("UTC")),
        args=[log], id="retention_weekly", misfire_grace_time=3600, coalesce=True,
    )
    scheduler.start()
    log.info("Purga semanal programada (lunes 04:00 UTC)")
    return scheduler


async def main() -> None:
    cfg = settings()
    _setup_logging()
    log = logging.getLogger("main")

    db_core.init_db()
    retention_purge()
    removed = cleanup_mod.sweep_plaintext_backups()
    if removed:
        log.warning("Se eliminaron backups temporales sin cifrar: %s", "; ".join(removed[:10]))

    if cfg.offsite_enabled:
        try:
            result = await asyncio.to_thread(offsite_mod.sync_new_backups)
            log.info("Copia remota al arranque: %d subido(s), %d en remoto, %d borrado(s), %d error(es)",
                     result["uploaded"], result["skipped"], result["deleted"], len(result["errors"]))
        except Exception:  # noqa: BLE001
            log.exception("Copia remota al arranque falló")

    app = create_app()
    server = uvicorn.Server(uvicorn.Config(
        app, host=cfg.api_host, port=cfg.api_port, log_level="info",
        proxy_headers=True, forwarded_allow_ips=cfg.forwarded_allow_ips,
    ))
    scheduler = setup_scheduler(log)
    scheduler_jobs.bind(scheduler)
    scheduler_jobs.resync()
    db_core.execute(
        "UPDATE backup_jobs SET status = 'interrupted', finished_at = datetime('now'), "
        "detail = 'El proceso terminó durante la ejecución.' WHERE status = 'running'"
    )
    jobs_task = asyncio.create_task(requested_jobs.run_forever())
    log.info("API escuchando en %s:%s", cfg.api_host, cfg.api_port)
    try:
        await server.serve()
    finally:
        scheduler.shutdown(wait=False)
        jobs_task.cancel()
        try:
            await jobs_task
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    asyncio.run(main())
