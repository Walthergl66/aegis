# Instalación y operación

## Requisitos

- Docker y Docker Compose (ruta recomendada).
- Bot creado con BotFather y token.
- Para importar Supabase: PAT con permisos necesarios, referencias de proyecto y contraseña de PostgreSQL.
- En ejecución fuera de Docker: Python compatible con dependencias y `pg_dump`, `pg_restore` y `psql` disponibles en PATH. El contenedor instala `postgresql-client-18` desde PGDG.

## Docker

```bash
cp backend/.env.example backend/.env
# Completa los secretos y credenciales
docker compose up -d --build
docker compose ps
```

Durante la migración, el panel se publica en `http://localhost:8080` enlazado a loopback; el estado final eliminará la SPA y conservará el acceso privado a la API para la app móvil. `./data` persiste DB y backups aunque se eliminen contenedores. `docker compose down` no elimina esa carpeta. El backend se espera healthy antes de iniciar frontend mientras este siga desplegado.

Al primer acceso usa `WEB_ADMIN_USERNAME`/`WEB_ADMIN_PASSWORD`. La contraseña inicial debe satisfacer la política de servicio; si no, se crea una temporal protegida junto a los datos. Cámbiala después del ingreso. Importar desde el panel valida PAT y proyectos, crea la cuenta/proyectos y permite dar de alta usuario Telegram y permisos. `/id` devuelve el chat ID. También se puede administrar desde CRUD.

## Desarrollo

```bash
cd backend
python -m venv .venv
# activa el entorno correspondiente a tu shell
pip install -r requirements-dev.txt
cp .env.example .env
python main.py
```

```bash
cd frontend
npm install
npm run dev
```

Vite sirve en `:5173` y proxy `/api` a `localhost:8000`; el backend por defecto usa 8080. Para desarrollo ajusta `WEB_PORT=8000` o cambia el proxy en `frontend/vite.config.js`.

## Comandos habituales

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend
docker compose down
docker compose up -d --build
```

## Importación y uso

1. Para PostgreSQL directo, crea un proyecto con una URI y valida la conexión; se crea/usa el grupo **Conexiones directas**. Para Supabase, importa con un PAT.
2. Registra el usuario Telegram que ejecutará comandos y asigna `can_backup`/`can_monitor` si no es admin.
3. Ejecuta `/proyectos`, `/test <slug>`, `/status <slug>`, `/backup <slug>` o `/historial <slug>`.
4. Opcional: define cron de cinco campos para cada proyecto activo.
5. Revisa resultados en Backups, historial por proyecto y Bitácora.

Para off-site, configura bucket S3 compatible y todas las variables `OFFSITE_*`, habilita `OFFSITE_ENABLED=on` y reinicia el backend. La subida inicial se ejecuta al arranque.

## Recuperación

Mantén una copia de las claves separada del host. Para recuperar un `.dump.enc`, usa la misma `BACKUP_ENCRYPTION_KEY`, descifra en un entorno protegido y restaura un dump custom con `pg_restore`; para `.sql.enc`, usa `psql`. Valida primero la recuperación en una base de prueba. Para recuperar la propia configuración SQLite existe un self-backup cifrado `panel_*.sqlite.enc`.

## Referencias operativas

- Runbook privado con Tailscale, verificación, restauración y diagnóstico: [Despliegue Modelo A](../despliegue/README.md).
- Variables y defaults: [Configuración](../configuracion/README.md).
- Flujo técnico de generación y retención: [Backups](../backups/README.md).
