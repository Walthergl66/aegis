"""API de importación de proyectos Supabase para la app móvil."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request

from api.deps import require_admin
from services import accounts as accounts_srv
from services import audit as audit_srv
from services import projects as projects_srv
from services import supabase_api as api_srv

router = APIRouter(prefix="/api/import", tags=["import_projects"])


@router.post("/fetch")
async def fetch_projects(request: Request, admin: dict = Depends(require_admin)):
    data = await request.json()
    pat = (data.get("pat") or "").strip()
    if not pat:
        raise HTTPException(status_code=400, detail="Debes ingresar un PAT.")

    try:
        projects = await asyncio.to_thread(api_srv.list_projects, pat)
    except api_srv.SupabaseAPIError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        raise HTTPException(
            status_code=502, detail="No se pudo consultar a Supabase. Inténtalo de nuevo."
        ) from None

    # Solo cuentan los proyectos ACTIVOS: los eliminados (archived/activo=0)
    # liberan su ref y pueden volver a importarse.
    existing_refs = {
        p["project_ref"]
        for p in projects_srv.list_projects(only_active=True, owner_user_id=admin["id"])
    }
    available = [p for p in projects if p["ref"] not in existing_refs]
    return {
        "available": available,
        "existing_count": len(projects) - len(available),
    }


@router.post("/create")
async def create_imported_projects(request: Request, admin: dict = Depends(require_admin)):
    data = await request.json()
    pat = (data.get("pat") or "").strip()
    selected = data.get("selected_projects") or []
    account_name = (data.get("account_name") or "").strip()
    db_password = (data.get("db_password") or "").strip() or None
    pooler_mode = (data.get("pooler_mode") or "session").strip().lower()
    test_connection = bool(data.get("test_connection"))

    if pooler_mode not in ("session", "transaction"):
        pooler_mode = "session"

    if not pat:
        raise HTTPException(status_code=400, detail="Debes ingresar un PAT.")
    if not selected:
        raise HTTPException(status_code=400, detail="Debes seleccionar al menos un proyecto.")
    try:
        all_projects = await asyncio.to_thread(api_srv.list_projects, pat)
    except api_srv.SupabaseAPIError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        raise HTTPException(
            status_code=502, detail="No se pudo consultar a Supabase. Inténtalo de nuevo."
        ) from None

    account_name = account_name or "Importada desde móvil"
    try:
        account_id = accounts_srv.create_account(
            account_name, pat, provider="supabase", owner_user_id=admin["id"]
        )
    except accounts_srv.AccountError as exc:
        raise HTTPException(status_code=400, detail=f"Error al crear cuenta: {exc}")

    created = 0
    errors = []
    for ref in selected:
        project_data = next((p for p in all_projects if p["ref"] == ref), None)
        if not project_data:
            errors.append(f"Proyecto {ref[:8]}... no encontrado")
            continue
        try:
            connection = await asyncio.to_thread(
                api_srv.get_connection_string, pat, ref, pooler_mode, db_password
            )
        except Exception:
            connection = None
        if not connection:
            errors.append(f"{project_data['name']}: no se pudo obtener la connection string")
            continue

        if test_connection:
            ok_test, detail_test = await asyncio.to_thread(api_srv.test_connection, connection)
            if not ok_test:
                errors.append(f"{project_data['name']}: conexión fallida — {detail_test}")
                continue
        slug = project_data["name"].lower().replace(" ", "-").replace("_", "-")[:30]
        try:
            projects_srv.create_project(
                slug=slug, nombre=project_data["name"], account_id=account_id,
                connection=connection, project_ref=ref, provider="supabase",
                owner_user_id=admin["id"],
            )
            created += 1
        except projects_srv.ProjectError as exc:
            errors.append(f"{project_data['name']}: {exc}")

    audit_srv.log_action(
        "mobile_import_supabase",
        "ok", app_user_id=admin["id"],
        detalle=f"{created} proyectos importados, {len(errors)} errores, "
                + f"cuenta {account_name}",
    )
    return {
        "created": created,
        "errors": errors,
        "account_name": account_name,
    }
