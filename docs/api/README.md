# API

FastAPI expone los recursos consumidos por la app Expo bajo `/api`. El backend valida JWT, limita intentos, registra auditoría y aplica el filtro de propietario en cada acceso a cuentas, proyectos, jobs y artefactos.

## Rutas principales

- `/api/auth`: registro, login, refresh, perfil y TOTP.
- `/api/accounts`: cuentas de proveedor propias.
- `/api/projects`: proyectos y prueba de conexión PostgreSQL.
- `/api/import`: importación de recursos Supabase.
- `/api/backups`: trabajos, historial y descargas.
- `/api/audit`: eventos de la cuenta autenticada.
- `/api/health`: estado del servicio.

La API exige PostgreSQL configurado por `DATABASE_URL`. No expone credenciales de servidor al cliente. La documentación OpenAPI se habilita solo con `API_DOCS_ENABLED=true`.
