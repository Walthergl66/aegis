"""Mini-WAF por IP (A5): corta escaneos y ráfagas anómalas hacia /api/*.

Complementa a slowapi (enfocado en login): vigila el TRÁFICO GLOBAL por IP en
una ventana deslizante y bloquea temporalmente la IP que supere el umbral.
"""

from __future__ import annotations

import threading
import time

from core.config import settings



class IpThrottle:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}
        self._blocked_until: dict[str, float] = {}
        self._lock = threading.Lock()

    def hit(self, ip: str) -> bool:
        """Registra una petición. True solo en la petición que CRUZA el umbral."""
        now = time.time()
        window = float(settings().throttle_window_seconds)
        with self._lock:
            self._prune_if_large(now, window)
            self._prune_blocked_locked(now)
            if self._blocked_until.get(ip, 0) > now:
                return False
            hits = [t for t in self._hits.get(ip, []) if now - t <= window]
            hits.append(now)
            self._hits[ip] = hits
            if len(hits) > settings().throttle_max_requests:
                self._blocked_until[ip] = now + settings().throttle_block_seconds
                self._hits.pop(ip, None)
                return True
            return False

    def is_blocked(self, ip: str) -> bool:
        now = time.time()
        with self._lock:
            return self._blocked_until.get(ip, 0) > now

    def _prune_if_large(self, now: float, window: float) -> None:
        if len(self._hits) > 5000:
            self._hits = {
                k: [t for t in v if now - t <= window] for k, v in self._hits.items()
            }

    def _prune_blocked_locked(self, now: float) -> None:
        # Los bloqueos expirados nunca volvían a podarse: un problema en una IP
        # llenaba la estructura poco a poco. Se purgan cuando crecen demasiado.
        if len(self._blocked_until) <= 500:
            return
        expired = [ip for ip, until in self._blocked_until.items() if until <= now]
        for ip in expired:
            del self._blocked_until[ip]


throttle = IpThrottle()


