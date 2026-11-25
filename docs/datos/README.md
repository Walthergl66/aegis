# Datos y persistencia

SQLite almacena configuración del panel, usuarios, historial y auditoría. La ruta por defecto local es `backend/data/backups.db`; Compose monta `./data` como `/data` y usa `/data/backups.db`. El directorio `data/` está fuera del control de versiones.

## Tablas

| Tabla | Propósito y relaciones |
|---|---|
| `accounts` | Cuenta Supabase con PAT cifrado o grupo de conexiones PostgreSQL directo sin PAT. Tiene proveedor `supabase` o `postgres`. |
| `projects` | Proyecto PostgreSQL: slug único, proveedor, cuenta/grupo, connection string cifrada, referencia Supabase opcional, opciones de `pg_dump`, estado, cron y archivado lógico. |
| `users` | Usuarios Telegram, rol, chat ID y PAT opcional cifrado. |
| `permissions` | Permisos de backup y monitor por usuario Telegram/proyecto; clave única por pareja. |
| `web_users` | Login del panel, hash de contraseña, rol, bloqueo y estado de TOTP. |
| `backup_history` | Resultado, fecha, tamaño, ruta y detalle de cada ejecución por proyecto. |
| `audit_log` | Acción, resultado, fecha, proyecto y actor Telegram/web opcional. |
| `refresh_sessions` | Hash de refresh token, usuario y expiración; cascada al borrar el usuario web. |
| `access_token_revocations` | `jti` revocado y vencimiento del JWT; conserva revocaciones entre reinicios y permite purgar las expiradas. |

El esquema íntegro, columnas, índices y restricciones está en `backend/db/schema.sql`. La auditoría no define FK para `project_id`; las tablas de permisos e historial sí vinculan proyecto/usuario según el esquema.

## Inicialización y evolución

`core.db.init_db()` crea directorios y ejecuta `schema.sql` solo si la base no existe o está vacía. Después `_migrate()` añade columnas incrementales (`users.supabase_pat_encrypted`, agenda/archive y proveedor/opciones de proyectos, proveedor de cuentas, campos de bloqueo/TOTP web), crea `refresh_sessions` y `access_token_revocations` e índices, y asegura el grupo **Conexiones directas**. Solo ignora errores de `ALTER TABLE` que indiquen que una columna ya existe; otros errores de migración se propagan. Al cambiar el modelo, actualiza el esquema para instalaciones nuevas y la migración para bases existentes; no uses el bloque destructivo `DROP TABLE` del esquema como migración de producción.

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
