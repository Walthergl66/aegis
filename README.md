# Bot de Backups y Monitoreo de PostgreSQL

Sistema para administrar bases PostgreSQL y ejecutar backups bajo demanda o programados desde una app móvil nativa para Android/iOS. La app Expo/React Native es el único cliente final previsto. El panel web y el bot Telegram siguen presentes solo mientras se completa la paridad de funciones y se migran identidades y alertas; después se retirarán. Se puede conectar cualquier PostgreSQL accesible por URI; Supabase añade importación por PAT y consulta del estado cloud. El motor de copias siempre usa `pg_dump`.

El sistema integra FastAPI, React/Vite, SQLite, `pg_dump`/`pg_restore` y APScheduler en un despliegue Docker de dos contenedores. API, bot y trabajos programados comparten un único proceso backend.

## Empezar

1. Copia `backend/.env.example` a `backend/.env` y completa `BOT_TOKEN`, `ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY` y `SESSION_SECRET`.
2. Ejecuta `docker compose up -d --build`.
3. Mientras dura la transición, el panel web actual sigue disponible en `http://localhost:8080`. El cliente nativo se configura con la URL HTTPS de la API en `mobile/.env.local`. La administración se está trasladando a la app y el panel no es parte del producto final.

Los proyectos PostgreSQL directos permiten probar la conexión antes de guardarla y configurar `--no-owner`/`--no-privileges` para facilitar restauraciones en servidores con otros usuarios. Los proyectos de Supabase se importan desde **Importar proyectos**.

El bot incluye `/test <slug>`, además de `/proyectos`, `/backup <slug>`, `/status <slug>` y `/historial <slug>`.

La guía para desarrollar la app nativa está en [App móvil](docs/movil/README.md); el plan por fases, incluida la retirada del panel web y Telegram, está en [Implementación móvil](docs/implementacion/implementacion.md). La puesta en marcha del sistema durante la transición está en [Instalación y operación](docs/operacion/README.md), y el despliegue privado en [Modelo A](docs/despliegue/README.md).

## Documentación del proyecto

El índice [Documentación modular](docs/README.md) organiza la guía por dominio: arquitectura, app móvil, API, persistencia, backups, transición Telegram, seguridad, configuración y pruebas.

## Estructura principal

- `backend/main.py`: arranque, bootstrap, scheduler, FastAPI y polling de Telegram.
- `backend/api/`: API JSON, dependencias de autenticación y rutas bajo `/api`.
- `backend/services/`: acceso y operaciones de persistencia.
- `backend/core/`: configuración, SQLite, cifrado, JWT, seguridad y sanitización.
- `backend/backup/`, `bot/`, `notify/`: ejecución y programación de copias, comandos Telegram y notificaciones.
- `frontend/src/`: panel web legado que se retirará al completar la paridad móvil.
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

cd ../frontend
npm install
npm run dev
npm run build

cd ../mobile
npm install
# Configura mobile/.env.local desde mobile/.env.example
npm run start
```

La configuración detallada, los límites operativos y los pasos para recuperar backups están documentados en [`docs/`](docs/README.md). Nunca subas `backend/.env`, `data/` ni claves de cifrado al repositorio.
