"""Regresiones del lote API hardening (A3-A4 y B3-B6)."""

def _admin_client(c):
    from services import app_users

    app_users.create_app_user("admin", "AdminPass-12345", rol="admin")
    tok = c.post("/api/auth/login", json={
        "username": "admin", "password": "AdminPass-12345",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def test_json_invalido_responde_400_no_500(db):
    from fastapi.testclient import TestClient

    from api.app import app

    with TestClient(app) as c:
        r = c.post(
            "/api/auth/login",
            data="esto-no-es-json{",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 400
        assert "JSON" in r.json()["detail"]


def test_activo_false_como_cadena_desactiva_proyecto(db):
    """Regresión B3: activo="false" (string) desactiva de verdad; bool('false')
    lo dejaba activo."""
    from fastapi.testclient import TestClient

    from api.app import app
    from services import accounts as accounts_srv
    from services import projects as projects_srv
    from services.app_users import create_app_user

    owner_id = create_app_user("admin", "AdminPass-12345", rol="admin")
    acc = accounts_srv.create_account("A", "pat-x", owner_user_id=owner_id)
    pid = projects_srv.create_project(
        "p1", "P1", acc, "postgresql://u:p@h/db", "ref1", owner_user_id=owner_id
    )
    with TestClient(app) as c:
        tok = c.post("/api/auth/login", json={
            "username": "admin", "password": "AdminPass-12345",
        }).json()["access_token"]
        admin = {"Authorization": f"Bearer {tok}"}
        r = c.put(
            f"/api/projects/{pid}",
            json={"activo": "false"},
            headers=admin,
        )
        assert r.status_code == 200, r.text
        assert projects_srv.get_project(pid)["activo"] == 0


def test_delete_inexistente_devuelve_404(db):
    """Regresión B4: borrar un recurso que no existe no debe responder 200."""
    from fastapi.testclient import TestClient

    from api.app import app

    with TestClient(app) as c:
        admin = _admin_client(c)
        for path in ("/api/accounts/99999",):
            assert c.delete(path, headers=admin).status_code == 404, path
        assert c.delete("/api/projects/99999", headers=admin).status_code == 404


def test_cabeceras_de_seguridad_presentes(db):
    from fastapi.testclient import TestClient

    from api.app import app

    with TestClient(app) as c:
        r = c.get("/api/health")
        assert r.headers["X-Content-Type-Options"] == "nosniff"
        assert r.headers["X-Frame-Options"] == "DENY"
        assert r.headers["Referrer-Policy"] == "no-referrer"
        assert r.headers["X-Permitted-Cross-Domain-Policies"] == "none"


def test_throttle_poda_bloqueos_expirados(db):
    """Regresión B6: los bloqueos por IP vencidos se purgan (no crecen sin fin)."""
    from api.throttle import throttle

    old_blocked = throttle._blocked_until
    old_hits = throttle._hits
    throttle._blocked_until = {f"ip-{i}": 0.0 for i in range(501)}
    try:
        result = throttle.hit("ip-nueva")
        assert result is False
        assert throttle.is_blocked("ip-nueva") is False
        # Tras el hit, la poda debió limpiar las 501 entradas vencidas.
        assert not any(u <= 0 for u in throttle._blocked_until.values())
    finally:
        throttle._blocked_until = old_blocked
        throttle._hits = old_hits


def test_backups_api_no_expone_ruta_absoluta(db):
    """Regresión B2: el historial no filtra rutas absolutas del servidor."""
    from fastapi.testclient import TestClient

    from api.app import app
    from core import db as db_mod
    from services import accounts as accounts_srv
    from services import projects as projects_srv
    from services.app_users import create_app_user

    owner_id = create_app_user("admin", "AdminPass-12345", rol="admin")
    acc = accounts_srv.create_account("A", "pat-x", owner_user_id=owner_id)
    pid = projects_srv.create_project(
        "p1", "P1", acc, "postgresql://u:p@h/db", "ref1", owner_user_id=owner_id
    )
    db_mod.execute(
        "INSERT INTO backup_history (project_id, resultado, ruta_archivo) "
        "VALUES (?, ?, ?)",
        (pid, "ok", "/app/data/backups/p1/p1_20260101_010101.dump.enc"),
    )
    with TestClient(app) as c:
        tok = c.post("/api/auth/login", json={
            "username": "admin", "password": "AdminPass-12345",
        }).json()["access_token"]
        admin = {"Authorization": f"Bearer {tok}"}
        r = c.get("/api/backups", headers=admin)
        assert r.status_code == 200
        row = r.json()["rows"][0]
        assert row["ruta_archivo"] == "p1_20260101_010101.dump.enc"
        assert not row["ruta_archivo"].startswith("/")
