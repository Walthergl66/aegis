# Bot de Backups y Monitoreo de PostgreSQL

Sistema para administrar bases PostgreSQL y ejecutar backups bajo demanda o programados, con una app móvil nativa Android/iOS en desarrollo, un panel web instalable (PWA) y un bot de Telegram. La PWA sigue siendo la interfaz web administrativa; la app Expo/React Native es el cliente móvil objetivo. Se puede conectar cualquier PostgreSQL accesible por URI; Supabase añade opcionalmente importación por PAT y consulta del estado cloud. El motor de copias siempre usa `pg_dump`.

El sistema integra FastAPI, React/Vite, SQLite, `pg_dump`/`pg_restore` y APScheduler en un despliegue Docker de dos contenedores. API, bot y trabajos programados comparten un único proceso backend.

## Empezar

1. Copia `backend/.env.example` a `backend/.env` y completa `BOT_TOKEN`, `ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY` y `SESSION_SECRET`.
2. Ejecuta `docker compose up -d --build`.
3. Abre `http://localhost:8080` e inicia sesión con el admin inicial. Agrega PostgreSQL desde **Proyectos → Nuevo proyecto** o, para Supabase, importa los proyectos con un PAT. Si no se definió una contraseña inicial válida, el backend genera una provisional y la guarda fuera de los logs junto a la base.

Los proyectos PostgreSQL directos permiten probar la conexión antes de guardarla y configurar `--no-owner`/`--no-privileges` para facilitar restauraciones en servidores con otros usuarios. Los proyectos de Supabase se importan desde **Importar proyectos**.

El bot incluye `/test <slug>`, además de `/proyectos`, `/backup <slug>`, `/status <slug>` y `/historial <slug>`.

La guía para desarrollar la app nativa está en [App móvil](docs/movil/README.md); el plan por fases está en [Implementación móvil](docs/implementacion/implementacion.md). La puesta en marcha del backend/panel está en [Instalación y operación](docs/operacion/README.md), y el despliegue privado en [Modelo A](docs/despliegue/README.md).

## Documentación del proyecto

El índice [Documentación modular](docs/README.md) organiza la guía por dominio: arquitectura, API, persistencia, backups, bot, frontend, seguridad, configuración y pruebas. Empieza allí para entender el sistema o encontrar una responsabilidad de código.

## Estructura principal

- `backend/main.py`: arranque, bootstrap, scheduler, FastAPI y polling de Telegram.
- `backend/api/`: API JSON, dependencias de autenticación y rutas bajo `/api`.
- `backend/services/`: acceso y operaciones de persistencia.
- `backend/core/`: configuración, SQLite, cifrado, JWT, seguridad y sanitización.
- `backend/backup/`, `bot/`, `notify/`: ejecución y programación de copias, comandos Telegram y notificaciones.
- `frontend/src/`: SPA React/PWA, funciones por dominio y clientes de API.
- `mobile/`: cliente nativo Expo/React Native para Android e iOS; actualmente incluye login/sesión y una pantalla inicial protegida.
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
