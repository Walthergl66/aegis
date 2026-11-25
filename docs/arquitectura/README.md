# Arquitectura

## Vista general

```text
Navegador (React/PWA web) ──► nginx (127.0.0.1:8080) ──┐
                                                       ├──► FastAPI ── SQLite en ./data
App nativa (Expo Android/iOS) ── HTTPS /api/* ─────────┘      │
                                                              ├── servicios
                                                              ├── bot Telegram polling
                                                              ├── APScheduler
                                                              └── pg_dump/pg_restore ── PostgreSQL
                                                                            └──────── S3 opcional
```

Compose tiene dos contenedores: `backend` y `frontend`. Dentro de `backend`, `main.py` coordina FastAPI, el polling de Telegram y APScheduler en el mismo proceso/event loop. Los trabajos bloqueantes de base de datos, `pg_dump` y algunos clientes se envían a hilos cuando se invocan desde tareas async. SQLite usa conexiones breves por operación, WAL, foreign keys y busy timeout.

## Arranque del backend

`backend/main.py` ejecuta, en orden: configuración/logging; inicialización y migración SQLite; creación del primer admin web; self-backup inicial si falta; purga de retención; barrido de restos de backups en claro; sincronización off-site opcional; creación de FastAPI y bot; scheduler y resincronización de crons de proyectos; inicio del polling y servicio Uvicorn. Al apagar el servidor cancela el polling y el scheduler.

El frontend web compila React/Vite a estáticos y nginx sirve la SPA y enruta `/api/` hacia `backend:8080`. El puerto publicado escucha en loopback; el backend solo se expone dentro de la red Compose. Para acceso web remoto el runbook usa Tailscale Serve. La app nativa se desarrolla en `mobile/`, no es un servicio Docker y llama a la misma API por la URL configurada en `EXPO_PUBLIC_API_URL` (por ejemplo, vía HTTPS/Tailscale).

## Capas del backend

| Área | Responsabilidad |
|---|---|
| `core/config.py` | Carga `.env`, valida secretos obligatorios y construye settings tipados. |
| `core/db.py` + `db/schema.sql` | Conexiones SQLite, inicialización del esquema nuevo y migraciones incrementales. |
| `core/crypto.py`, `jwt.py`, `security.py`, `sanitize.py` | Cifrado de secretos/archivos, tokens, contraseñas y limpieza de mensajes. |
| `services/` | Persistencia y operaciones para cuentas, proyectos, usuarios, permisos, sesiones, historial, auditoría e integración de proveedores. |
| `services/providers/` | Contrato común y adaptadores para PostgreSQL directo y Supabase. PostgreSQL provee conexión/prueba; Supabase añade importación y estado cloud. |
| `api/app.py`, `api/routes/`, `api/deps.py` | API JSON, middleware y control de acceso web. |
| `backup/` | Motor `pg_dump`, crons por proyecto, self-backup, limpieza y transferencia S3 compatible. |
| `bot/` | Construcción de la aplicación Telegram, comandos y conversaciones. |
| `notify/` | Mensajes/documentos a admins y resumen diario. |

Las rutas web no deben contener SQL de persistencia: usan `services/`. Las funciones en `services/` son la capa de persistencia de dominio y usan `core.db`.

### Inventario de servicios

| Módulo | Responsabilidad |
|---|---|
| `services/accounts.py` | CRUD de cuentas y acceso al PAT descifrado para integraciones internas. |
| `services/projects.py` | CRUD, validación/generación de slug y cron, archivado/restauración y estado derivado de proyectos. |
| `services/users.py` | Identidad Telegram, permisos por proyecto, PAT del usuario y resolución de admins. |
| `services/web_users.py` | Usuarios del panel, autenticación, bloqueo de login y funciones TOTP. |
| `services/supabase_api.py` | Cliente de Management API: valida PAT, lista proyectos y obtiene connection strings del pooler. |
| `services/providers/base.py` | Tipos de capacidades disponibles y resultado de prueba de conexión. |
| `services/providers/postgres.py` | Parseo/validación de URI PostgreSQL, parámetros de libpq, conexión de prueba y estado cloud no aplicable. |
| `services/providers/supabase.py` | Adaptador que delega conexión de base a PostgreSQL y usa Management API para importación/estado cloud. |
| `services/providers/__init__.py` | Registro/selección de proveedor y despacho a capacidades soportadas. |
| `services/pg_errors.py` | Traducción de errores PostgreSQL a mensajes amigables. |
| `services/backup_history.py` | Registro, consulta, último backup correcto y retención. |
| `services/audit.py` | Registro/consulta de acciones y retención. |
| `services/refresh_tokens.py` | Creación, hash, rotación, revocación y expiración de sesiones refresh. |
| `services/access_blacklist.py` | Revocación persistente de access JWT por `jti`; guarda vencimiento en `access_token_revocations`. |

### Inventario de áreas de backup

| Módulo | Responsabilidad |
|---|---|
| `backup/runner.py` | `pg_dump`, verificación con `pg_restore`, generación SQL, cifrado, rotación local y locks por proyecto. |
| `backup/scheduler_jobs.py` | Resincronización de crons por proyecto y registro/alerta de cada resultado automático. |
| `backup/web_jobs.py` | Worker async que reclama solicitudes persistidas y ejecuta el runner en un hilo. |
| `backup/self_backup.py` | Snapshot cifrado de SQLite del panel, rotación y envío opcional a admins. |
| `backup/offsite.py` | Listado/subida S3 compatible y retención remota por proyecto. |
| `backup/cleanup.py` | Eliminación de restos en claro al inicio. |
| `backup/monitor.py` | Funciones auxiliares de estado/conectividad de proyectos consumidas por flujos de monitoreo. |

## Proveedores de bases

El proveedor describe capacidades adicionales, no motores de backup distintos. PostgreSQL directo y Supabase usan `pg_dump` sobre una URI cifrada. El proveedor `postgres` acepta una conexión directa y no requiere PAT ni Management API. El proveedor `supabase` conserva la importación mediante PAT y el estado cloud; su conexión de base también se prueba y respalda con herramientas PostgreSQL estándar.

Los proyectos genéricos se asocian al grupo del sistema **Conexiones directas**. `core.db` lo crea durante la migración si no existe, porque el esquema mantiene `projects.account_id` como FK obligatoria.

## Recorrido de una acción

1. React llama al cliente de su dominio en `frontend/src/services/`.
2. `http.js` agrega Bearer, incluye cookies y renueva el access token al recibir 401.
3. nginx pasa `/api/*` al backend.
4. La ruta FastAPI valida el cuerpo/permiso, llama a un service y devuelve JSON.
5. Para un backup, la ruta o el bot consulta el proyecto, resuelve sus credenciales cifradas desde el service y llama al runner; el resultado se registra en historial y auditoría.

## Fuentes de verdad

- Esquema inicial: `backend/db/schema.sql`; cambios posteriores: `backend/core/db.py`.
- Rutas y contratos: decoradores en `backend/api/routes/` y `backend/api/app.py`.
- Configuración real: `backend/core/config.py` más plantilla `backend/.env.example`.
- Topología y hardening Docker/nginx: `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` y `frontend/nginx.conf`.
