"""Regresión: las cuentas móviles solo acceden a recursos de su propietario."""

from fastapi.testclient import TestClient

from services.app_users import create_app_user


def _headers(client: TestClient, username: str, password: str) -> dict[str, str]:
    token = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_usuario_no_lee_ni_modifica_recursos_de_otra_cuenta(db, tmp_path):
    from api.app import app
    from core.config import settings
    from services import accounts, audit, backup_history, projects

    owner_a = create_app_user("cuenta-a", "Password-A-12345", rol="admin")
    owner_b = create_app_user("cuenta-b", "Password-B-12345", rol="admin")
    account_a = accounts.create_account(
        "A", "", provider="postgres", owner_user_id=owner_a
    )
    account_b = accounts.create_account(
        "B", "", provider="postgres", owner_user_id=owner_b
    )
    project_a = projects.create_project(
        "proyecto-a", "Proyecto A", account_a,
        "postgresql://user:secret@db-a.example.com/postgres",
        provider="postgres", owner_user_id=owner_a,
    )
    project_b = projects.create_project(
        "proyecto-b", "Proyecto B", account_b,
        "postgresql://user:secret@db-b.example.com/postgres",
        provider="postgres", owner_user_id=owner_b,
    )
    backup_dir = settings().backup_dir
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_file = backup_dir / "proyecto-b.dump.enc"
    backup_file.write_bytes(b"encrypted-placeholder")
    backup_id = backup_history.record(project_b, "ok", ruta_archivo=str(backup_file))
    audit.log_action(
        "cross_owner_probe", "ok", app_user_id=owner_a, project_id=project_b
    )

    with TestClient(app) as client:
        headers_a = _headers(client, "cuenta-a", "Password-A-12345")

        listed = client.get("/api/projects", headers=headers_a)
        assert listed.status_code == 200
        assert {project["id"] for project in listed.json()} == {project_a}

        assert client.get(f"/api/projects/{project_b}", headers=headers_a).status_code == 404
        assert client.get(f"/api/projects/{project_b}/history", headers=headers_a).status_code == 404
        assert client.delete(f"/api/projects/{project_b}", headers=headers_a).status_code == 404
        assert client.get(f"/api/accounts/{account_b}", headers=headers_a).status_code == 404
        assert client.get("/api/backups", headers=headers_a).json()["rows"] == []
        assert client.get(
            f"/api/backups/{backup_id}/download", headers=headers_a
        ).status_code == 404

        audit_rows = client.get("/api/audit", headers=headers_a).json()["rows"]
        assert all(row["accion"] != "cross_owner_probe" for row in audit_rows)

        edit = client.put(
            f"/api/projects/{project_b}",
            json={"nombre": "intrusion"},
            headers=headers_a,
        )
        assert edit.status_code != 200
        assert projects.get_project(project_b, owner_user_id=owner_b)["nombre"] == "Proyecto B"
