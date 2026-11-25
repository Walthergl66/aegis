# Backups y planificación

## Backup de proyecto

`backend/backup/runner.py` invoca `pg_dump --format=custom --compress=9` (`-Fc`) con `subprocess`, `shell=False` y timeout configurable. Antes de ejecutarlo exige el mínimo de espacio libre. Un lock por ID de proyecto serializa ejecuciones simultáneas de bot y scheduler.

El dump se valida con `pg_restore --list`; esto comprueba que el catálogo del archivo sea legible, pero no equivale a ensayar una restauración completa en otra base. Luego se intenta generar un `.sql` plano con `pg_restore`. El `.sql` es complementario: si la conversión falla, el dump custom puede completar. Los archivos se cifran con Fernet y se elimina el claro. En almacenamiento se esperan archivos `.dump.enc` y, cuando se genera, `.sql.enc`.

Cada resultado de proyecto se registra en `backup_history`; las acciones manuales y programadas dejan también `audit_log`. La rotación local conserva hasta `BACKUP_KEEP_COUNT` copias por proyecto. Los detalles de errores PostgreSQL se traducen y redactan antes de mostrarse/notificarse.

## Origen de la conexión

Al importar, el sistema valida el PAT con la Management API de Supabase, lista proyectos y obtiene pooler config. Usa modo session (`:5432`) por defecto para `pg_dump`; se puede inyectar la contraseña de la BD. La connection string se cifra al guardarla. Si `project_ref` está vacío, el proyecto puede representar PostgreSQL genérico sin Management API, aunque sigue usando el motor de backup PostgreSQL.

## Ejecuciones

- Bajo demanda desde Telegram: `/backup <slug>`.
- Automáticas: cada proyecto activo puede tener una expresión cron de cinco campos. Sin cron queda solo manual. Se usa la zona por defecto del scheduler (UTC mediante `SELF_BACKUP_TZ`, que configura el scheduler principal). Cambios de proyecto resincronizan jobs.
- Self-backup SQLite: una copia diaria cifrada, además de una copia inicial si no hay ninguna. Conserva `SELF_BACKUP_KEEP_COUNT` y opcionalmente envía la copia más reciente descifrada en memoria a administradores Telegram.
- Resumen diario opcional: reporta estado de los proyectos por Telegram.

Un cron de proyecto puede expresarse, por ejemplo, como `30 3 * * *`. El parser valida el formato y los rangos al guardar. Los fallos programados alertan a admins.

## Copia off-site

Si `OFFSITE_ENABLED=on`, `backup/offsite.py` sube los archivos `.enc` nuevos a un endpoint S3 compatible y aplica retención por carpeta/proyecto, conservando `OFFSITE_KEEP_COUNT` por proyecto. Se intenta sincronizar al arrancar y después de backups correctos. Es una sincronización best-effort: los errores se registran y notifican, y se pueden reintentar en la siguiente sincronización.

## Limpieza y recuperación

Al arrancar se barren `.dump`, `.sql` y `.tmp` bajo BACKUP_DIR: durante la generación los archivos pueden existir temporalmente en claro; restos de un proceso interrumpido se borran y se alerta a admins. No borres archivos `.enc` si no has confirmado acceso a la clave correcta.

Para restaurar: copia el `.enc` a un entorno controlado con la misma `BACKUP_ENCRYPTION_KEY`, descífralo a un archivo temporal protegido y usa `pg_restore` para el formato custom o `psql` para el SQL plano. Los pasos operativos se encuentran en [Instalación y operación](../operacion/README.md) y [Modelo A](../despliegue/README.md). La restauración debe probarse en una base de destino antes de considerarla recuperable.
