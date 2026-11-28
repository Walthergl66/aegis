# Seguridad

- PostgreSQL es obligatorio y solo el backend conoce `DATABASE_URL`.
- Cada cuenta queda aislada por `owner_user_id`; todas las operaciones de recursos aplican ese filtro.
- Los proyectos y cuentas ajenos responden como inexistentes, sin revelar su existencia.
- Los PAT y las cadenas de conexión se cifran en reposo; se redactan en logs y errores.
- Las contraseñas se almacenan con PBKDF2-SHA256, TOTP es opcional y los refresh tokens se rotan.
- Límites por IP reducen intentos de acceso y tráfico excesivo.
- Las copias se cifran antes de persistirse; los archivos temporales en claro se eliminan al iniciar.
- No guardes claves, `.env`, cadenas de conexión ni backups dentro del control de versiones.
