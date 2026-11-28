# Datos y persistencia

Supabase PostgreSQL almacena las cuentas de acceso, conexiones, proyectos, sesiones, trabajos, historial y auditoría. El esquema inicial se define en `backend/db/schema.postgres.sql`; las actualizaciones incrementales van en `backend/db/migrations/postgres/`. El esquema crea tablas vacías: no inserta un usuario ni una conexión por defecto. El backend se conecta usando `DATABASE_URL`, guardada solo en `backend/.env`.

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

El esquema SQLite está en `backend/db/schema.sql` y el esquema inicial PostgreSQL en `backend/db/schema.postgres.sql`. La auditoría no define FK para `project_id`; las tablas de permisos e historial sí vinculan proyecto/usuario según el esquema.

## Inicialización y evolución

Para SQLite, `core.db.init_db()` ejecuta `schema.sql` solo si la base no existe o está vacía y después `_migrate()` aplica los cambios incrementales. En PostgreSQL, cada arranque aplica el esquema inicial de forma idempotente y luego ejecuta, en orden, los archivos SQL aún no registrados en `schema_migrations`. Cada migración se registra en la misma transacción que sus cambios; si falla, se revierte y se vuelve a intentar al siguiente arranque. No edites el esquema inicial para modificar tablas ya creadas: agrega una nueva migración numerada en `backend/db/migrations/postgres/`. La migración `0001` completa columnas e índices en bases PostgreSQL existentes. Los recursos existentes sin propietario se mantienen inaccesibles desde la app hasta que se les asigne un propietario de forma explícita y verificada; el registro no los reclama automáticamente.

Cada registro crea un espacio personal y recibe el rol `admin` para gestionar sus propios proyectos. Las rutas de la API filtran los recursos por `owner_user_id`; este rol no concede acceso a los datos de otros usuarios. El bot de Telegram solo opera sobre proyectos sin propietario móvil hasta que exista un vínculo de identidad explícito.

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
