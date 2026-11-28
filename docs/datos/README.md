# Persistencia

PostgreSQL es obligatorio para el servicio. `DATABASE_URL` no puede estar vacía; si falta, la configuración detiene el arranque. El esquema inicial está en `backend/db/schema.postgres.sql` y las migraciones incrementales en `backend/db/migrations/postgres/`.

## Schemas

| Schema | Contenido |
|---|---|
| `identity` | `app_users`, sesiones refresh y revocaciones de tokens. |
| `integrations` | `accounts` y credenciales cifradas de proveedores. |
| `app` | `projects` y sus propietarios. |
| `backups` | `backup_jobs` e historial. |
| `audit` | `audit_log`. |
| `public` | Solo el registro de migraciones; no contiene datos privados de la app. |

El backend establece un `search_path` fijo para resolver estos objetos. Los schemas privados no se añaden a los schemas expuestos por la Data API de Supabase. La migración `0002` mueve las tablas existentes dentro de una transacción; mantiene IDs, filas, índices y relaciones de clave foránea. Si el destino ya contiene una tabla homónima, falla sin sobrescribirla.

Cada cuenta nueva obtiene un espacio propio. Las tablas de cuentas y proyectos incluyen `owner_user_id`; los servicios y rutas limitan las consultas al propietario autenticado. La separación por schemas organiza módulos y privilegios, pero el aislamiento de personas sigue dependiendo de la autorización por propietario.

Los secretos de conexión y PAT se cifran con `ENCRYPTION_KEY`. Las sesiones guardan hashes de refresh tokens; los archivos generados se cifran con `BACKUP_ENCRYPTION_KEY`.
