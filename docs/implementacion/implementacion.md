# Implementación de la app móvil de backups PostgreSQL

**Objetivo de producto.** Una persona autorizada puede registrar una base PostgreSQL, probar la conexión, programar o iniciar una copia, cerrar la app y volver para consultar el resultado o recuperar el archivo. Una cuenta Supabase añade descubrimiento de proyectos por PAT y estado del servicio. El mismo motor PostgreSQL respalda ambos tipos de conexión.

**Cliente móvil.** La aplicación móvil objetivo es nativa y multiplataforma, desarrollada con Expo y React Native bajo `mobile/`. El frontend PWA existente continúa como interfaz web administrativa, no como sustituto del cliente móvil. La app nativa usa la misma API REST y guarda tokens en el almacén seguro de Android/iOS. El estado y guía del scaffold están en [App móvil](../movil/README.md).

## Estado actual del plan

La base nativa de la **Fase 1** está implementada y avanzó a un primer recorrido de operación: scaffold Expo/React Native, configuración Android/iOS, navegación protegida, login con usuario/contraseña y TOTP, SecureStore y contrato nativo de sesión; Inicio lista proyectos y último backup, admin puede encolar una copia idempotente y la app sondea el job; el detalle muestra el historial reciente y permite descargar/compartir dumps mediante caché temporal. Una solicitud protegida con 401 provoca un refresh y un reintento; si el refresh devuelve 401, la sesión local se borra. La configuración y los bundles Android/iOS fueron verificados en este corte.

El alcance móvil sigue incompleto: faltan alta/edición y prueba de conexión, configuración de cron, administración y push. La verificación de bundles no equivale a validar instalación y operación en dispositivos físicos ni a preparar builds de distribución. Por ello, los criterios de salida completos de la Fase 1 y el piloto siguen pendientes; el resto de fases conserva el alcance descrito más abajo.

**Punto de partida.** FastAPI, el bot y APScheduler comparten un proceso. Ya existen sesiones con TOTP, proyectos, proveedores, prueba de conexión, historial, cifrado, rotación y copia S3. La ruta web de backups lista ejecuciones. El disparo manual, la entrega de archivos y varias alertas dependen del bot. El arranque exige `BOT_TOKEN`. Las rutas y tablas nuevas que aparecen más abajo son propuestas. Véanse la [arquitectura](../arquitectura/README.md), la [API](../api/README.md) y el [inventario del bot](../bot/README.md).

## 1. Fijar el alcance y preparar una migración reversible

- **Decisión:** construir un cliente nativo Expo/React Native para Android e iOS. El frontend PWA sigue atendiendo el panel web. El cliente móvil comparte API y reglas de negocio con el servidor, con navegación y almacenamiento propios de cada plataforma.
- **Alcance del piloto:** administrar conexiones PostgreSQL, probarlas, iniciar y consultar backups, ver historial y descargar archivos. Supabase queda como proveedor opcional. No retirar Telegram ni cambiar todavía el flujo de alertas.
- Inventariar comandos, conversaciones, alertas, resumen diario, entrega de dumps y copia de SQLite del panel. Asociar cada flujo a una pantalla, permiso, destinatario y prueba de aceptación.
- Identificar proyectos, cron, archivos cifrados y permisos existentes. Crear una copia recuperable de SQLite, resguardar por separado ambas claves Fernet y ensayar la migración sobre una copia. Conservar los identificadores para mantener el historial.
- Mantener el acceso privado por HTTPS a través de Tailscale durante el piloto. Validar en al menos un dispositivo Android y uno iOS: build de desarrollo, login/TOTP, almacenamiento de sesión, reconexión tras suspensión y descarga de un archivo representativo.
- Registrar los usuarios del piloto y sus permisos por proyecto. Confirmar la restauración de SQLite y de un dump en una base aislada antes de habilitar operaciones reales desde el teléfono.

**Criterio de salida:** matriz de paridad aprobada, app nativa ejecutada en Android e iOS, recuperación del estado inicial ensayada y distribución de builds documentada.

## 2. Consolidar PostgreSQL como núcleo

- Modelar cada proyecto por su conexión PostgreSQL, nombre, slug, agenda UTC y opciones de volcado. Reutilizar `services/projects.py`, el proveedor PostgreSQL, el runner y el grupo **Conexiones directas**. Mantener la configuración del panel en SQLite.
- Validar URI y parámetros admitidos en el servidor. Distinguir conexión comprobada, comprobación omitida y error. Ofrecer mensajes accionables para credenciales rechazadas, TLS, conectividad y versión incompatible del cliente.
- Mantener `pg_dump`, verificación de catálogo, cifrado, retención y sincronización remota en el servidor. La operación debe continuar con la pantalla apagada. Preservar la lectura de archivos cifrados históricos.

**Salida:** con una base PostgreSQL ordinaria se puede completar una copia manual y otra programada en un entorno aislado sin proporcionar un PAT.

## 3. Unificar identidad y permisos

- Reutilizar usuarios del panel, TOTP y sesiones revocables. Extender los permisos por proyecto a las identidades que operarán desde el móvil. Distinguir consulta, ejecución, descarga y administración. Conservar la semántica de solo lectura de `viewer`.
- Preparar una correspondencia revisada por un administrador entre usuarios Telegram y cuentas del panel. Asignar permisos explícitos y conservar la identidad histórica de auditoría. Un nombre coincidente o el conocimiento de un chat ID no acredita titularidad.
- Definir el ciclo de sesión por plataforma. En cliente nativo guardar el secreto de renovación en el almacén seguro del sistema. Para PWA revisar la exposición del access token actual en `localStorage`. Incluir cierre remoto por pérdida del dispositivo. Redactar URI, contraseña, PAT y tokens en logs, errores y telemetría.

**Salida:** dos usuarios con proyectos distintos solo pueden consultar, ejecutar y descargar dentro de su alcance, incluso si invocan directamente la API. La revocación se aplica en el siguiente acceso.

## 4. Exponer la ejecución de backups como trabajo persistente

- El primer corte ya expone `POST /api/projects/{id}/backup-jobs` y `GET /api/backups/jobs/{job_id}`. El alta devuelve HTTP 202 y un identificador, exige `Idempotency-Key` y requiere admin. SQLite conserva usuario, proyecto, clave, estado, tiempos y resultado. Por ahora el worker procesa solicitudes web manuales; ampliar los jobs a cron y permisos más granulares sigue pendiente.
- La pantalla Proyectos ofrece **Respaldar ahora** a administradores. El frontend genera la clave idempotente, consulta el estado periódicamente y guarda el ID del trabajo activo en `localStorage` para reanudar el seguimiento tras recargar. El seguimiento simultáneo de varios trabajos sigue pendiente.
- El historial ofrece descarga del dump para administradores mediante `GET /api/backups/{backup_id}/download?format=dump`. La API valida el archivo, lo descifra por bloques y lo transmite sin escribir otra copia en claro. La descarga SQL está disponible en API mediante `format=sql`; la interfaz actual prioriza dump. El seguimiento de varios trabajos sigue pendiente.
- Reutilizar el runner desde bot, scheduler y API durante la transición. Procesar trabajos dentro del backend existente, con límite global y exclusión por proyecto. Una clave de idempotencia debe devolver el mismo trabajo si el móvil repite la petición tras perder la red.
- Definir estados en cola, en ejecución, completado, fallido e interrumpido. Al reiniciar, reconciliar trabajos en curso con los artefactos y recuperar la cola. Registrar por separado el resultado local y la transferencia S3 para que un fallo remoto pueda reintentarse sin repetir el volcado.
- Permitir descarga autenticada por identificador de artefacto. Verificar permiso y existencia en cada entrega, registrar quién descarga y distinguir copia rotada de error de red. Mantener la exportación de SQLite del panel restringida a administradores.

**Salida:** dos toques generan una sola ejecución. Después de cerrar la app o reiniciar el backend, el usuario obtiene un estado coherente y puede descargar una copia disponible.

## 5. Entregar la experiencia móvil de PostgreSQL

| Pantalla | Estado actual | Pendiente |
|---|---|---|
| Acceso | Implementado: login, TOTP, renovación nativa y cierre de sesión. | Validación física y recuperación de sesión tras suspensión en Android/iOS. |
| Inicio | Implementado: lista activos, proveedor, último backup correcto y refresco manual. | Indicadores de proyectos atrasados y atención requerida. |
| Proyectos | Implementado: navegar a detalle e historial; admin puede encolar backup con idempotencia y seguirlo. | Crear/editar conexiones, probarlas, opciones, estado/cron y archivar/reactivar. |
| Detalle de proyecto | Implementado: historial de 25 entradas, refresco manual y descarga/compartición temporal del dump. | Ejecutar/seguir backup desde el detalle y editar cron con UTC, hora local y próxima ejecución. |
| Copias | Muestra fechas/resultados/tamaños en cards e historial; permite compartir temporalmente un dump descargado. | Mejorar indicación de disponibilidad y destino de descarga. |
| Administración | Pendiente. | Cuentas, usuarios, permisos, dispositivos, seguridad personal y auditoría. |

El cliente reutiliza `POST /api/projects/{id}/backup-jobs` y `GET /api/backups/jobs/{job_id}`. Conserva `Idempotency-Key` hasta aceptar la solicitud y el `job_id` en SecureStore para retomar polling; el endpoint de alta solo se presenta a admins. La integración del historial consume las 25 filas recientes de `GET /api/projects/{id}/history`.

Diseñar estados de carga, ausencia de datos, desconexión, expiración de sesión y operación en curso. Al reconectar, consultar el trabajo por su identificador antes de ofrecer un reintento. Revisar lector de pantalla, tamaño de texto, contraste y manejo de archivos grandes en el dispositivo piloto.

**Salida:** un operador completa el recorrido desde el alta de una base hasta la recuperación del archivo usando solo el teléfono.

## 6. Añadir Supabase por capacidades

- Ofrecer **Importar desde Supabase** como entrada opcional en Proyectos. El backend valida el PAT, descubre proyectos, obtiene el pooler, comprueba la conexión y cifra las credenciales. Una reimportación debe reconocer los proyectos existentes.
- Mostrar estado cloud y datos de importación cuando el proveedor anuncie esas capacidades. Presentar el estado cloud y el resultado PostgreSQL por separado. Un fallo de Management API debe permitir respaldar mediante una conexión PostgreSQL guardada que siga operativa.

**Salida:** importar, reimportar y respaldar un proyecto Supabase funciona con el mismo historial y sistema de trabajos que una conexión directa. Probar también PAT vencido y Management API indisponible.

## 7. Sustituir alertas y entregas de Telegram

- Persistir eventos y destinatarios antes del envío. Entregar en una bandeja dentro de la app y usar push para avisar con la app cerrada. Al abrir la notificación, volver a autenticar la sesión según corresponda y comprobar el permiso sobre el recurso.
- Cubrir fallos de cron, poco espacio, copia remota fallida, limpieza tras interrupciones, incidentes de acceso, copia del panel y resumen diario. Configurar preferencias por dispositivo, baja al cerrar sesión, reintentos y deduplicación. Los avisos en pantalla bloqueada deben omitir secretos y archivos.
- Para una caída completa del backend, comprobar la salud desde fuera del proceso. La bandeja local solo puede registrar eventos mientras el servidor funciona.

**Salida:** provocar un fallo controlado y confirmar entrega al destinatario correcto. Al desactivar push, el evento sigue disponible en la app.

## 8. Validar recuperación y preparar el lanzamiento

- Probar PostgreSQL directo y Supabase, copias manuales y cron, roles, migración de datos antiguos, red intermitente, disco lleno, reinicio durante el volcado, fallo S3 y archivos rotados. Verificar cada plataforma que vaya a distribuirse.
- Restaurar un dump descifrado en una base aislada y comprobar tablas, filas y una consulta representativa. Recuperar también SQLite y verificar acceso a conexiones cifradas con las claves custodiadas. Medir el tiempo de recuperación y acordar cuánta pérdida de datos admite cada proyecto.
- Publicar una versión piloto con backend compatible con clientes anteriores. Registrar duración, últimas copias correctas, trabajos interrumpidos y retrasos de notificaciones. Documentar actualización, reversión y diagnóstico. En cliente nativo, custodiar las claves de firma y distribuir primero por un canal de pruebas.

**Salida:** restauración demostrada, regresiones críticas resueltas y piloto capaz de operar durante un ciclo completo de la programación utilizada.

## 9. Retirar el bot y cerrar la transición

1. Validar la matriz de paridad con los operadores. Confirmar que cada permiso fue migrado, que los administradores reciben alertas y que pueden recuperar tanto copias de proyectos como la del panel.
2. Hacer opcional Telegram en configuración y arranque. Desactivar el polling en el piloto y observar copias programadas, entrega de eventos, descargas y arranques sin `BOT_TOKEN`. Durante esta ventana, permitir volver a activar el canal anterior.
3. Tras aceptar el piloto, retirar handlers, envíos y dependencia de Telegram. Revisar el importador, las pantallas de usuarios, Docker, la plantilla de entorno y los runbooks. Conservar auditoría e historial según su política de retención y revocar el token del bot al cerrar la ventana de reversión.

**Criterio final:** una instalación nueva y una actualizada arrancan sin Telegram. Ambas permiten administrar PostgreSQL, operar backups desde el móvil, recibir alertas y recuperar datos. La integración de Supabase se activa únicamente para los proyectos que la utilizan.
