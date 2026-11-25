# Aplicación móvil nativa

`mobile/` es el cliente nativo Expo/React Native para Android e iOS. Comparte la API REST y las cuentas web existentes con el panel. La PWA de `frontend/` sigue siendo la interfaz web administrativa; no es el cliente móvil objetivo ni contiene las rutas nativas.

## Estado actual

La primera entrega es la base de autenticación:

- Expo Router con rutas de entrada, login y una sola pestaña autenticada **Inicio**.
- Login con usuario/contraseña; si el backend requiere TOTP, la pantalla solicita el código y vuelve a enviar el login.
- Sesión nativa que persiste access y refresh tokens en `expo-secure-store`, intenta restaurar la sesión mediante refresh y borra los tokens al salir.
- Navegación que deriva a login si no hay sesión y protege la pestaña hasta que se restaura el estado.
- Configuración Expo con plataformas Android e iOS y bundles de ambas plataformas verificados para este corte.

La pantalla Inicio aún es un placeholder. El cliente móvil todavía no lista/crea proyectos, no lanza ni sigue backups, no muestra historial ni descarga archivos, y no incluye administración ni push. La verificación de configuración y bundles no demuestra una prueba en dispositivos físicos ni constituye una build de distribución.

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
| `mobile/app/(tabs)/index.tsx` | Pantalla inicial placeholder con estado de sesión y cierre de sesión. |
| `mobile/services/api.ts` | Cliente HTTP y adaptadores de login, refresh y logout. |
| `mobile/services/session.tsx` | Contexto de sesión, restauración/rotación y SecureStore. |
| `mobile/.env.example` | Plantilla de `EXPO_PUBLIC_API_URL`. |

## Contrato de sesión nativa

El adaptador móvil llama a estas rutas relativas a `EXPO_PUBLIC_API_URL`:

1. `POST /auth/login` envía `username`, `password`, `code` y `client_type: "native"`. Si se requiere TOTP, el backend responde con `totp_required`; la app revela el campo de código. Al autenticar devuelve access token, refresh token y perfil.
2. `POST /auth/refresh` envía `{ "refresh_token": "…" }`. El servidor rota el refresh token y devuelve ambos tokens nuevos para persistirlos.
3. `POST /auth/logout` envía el refresh token en el cuerpo y el access token como Bearer para revocar ambos.

El servidor sigue emitiendo/aceptando `sb_refresh_token` como cookie HttpOnly para el panel web. El cliente nativo usa los tokens del cuerpo y SecureStore; no reemplaza el flujo de cookies de la PWA.

## Próxima fase

El orden del trabajo, los criterios de salida y los flujos de producto pendientes están en el [plan de implementación móvil](../implementacion/implementacion.md). El siguiente alcance visible de la app es conectar Proyectos e historial; trabajos de backup y descarga requieren integrar las rutas existentes con permisos y estados móviles.
