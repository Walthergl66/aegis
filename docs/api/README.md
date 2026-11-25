# API y permisos

La API es JSON bajo `/api/*`. Las rutas salvo salud y login requieren `Authorization: Bearer <access-token>`. El cliente web usa cookie HttpOnly para refresh/logout; el cliente nativo envía su refresh token en el cuerpo JSON. Swagger/ReDoc/OpenAPI se habilitan solo con `WEB_DOCS_ENABLED=true`, bajo `/api/docs`, `/api/redoc` y `/api/openapi.json`.

## Rutas

| Método y ruta | Acceso | Uso |
|---|---|---|
| `GET /api/health` | Público | Healthcheck `{"status":"ok"}`. |
| `POST /api/auth/login` | Público, limitado | Acepta username, password y `code` TOTP cuando se exige. Con `client_type: "native"`, incluye `refresh_token` en JSON además de la cookie que mantiene el flujo web. |
| `POST /api/auth/refresh` | Cookie web o JSON nativo | Acepta cookie `sb_refresh_token` o cuerpo `{ "refresh_token": "…" }`; rota el token y, para solicitud nativa, devuelve el nuevo refresh token en JSON junto al access token. |
| `POST /api/auth/logout` | Cookie web o JSON nativo | Revoca el refresh token de cookie o cuerpo `{ "refresh_token": "…" }`; con Bearer también revoca el access token. |
| `GET /api/auth/me` | Sesión | Devuelve identidad y rol actuales. |
| `POST /api/auth/totp/setup`, `/confirm`, `/disable` | Sesión | Configura, confirma o desactiva TOTP. |
| `GET /api/dashboard` | Sesión | Conteos, proyectos activos y auditoría reciente. |
| `/api/accounts` | Admin | `GET`, `POST`, `GET/{id}`, `PUT/{id}`, `DELETE/{id}` para cuentas Supabase o grupos PostgreSQL directo. |
| `GET /api/projects?estado=activos&provider=postgres` | Sesión (estados no activos solo admin) | Lista proyectos; `provider` filtra opcionalmente por `postgres` o `supabase`. |
| `/api/projects` | Mixto | Listado/detalle/historial autenticado; alta, edición, baja y restauración admin. Incluye `GET /active`. |
| `POST /api/projects/test-connection` | Admin | Prueba una URI antes de guardarla; JSON `connection` y `provider` opcional (`postgres` por defecto). Devuelve `ok`, detalle, host, base, versión y latencia. |
| `POST /api/projects/{id}/restore` | Admin | Restaura proyecto archivado con el slug enviado. |
| `GET /api/projects/{id}/history` | Sesión | Historial paginado del proyecto. |
| `/api/import/fetch`, `/api/import/create` | Admin | Consulta Management API y registra proyectos seleccionados. |
| `/api/users` | Admin | CRUD de usuarios Telegram y `POST /{id}/permissions`. |
| `/api/web-users` | Admin | CRUD de usuarios del panel. |
| `GET /api/backups` | Sesión | Historial paginado de backups; rutas devueltas relativas a BACKUP_DIR. |
| `GET /api/backups/{backup_id}/download?format=dump|sql` | Admin | Descarga por streaming un artefacto cifrado asociado a un backup correcto. Solo acepta `dump` o `sql`. |
| `POST /api/projects/{id}/backup-jobs` | Admin | Encola un backup y responde `202`; requiere `Idempotency-Key`. Repetir la clave del mismo usuario devuelve el trabajo existente. |
| `GET /api/backups/jobs/{job_id}` | Sesión | Consulta estado persistente del trabajo en cola, ejecución, completado, fallo o interrupción. |
| `GET /api/audit` | Sesión | Bitácora paginada. |

Los detalles de los cuerpos, respuestas y errores se definen en las funciones de `backend/api/routes/`. La API de backups lista metadatos; no sirve archivos de backup para descarga.

## Roles

- **Web `admin`**: administra cuentas, proyectos, importaciones, usuarios Telegram y usuarios web.
- **Web `viewer`**: consulta panel, proyectos, backups, auditoría y su seguridad personal. La autorización se aplica también en backend, no solo ocultando menús.
- El rol web no equivale al rol Telegram. Son identidades separadas.
- Los usuarios de Telegram tienen rol `admin` o `usuario`; estos últimos tienen permisos por proyecto (`can_backup`, `can_monitor`). Un admin Telegram tiene acceso global.

## Sesiones

Access JWT HS256 de corta duración viaja en Bearer. En web, el refresh token se administra en cookie HttpOnly; en nativo viaja en JSON y el cliente lo conserva en SecureStore. Ambos flujos rotan refresh tokens y en SQLite solo se conserva el hash. Cada request autenticado vuelve a consultar el usuario para reflejar desactivación y cambios de rol; la revocación del access token se guarda en SQLite y sobrevive reinicios. El bloqueo por intentos fallidos se aplica al login, no a sesiones ya autenticadas.

Errores de validación/autorización se devuelven como JSON `detail`. El middleware de throttling puede responder HTTP 429. Un JSON malformado devuelve 400. La referencia interactiva es opcional y debe mantenerse apagada en producción salvo que se necesite.
