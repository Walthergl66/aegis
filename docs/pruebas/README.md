# Pruebas

No existe suite frontend configurada. La suite automatizada está en `backend/tests/`; instalar dependencias de desarrollo y ejecutar desde `backend/`:

```bash
pip install -r requirements-dev.txt
pytest -p no:cacheprovider
```

El flag desactiva `.pytest_cache` en el repositorio. `tests/conftest.py` prepara SQLite y directorios temporales por test. Si un test modifica variables de entorno, debe limpiar el singleton de settings (`cfg._settings = None`) para que la siguiente lectura refleje la nueva configuración.

## Cobertura agrupada

| Área | Archivos representativos |
|---|---|
| Acceso, RBAC y calidad API | `test_api_rbac.py`, `test_api_quality.py`, `test_bot_access.py` |
| Autenticación web | `test_login_lockout.py`, `test_refresh_tokens_persist.py`, `test_access_token_revocation.py`, `test_totp.py`, `test_web_users_permissions.py` |
| Backups, cifrado y limpieza | `test_crypto_cleanup.py`, `test_offsite.py`, `test_retention_rate_limit.py` |
| Proveedores PostgreSQL/Supabase, modelo y prueba de conexión API | `test_postgres_providers.py`, `test_postgres_projects.py`, `test_api_projects_postgres.py`, `test_generic_postgres.py` |
| Opciones de `pg_dump` | `test_backup_options.py` |
| Supabase/importación | `test_import_pooler.py`, `test_import_reimport.py` |
| Cron y notificaciones | `test_slug_schedule.py`, `test_daily_summary.py`, `test_messaging_hardening.py` |

Verificación frontend disponible: `npm run build`. No hay runner de pruebas ni script de lint/typecheck definido en `frontend/package.json`.
