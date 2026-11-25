# Configuración

La plantilla es `backend/.env.example`; `backend/core/config.py` define defaults, conversiones y validación. Copia la plantilla a `backend/.env`. `BOT_TOKEN`, `ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY` y `SESSION_SECRET` son obligatorios al crear settings. Los booleanos aceptan `1`, `true`, `yes` u `on` (sin importar mayúsculas).

## Variables

| Variable | Default | Descripción |
|---|---|---|
| `BOT_TOKEN` | — | Token de Telegram, obligatorio. |
| `ENCRYPTION_KEY` | — | Fernet para PAT/conexiones, obligatorio. |
| `BACKUP_ENCRYPTION_KEY` | — | Fernet para archivos, obligatorio y distinta. |
| `SESSION_SECRET` | — | Secreto de firma JWT, obligatorio. |
| `WEB_ADMIN_USERNAME` | `admin` | Usuario bootstrap del primer admin. |
| `WEB_ADMIN_PASSWORD` | vacío | Contraseña inicial; si falta o no alcanza política, se genera provisional. Solo bootstrap. |
| `DB_PATH` | local `backend/data/backups.db`; Docker `/data/backups.db` | Archivo SQLite. |
| `BACKUP_DIR` | local `backend/data/backups`; Docker `/data/backups` | Raíz de copias de proyecto. |
| `BACKUP_KEEP_COUNT` | `10` | Retención local por proyecto. |
| `BACKUP_TIMEOUT_SECONDS` | `600` | Timeout de herramientas de backup. |
| `BACKUP_MIN_FREE_MB` | `1024` | Espacio libre mínimo para iniciar. |
| `BACKUP_COOLDOWN_SECONDS` | `30` | Espera anti repetición por chat en el comando manual. |
| `AUDIT_RETENTION_DAYS` | `365` | Retención de bitácora. |
| `HISTORY_RETENTION_DAYS` | `365` | Retención del historial de backups. |
| `SELF_BACKUP_DIR` | `<BACKUP_DIR>/self` | Directorio del self-backup. |
| `SELF_BACKUP_KEEP_COUNT` | `10` | Self-backups a conservar. |
| `SELF_BACKUP_TIME` | `03:00` | Hora local a la zona indicada. |
| `SELF_BACKUP_TZ` | `UTC` | Zona del scheduler principal/self-backup y purga. |
| `SELF_BACKUP_TELEGRAM` | `off` en código; `on` en plantilla | Enviar el self-backup más reciente a admins. |
| `DAILY_SUMMARY_ENABLED` | `on` | Programa resumen diario. |
| `DAILY_SUMMARY_TIME` | `08:00` | Hora del resumen. |
| `DAILY_SUMMARY_TZ` | `UTC` | Zona horaria del resumen. |
| `OFFSITE_ENABLED` | `off` | Habilita sincronización S3 compatible. |
| `OFFSITE_ENDPOINT` | vacío | Endpoint S3 (URL sin path según plantilla). |
| `OFFSITE_REGION` | `auto` | Región del servicio. |
| `OFFSITE_ACCESS_KEY`, `OFFSITE_SECRET_KEY` | vacío | Credenciales del bucket. |
| `OFFSITE_BUCKET` | vacío | Bucket destino. |
| `OFFSITE_PREFIX` | `backups` | Prefijo remoto. |
| `OFFSITE_KEEP_COUNT` | `30` | Retención remota por proyecto. |
| `WEB_HOST` | `0.0.0.0` | Host de escucha de Uvicorn. |
| `WEB_PORT` | `8080` | Puerto API. |
| `CORS_ALLOW_ORIGINS` | localhost y 127.0.0.1:8080 | Orígenes separados por coma. |
| `FORWARDED_ALLOW_IPS` | redes privadas/loopback | Proxies confiables de Uvicorn. |
| `WEB_DOCS_ENABLED` | `false` | Swagger, ReDoc y OpenAPI. |
| `PBKDF2_ITERATIONS` | `600000` | Iteraciones de hash de contraseña. |
| `JWT_TTL_MINUTES` | `60` | Vigencia del access token. |
| `REFRESH_TTL_DAYS` | `7` | Vigencia del refresh token. |
| `THROTTLE_MAX_REQUESTS` | `120` | Umbral mini-WAF por IP. |
| `THROTTLE_WINDOW_SECONDS` | `60` | Ventana de conteo mini-WAF. |
| `THROTTLE_BLOCK_SECONDS` | `120` | Duración de bloqueo. |
| `LOG_LEVEL` | `INFO` | Nivel de logging. |

Los defaults locales y Docker de `DB_PATH`/`BACKUP_DIR` difieren: en Docker Compose se fijan explícitamente a `/data` mediante plantilla. La plantilla indica `SELF_BACKUP_TELEGRAM=on`, mientras que si la variable no existe el default del código es `off`; conserva el valor explícito de la plantilla si deseas ese comportamiento.

## Cambios de configuración sensibles

Las claves no son intercambiables ni se pueden rotar sin recifrado planificado. Cambiar `SESSION_SECRET` invalida sesiones activas. `WEB_ADMIN_*` solo se usa cuando no hay usuarios web; luego cambia usuarios desde el panel. Mantén nginx `proxy_read_timeout` por encima del timeout del backup.

## App móvil

El cliente Expo usa una variable de entorno separada, no una variable del backend: `EXPO_PUBLIC_API_URL` se configura en `mobile/.env.local` a partir de [`mobile/.env.example`](../../mobile/.env.example). Debe incluir la base `/api` (por ejemplo, `https://servidor-accesible/api`); la app añade `/auth/login`, `/auth/refresh` y `/auth/logout`. Es una URL pública que queda incorporada al bundle, no debe contener secretos.
