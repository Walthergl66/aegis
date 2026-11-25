# Datos y persistencia

Supabase PostgreSQL almacena las cuentas de acceso, conexiones, proyectos, sesiones, trabajos, historial y auditoría. El esquema se define en `backend/db/schema.postgres.sql` y crea tablas vacías: no inserta un usuario ni una conexión por defecto. El backend se conecta usando `DATABASE_URL`, guardada solo en `backend/.env`.

SQLite se conserva como alternativa local para desarrollo y pruebas (`DB_PATH`). Los archivos de backup siguen en `BACKUP_DIR` dentro del volumen `./data`; no forman parte de esta migración de tablas.

## Tablas

| Tabla | Propósito y relaciones |
|---|---|
| `accounts` | Cuenta Supabase con PAT cifrado o grupo PostgreSQL directo, proveedor y `owner_user_id`. |
| `projects` | Proyecto PostgreSQL: slug único, propietario, proveedor, cuenta/grupo, connection string cifrada, referencia Supabase, opciones de `pg_dump`, estado, cron y archivado lógico. |
| `users` | Usuarios Telegram, rol, chat ID y PAT opcional cifrado. |
| `permissions` | Permisos de backup y monitor por usuario Telegram/proyecto; clave única por pareja. |
| `web_users` | Cuentas de acceso a la app, hash de contraseña, rol, bloqueo y estado de TOTP (nombre histórico). |
| `backup_history` | Resultado, fecha, tamaño, ruta y detalle de cada ejecución por proyecto. |
| `audit_log` | Acción, resultado, fecha, proyecto y actor Telegram/web opcional. |
| `refresh_sessions` | Hash de refresh token, usuario y expiración; cascada al borrar el usuario web. |
| `access_token_revocations` | `jti` revocado y vencimiento del JWT; conserva revocaciones entre reinicios y permite purgar las expiradas. |
| `backup_jobs` | Cola persistente para solicitudes web, usuario solicitante, clave idempotente, estado, tiempos y vínculo al historial. |

El esquema íntegro, columnas, índices y restricciones está en `backend/db/schema.sql`. La auditoría no define FK para `project_id`; las tablas de permisos e historial sí vinculan proyecto/usuario según el esquema.

## Inicialización y evolución

`core.db.init_db()` crea directorios y ejecuta `schema.sql` solo si la base no existe o está vacía. Después `_migrate()` añade columnas incrementales, incluyendo propietarios para cuentas y proyectos. En datos existentes asigna los recursos previos a la cuenta de acceso más antigua; en una instalación nueva, la primera persona que se registra reclama los recursos sin propietario. También crea índices y asegura el grupo **Conexiones directas**. Solo ignora errores de `ALTER TABLE` que indiquen que una columna ya existe; otros errores de migración se propagan.

Las filas históricas reciben proveedor `supabase` por defecto para conservar compatibilidad. Los nuevos proyectos `postgres` se agrupan bajo la cuenta interna **Conexiones directas**; aunque no necesiten PAT, conservan `account_id` válido por la FK obligatoria.

Las conexiones son cortas, activan foreign keys y WAL, y tienen `busy_timeout=5000`. Las funciones CRUD/persistencia viven en `backend/services/`; las utilidades SQL (`fetch_one`, `fetch_all`, `execute`) están en `core.db`.

## Datos cifrados

- PAT de cuentas y usuarios y connection strings de proyectos se cifran con Fernet usando `ENCRYPTION_KEY`.
- Los hashes de contraseña web usan PBKDF2-SHA256 con salt; no se almacena la contraseña en claro.
- El secreto TOTP activo está en `web_users`; el secreto pendiente permanece hasta confirmar la activación.
- Refresh tokens se guardan como SHA-256 y no en claro; revocaciones de access tokens guardan solo `jti` y vencimiento.
- El cifrado de archivos usa otra clave: `BACKUP_ENCRYPTION_KEY`.

La rotación o pérdida de las dos claves Fernet requiere un plan de migración con las claves anteriores. Cambiar la clave sin recifrar datos hace que el material anterior sea ilegible.

## Retención

El job semanal elimina eventos antiguos de `audit_log` y `backup_history` según `AUDIT_RETENTION_DAYS` y `HISTORY_RETENTION_DAYS`, y purga refresh sessions expiradas. El scheduler utiliza `SELF_BACKUP_TZ` como zona del scheduler principal; la hora del resumen diario tiene su propia zona `DAILY_SUMMARY_TZ`.
