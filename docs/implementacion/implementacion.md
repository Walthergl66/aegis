# Implementación de la app móvil de backups PostgreSQL

**Objetivo de producto.** Una persona autorizada puede registrar una base PostgreSQL, probar la conexión, programar o iniciar una copia, cerrar la app y volver para consultar el resultado o recuperar el archivo. Una cuenta Supabase añade descubrimiento de proyectos por PAT y estado del servicio. El mismo motor PostgreSQL respalda ambos tipos de conexión.

**Punto de partida.** FastAPI, el bot y APScheduler comparten un proceso. Ya existen sesiones con TOTP, proyectos, proveedores, prueba de conexión, historial, cifrado, rotación y copia S3. La ruta web de backups lista ejecuciones. El disparo manual, la entrega de archivos y varias alertas dependen del bot. El arranque exige `BOT_TOKEN`. Las rutas y tablas nuevas que aparecen más abajo son propuestas. Véanse la [arquitectura](../arquitectura/README.md), la [API](../api/README.md) y el [inventario del bot](../bot/README.md).

## 1. Fijar el alcance y preparar una migración reversible

- **Decisión para la primera entrega:** ampliar la PWA que ya existe y usarla como cliente móvil en Android e iOS. Evita mantener dos clientes mientras se valida el flujo. La decisión es reversible: si notificaciones push, almacenamiento seguro de refresh o transferencia de archivos no alcanzan los criterios en dispositivos reales, evaluar un cliente nativo compartido antes de ampliar el alcance.
- **Alcance del piloto:** administrar conexiones PostgreSQL, probarlas, iniciar y consultar backups, ver historial y descargar archivos. Supabase queda como proveedor opcional. No retirar Telegram ni cambiar todavía el flujo de alertas.
- Inventariar comandos, conversaciones, alertas, resumen diario, entrega de dumps y copia de SQLite del panel. Asociar cada flujo a una pantalla, permiso, destinatario y prueba de aceptación.
- Identificar proyectos, cron, archivos cifrados y permisos existentes. Crear una copia recuperable de SQLite, resguardar por separado ambas claves Fernet y ensayar la migración sobre una copia. Conservar los identificadores para mantener el historial.
- Mantener el acceso privado por HTTPS a través de Tailscale durante el piloto. Validar en al menos un dispositivo Android y uno iOS: instalación de PWA, login/TOTP, reconexión tras suspensión y descarga de un archivo representativo.
- Registrar los usuarios del piloto y sus permisos por proyecto. Confirmar la restauración de SQLite y de un dump en una base aislada antes de habilitar operaciones reales desde el teléfono.

**Criterio de salida:** matriz de paridad aprobada, PWA instalada y recorrida en Android e iOS, recuperación del estado inicial ensayada y límites de distribución documentados. Si push o descarga no son fiables en alguno de los dispositivos, abrir la evaluación de cliente nativo antes de la fase 5.

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
- La pantalla Proyectos ofrece **Respaldar ahora** a administradores. El frontend genera la clave idempotente, consulta el estado periódicamente y guarda el ID del trabajo activo en `localStorage` para reanudar el seguimiento tras recargar. La descarga del artefacto y el seguimiento de varios trabajos siguen pendientes.
- Reutilizar el runner desde bot, scheduler y API durante la transición. Procesar trabajos dentro del backend existente, con límite global y exclusión por proyecto. Una clave de idempotencia debe devolver el mismo trabajo si el móvil repite la petición tras perder la red.
- Definir estados en cola, en ejecución, completado, fallido e interrumpido. Al reiniciar, reconciliar trabajos en curso con los artefactos y recuperar la cola. Registrar por separado el resultado local y la transferencia S3 para que un fallo remoto pueda reintentarse sin repetir el volcado.
- Permitir descarga autenticada por identificador de artefacto. Verificar permiso y existencia en cada entrega, registrar quién descarga y distinguir copia rotada de error de red. Mantener la exportación de SQLite del panel restringida a administradores.

**Salida:** dos toques generan una sola ejecución. Después de cerrar la app o reiniciar el backend, el usuario obtiene un estado coherente y puede descargar una copia disponible.

## 5. Entregar la experiencia móvil de PostgreSQL

| Pantalla | Flujo que debe completar |
|---|---|
| Acceso | Entrar, introducir TOTP, renovar sesión y salir. |
| Inicio | Identificar la última copia correcta, proyectos atrasados y operaciones que requieren atención. |
| Proyectos | Crear o editar una conexión directa, probarla, ajustar opciones, consultar estado y archivar o reactivar el proyecto. |
| Detalle de proyecto | Ejecutar **Respaldar ahora**, seguir el trabajo y volver a él desde el historial. Editar cron mostrando UTC, hora local y próxima ejecución. |
| Copias | Consultar resultado, tamaño, fecha y disponibilidad. Descargar el archivo que corresponda y mostrar el destino de la descarga. |
| Administración | Gestionar cuentas, usuarios, permisos, dispositivos, seguridad personal y auditoría. |

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
