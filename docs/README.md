# Documentación modular

Guía de referencia del repositorio. Describe la implementación observada en el código; el archivo `.env.example`, los esquemas, rutas y scripts son la fuente de verdad cuando una opción cambia.

## Índice

| Tema | Contenido |
|---|---|
| [App móvil nativa](movil/README.md) | Scaffold Expo, configuración, sesión, proyectos, backups, importación Supabase y administración de usuarios. |
| [Plan de implementación móvil](implementacion/implementacion.md) | Fases, estado actual, criterios de salida y trabajo pendiente para completar la experiencia móvil. |
| [Arquitectura](arquitectura/README.md) | Componentes, flujo de arranque, límites entre capas y responsabilidades por módulo. |
| [API y permisos](api/README.md) | Rutas REST, autenticación, roles y contrato con la app móvil. |
| [Datos y persistencia](datos/README.md) | Esquema Supabase PostgreSQL, relaciones y cifrado de campos. |
| [Backups y planificación](backups/README.md) | Flujo de backup, verificación, retención, scheduler y copia remota. |
| [Bot y notificaciones](bot/README.md) | Comandos, registro, autorización y mensajes operativos. |
| [Seguridad](seguridad/README.md) | Controles, claves, sesiones, límites y datos sensibles. |
| [Configuración](configuracion/README.md) | Variables, valores por defecto y efectos de rotación. |
| [Instalación y operación](operacion/README.md) | Entorno local, Docker, tareas frecuentes e incidentes. |
| [Despliegue Modelo A](despliegue/README.md) | VM privada con Tailscale, restauración y runbook de incidentes. |
| [Pruebas](pruebas/README.md) | Cómo ejecutar la suite y qué áreas cubre cada grupo de casos. |

## Mapa del repositorio

```text
backend/main.py              arranque del único proceso
backend/api/                 FastAPI, dependencias y endpoints JSON
backend/services/            persistencia, lógica de datos y proveedores
backend/core/                configuración, DB, cifrado, JWT y utilidades
backend/backup/              ejecución, scheduler, retención y destino S3
backend/bot/                 polling y handlers de Telegram
backend/notify/              envío a Telegram y resumen de salud
backend/db/schema.postgres.sql esquema inicial vacío PostgreSQL/Supabase
mobile/                      app nativa Expo/React Native Android e iOS
docs/                        documentación funcional y operativa
data/                         volumen de runtime, fuera de Git
```

## Convenciones de mantenimiento

- Toda lectura/escritura de dominio debe pasar por `backend/services/`; `backend/core/db.py` ofrece PostgreSQL en producción y SQLite para desarrollo/pruebas. `services/providers/` adapta capacidades específicas de PostgreSQL y Supabase.
- Las rutas de `backend/api/` son JSON y delegan persistencia a `services/`.
- El backend sigue siendo un solo proceso: no separar API, bot y scheduler en servicios independientes sin revisar el uso compartido de la base de datos y las instrucciones del proyecto.
- Actualiza el documento del dominio correspondiente cuando cambie una ruta, tabla, proceso operativo o responsabilidad de módulo.
- `docs/despliegue/README.md` es el runbook de despliegue existente; esta guía lo enlaza en vez de duplicar sus pasos de infraestructura.
