"""Rate limiting de la API (slowapi).

El límite se aplica por IP real del cliente. Si existe un proxy confiable,
se lee `X-Forwarded-For`; el backend se publica solo en loopback.
"""

from __future__ import annotations

import time
from threading import Lock

from slowapi import Limiter

_RATE_LIMIT_ALERT_COOLDOWN_SECONDS = 300
_last_alert_at = 0.0
_alert_lock = Lock()


def _client_address(request) -> str:
    """IP real del cliente.

    Se usa la ÚLTIMA dirección de `X-Forwarded-For`, que el proxy confiable
    debe recalcular. Sin header, se cae a la IP del peer directo.
    """
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[-1]
    if request.client is not None:
        return request.client.host
    return "unknown"


def should_log_rate_limit() -> bool:
    """True si se debe registrar el evento (como máximo una vez cada 5 minutos)."""
    global _last_alert_at
    with _alert_lock:
        now = time.time()
        if now - _last_alert_at < _RATE_LIMIT_ALERT_COOLDOWN_SECONDS:
            return False
        _last_alert_at = now
        return True


limiter = Limiter(key_func=_client_address)
