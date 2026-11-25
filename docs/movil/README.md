# Aplicación móvil nativa

`mobile/` es el cliente nativo Expo/React Native para Android e iOS. Comparte la API REST y las cuentas web existentes con el panel. La PWA de `frontend/` sigue siendo la interfaz web administrativa; no es el cliente móvil objetivo ni contiene las rutas nativas.

## Estado actual

La app ya cubre una primera ruta operativa:

- Expo Router con rutas de entrada, login, una pestaña autenticada **Inicio** y detalle de proyecto.
- Login con usuario/contraseña; si el backend requiere TOTP, la pantalla solicita el código y vuelve a enviar el login.
- Sesión nativa que persiste access y refresh tokens en `expo-secure-store`, intenta restaurar la sesión mediante refresh, renueva y reintenta una vez una solicitud protegida con 401, y borra la sesión si el refresh también devuelve 401.
- Navegación que deriva a login si no hay sesión y protege la pestaña hasta que se restaura el estado.
- Inicio consume `GET /api/projects?estado=activos` y muestra proyectos PostgreSQL/Supabase, proveedor y fecha del último backup correcto.
- Un admin puede iniciar un backup desde la tarjeta del proyecto. La app conserva la clave `Idempotency-Key` mientras espera aceptación, guarda el ID del trabajo en SecureStore y consulta su estado periódicamente; si pierde conexión conserva el ID para retomar el polling.
- El detalle del proyecto consume su historial y muestra las 25 entradas más recientes. Permite descargar un dump con la sesión vigente, guardarlo temporalmente en la caché y compartirlo con la hoja nativa; elimina el archivo temporal después.
- Configuración Expo con plataformas Android e iOS y bundles de ambas plataformas verificados para este corte.

La app todavía no permite crear/editar proyectos, probar una conexión, configurar cron, administrar usuarios/permisos ni recibir push. La verificación de configuración y bundles no demuestra una prueba en dispositivos físicos ni constituye una build de distribución.

## Configuración y arranque local

Requiere Node.js/npm y una URL HTTPS del backend que sea accesible desde el emulador o dispositivo. Para la configuración del entorno local:

```sh
cd mobile
npm install
cp .env.example .env.local
```

En PowerShell, usa `Copy-Item .env.example .env.local`. Edita el archivo y define `EXPO_PUBLIC_API_URL` con la base de API completa, incluido `/api`, por ejemplo `https://host-de-tu-tailnet/api`. No uses `localhost` desde un teléfono físico: debe resolver a un host alcanzable por el dispositivo.

Comandos disponibles en `mobile/package.json`:

```sh
npm run start       # inicia Expo dev server
npm run android     # inicia Expo orientado a Android
npm run ios         # inicia Expo orientado a iOS
npm run typecheck   # comprobación TypeScript
```

Los scripts de plataforma inician el servidor de desarrollo y no producen un paquete de distribución. No hay actualmente scripts EAS/de release ni paso móvil en Docker Compose.

## Mapa del código

| Ruta | Responsabilidad |
|---|---|
| `mobile/app/_layout.tsx` | Monta el proveedor global de sesión y el stack raíz. |
| `mobile/app/index.tsx` | Espera la restauración de sesión y redirige a login o al grupo autenticado. |
| `mobile/app/login.tsx` | Formulario, envío de credenciales/TOTP y errores del login. |
| `mobile/app/(tabs)/_layout.tsx` | Protege la navegación autenticada. |
| `mobile/app/(tabs)/index.tsx` | Carga proyectos activos, refresca la lista y presenta las tarjetas de proyecto. |
| `mobile/app/projects/[id].tsx` | Detalle con proveedor, conexión enmascarada, historial reciente y descarga/compartición temporal de dumps. |
| `mobile/components/ProjectCard.tsx` | Muestra último backup, inicia ejecución para admin, persiste clave/ID y sondea estado del job. |
| `mobile/services/projects.ts` | Tipos y adaptadores para listado, alta/consulta de backup jobs e historial de proyecto. |
| `mobile/services/api.ts` | Cliente HTTP y adaptadores de sesión; renueva y reintenta una vez las solicitudes autenticadas. |
| `mobile/services/session.tsx` | Contexto, restauración/rotación, cierre y datos de sesión/trabajo en SecureStore. |
| `mobile/.env.example` | Plantilla de `EXPO_PUBLIC_API_URL`. |

## Contrato de sesión nativa

El adaptador móvil llama a estas rutas relativas a `EXPO_PUBLIC_API_URL`:

1. `POST /auth/login` envía `username`, `password`, `code` y `client_type: "native"`. Si se requiere TOTP, el backend responde con `totp_required`; la app revela el campo de código. Al autenticar devuelve access token, refresh token y perfil.
2. `POST /auth/refresh` envía `{ "refresh_token": "…" }`. El servidor rota el refresh token y devuelve ambos tokens nuevos para persistirlos.
3. `POST /auth/logout` envía el refresh token en el cuerpo y el access token como Bearer para revocar ambos.

El servidor sigue emitiendo/aceptando `sb_refresh_token` como cookie HttpOnly para el panel web. El cliente nativo usa los tokens del cuerpo y SecureStore; no reemplaza el flujo de cookies de la PWA.

## Proyectos y trabajos de backup

- Inicio solicita proyectos activos y permite refrescar la lista manualmente.
- Solo el rol web `admin` ve el botón para encolar una copia; el endpoint requiere ese mismo rol. El detalle/historial queda disponible desde las tarjetas.
- La app envía `POST /api/projects/{id}/backup-jobs` con `Idempotency-Key`. Conserva la clave en SecureStore hasta recibir aceptación para que un reintento de red use la misma operación.
- Al aceptar el servidor, la app guarda el `job_id` por proyecto en SecureStore y consulta `GET /api/backups/jobs/{job_id}` cada 2.5 segundos. Los estados terminales son `completed`, `failed` e `interrupted`; los estados activos son `queued` y `running`. Si el sondeo falla por desconexión, el ID se mantiene y se vuelve a consultar.
- `GET /api/projects/{id}/history` devuelve 25 registros recientes, que se pueden actualizar desde la pantalla de detalle.
- Desde el historial, un admin puede descargar el dump de una copia completada mediante `GET /api/backups/{backup_id}/download?format=dump`. La app usa la sesión actual, guarda el archivo en la caché del sistema para abrir la hoja de compartir nativa y elimina el temporal al terminar el flujo.

## Próxima fase

El orden del trabajo, los criterios de salida y los flujos de producto pendientes están en el [plan de implementación móvil](../implementacion/implementacion.md). Lo siguiente es completar alta/edición y prueba de conexiones, cron, y validar los flujos en dispositivos físicos.
