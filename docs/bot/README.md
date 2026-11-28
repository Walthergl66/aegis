# Bot y notificaciones

`backend/bot/application.py` registra los handlers y ejecuta Telegram long polling dentro del event loop compartido con FastAPI. Al iniciar descarta updates pendientes (`drop_pending_updates=True`). Los handlers por dominio viven en `backend/bot/handlers/`.

## Comandos

| Comando | Handler | Resultado |
|---|---|---|
| `/start`, `/help` | `basics.py` | Ayuda/instrucciones. |
| `/id` | `misc.py` | Devuelve el chat ID para el alta. |
| `/proyectos` | `basics.py` | Lista proyectos disponibles y estado del último backup según permisos. |
| `/backup <slug>` | `backup_cmd.py` | Ejecuta una copia bajo demanda si el usuario está autorizado. Aplica cooldown. |
| `/status <slug>` | `status_cmd.py` | Comprueba conectividad/estado del proyecto. |
| `/test <slug>` | `status_cmd.py` | Prueba únicamente la conexión PostgreSQL y muestra versión/latencia si están disponibles. Requiere permiso `can_monitor`. |
| `/historial <slug>` | `status_cmd.py` | Muestra ejecuciones recientes. |
| `/register` | `register.py` | Valida y cifra el PAT de un usuario Telegram ya autorizado, luego lista los proyectos que ve ese PAT. |
| `/addbd` | `addbd.py` | Presenta dos rutas: importar un proyecto Supabase con PAT o registrar PostgreSQL directo pegando una URI. En el flujo directo valida y prueba la conexión; los mensajes con URI se borran del chat al leerlos. Luego solicita slug y registra al autor con permisos de backup y monitoreo. En el flujo Supabase elige proyectos del PAT guardado y obtiene la conexión automáticamente, con opción de entregar contraseña si viene el marcador. |
| `/cancel` | conversaciones | Sale del flujo activo. |

El flujo `/register` no crea la identidad Telegram desde cero: el chat debe estar previamente autorizado para que el usuario registre su PAT. Los comandos de gestión y backup verifican el usuario Telegram y su acceso antes de actuar; los usuarios no reconocidos reciben respuestas genéricas. Los admins Telegram pueden operar todos los proyectos sin propietario de la app; los proyectos móviles con `owner_user_id` solo son visibles para su propietario en la app. El rol `usuario` queda limitado además por la tabla `permissions`.

## Notificaciones

`backend/notify/telegram.py` centraliza mensajes a administradores y envío de documentos. Se usa para alertas operativas; los resúmenes y errores de backups omiten los proyectos propiedad de usuarios móviles. Si se habilita el envío de self-backup, Telegram recibe únicamente el archivo cifrado, que requiere `BACKUP_ENCRYPTION_KEY` para abrirse. Las funciones de red son asíncronas o tienen variante sync para contextos de ejecución diferentes.

`notify/daily_summary.py` genera un resumen de estado de proyectos y avisa cuando no hay un backup OK reciente. Se activa con `DAILY_SUMMARY_ENABLED`, hora `DAILY_SUMMARY_TIME` y zona `DAILY_SUMMARY_TZ`.

La integración de correo no forma parte de la implementación actual. El bot requiere `BOT_TOKEN` y normalmente usa los usuarios Telegram con rol admin como destinatarios operativos.
