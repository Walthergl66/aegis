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
| `/historial <slug>` | `status_cmd.py` | Muestra ejecuciones recientes. |
| `/register` | `register.py` | Valida y cifra el PAT de un usuario Telegram ya autorizado, luego lista los proyectos que ve ese PAT. |
| `/addbd` | `addbd.py` | Desde el PAT guardado, permite elegir un proyecto, definir slug y obtener/guardar la conexión; pregunta la contraseña si Supabase entrega el marcador. |
| `/cancel` | conversaciones | Sale del flujo activo. |

El flujo `/register` no crea la identidad Telegram desde cero: el chat debe estar previamente autorizado para que el usuario registre su PAT. Los comandos de gestión y backup verifican el usuario Telegram y su acceso antes de actuar; los usuarios no reconocidos reciben respuestas genéricas. Los admins Telegram tienen permisos globales; el rol `usuario` queda limitado por la tabla `permissions`. La política concreta de cada handler puede variar por comando y es la autoridad final.

## Notificaciones

`backend/notify/telegram.py` centraliza mensajes a administradores y envío de documentos. Se usa para fallos de backups programados, errores de copia remota, alertas del throttle/login, limpieza de archivos en claro, self-backup y resumen diario. Las funciones de red son asíncronas o tienen variante sync para contextos de ejecución diferentes.

`notify/daily_summary.py` genera un resumen de estado de proyectos y avisa cuando no hay un backup OK reciente. Se activa con `DAILY_SUMMARY_ENABLED`, hora `DAILY_SUMMARY_TIME` y zona `DAILY_SUMMARY_TZ`.

La integración de correo no forma parte de la implementación actual. El bot requiere `BOT_TOKEN` y normalmente usa los usuarios Telegram con rol admin como destinatarios operativos.
