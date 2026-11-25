# Documentación modular

Guía de referencia del repositorio. Describe la implementación observada en el código; el archivo `.env.example`, los esquemas, rutas y scripts son la fuente de verdad cuando una opción cambia.

## Índice

| Tema | Contenido |
|---|---|
| [Arquitectura](arquitectura/README.md) | Componentes, flujo de arranque, límites entre capas y responsabilidades por módulo. |
| [API y permisos](api/README.md) | Rutas REST, autenticación, roles y contrato con el frontend. |
| [Datos y persistencia](datos/README.md) | Esquema SQLite, relaciones, migraciones y cifrado de campos. |
| [Backups y planificación](backups/README.md) | Flujo de backup, verificación, retención, scheduler y copia remota. |
| [Bot y notificaciones](bot/README.md) | Comandos, registro, autorización y mensajes operativos. |
| [Frontend y PWA](frontend/README.md) | Rutas, pantallas, servicios y políticas de sesión/cache. |
| [Seguridad](seguridad/README.md) | Controles, claves, sesiones, límites y datos sensibles. |
| [Configuración](configuracion/README.md) | Variables, valores por defecto y efectos de rotación. |
| [Instalación y operación](operacion/README.md) | Entorno local, Docker, tareas frecuentes e incidentes. |
| [Despliegue Modelo A](despliegue/README.md) | VM privada con Tailscale, restauración y runbook de incidentes. |
| [Pruebas](pruebas/README.md) | Cómo ejecutar la suite y qué áreas cubre cada grupo de casos. |

## Mapa del repositorio

```text
backend/main.py              arranque del único proceso
backend/api/                 FastAPI, dependencias y endpoints JSON
backend/services/            persistencia y lógica de acceso a datos
backend/core/                configuración, DB, cifrado, JWT y utilidades
backend/backup/              ejecución, scheduler, retención y destino S3
backend/bot/                 polling y handlers de Telegram
backend/notify/              envío a Telegram y resumen de salud
backend/db/schema.sql        esquema inicial SQLite
frontend/src/features/       pantallas React por dominio
frontend/src/services/       clientes HTTP por dominio
frontend/src/components/     layout y componentes compartidos
docs/                        documentación funcional y operativa
data/                         volumen de runtime, fuera de Git
```

## Convenciones de mantenimiento

- Toda lectura/escritura de aplicación en SQLite debe pasar por `backend/services/`; `backend/core/db.py` ofrece la conexión y primitivas SQL compartidas.
- Las rutas de `backend/api/` son JSON y delegan persistencia a `services/`.
- El backend sigue siendo un solo proceso: no separar API, bot y scheduler en servicios independientes sin revisar el uso compartido de SQLite y las instrucciones del proyecto.
- Actualiza el documento del dominio correspondiente cuando cambie una ruta, tabla, proceso operativo o responsabilidad de módulo.
- `docs/DEPLOY_MODELO_A.md` es el runbook de despliegue existente; esta guía lo enlaza en vez de duplicar sus pasos de infraestructura.
