# Despliegue

El contenedor ejecuta FastAPI y el planificador. PostgreSQL debe estar disponible y `DATABASE_URL` configurada antes del arranque. El ejemplo de Compose publica la API solo en loopback; para acceso remoto se recomienda una red privada.

## Variables necesarias

Define `DATABASE_URL`, `ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY` y `SESSION_SECRET` en el entorno privado del servidor. Configura `BACKUP_DIR`; si se usa almacenamiento remoto, añade las variables `OFFSITE_*`.

## Operación

```sh
docker compose up -d --build
docker compose logs -f backend
```

Las migraciones PostgreSQL se aplican al inicio. Comprueba `/api/health`, revisa logs y valida periódicamente la restauración de un backup cifrado.
