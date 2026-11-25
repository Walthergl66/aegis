# Aplicación móvil nativa

`mobile/` es el cliente nativo Expo/React Native para Android e iOS y el único cliente final previsto. Comparte la API REST y la identidad que hoy todavía se denomina web. El frontend de `frontend/` es transitorio durante la migración; no añadirle nuevas funciones y retirarlo al completar la administración, alertas y validación móvil.

## Estado actual

La app ya cubre una primera ruta operativa:

- Expo Router con rutas de entrada, login, una pestaña autenticada **Inicio** y detalle de proyecto.
- Login con usuario/contraseña; si el backend requiere TOTP, la pantalla solicita el código y vuelve a enviar el login.
- Sesión nativa que persiste access y refresh tokens en `expo-secure-store`, intenta restaurar la sesión mediante refresh, renueva y reintenta una vez una solicitud protegida con 401, y borra la sesión si el refresh también devuelve 401.
- Navegación que deriva a login si no hay sesión y protege la pestaña hasta que se restaura el estado.
- Inicio consume `GET /api/projects?estado=activos` y muestra proyectos PostgreSQL/Supabase, proveedor y fecha del último backup correcto.
- Un admin puede iniciar un backup desde la tarjeta del proyecto. La app conserva la clave `Idempotency-Key` mientras espera aceptación, guarda el ID del trabajo en SecureStore y consulta su estado periódicamente; si pierde conexión conserva el ID para retomar el polling.
- Un admin puede abrir **Añadir PostgreSQL** desde Inicio y registrar una conexión directa: nombre y URI obligatorios, slug opcional (el servidor lo deriva del nombre si falta), cron opcional y opciones `no_owner`/`no_privileges`. La pantalla ofrece probar la URI antes de guardar; probarla no es requisito para habilitar el guardado.
- Un admin también puede iniciar **Importar Supabase** desde Inicio: consulta proyectos disponibles con un PAT, selecciona cuáles importar, elige el pooler y puede indicar la contraseña de la base y pedir una prueba de conexión antes de crear los proyectos.
- En el detalle, un admin puede editar nombre, reemplazar opcionalmente la URI (y probar la nueva), cambiar cron, estado activo y opciones de dump para PostgreSQL. También puede archivar el proyecto; el historial se conserva.
- En Inicio, un admin puede alternar entre proyectos activos e inactivos y restaurarlos; la interfaz los etiqueta como **Archivados**. La lista se actualiza tras la operación.
- Inicio ofrece a admins la sección **Administración** para listar, crear, editar, desactivar y eliminar cuentas de acceso a la app. El formulario asigna los roles `admin` y `viewer`; al editar puede dejarse la contraseña vacía para conservarla.
- El Inicio vuelve a cargar los proyectos al recuperar el foco, por ejemplo al regresar del formulario de edición.
- El detalle del proyecto consume su historial y muestra las 25 entradas más recientes. Permite descargar un dump con la sesión vigente, guardarlo temporalmente en la caché y compartirlo con la hoja nativa; elimina el archivo temporal después.
- Configuración Expo con plataformas Android e iOS y bundles de ambas plataformas verificados para este corte.

La importación Supabase móvil reutiliza el flujo y los servicios de Supabase existentes en el backend; no agrega una implementación separada de Management API. En modo nativo no requiere ni crea un usuario Telegram. La administración implementada cubre cuentas de acceso a la app; no administra cuentas de conexión Supabase/PostgreSQL, permisos por proyecto, dispositivos ni auditoría, y no incluye push. Quedan pendientes pruebas en dispositivos físicos y validar PAT vencidos/sin permisos, contraseña de base ausente o incorrecta, disponibilidad de Supabase y resultados parciales de importación. El cron se edita como expresión de cinco campos, sin selector de zona horaria ni vista previa de próxima ejecución. Mientras se completa la paridad, el panel web sigue desplegado solo como transición y no es parte del producto final. La verificación de configuración y bundles no demuestra una prueba en dispositivos físicos ni constituye una build de distribución.

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
| `mobile/app/(tabs)/index.tsx` | Carga/actualiza proyectos activos o archivados; ofrece alta e importación a admins. |
| `mobile/app/admin/index.tsx` | Entrada de administración, restringida a admins. |
| `mobile/app/admin/users.tsx` | Lista cuentas de acceso, muestra rol/estado/TOTP y ofrece acciones de gestión. |
| `mobile/app/admin/users/new.tsx` | Formulario de creación; también se reutiliza para editar por ID. |
| `mobile/app/admin/users/[id].tsx` | Ruta de edición que reutiliza el formulario de usuario. |
| `mobile/app/projects/new.tsx` | Formulario admin para crear conexión PostgreSQL directa, probarla, asignar cron y elegir opciones de dump. |
| `mobile/app/import/supabase.tsx` | Flujo admin para consultar proyectos Supabase, seleccionarlos y configurar la importación nativa. |
| `mobile/app/projects/[id].tsx` | Detalle con proveedor, conexión enmascarada, historial, descarga temporal y acciones admin para editar o archivar. |
| `mobile/app/projects/[id]/edit.tsx` | Formulario admin para editar nombre, conexión, cron, estado activo y opciones PostgreSQL. |
| `mobile/components/ProjectCard.tsx` | Muestra último backup, inicia ejecución o restaura proyectos inactivos, y persiste/sondea backup jobs. |
| `mobile/services/projects.ts` | Tipos y adaptadores para listado/alta/edición/restauración, importación Supabase, prueba de conexión, backup jobs e historial. |
| `mobile/services/admin.ts` | Adaptadores para listar, consultar, crear, editar y eliminar cuentas de acceso a la app. |
| `mobile/services/api.ts` | Cliente HTTP y adaptadores de sesión; renueva y reintenta una vez las solicitudes autenticadas. |
| `mobile/services/session.tsx` | Contexto, restauración/rotación, cierre y datos de sesión/trabajo en SecureStore. |
| `mobile/.env.example` | Plantilla de `EXPO_PUBLIC_API_URL`. |

## Contrato de sesión nativa

El adaptador móvil llama a estas rutas relativas a `EXPO_PUBLIC_API_URL`:

1. `POST /auth/login` envía `username`, `password`, `code` y `client_type: "native"`. Si se requiere TOTP, el backend responde con `totp_required`; la app revela el campo de código. Al autenticar devuelve access token, refresh token y perfil.
2. `POST /auth/refresh` envía `{ "refresh_token": "…" }`. El servidor rota el refresh token y devuelve ambos tokens nuevos para persistirlos.
3. `POST /auth/logout` envía el refresh token en el cuerpo y el access token como Bearer para revocar ambos.

El servidor sigue emitiendo/aceptando `sb_refresh_token` como cookie HttpOnly para la interfaz web transitoria. El cliente nativo usa los tokens del cuerpo y SecureStore. La cookie se podrá retirar junto con el panel cuando la validación móvil y la migración de sesiones estén aprobadas.

## Proyectos y trabajos de backup

- Inicio solicita proyectos activos y permite refrescar la lista manualmente.
- El formulario de alta envía `POST /api/projects` como admin con `provider: "postgres"`, `nombre`, `connection`, `backup_options` y, opcionalmente, `slug` y `schedule`. El servidor valida la URI, deriva el slug si se omite, valida el cron de cinco campos y cifra la URI para almacenarla. La app no conserva la URI en SecureStore.
- El botón **Probar conexión** usa `POST /api/projects/test-connection` con `provider: "postgres"`; enseña el resultado, versión y latencia. Es una acción independiente: se puede guardar aunque no se haya probado antes o la prueba haya fallado; el backend valida igualmente los datos del alta.
- Las opciones `no_owner` y `no_privileges` comienzan activadas y se pueden cambiar. Un cron vacío representa ejecución manual; el ejemplo `30 3 * * *` tiene cinco campos (minuto, hora, día del mes, mes y día de semana).
- Desde Inicio, solo admin puede abrir el importador Supabase. `POST /api/import/fetch` consulta proyectos con el PAT y separa los disponibles de los ya importados. Se pueden seleccionar varios, dar un nombre a la cuenta Supabase y, al importar, elegir pooler `session` (5432) o `transaction` (6543), ingresar opcionalmente la contraseña de la base y activar/desactivar la prueba de conexión (activada por defecto en el formulario).
- El cliente envía `POST /api/import/create` con `client_type: "native"`. El PAT y la contraseña viven en el estado temporal del formulario y no se guardan en el almacenamiento móvil; el backend persiste cifrado el PAT en la cuenta Supabase y cifra la URI de conexión del proyecto. La contraseña se incorpora a la URI cuando se necesita y no se guarda como campo separado.
- En modo nativo el backend no exige ni crea un usuario Telegram; registra la acción de auditoría `mobile_import_supabase`. La importación usa el servicio existente para consultar Management API, obtener el pooler y, si se pidió, probar la conexión. Los proyectos ya activos se excluyen como duplicados; los errores por proyecto se devuelven junto con el conteo importado.
- **Administración** es solo para admins y gestiona cuentas de acceso de la app mediante `/api/web-users`. Al crear se exige contraseña de al menos 12 caracteres; al editar, contraseña vacía conserva la actual. Cambiar contraseña o desactivar una cuenta revoca sus sesiones. Admin no puede cambiar su propio rol, desactivarse ni eliminarse; el backend también impide eliminar/desactivar/degradar al último admin activo. La lista muestra si TOTP está activo, pero no administra su configuración.
- Desde el detalle, la edición usa `PUT /api/projects/{id}`; deja la URI en blanco para conservar la conexión cifrada actual. Si se escribe una nueva, se puede probar con `POST /api/projects/test-connection` antes de guardar. El formulario también actualiza cron/estado, y solo muestra opciones `no_owner`/`no_privileges` para PostgreSQL.
- **Archivar** usa `DELETE /api/projects/{id}` como eliminación lógica: desactiva el proyecto, libera su slug y conserva historial/auditoría. Desde el filtro **Archivados**, admin puede restaurar con `POST /api/projects/{id}/restore`; el cliente no envía slug y el backend reutiliza el slug archivado si sigue disponible. Ese filtro de API incluye cualquier proyecto inactivo, también los que se desactivaron desde el editor.
- Solo el rol web `admin` ve el botón para encolar una copia; el endpoint requiere ese mismo rol. El detalle/historial queda disponible desde las tarjetas.
- La app envía `POST /api/projects/{id}/backup-jobs` con `Idempotency-Key`. Conserva la clave en SecureStore hasta recibir aceptación para que un reintento de red use la misma operación.
- Al aceptar el servidor, la app guarda el `job_id` por proyecto en SecureStore y consulta `GET /api/backups/jobs/{job_id}` cada 2.5 segundos. Los estados terminales son `completed`, `failed` e `interrupted`; los estados activos son `queued` y `running`. Si el sondeo falla por desconexión, el ID se mantiene y se vuelve a consultar.
- `GET /api/projects/{id}/history` devuelve 25 registros recientes, que se pueden actualizar desde la pantalla de detalle.
- Desde el historial, un admin puede descargar el dump de una copia completada mediante `GET /api/backups/{backup_id}/download?format=dump`. La app usa la sesión actual, guarda el archivo en la caché del sistema para abrir la hoja de compartir nativa y elimina el temporal al terminar el flujo.

## Próxima fase

El orden del trabajo, los criterios de salida y la retirada de la interfaz web y Telegram están en el [plan de implementación móvil](../implementacion/implementacion.md). Lo siguiente es portar administración de cuentas/usuarios/permisos, añadir push, validar en dispositivos físicos y retirar el panel web al alcanzar paridad.
