# Aegis

Aegis permite administrar conexiones PostgreSQL y copias de seguridad desde una app Expo para iOS, Android y navegador. El backend FastAPI ofrece una API privada; PostgreSQL es obligatorio para las cuentas, conexiones, sesiones, auditoría y trabajos.

## Requisitos

- PostgreSQL 16 o compatible y `DATABASE_URL` configurada.
- Python según `backend/requirements.txt` y `pg_dump` disponible en el servidor.
- Node.js y Expo para desarrollar el cliente en `mobile/`.
- Claves únicas para `ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY` y `SESSION_SECRET`.

## Desarrollo

- Backend: configura `backend/.env` desde `.env.example` y ejecuta `python main.py` dentro de `backend/`.
- Cliente: `cd mobile && npm install && npx expo start`.
- Verificación de tipos: `cd mobile && npm run typecheck`.
- Pruebas del backend: configura una base de datos dedicada en `TEST_DATABASE_URL` y ejecuta `cd backend && pytest -p no:cacheprovider`.
- Despliegue: `docker compose up -d --build`.

El esquema y las migraciones PostgreSQL viven en `backend/db/`. Las conexiones y secretos de PostgreSQL nunca se guardan en el cliente; las credenciales de proyectos y los archivos de backup se cifran en el backend.
