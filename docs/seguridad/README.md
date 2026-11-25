# Seguridad

Este documento resume controles presentes en la aplicación; el perímetro de red, gestión de secretos, restauración y actualizaciones siguen siendo responsabilidad del despliegue.

## Identidad y permisos

- Contraseñas de acceso a la app: PBKDF2-SHA256 con salt y umbral mínimo aplicado por los servicios de usuario; bloqueo tras fallos de login.
- Sesión móvil: guarda access y refresh tokens con `expo-secure-store`, envía el refresh token en el cuerpo al renovar/cerrar sesión y recibe el token rotado.
- TOTP opcional por cuenta de acceso; se exige código al login si está activado.
- Separación de roles web y Telegram; permisos por proyecto para usuarios Telegram no admin.
- Login limitado por slowapi; el mini-WAF de la API reduce ráfagas y escaneo.

## Secretos y backups

- `ENCRYPTION_KEY` protege PAT y cadenas de conexión en SQLite.
- `BACKUP_ENCRYPTION_KEY` protege backups locales y self-backup. Debe ser distinta de la anterior.
- `SESSION_SECRET` firma JWT; cambiarla invalida tokens emitidos.
- No registrar claves o connection strings: `sanitize.py` redacta secretos antes de mensajes sensibles y la API oculta credenciales completas.
- En el proveedor PostgreSQL, el parser separa credenciales de la URI y exporta la contraseña como `PGPASSWORD`; no la coloca en el argv de `pg_dump` ni `psql`. El mensaje con URI enviada al flujo `/addbd` se borra al procesarla.
- Backups temporales existen en claro mientras se construyen; tras cifrarlos se eliminan. Un barrido al arranque elimina restos de interrupciones.
- Las descargas requieren rol admin, verifican que la ruta del artefacto permanezca dentro de `BACKUP_DIR` y descifran por bloques durante el streaming sin crear otro archivo claro. Las rutas de historial son relativas y cada descarga se audita.
- Para envíos a Telegram, el archivo se descifra en memoria; el adjunto enviado contiene datos en claro, así que los destinatarios de admin deben ser confiables.

## Contenedores y proxy

Compose ejecuta el backend con UID 1000, capacidades eliminadas, `no-new-privileges`, filesystem de solo lectura y `/tmp` temporal. La API se enlaza únicamente a `127.0.0.1:8080`; el acceso remoto debe pasar por Tailscale Serve.

No publiques directamente el backend ni confíes en `X-Forwarded-*` de proxies arbitrarios. El runbook Modelo A restringe acceso remoto a Tailscale.

## Ciclo de vida de claves

Guarda las claves fuera del repositorio en un vault y asegúrate de incluirlas en el plan de recuperación. Si pierdes `ENCRYPTION_KEY`, PAT y conexiones guardados no se pueden descifrar. Si pierdes `BACKUP_ENCRYPTION_KEY`, los archivos cifrados no se pueden abrir. La rotación requiere descifrar/recifrar con ambas claves en un procedimiento controlado; no reemplaces una clave a ciegas.

No versionar `backend/.env`, archivos de datos ni backups. Revisa también los destinos de off-site y los permisos del bucket.
