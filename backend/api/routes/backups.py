"""API de historial de backups."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from api.deps import get_current_user, require_admin
from core import crypto
from core import db
from core.config import settings
from services import audit as audit_srv
from services import backup_jobs as jobs_srv

router = APIRouter(prefix="/api/backups", tags=["backups"])


@router.get("/jobs/{job_id}")
async def get_backup_job(job_id: str, user: dict = Depends(get_current_user)):
    job = jobs_srv.get(job_id, owner_user_id=user["id"])
    if job is None:
        raise HTTPException(status_code=404, detail="Trabajo de backup no encontrado.")
    return job


@router.get("/{backup_id}/download")
async def download_backup(
    backup_id: int,
    file_format: str = Query("dump", alias="format", pattern="^(dump|sql)$"),
    admin: dict = Depends(require_admin),
):
    row = db.fetch_one(
        """SELECT bh.*, p.slug FROM backup_history bh
           JOIN projects p ON p.id = bh.project_id
           WHERE bh.id = ? AND p.owner_user_id = ?""",
        (backup_id, admin["id"]),
    )
    if row is None or row["resultado"] != "ok":
        raise HTTPException(status_code=404, detail="Backup no encontrado.")

    dump_path = Path(row["ruta_archivo"] or "")
    backup_root = Path(settings().backup_dir).resolve()
    try:
        dump_path = dump_path.resolve(strict=True)
        dump_path.relative_to(backup_root)
    except (OSError, ValueError):
        raise HTTPException(status_code=404, detail="El archivo de backup ya no está disponible.") from None
    if not dump_path.name.endswith(".dump.enc"):
        raise HTTPException(status_code=404, detail="El archivo de backup ya no está disponible.")

    artifact = dump_path if file_format == "dump" else dump_path.with_name(
        dump_path.name.removesuffix(".dump.enc") + ".sql.enc"
    )
    try:
        artifact = artifact.resolve(strict=True)
        artifact.relative_to(backup_root)
    except (OSError, ValueError):
        raise HTTPException(status_code=404, detail="El formato solicitado no está disponible.")
    if not artifact.is_file():
        raise HTTPException(status_code=404, detail="El formato solicitado no está disponible.")

    audit_srv.log_action("app_backup_descarga", "ok", app_user_id=admin["id"],
                         project_id=row["project_id"], detalle=f"backup={backup_id}, formato={file_format}")
    filename = f"{row['slug']}_{row['fecha'].replace(':', '').replace(' ', '_')}.{file_format}"
    return StreamingResponse(
        crypto.iter_decrypted_file(artifact),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


def _relative_ruta(ruta: str | None) -> str | None:
    """Expone la ruta RELATIVA a BACKUP_DIR: no se filtran rutas absolutas del
    servidor (estructura interna) a los clientes."""
    if not ruta:
        return ruta
    base = Path(settings().backup_dir)
    path = Path(ruta)
    if path.is_absolute():
        try:
            return path.relative_to(base).as_posix()
        except ValueError:
            pass
    return path.name


@router.get("")
async def list_backups(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    offset = (page - 1) * page_size
    rows = db.fetch_all(
        """
        SELECT bh.*, p.slug
        FROM backup_history bh JOIN projects p ON p.id = bh.project_id
        WHERE p.owner_user_id = ?
        ORDER BY bh.fecha DESC, bh.id DESC
        LIMIT ? OFFSET ?
        """,
        (user["id"], page_size, offset),
    )
    total = db.fetch_one(
        "SELECT COUNT(*) AS c FROM backup_history bh JOIN projects p ON p.id = bh.project_id "
        "WHERE p.owner_user_id = ?",
        (user["id"],),
    )
    total_count = total["c"] if total else 0
    items = []
    for r in rows:
        d = dict(r)
        d["ruta_archivo"] = _relative_ruta(d.get("ruta_archivo"))
        items.append(d)
    return {
        "rows": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "pages": (total_count + page_size - 1) // page_size if total_count else 0,
    }
