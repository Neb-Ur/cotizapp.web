# PostgreSQL y Firebase SQL Connect en Findi

## Selección de base de datos

**Estado actual: PostgreSQL activo**, desplegado y verificado el 8 de octubre de 2026 (hora de Chile). El control de migración está en `active` y la réplica desde Firestore está detenida.

La variable pertenece al **servidor** y está en `functions/.env`:

```dotenv
USE_SQL_DATABASE=true
```

- `false`: la API sigue usando Firestore; la réplica mantiene PostgreSQL actualizado.
- `true`: la misma API, con sus rutas, permisos y respuestas, usa PostgreSQL para todas las colecciones de aplicación. Firebase Authentication conserva las credenciales y los tokens.

En GitHub Actions se conserva la configuración del servidor desplegado. También puedes definir la variable de repositorio `USE_SQL_DATABASE` para elegir explícitamente la base desde CI; un push posterior no la reinicia silenciosamente.

El cambio local requiere desplegar **todas las funciones**, no solo cambiar una variable del frontend:

```sh
firebase deploy --only functions --project cotizapp-d71c8
```

Al recibir tráfico con `true`, la API cambia el control de migración de `verified` a `active`. Ese bloqueo espera las escrituras protegidas de Firestore y las réplicas en curso. Bajo el bloqueo se concilian los últimos cambios y solo entonces se activa SQL; las réplicas posteriores se detienen. Esta conciliación se hace una vez: las consultas habituales a SQL no leen Firestore. Las instancias antiguas que todavía usan Firestore rechazan las escrituras durante el relevo. Una base sin conciliación verificada responde 503: no se hace una caída silenciosa a Firestore.

## Infraestructura y conexión

- Proyecto: `cotizapp-d71c8`.
- Servicio SQL Connect: `cotizapp-d71c8-service`, región `us-east4`.
- Instancia: `cotizapp-d71c8-instance`, PostgreSQL 18.
- Base: `cotizapp-d71c8-database`.
- Esquema de negocio: `findi`; conciliación temporal: `findi_migration`.
- Usuario del servidor: `findi_runtime`, con el rol privado `findi_backend`.
- Usuario de migraciones: `findi_migration`, separado del servidor.
- Contraseña del servidor: secreto `FINDI_SQL_PASSWORD` de Secret Manager. Nunca va al navegador, al repositorio ni a las respuestas públicas.

La API utiliza el conector oficial de Cloud SQL para Node.js para operar directamente en PostgreSQL con consultas parametrizadas y transacciones. SQL Connect administra la conexión a esa misma base y dispone de un conector de inspección `findi-admin`. Sus operaciones llevan `NO_ACCESS`: solo se pueden ejecutar con privilegios administrativos. No se expone un segundo API público que permita eludir los permisos de Express.

La pestaña **Esquema** de Firebase SQL Connect muestra los modelos GraphQL publicados, no descubre automáticamente todas las tablas PostgreSQL. Además de las dos vistas iniciales, se publican **60 modelos administrativos**, uno por cada tabla física: 57 de `findi`, 2 de `findi_migration` y el registro de migraciones SQL. Tienen nombres descriptivos en español y muestran las 659 columnas. Son vistas de lectura de los datos existentes, sin copiar tablas ni habilitar cambios directos que omitan las reglas de la API.

Cada modelo indica su tabla física en la descripción. El conector `findi-admin` contiene una consulta `Inspeccionar…` por modelo, con un límite de 20 filas y `NO_ACCESS`. Incluyen información privada y requieren privilegios administrativos de consola o Admin SDK. El navegador de la aplicación no puede ejecutarlas. Las relaciones reales se consultan en el [diagrama completo](diagrama-completo.md); SQL Connect no permite referencias entre estas vistas.

Para regenerar estos modelos tras añadir una tabla, ejecutar `node functions/scripts/generate-sql-connect-inspection.mjs` con credenciales administrativas. El generador describe la base real y escribe el esquema GraphQL, consultas y manifiesto. La migración 007 aplicada es inmutable: para futuras ampliaciones, usar `--migration 011-complete-console-inspection.sql`, revisar el SQL y añadirlo al listado del bootstrap antes de ejecutarlo. El generador rechaza sobrescribir una migración existente con contenido distinto.

El esquema SQL sigue siendo la fuente de restricciones. Las migraciones SQL controlan sus tablas; el esquema GraphQL usa vistas y validación `COMPATIBLE`, sin transferir el esquema de negocio ni eliminar tablas existentes.

## Compatibilidad de la API

La capa `functions/src/database/` implementa las operaciones que ya usa la aplicación: documentos, consultas, lotes, creación, actualización, eliminación, transacciones y contadores incrementales.

Cada entidad conserva su ID. Sus datos estructurados se escriben en las tablas y columnas del diseño: marcas, taxonomía, productos, atributos tipados, permisos de contenido, imágenes, ofertas, contratos, cotizaciones, consentimientos y métricas. Las listas anidadas se materializan en tablas hijas, conservando el orden y las líneas repetidas.

`005-runtime-compatibility.sql` agrega un campo privado `api_payload` por entidad para conservar exactamente las respuestas existentes, las omisiones y los campos editoriales durante la transición. Esta duplicación es deliberada y temporal: la API escribe las columnas tipadas y el payload **en la misma transacción**, bajo las restricciones SQL. No es una tabla genérica de documentos; cada entidad sigue teniendo su tabla, claves e integridad. Los cambios deben hacerse mediante la API o el adaptador, porque una actualización SQL manual de una columna no actualiza automáticamente esa representación de compatibilidad.

Las tablas `database_migration_state` y `source_replication_versions` controlan el estado del cambio y la versión de los eventos de Firestore. No contienen contraseñas. La réplica ignora eventos duplicados o anteriores, conserva marcas de eliminación y se detiene cuando SQL está activo.

Las políticas de `003-security.sql` son una referencia de acceso por usuario. El rol `findi_backend` de `005` es una conexión **exclusiva del servidor** y tiene políticas explícitas para las operaciones internas; la API sigue aplicando autenticación, estado, rol, propiedad y aceptación legal. El navegador no recibe ese rol ni credenciales SQL.

## Copia y conciliación

Las herramientas requieren el proyecto de destino explícito para aplicar cambios:

```sh
firebase projects:list
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/bootstrap-sql.mjs --apply --firebase-cli-auth
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/migrate-firestore-to-sql.mjs --apply --firebase-cli-auth
```

`bootstrap-sql` registra el hash de cada migración aplicada y rechaza un archivo modificado o un esquema preexistente sin registro. Crea secretos y usuarios propios; conserva el usuario `postgres` existente.

La copia conserva los IDs y compara las cantidades y huellas SHA-256 del contenido por colección. Las cachés públicas son derivadas y no entran en la comparación exacta. El documento de bloqueo de cotizaciones se reemplaza por el bloqueo de la fila del propietario y la restricción de máximo de cotizaciones.

Los respaldos de la copia quedan en `tmp/sql-migration/`, fuera de Git, con permisos `0600`. Contienen datos personales y se eliminan según la política de conservación; no deben publicarse. No se borra ninguna colección de Firestore.

Antes de activar, comprobar otra vez la réplica con datos actuales:

```sh
node functions/scripts/migrate-firestore-to-sql.mjs --verify-only --firebase-cli-auth
```

Si hay diferencias, la activación queda pendiente. Mantener `USE_SQL_DATABASE=false`, dejar drenar la réplica y repetir la copia/conciliación. No marcar como verificada una colección a mano.

## Operación y retorno

`SQL_REPLICATION_ENABLED=true` habilita la sincronización y la protección durante la transición. Es un control interno; la variable que selecciona la base es `USE_SQL_DATABASE`.

La tarea nocturna y la API usan el mismo selector. Los cambios SQL actualizan las versiones del catálogo y ensucian su caché en la misma transacción, sin depender de eventos de Firestore.

Después de que SQL esté `active`, no basta con volver a `false`: Firestore puede haber quedado atrás. La protección bloqueará las escrituras antiguas. Un retorno exige conciliar y copiar los cambios recientes de SQL a Firestore antes de cambiar la autoridad. La herramienta de importación se niega a sobrescribir SQL activo con datos viejos de Firestore.

## Verificaciones

Las pruebas del backend cubren los flujos existentes. Las pruebas SQL usan PostgreSQL embebido y verifican restricciones, lotes atómicos, atributos tipados, cotizaciones repetidas, límites, incrementos, visibilidad comercial, invalidación de caché y orden de eventos. La copia real añade conciliación con la instancia Cloud SQL. Las comprobaciones en PostgreSQL real verifican también el rol del servidor y la concurrencia de las operaciones críticas.

## Estado comprobado al preparar la activación

- `USE_SQL_DATABASE=false`: Firestore conserva la autoridad.
- Copia conciliada: 3.295 registros de 28 colecciones persistentes/derivadas; el bloqueo operativo de cotizaciones se sustituye por bloqueo SQL.
- Catálogo: 856 productos y 1.047 valores de atributos; 18 categorías, 80 subcategorías, 101 familias y 8 marcas.
- 108 pruebas del backend aprobadas.
- PostgreSQL real: integridad del catálogo, rol sin privilegios de superusuario, creación de tablas denegada y comprobación concurrente del límite de cotizaciones. Las escrituras de validación se revirtieron.
- API utilizando el repositorio SQL: configuración, catálogo público y sitemap responden 200.
- Conector administrativo SQL Connect: catálogo y las 60 consultas de inspección ejecutadas correctamente, con filas contrastadas contra PostgreSQL. Solicitud anónima rechazada con HTTP 403; el rol de consulta tiene lectura de las vistas, sin lectura directa de `findi.users` ni permiso de actualización.
- Funciones de API, métricas nocturnas y réplica desplegadas; la web pública mantiene sus rutas, estilos y UX.

Estas cantidades son el corte de conciliación, no límites del catálogo. La réplica admite cambios posteriores y la activación realiza la conciliación final bajo bloqueo.

La carga de referencia añade la división territorial oficial de Chile y las agrupaciones de ciudades de los formularios; ver [estado de carga](estado-de-carga.md). Los vínculos territoriales de cuentas y ferreterías se actualizan automáticamente con los cambios de sus campos de ubicación.

## Verificación de la activación en producción

La conciliación previa coincidió con las 28 colecciones de origen y las 108 pruebas del backend pasaron. Se desplegaron todas las funciones con `USE_SQL_DATABASE=true`. La primera solicitud ejecutó la conciliación final y dejó el estado en `active`, eliminando las versiones pendientes de réplica.

`node functions/scripts/verify-sql-activation.mjs --firebase-cli-auth` verifica la configuración desplegada, el estado real en SQL, el catálogo, un detalle, el índice de sugerencias y el rechazo de acceso anónimo al admin. No fabrica datos comerciales. `node scripts/smoke-production.mjs` comprobó HTML de producto, canonical, JSON-LD, páginas de categorías/familias/marcas, sitemap, noindex privado y 404 reales. El resultado fue 856 productos y 0 ofertas activas.

En la prueba inicial, la primera solicitud, que incluye arranque y conciliación, tardó aproximadamente 25 segundos y la primera consulta de catálogo unos 16 segundos. En consultas posteriores, el detalle respondió entre 0,8 y 1 segundo y la búsqueda aproximadamente 0,6 segundos. Una carga completa posterior de catálogo tomó 8,4 segundos y el índice de sugerencias 2,8 segundos: estas rutas todavía tienen margen de optimización. Son mediciones puntuales de extremo a extremo, no una garantía de latencia. El buscador del navegador conserva su índice local en caché; la primera descarga sigue dependiendo de la API.

Firestore se conserva como copia del momento del cambio, sin recibir las nuevas escrituras SQL. No ejecutar nuevamente la importación desde Firestore ni volver a `false` sin preparar la sincronización inversa.
