# Arquitectura

El producto consta de una app Expo, una API FastAPI privada y PostgreSQL. La API valida sesiones, aplica aislamiento por propietario y coordina conexiones, copias y tareas programadas.

## Arranque del backend

`backend/main.py` carga configuración, exige `DATABASE_URL`, aplica el esquema y migraciones PostgreSQL, ejecuta tareas de retención, limpia archivos temporales, sincroniza backups remotos opcionales y levanta FastAPI junto al planificador.

## Módulos

| Módulo | Responsabilidad |
|---|---|
| `api/` | Autenticación, cuentas, proyectos, importación, backups, auditoría y límites de acceso. |
| `core/` | Configuración, PostgreSQL, cifrado, JWT, seguridad y sanitización. |
| `services/` | Dominio, proveedores, propiedad y persistencia. |
| `backup/` | Ejecución, colas, programación, retención y sincronización remota. |
| `db/` | Esquema y migraciones PostgreSQL. |
| `mobile/` | Cliente Expo y acceso autenticado a la API. |

La app no recibe credenciales de PostgreSQL del servidor. Las claves de conexión se cifran antes de persistirse; los endpoints verifican el propietario en cada lectura y escritura.
