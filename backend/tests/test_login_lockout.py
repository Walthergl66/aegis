"""Tests del bloqueo por fuerza bruta (por IP) y de la respuesta uniforme del login."""

from services import app_users


def _cleanup(user):
    app_users.reset_failed_logins(user, "")
    app_users.reset_failed_logins(user, "1.1.1.1")
    app_users.reset_failed_logins(user, "2.2.2.2")


def test_lockout_es_por_ip_y_no_afecta_a_otras(db):
    """El bloqueo se aplica a la (usuario, IP) que falla: desde otra IP no se
    puede tumbar la cuenta del dueño (DoS por lockout)."""
    user = "admin_lockout"
    for _ in range(app_users.MAX_FAILED_ATTEMPTS):
        app_users.record_failed_login(user, "1.1.1.1")

    assert app_users.get_lock_seconds(user, "1.1.1.1") > 0
    assert app_users.get_lock_seconds(user, "2.2.2.2") == 0

    app_users.reset_failed_logins(user, "1.1.1.1")
    assert app_users.get_lock_seconds(user, "1.1.1.1") == 0
    _cleanup(user)


def test_contador_reseta_con_clave_y_tipo(db):
    """La ventana es móvil: tras el reset en esa IP, vuelve a contar desde cero."""
    user = "admin_lockout2"
    app_users.record_failed_login(user, "1.1.1.1")
    app_users.reset_failed_logins(user, "1.1.1.1")

    attempts, locked = app_users.record_failed_login(user, "1.1.1.1")
    assert (attempts, locked) == (1, False)

    app_users.reset_failed_logins(user, "1.1.1.1")
    _cleanup(user)


def test_usuario_inexistente_tambien_acumula_fallos(db):
    """No debe distinguirse si la cuenta existe: un atacante no puede enumerar
    usuarios observando cuándo se activa el bloqueo."""
    user = "nadie_existe"
    for _ in range(app_users.MAX_FAILED_ATTEMPTS):
        app_users.record_failed_login(user, "1.1.1.1")
    assert app_users.get_lock_seconds(user, "1.1.1.1") > 0
    _cleanup(user)


def test_login_bloqueado_responde_igual_que_credencial_mala(db, monkeypatch):
    """Regresión: el login no revela que la cuenta está bloqueada (mismo 401
    genérico que una contraseña errónea)."""
    from fastapi.testclient import TestClient

    from api.app import app
    from services.app_users import create_app_user

    create_app_user("admin", "AdminPass-12345", rol="admin")
    monkeypatch.setattr(
        "services.app_users.get_lock_seconds", lambda _u, _ip=None: 60
    )

    with TestClient(app) as c:
        r = c.post("/api/auth/login", json={
            "username": "admin", "password": "AdminPass-12345"},
        )
        assert r.status_code == 401
        assert r.json()["detail"] == "Usuario o contraseña incorrectos."