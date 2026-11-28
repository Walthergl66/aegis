# Backups

`backend/backup/runner.py` ejecuta `pg_dump` con formato custom, timeout, revisión de espacio libre y cifrado antes de conservar el archivo. Un lock por proyecto evita ejecuciones simultáneas. Los resultados se escriben en historial y auditoría PostgreSQL.

Los backups pueden iniciarse desde la app, programarse con una expresión cron por proyecto o sincronizarse opcionalmente con un destino S3 compatible. La retención local y remota se configura en `backend/.env`.

Los archivos en claro son temporales durante la ejecución. El arranque elimina restos sin cifrar. Protege `BACKUP_ENCRYPTION_KEY` y valida las restauraciones en una base aislada.
