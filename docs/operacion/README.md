# Operación

Antes de habilitar el servicio, verifica conectividad con PostgreSQL, claves de cifrado, espacio disponible y acceso de `pg_dump` a los servidores administrados.

Cada persona registra su cuenta y administra sus propios proyectos. Para un backup manual, usa la acción de backup del proyecto en la app. Las ejecuciones programadas quedan registradas en el historial y la auditoría.

Conserva `ENCRYPTION_KEY` y `BACKUP_ENCRYPTION_KEY` fuera del host de ejecución. Para recuperar un `.dump.enc`, descífralo en un entorno protegido y restaura con `pg_restore`; para `.sql.enc`, usa `psql`. Comprueba el resultado en una base aislada antes de reemplazar datos.
