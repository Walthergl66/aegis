# App Expo

`mobile/` contiene el cliente Expo/React Native para iOS, Android y navegador. El cliente se conecta a la API privada mediante `EXPO_PUBLIC_API_URL`; las sesiones usan almacenamiento seguro nativo y el adaptador compatible de Expo cuando corre en navegador.

## Desarrollo

```sh
cd mobile
npm install
npx expo start
npm run typecheck
```

La app permite registrar una cuenta personal, iniciar sesión, administrar conexiones PostgreSQL propias, importar recursos de Supabase, iniciar backups, consultar historial y descargar archivos.

Las credenciales PostgreSQL se envían al backend por TLS y se cifran en servidor. El cliente no contiene `DATABASE_URL` ni claves de cifrado del backend.
