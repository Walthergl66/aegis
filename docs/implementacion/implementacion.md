# Implementación de la app móvil de backups PostgreSQL

**Objetivo de producto.** Una persona autorizada puede registrar una base PostgreSQL, probar la conexión, programar o iniciar una copia, cerrar la app y volver para consultar el resultado o recuperar el archivo. Una cuenta Supabase añade descubrimiento de proyectos por PAT y estado del servicio. El mismo motor PostgreSQL respalda ambos tipos de conexión.

**Cliente final.** El producto se opera desde la app nativa multiplataforma Expo/React Native bajo `mobile/`. El panel web y su contenedor fueron retirados; la API REST queda privada para el cliente móvil. Telegram sigue activo como integración operativa y de alertas hasta que se implemente y valide su reemplazo móvil. Véase [App móvil](../movil/README.md).

## Estado actual del plan

La app móvil ya incluye registro personal, inicio de sesión, conexiones PostgreSQL/Supabase, backups, historial y descargas. Los recursos se guardan con propietario y se sincronizan al iniciar sesión en otro dispositivo. El esquema PostgreSQL para Supabase ya está preparado sin datos iniciales; falta crear el proyecto `controldata`, aplicar la migración y configurar `DATABASE_URL` en el backend. Los archivos de backup permanecen en el almacenamiento actual. El panel web y su contenedor están retirados.

El alcance móvil sigue incompleto: faltan una experiencia de cron más completa, dispositivos, recuperación de contraseña, auditoría en la app y push. La importación Supabase tiene un primer flujo; falta validar PAT/contraseña, disponibilidad y errores parciales en dispositivos. La validación en dispositivos físicos y las builds de distribución siguen pendientes. Telegram continúa activo para comandos y alertas operativas.

**Punto de partida.** FastAPI, el bot y APScheduler comparten un proceso. Ya existen sesiones con TOTP, proyectos, proveedores, prueba de conexión, historial, cifrado, rotación y copia S3. El backend aún requiere `BOT_TOKEN` para la integración operativa y las alertas. Véanse la [arquitectura](../arquitectura/README.md), la [API](../api/README.md) y el [inventario del bot](../bot/README.md).

## 1. Fijar el alcance móvil y preparar una migración reversible

- **Decisión:** app nativa Expo/React Native para Android e iOS como único cliente de producto. El panel web se retiró; la API se mantiene para el cliente móvil.
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

- **Implementado:** registro personal desde la app, login y sesiones con refresh token. Cada cuenta tiene propiedad independiente de sus conexiones y proyectos; la API comprueba esa propiedad al listar, leer, modificar, importar, ejecutar backups, consultar historial y descargar. Al iniciar sesión en otro dispositivo se recupera el mismo conjunto de datos. El registro está limitado por IP.
- **Migración de datos existentes:** los recursos sin propietario se asignan a la cuenta de acceso más antigua; en una instalación sin usuarios, el primer registro los reclama. Las cuentas nuevas no reciben esos datos.
- Los roles actuales son por cuenta individual: `admin` permite administrar los recursos propios; no existen endpoints móviles para enumerar o administrar las cuentas de otras personas. Telegram continúa como integración operativa heredada.
- La app conserva access/refresh tokens en SecureStore y el refresh token rota por sesión. Falta recuperación de contraseña y una pantalla para revisar/revocar dispositivos activos.

**Salida:** dos usuarios con proyectos distintos solo pueden consultar, ejecutar y descargar dentro de su alcance, incluso si invocan directamente la API. La revocación se aplica en el siguiente acceso.

## 4. Exponer la ejecución de backups como trabajo persistente

- El primer corte ya expone `POST /api/projects/{id}/backup-jobs` y `GET /api/backups/jobs/{job_id}`. El alta devuelve HTTP 202 y un identificador, exige `Idempotency-Key` y requiere admin. SQLite conserva usuario, proyecto, clave, estado, tiempos y resultado. Por ahora el worker procesa solicitudes web manuales; ampliar los jobs a cron y permisos más granulares sigue pendiente.
- La app ofrece **Respaldar ahora** a administradores. Genera la clave idempotente, consulta el estado periódicamente y guarda el ID del trabajo activo en SecureStore para reanudar el seguimiento. El seguimiento simultáneo de varios trabajos sigue pendiente.
- El historial ofrece descarga del dump para administradores mediante `GET /api/backups/{backup_id}/download?format=dump`. La API valida el archivo, lo descifra por bloques y lo transmite sin escribir otra copia en claro. La descarga SQL está disponible en API mediante `format=sql`; la interfaz actual prioriza dump. El seguimiento de varios trabajos sigue pendiente.
- Reutilizar el runner desde bot, scheduler y API durante la transición. Procesar trabajos dentro del backend existente, con límite global y exclusión por proyecto. Una clave de idempotencia debe devolver el mismo trabajo si el móvil repite la petición tras perder la red.
- Definir estados en cola, en ejecución, completado, fallido e interrumpido. Al reiniciar, reconciliar trabajos en curso con los artefactos y recuperar la cola. Registrar por separado el resultado local y la transferencia S3 para que un fallo remoto pueda reintentarse sin repetir el volcado.
- Permitir descarga autenticada por identificador de artefacto. Verificar permiso y existencia en cada entrega, registrar quién descarga y distinguir copia rotada de error de red. Mantener la exportación de SQLite del panel restringida a administradores.

**Salida:** dos toques generan una sola ejecución. Después de cerrar la app o reiniciar el backend, el usuario obtiene un estado coherente y puede descargar una copia disponible.

## 5. Entregar la experiencia móvil de PostgreSQL

| Pantalla | Estado actual | Pendiente |
|---|---|---|
| Acceso y cuenta | Implementado: registro, login, TOTP, renovación nativa y cierre de sesión; recursos asociados al usuario para sincronizar al iniciar sesión en otro dispositivo. | Validación física, recuperación de contraseña y gestión/revocación de sesiones por dispositivo. |
| Inicio | Implementado: lista activos, proveedor, último backup correcto y refresco manual. | Indicadores de proyectos atrasados y atención requerida. |
| Proyectos | Implementado: admin puede crear conexiones directas PostgreSQL, editar nombre/conexión/cron/estado/opciones, probar una URI, archivar/restaurar e importar proyectos Supabase seleccionados; puede encolar backups idempotentes y seguirlos. Inicio recarga al volver a primer plano de navegación. | Ofrecer una gestión de cron más completa. Validar flujos y credenciales Supabase en Android/iOS físicos. La prueba antes de guardar o actualizar/importar es opcional. |
| Detalle de proyecto | Implementado: historial de 25 entradas, refresco manual y descarga/compartición temporal del dump. | Ejecutar/seguir backup desde el detalle y editar cron con UTC, hora local y próxima ejecución. |
| Copias | Muestra fechas/resultados/tamaños en cards e historial; permite compartir temporalmente un dump descargado. | Mejorar indicación de disponibilidad y destino de descarga. |
| Cuenta y sincronización | Implementado: registro personal, login, sesión segura y recursos separados por propietario; otro dispositivo recupera los mismos datos al iniciar sesión. | Recuperación de contraseña y gestión/revocación de sesiones por dispositivo. |

El cliente reutiliza `POST /api/projects/{id}/backup-jobs` y `GET /api/backups/jobs/{job_id}`. Conserva `Idempotency-Key` hasta aceptar la solicitud y el `job_id` en SecureStore para retomar polling; el endpoint de alta solo se presenta a admins. La integración del historial consume las 25 filas recientes de `GET /api/projects/{id}/history`.

Diseñar estados de carga, ausencia de datos, desconexión, expiración de sesión y operación en curso. Al reconectar, consultar el trabajo por su identificador antes de ofrecer un reintento. Revisar lector de pantalla, tamaño de texto, contraste y manejo de archivos grandes en el dispositivo piloto.

**Salida:** un operador completa el recorrido desde el alta de una base hasta la recuperación del archivo usando solo el teléfono.

## 6. Añadir Supabase por capacidades

- **Implementado en móvil:** admins pueden consultar proyectos con un PAT, seleccionar proyectos, elegir pooler `session`/`transaction`, proporcionar opcionalmente la contraseña de la base y activar/desactivar la comprobación previa. La app llama a `POST /api/import/fetch` y `POST /api/import/create`. El backend reutiliza el servicio `supabase_api` existente para Management API, obtención de pooler y prueba; registra `mobile_import_supabase` sin requerir ni crear usuario Telegram. El PAT queda cifrado en la cuenta Supabase del backend; el cliente no lo persiste localmente.
- Validar en dispositivos físicos PAT válido, vencido o sin permisos, falta/error de contraseña de base, errores de red/Management API, pooler no disponible, pruebas opcionales y resultados parciales. Una reimportación debe reconocer proyectos existentes y la cuenta Supabase debe conservar el PAT cifrado.
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

## 9. Panel web retirado; cerrar la transición solo móvil

1. Completar en móvil permisos por proyecto, cuentas de conexión, auditoría, seguridad personal y alertas. Validar la matriz de paridad con operadores y demostrar recuperación de copias/configuración desde la app.
2. Publicar un piloto móvil y validar dispositivos reales, identidad, descargas y restauraciones. El backend ya se enlaza solo a loopback para Tailscale Serve. Mantener límites, cabeceras de seguridad, HTTPS y proxies confiables; nunca publicar el backend directamente a Internet.
3. Sustituir las funciones Telegram (comandos, avisos, entregas y resúmenes) por flujos de app/push, probar backups y operación sin `BOT_TOKEN`, y retirar entonces polling, handlers y dependencias. Conservar auditoría e historial.

**Criterio final:** la instalación nueva y la actualizada se operan desde Android/iOS. No distribuyen un panel web y no requieren Telegram. La app administra PostgreSQL, integra Supabase, recibe alertas y recupera datos; el backend queda expuesto únicamente mediante el acceso privado documentado.
