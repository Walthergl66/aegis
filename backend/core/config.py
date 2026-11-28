"""Configuración central del sistema.

Carga las variables de entorno desde un archivo `.env` (raíz del proyecto)
y las expone de forma tipada. Todas las credenciales viven aquí y nunca
hardcodeadas en el código.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ENV_FILE = PROJECT_ROOT / ".env"


class Settings:
    def __init__(self, env_file: Path | None = None) -> None:
        env_file = env_file or DEFAULT_ENV_FILE
        if env_file.exists():
            load_dotenv(env_file)

        self.package_dir = PROJECT_ROOT

        self.encryption_key: str = self._required("ENCRYPTION_KEY")

        self.backup_encryption_key: str = self._required("BACKUP_ENCRYPTION_KEY")

        self.api_docs_enabled: bool = os.getenv("API_DOCS_ENABLED", "").strip().lower() in ("1", "true", "yes", "on")

        try:
            self.pbkdf2_iterations: int = int(os.getenv("PBKDF2_ITERATIONS", "600000"))
        except ValueError:
            self.pbkdf2_iterations = 600_000

        # Access JWT de corta duración + refresh token rotativo para la app móvil.
        self.jwt_ttl_seconds: int = self._int_env("JWT_TTL_MINUTES", 60) * 60
        self.refresh_ttl_seconds: int = self._int_env("REFRESH_TTL_DAYS", 7) * 24 * 3600

        # Mini-WAF por IP (A5): corta ráfagas anómalas hacia /api/*.
        self.throttle_max_requests: int = self._int_env("THROTTLE_MAX_REQUESTS", 120)
        self.throttle_window_seconds: int = self._int_env("THROTTLE_WINDOW_SECONDS", 60)
        self.throttle_block_seconds: int = self._int_env("THROTTLE_BLOCK_SECONDS", 120)

        self.session_secret: str = self._required("SESSION_SECRET")

        self.database_url: str = self._required("DATABASE_URL")
        if not self.database_url.startswith(("postgres://", "postgresql://")):
            raise RuntimeError("DATABASE_URL debe usar el protocolo PostgreSQL.")
        self.backup_dir: Path = Path(os.getenv("BACKUP_DIR", str(PROJECT_ROOT / "data" / "backups")))

        self.backup_keep_count: int = self._int_env("BACKUP_KEEP_COUNT", 10)
        self.backup_timeout_seconds: int = self._int_env("BACKUP_TIMEOUT_SECONDS", 600)
        self.backup_min_free_mb: int = self._int_env("BACKUP_MIN_FREE_MB", 1024)
        # Retención de tablas de log (purga semanal automática).
        self.audit_retention_days: int = self._int_env("AUDIT_RETENTION_DAYS", 365)
        self.history_retention_days: int = self._int_env("HISTORY_RETENTION_DAYS", 365)

        self.api_host: str = os.getenv("API_HOST", "0.0.0.0")
        self.api_port: int = self._int_env("API_PORT", 8080)

        # Proxies confiados para uvicorn (proxy_headers): permite a FastAPI
        # ver el esquema real (https) y la IP real cuando Tailscale Serve
        # reenvían X-Forwarded-Proto/For. Solo sufijos de red privada:
        # un cliente externo nunca puede inyectar esos headers.
        self.forwarded_allow_ips: str = os.getenv(
            "FORWARDED_ALLOW_IPS",
            "127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16",
        )

        self.log_level: str = os.getenv("LOG_LEVEL", "INFO").strip().upper()

        # Copia fuera del sitio (S3 / R2 / B2 / MinIO). Requiere OFFSITE_ENABLED=on.
        self.offsite_enabled: bool = os.getenv("OFFSITE_ENABLED", "").strip().lower() in ("1", "true", "yes", "on")
        self.offsite_endpoint: str = os.getenv("OFFSITE_ENDPOINT", "").strip()
        self.offsite_region: str = os.getenv("OFFSITE_REGION", "auto").strip()
        self.offsite_access_key: str = os.getenv("OFFSITE_ACCESS_KEY", "")
        self.offsite_secret_key: str = os.getenv("OFFSITE_SECRET_KEY", "")
        self.offsite_bucket: str = os.getenv("OFFSITE_BUCKET", "").strip()
        self.offsite_prefix: str = os.getenv("OFFSITE_PREFIX", "backups").strip() or "backups"
        self.offsite_keep_count: int = self._int_env("OFFSITE_KEEP_COUNT", 30)

    @staticmethod
    def _required(name: str) -> str:
        value = os.getenv(name, "").strip()
        if not value:
            raise RuntimeError(
                f"Falta la variable de entorno obligatoria {name!r}. "
                "Revisa el archivo .env (usa .env.example como plantilla)."
            )
        return value

    @staticmethod
    def _int_env(name: str, default: int) -> int:
        try:
            return int(os.getenv(name, default))
        except ValueError:
            return default


def get_settings(env_file: Path | None = None) -> Settings:
    return Settings(env_file)


_settings: Settings | None = None


def settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
