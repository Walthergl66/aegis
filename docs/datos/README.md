# Persistencia

PostgreSQL es obligatorio para el servicio. `DATABASE_URL` no puede estar vacía; si falta, la configuración detiene el arranque. El esquema inicial está en `backend/db/schema.postgres.sql` y las migraciones incrementales en `backend/db/migrations/postgres/`.

Cada cuenta nueva obtiene un espacio propio. Las tablas de cuentas y proyectos incluyen `owner_user_id`; los servicios y rutas limitan las consultas al propietario autenticado. Las claves externas y las sesiones usan restricciones de PostgreSQL.

La migración inicial de actualización conserva la identidad de las cuentas y sus relaciones al renombrar las tablas y columnas heredadas. También elimina las tablas obsoletas que ya no tienen consumidores en el producto.

Los secretos de conexión y PAT se cifran con `ENCRYPTION_KEY`. Las sesiones guardan hashes de refresh tokens; los archivos generados se cifran con `BACKUP_ENCRYPTION_KEY`.
