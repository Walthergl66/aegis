# Bot de Backups y Monitoreo de PostgreSQL

Sistema para administrar bases PostgreSQL y ejecutar backups desde una app móvil nativa para Android/iOS. La app Expo/React Native es el único cliente de producto; la API privada y Telegram siguen como servicios de soporte del backend. Se puede conectar cualquier PostgreSQL accesible por URI; Supabase añade importación por PAT y consulta del estado cloud. El motor de copias siempre usa `pg_dump`.

El sistema integra una app nativa Expo/React Native, una API FastAPI, SQLite, `pg_dump`/`pg_restore` y APScheduler. La app móvil es el único cliente de producto; API, bot y trabajos programados comparten el proceso backend.

## Empezar

1. Copia `backend/.env.example` a `backend/.env` y completa `BOT_TOKEN`, `ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY` y `SESSION_SECRET`. Si no configuras `WEB_ADMIN_PASSWORD`, crea tu primera cuenta desde la app.
2. Ejecuta `docker compose up -d --build`.
3. La API queda enlazada a `127.0.0.1:8080`; configura `EXPO_PUBLIC_API_URL` en `mobile/.env.local` con la URL privada HTTPS de la API (por ejemplo, Tailscale Serve).

4. Abre la app y crea tu cuenta. Tus conexiones y proyectos quedan guardados en el backend y aparecerán al iniciar sesión con la misma cuenta desde otro dispositivo.

Los proyectos PostgreSQL directos permiten probar la conexión antes de guardarla y configurar `--no-owner`/`--no-privileges` para facilitar restauraciones en servidores con otros usuarios. Los proyectos de Supabase se importan desde **Importar proyectos**.

El bot incluye `/test <slug>`, además de `/proyectos`, `/backup <slug>`, `/status <slug>` y `/historial <slug>`.

La guía para desarrollar la app nativa está en [App móvil](docs/movil/README.md); el plan y el estado de migración están en [Implementación móvil](docs/implementacion/implementacion.md). La puesta en marcha está en [Instalación y operación](docs/operacion/README.md), y el despliegue privado en [Modelo A](docs/despliegue/README.md).

## Documentación del proyecto

El índice [Documentación modular](docs/README.md) organiza la guía por dominio: arquitectura, app móvil, API, persistencia, backups, transición Telegram, seguridad, configuración y pruebas.

## Estructura principal

- `backend/main.py`: arranque, bootstrap, scheduler, FastAPI y polling de Telegram.
- `backend/api/`: API JSON, dependencias de autenticación y rutas bajo `/api`.
- `backend/services/`: acceso y operaciones de persistencia.
- `backend/core/`: configuración, SQLite, cifrado, JWT, seguridad y sanitización.
- `backend/backup/`, `bot/`, `notify/`: ejecución y programación de copias, comandos Telegram y notificaciones.
- `mobile/`: app nativa Expo/React Native para Android e iOS y cliente final del producto.
- `backend/db/schema.sql`: esquema de base nueva; `backend/core/db.py` aplica migraciones incrementales.
- `data/`: persistencia local de SQLite y archivos de backup; no se versiona.

## Comandos rápidos

```bash
docker compose up -d --build
docker compose logs -f backend
docker compose down

cd backend
pip install -r requirements-dev.txt
pytest -p no:cacheprovider

cd ../mobile
npm install
# Configura .env.local desde .env.example
npm run start
```

La configuración detallada, los límites operativos y los pasos para recuperar backups están documentados en [`docs/`](docs/README.md). Nunca subas `backend/.env`, `data/` ni claves de cifrado al repositorio.
