# Guía del repositorio

## Estructura

- `backend/` contiene FastAPI, servicios de dominio, persistencia PostgreSQL, backups, seguridad y migraciones.
- `backend/tests/` contiene pruebas pytest; las pruebas con datos requieren `TEST_DATABASE_URL` y crean esquemas temporales.
- `mobile/` contiene la app Expo/React Native para iOS, Android y navegador. Llama a la API mediante `EXPO_PUBLIC_API_URL`.
- `docs/` contiene arquitectura, API, persistencia, seguridad, despliegue y guías de uso.
- `data/` es para backups y datos de ejecución, no para código fuente.

## Comandos

- Desarrollo de app: `cd mobile && npm install && npx expo start`.
- Verificación móvil: `cd mobile && npm run typecheck`.
- Backend: crea `backend/.env` desde `.env.example`, configura PostgreSQL y ejecuta `python main.py`.
- Pruebas backend: `cd backend && pytest -p no:cacheprovider` con una base dedicada en `TEST_DATABASE_URL`.
- Despliegue: `docker compose up -d --build`.

## Convenciones

- Python: 4 espacios y `snake_case`; componentes React Native en `PascalCase`, funciones en `camelCase`.
- Mantén los handlers HTTP delgados y coloca la lógica reutilizable en `backend/services/`.
- Mantén el acceso del cliente a la API en `mobile/services/`.
- Sigue el formato cercano; no hay un formateador global configurado.

## Seguridad

- `DATABASE_URL` debe apuntar a PostgreSQL y permanecer solo en el servidor.
- Nunca guardes `.env`, tokens, cadenas de conexión o backups generados en Git.
- Mantén el cifrado y la redacción de secretos en los flujos de conexión y backups.
