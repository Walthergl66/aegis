# Estado de implementación

## Producto

La app Expo ofrece registro, autenticación, TOTP, proyectos PostgreSQL propios, importación Supabase, prueba de conexión, programación, historial y descargas. El cliente funciona en iOS, Android y navegador.

## Backend y datos

FastAPI y PostgreSQL son la arquitectura de servicio. `DATABASE_URL` es obligatoria. El inicio aplica esquema y migraciones, programa retención y backups, y procesa trabajos solicitados por la app. La migración de nombres preserva cuentas existentes y sus relaciones.

## Próximas validaciones

- Ejecutar migraciones en una copia reciente de PostgreSQL y revisar propietarios de proyectos y cuentas existentes.
- Correr la suite con `TEST_DATABASE_URL` dedicado.
- Probar registro, acceso entre cuentas, rotación de tokens, pruebas de conexión y restauración desde dispositivos iOS, Android y navegador.
- Confirmar backups remotos y restauración con las claves custodiadas.
