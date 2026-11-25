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

Solo se despliega el backend/API, enlazado a `127.0.0.1:8080`. Configura `EXPO_PUBLIC_API_URL` en la app móvil con el endpoint privado HTTPS (por ejemplo, Tailscale Serve). `./data` persiste DB y backups aunque se eliminen contenedores. `docker compose down` no elimina esa carpeta.

Al instalar por primera vez, crea la cuenta desde la app móvil. Si se configuró `WEB_ADMIN_PASSWORD`, esa cuenta inicial se creó durante el arranque. Las cuentas y sus conexiones se sincronizan al iniciar sesión en otro dispositivo.

## Desarrollo

```bash
cd backend
python -m venv .venv
# activa el entorno correspondiente a tu shell
pip install -r requirements-dev.txt
cp .env.example .env
python main.py
```

La app móvil se desarrolla desde `mobile/` con `npm install` y `npm run start`; configura `.env.local` desde `.env.example`.

## Comandos habituales

```bash
docker compose logs -f backend
docker compose restart backend
docker compose down
docker compose up -d --build
```

## Importación y uso

1. Desde la app móvil, crea un proyecto PostgreSQL con una URI o importa proyectos Supabase con un PAT.
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
