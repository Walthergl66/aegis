# Supabase Backups

Panel web progresivo y bot de Telegram para administrar proyectos PostgreSQL, ejecutar y programar backups, revisar su estado y conservar una bitácora. El sistema integra FastAPI, React/Vite, SQLite, `pg_dump`/`pg_restore` y APScheduler en un despliegue Docker de dos contenedores; API, bot y trabajos programados comparten un único proceso backend.

## Empezar

1. Copia `backend/.env.example` a `backend/.env` y completa `BOT_TOKEN`, `ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY` y `SESSION_SECRET`.
2. Ejecuta `docker compose up -d --build`.
3. Abre `http://localhost:8080`, inicia sesión con el admin inicial y configura cuentas, proyectos y usuarios. Si no se definió una contraseña inicial válida, el backend genera una provisional y la guarda fuera de los logs junto a la base.

La guía completa de puesta en marcha local y operación está en [Instalación y operación](docs/operacion/README.md). Para el despliegue privado por Tailscale consulta el [runbook Modelo A](docs/despliegue/README.md).

## Documentación del proyecto

El índice [Documentación modular](docs/README.md) organiza la guía por dominio: arquitectura, API, persistencia, backups, bot, frontend, seguridad, configuración y pruebas. Empieza allí para entender el sistema o encontrar una responsabilidad de código.

## Estructura principal

- `backend/main.py`: arranque, bootstrap, scheduler, FastAPI y polling de Telegram.
- `backend/api/`: API JSON, dependencias de autenticación y rutas bajo `/api`.
- `backend/services/`: acceso y operaciones de persistencia.
- `backend/core/`: configuración, SQLite, cifrado, JWT, seguridad y sanitización.
- `backend/backup/`, `bot/`, `notify/`: ejecución y programación de copias, comandos Telegram y notificaciones.
- `frontend/src/`: SPA React/PWA, funciones por dominio y clientes de API.
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
```

La configuración detallada, los límites operativos y los pasos para recuperar backups están documentados en [`docs/`](docs/README.md). Nunca subas `backend/.env`, `data/` ni claves de cifrado al repositorio.
