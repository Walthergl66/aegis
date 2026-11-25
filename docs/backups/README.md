# Backups y planificación

## Backup de proyecto

`backend/backup/runner.py` invoca `pg_dump --format=custom --compress=9` (`-Fc`) con `subprocess`, `shell=False` y timeout configurable. Antes de ejecutarlo exige el mínimo de espacio libre. Un lock por ID de proyecto serializa ejecuciones simultáneas de bot y scheduler. Para proyectos PostgreSQL directo se pueden aplicar `--no-owner` y `--no-privileges`; ambos están activados por defecto para ese proveedor y se pueden cambiar desde el formulario del proyecto. Proyectos Supabase no reciben esas opciones por defecto.

El dump se valida con `pg_restore --list`; esto comprueba que el catálogo del archivo sea legible, pero no equivale a ensayar una restauración completa en otra base. Luego se intenta generar un `.sql` plano con `pg_restore`. El `.sql` es complementario: si la conversión falla, el dump custom puede completar. Los archivos se cifran con Fernet y se elimina el claro. En almacenamiento se esperan archivos `.dump.enc` y, cuando se genera, `.sql.enc`.

Cada resultado de proyecto se registra en `backup_history`; las acciones manuales y programadas dejan también `audit_log`. La rotación local conserva hasta `BACKUP_KEEP_COUNT` copias por proyecto. Los detalles de errores PostgreSQL se traducen y redactan antes de mostrarse/notificarse.

Administradores descargan artefactos con `GET /api/backups/{backup_id}/download?format=dump` o `format=sql`. El endpoint acepta solo filas exitosas, resuelve la ruta dentro de `BACKUP_DIR` y transmite el contenido descifrado por bloques sin crear otro archivo claro en disco. Cada descarga queda auditada con usuario, proyecto y formato. La API de historial expone rutas relativas para no revelar la ruta absoluta del servidor.

## Origen de la conexión

Para PostgreSQL directo se registra una URI `postgresql://` o `postgres://`, que se valida y prueba antes de guardarse. El proveedor analiza host/puerto/usuario/base y opciones libpq admitidas. La contraseña se entrega a `pg_dump` en `PGPASSWORD`, no como argumento del proceso; el resto de datos se pasa como argumentos separados. La connection string completa se cifra al guardarla.

Para Supabase, el sistema valida el PAT con la Management API, lista proyectos y obtiene pooler config. Usa modo session (`:5432`) por defecto para `pg_dump`; si hace falta, se inyecta la contraseña de la BD. La connection string también se cifra. Los dos proveedores comparten el motor PostgreSQL de backup; solo Supabase ofrece importación y estado cloud.

## Ejecuciones

- Bajo demanda desde Telegram: `/backup <slug>`.
- Automáticas: cada proyecto activo puede tener una expresión cron de cinco campos. Sin cron queda solo manual. Se usa la zona por defecto del scheduler (UTC mediante `SELF_BACKUP_TZ`, que configura el scheduler principal). Cambios de proyecto resincronizan jobs.
- Self-backup SQLite: una copia diaria cifrada, además de una copia inicial si no hay ninguna. Conserva `SELF_BACKUP_KEEP_COUNT` y opcionalmente envía la copia más reciente descifrada en memoria a administradores Telegram.
- Resumen diario opcional: reporta estado de los proyectos por Telegram.

Un cron de proyecto puede expresarse, por ejemplo, como `30 3 * * *`. El parser valida el formato y los rangos al guardar. Los fallos programados alertan a admins.

Las solicitudes manuales desde la API web se guardan en `backup_jobs` y las procesa un worker del backend, aunque el cliente cierre la aplicación. El alta requiere `Idempotency-Key` y solo `admin` puede iniciarla. La app consulta el trabajo por su ID. Los estados son `queued`, `running`, `completed`, `failed` e `interrupted`. Si el backend reinicia mientras un trabajo estaba en ejecución, este queda como `interrupted` para revisión y no se repite automáticamente. Las solicitudes en cola se conservan en SQLite. El resultado se enlaza con `backup_history` y `audit_log`; al completar bien se intenta sincronizar off-site.

## Copia off-site

Si `OFFSITE_ENABLED=on`, `backup/offsite.py` sube los archivos `.enc` nuevos a un endpoint S3 compatible y aplica retención por carpeta/proyecto, conservando `OFFSITE_KEEP_COUNT` por proyecto. Se intenta sincronizar al arrancar y después de backups correctos. Es una sincronización best-effort: los errores se registran y notifican, y se pueden reintentar en la siguiente sincronización.

## Limpieza y recuperación

Al arrancar se barren `.dump`, `.sql` y `.tmp` bajo BACKUP_DIR: durante la generación los archivos pueden existir temporalmente en claro; restos de un proceso interrumpido se borran y se alerta a admins. No borres archivos `.enc` si no has confirmado acceso a la clave correcta.

Para restaurar: copia el `.enc` a un entorno controlado con la misma `BACKUP_ENCRYPTION_KEY`, descífralo a un archivo temporal protegido y usa `pg_restore` para el formato custom o `psql` para el SQL plano. Los pasos operativos se encuentran en [Instalación y operación](../operacion/README.md) y [Modelo A](../despliegue/README.md). La restauración debe probarse en una base de destino antes de considerarla recuperable.
