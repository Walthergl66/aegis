# Configuración

Copia `backend/.env.example` a `backend/.env`. Configura valores únicos para `ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY` y `SESSION_SECRET`.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | URI obligatoria de PostgreSQL. |
| `BACKUP_DIR` | Directorio de archivos de backup cifrados. |
| `BACKUP_KEEP_COUNT` | Cantidad local máxima por proyecto. |
| `BACKUP_TIMEOUT_SECONDS` | Tiempo límite de `pg_dump`. |
| `BACKUP_MIN_FREE_MB` | Espacio libre mínimo antes de iniciar una copia. |
| `OFFSITE_*` | Destino S3 compatible opcional. |
| `API_HOST`, `API_PORT` | Dirección de escucha de la API. |
| `API_DOCS_ENABLED` | Habilita o deshabilita OpenAPI. |
| `JWT_TTL_MINUTES`, `REFRESH_TTL_DAYS` | Duración de sesiones. |

`DATABASE_URL` y las claves son secretos exclusivos del servidor. La app móvil solo necesita `EXPO_PUBLIC_API_URL`.
