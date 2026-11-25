# Frontend y PWA

La aplicación es una SPA React 18 con React Router, compilada por Vite y servida por nginx. `frontend/src/main.jsx` monta proveedores globales; `App.jsx` declara rutas; `features/` agrupa pantallas y `services/` define llamadas a la API.

## Rutas de pantalla

| Ruta | Pantalla | Acceso en UI |
|---|---|---|
| `/login` | Inicio de sesión | Público. |
| `/` | Dashboard | Usuario autenticado. |
| `/proyectos`, `/proyectos/:id/historial` | Lista e historial; la lista filtra por proveedor PostgreSQL o Supabase | Autenticado. |
| `/proyectos/nuevo`, `/proyectos/:id/editar` | Formulario: proveedor, grupo/cuenta compatible, URI, prueba de conexión y cron; permite flags de compatibilidad de dump | La ruta se agrupa en `RequireAdmin`. |
| `/cuentas/*`, `/usuarios/*`, `/usuarios-web/*`, `/importar` | Administración de grupos PostgreSQL/cuentas Supabase, usuarios e importación | Admin. |
| `/backups`, `/auditoria`, `/seguridad` | Historial general, bitácora y TOTP del usuario | Autenticado. |

La UI controla navegación con `RequireAuth`, `RequireAdmin` y menús condicionados por rol. El backend revalida las autorizaciones en cada endpoint; ocultar una ruta no es un control de seguridad.

## Capas

- `features/auth/AuthContext.jsx`: estado de usuario, recuperación de sesión, login/logout.
- `services/http.js`: fetch JSON, Bearer, cookie, renovación concurrente de access token y tratamiento de errores.
- `services/{auth,accounts,projects,users,webUsers,backups,audit,imports,totp,dashboard}.js`: adaptadores de endpoints.
- El servicio de proyectos consulta `/api/projects/test-connection` antes de guardar una URI; el formulario envía `provider` y, para PostgreSQL directo, las opciones `no_owner`/`no_privileges`.
- En Proyectos, el admin puede usar **Respaldar ahora**. El cliente crea una clave `Idempotency-Key`, encola el trabajo y consulta su estado por polling. Guarda el ID activo en `localStorage` para reanudar el seguimiento tras recargar la página.
- En el historial por proyecto, admin puede descargar el dump de un backup exitoso. El cliente recibe el archivo por streaming autenticado.
- `components/layout/`: navegación y shell autenticado.
- `components/ui/`: diálogo, paginación, mensajes y elementos reutilizables.
- `hooks/useAbort.js`: cancelación de fetches al desmontar o cambiar consulta.

El access token se conserva en `localStorage` bajo `sb_access_token`; el refresh token lo administra el navegador mediante cookie HttpOnly (`credentials: include`). Si el access expira, `http.js` intenta renovar una sola vez para llamadas concurrentes y redirige al login si la renovación falla.

## PWA y proxy

`vite.config.js` configura el manifiesto, iconos y `autoUpdate`. Workbox precachea recursos estáticos y establece `NetworkOnly` para `/api/*`; las respuestas y datos de API no se guardan offline. El service worker no se cachea para permitir actualizaciones.

En desarrollo Vite escucha el puerto 5173 y su proxy `/api` apunta a `localhost:8000`. El backend por defecto escucha 8080: para desarrollo local configura `WEB_PORT=8000` o ajusta el proxy. En Docker, nginx escucha 8080, entrega el frontend y proxya al backend:8080.

Iconos PWA: `frontend/public/icons/`; generador: `frontend/scripts/generate-icons.mjs` (ejecutar desde `frontend/`).
