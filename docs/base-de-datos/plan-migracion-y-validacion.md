# Migración relacional: conservar funciones y datos

Este documento conserva el plan y los criterios de aceptación. La implementación de transición y el procedimiento actual están en [activación de PostgreSQL](activacion-postgresql.md); la autoridad sigue en Firestore hasta activar la variable del servidor. Los archivos SQL se validan en una base nueva y vacía; no ejecutar contra una base que ya tenga tablas.

## Reglas de equivalencia

| Área actual | Qué debe seguir funcionando | Referencia del código |
|---|---|---|
| Identidad | registro, login, “Recordarme”, sesión restaurada, logout, timeout, perfil y roles | `auth.service.ts`, `auth.routes.ts`, `admin-users.routes.ts` |
| Correos | verificación, recuperación, cambio de contraseña y contenido Findi existente | Firebase Auth + `auth-email.service.spec.ts` |
| Inicio de maestro | página pública, regreso a URL previa, perfil/cotizaciones en la misma web | `auth-navigation.util.ts`, rutas y navbar |
| Inicio de ferretería | dashboard con header/footer público, menú comercial y regreso a Home | `dashboard-ferreteria.component.*` |
| Aceptación | casillas legales, rechazo/cierre de sesión, contrato y versiones actuales | `privacy.routes.ts`, `store-onboarding.routes.ts`, `store-agreement.routes.ts` |
| Taxonomía | CRUD, jerarquía, iconos, atributos obligatorios/filtrables y opciones | `taxonomy.routes.ts` |
| Productos | bases, variantes reales, marcas, logística, atributos, sin fotos obligatorias | `master-products.routes.ts`, `catalog-plan.mjs` |
| Publicación | bases sin ferreterías, ofertas elegibles, despublicación y moderación | `catalog-search.service.ts`, `public-catalog-cache.ts` |
| Búsqueda | productos/familias/marcas, normalización, sugerencias cacheadas, filtros, paginación y orden | `product-search.ts`, índice JS, rutas públicas |
| SEO | URLs actuales/duplicados, canonicals, HTML inicial, sitemap, 404/noindex | `catalog-seo.ts`, `public-pages.routes.ts`, `seo.service.ts` |
| Catálogo comercial | carga individual por local, admin o dueño; carga Excel y solicitudes | `store-catalog.routes.ts`, `product-requests.routes.ts`, editor/importador frontend |
| Cotizaciones | crear/seleccionar/agregar, dos por cuenta, líneas repetidas, cantidades y PDF | `projects.routes.ts`, motor, selección y PDF |
| Optimización | selección explícita, tienda única, proximidad, stock agrupado, ahorro, precios vivos | `domain/quotation.ts` |
| Métricas | solo último snapshot, ranking/top20, montos referenciales, cron diario 02:00 Chile | analytics domain/service/job |
| Contacto | mensajes existentes, aceptación de formulario, estados y WhatsApp para acceso | `contact.routes.ts`, configuración legal/contacto |
| Privacidad | exportar/bloquear/eliminar, correo verificado para datos anónimos vinculados | privacy/account-data services |
| Reclamos | corregir precios con evidencia, seguimiento de denuncia por token y retiro/reposición | price/IP routes |
| Gobierno | auditoría, incidentes, evidencia, plazos y minimización | governance routes + matriz de retención |
| Seguridad HTTP | autenticación reciente, roles, CORS, límites/honeypots y anti-enumeración | auth/rate-limit/index |

Las funciones de navegación, diseño responsive, footer legal, cookies, timeout, cotización seleccionada local y PDF se conservan en el frontend. No crear tablas para sustituir su comportamiento sin una necesidad concreta. Las cookies opcionales no son requisito para usar búsqueda/caché esencial.

## 1. Fijar baseline y ensayar en una base aislada

1. Guardar versión de código y contratos de respuestas; usar `inventario-endpoints.json` y tests actuales de rutas.
2. Capturar respuestas anonimizadas por endpoint y casos negativos (401/403/404/409/428, validaciones, límites).
3. Crear una base PostgreSQL de prueba y ejecutar `001`, `002`, `003`, `004` en orden. El archivo `004` revierte sus datos sintéticos.
4. Probar el servidor PostgreSQL elegido y extensiones/permisos reales. La validación PGlite no reemplaza una prueba de Cloud SQL y pooling.
5. Definir roles/funciones específicas que faltan para catálogo/administración/privacidad. Evitar una conexión de dueño de tablas usada para todas las peticiones.

Ejemplo, **solo base vacía de prueba**:

```sh
psql "$FINDI_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/findi/001-schema.sql
psql "$FINDI_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/findi/002-public-views.sql
psql "$FINDI_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/findi/003-security.sql
psql "$FINDI_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/findi/004-validation.sql
```

## 2. Exportar y conciliar sin perder campos

- Export consistente de Firestore, Firebase UID/perfiles y metadatos necesarios de Auth. Las credenciales siguen en Auth; no exportarlas a tablas SQL.
- Export de las 29 colecciones del mapa. Las ocho compartidas no llevan prefijo y las restantes se resuelven a `real_...`. No restaurar antiguos datos demo.
- `findi_migration.source_documents`: JSON original, ID, hash, exportado/vence y estado. Guardar temporalmente con acceso de migración y cifrado de infraestructura; nunca publicarlo.
- Cada campo se asigna a una columna, fila hija, evidencia JSON o derivado justificado. Un campo no clasificado queda como issue y **bloquea la declaración de migración completa**.
- Codificar tipos nativos Firestore (timestamps, bytes, referencias y valores especiales) explícitamente en staging. No usar JSON.stringify de NaN/Infinity como si preservara el original. Normalizar solo después de registrar y resolver esos valores.
- Conservar IDs, orden de ítems/galería/opciones, fechas y zona de los cortes, `false`, cero, nulos y snapshots.
- Auditar FK huérfanas, atributos vacíos/múltiples, tipos y opciones, nombres duplicados, correos duplicados, roles/estados antiguos, precios sin IVA, stock/medidas inválidos, y producto/categoría/subcategoría inconsistentes.
- Si un histórico apunta a oferta/local inexistente: conservar referencia y snapshot, FK nula. Si falta el dueño de una cuenta/cotización, requiere decisión de conciliación; no inventar un usuario.
- “Por especificar” permanece una etiqueta de base sin entidad de marca. Las marcas reales conservan ID/nombre normalizado; no vincular marcas por parecido de texto sin validación.
- El documento/hash histórico de contrato no se reconstruye con las cláusulas actuales. Guardar documento exacto cuando exista; si faltan bytes, registrar la limitación y resolver con respaldo de evidencia.
- Staging y archivos exportados también están sujetos a solicitudes de eliminación; no conservar una segunda copia indefinida de datos borrados. Su retención operativa debe aprobarse antes de usar datos reales.

Conciliaciones: documentos por colección, hijos por padre, conteos de ítems/opciones/atributos/medios, importes y stock, IDs preservados, contratos, eventos legales y fechas. Comparar antes/después del adaptador, no solo el número de filas: una colección puede dividirse en varias tablas.

## 3. Orden de carga

1. `users`; categorías/subcategorías/familias/marcas.
2. Documentos legales históricos; productos/modelos opcionales y definiciones/opciones.
3. Atributos, features, medios y derechos; rutas SEO importadas con sus paths actuales.
4. Locales y preferencias de local principal; contratos y consentimientos.
5. Ofertas y solicitudes; historial/reclamos/denuncias y referencias entre ellos.
6. Cotizaciones e ítems; seleccionadas opcionales solo después de cargar el dueño.
7. Privacidad/contacto/supresiones/auditoría/incidentes/evidencia.
8. Contadores y el corte diario real más reciente; lock del job convertido a su fecha local.
9. Reconstruir cachés e índice desde las tablas reconciliadas; no importar chunks obsoletos como verdad.

Para dependencias circulares de moderación/historial/solicitudes: insertar primero entidades con FK opcionales nulas; enlazarlas en una segunda pasada tras validar IDs. No desactivar todas las FK y asumir que no hay huérfanos.

Al llenar `quotation_limit`, revisar cuentas con más de dos cotizaciones heredadas. No borrar registros para cumplir el nuevo CHECK de flujo: bloquear nuevas creaciones y acordar un tratamiento que preserve el historial (por ejemplo límite temporal igual al número existente, sin habilitar nuevas). El default actual sigue siendo dos.

## 4. Adaptador compatible con la API

Crear repositorios PostgreSQL detrás de los servicios; no sustituir el frontend. Mantener `{ok,data,error}`, nombres en español/inglés existentes, códigos de error, rol/propiedad, paginación y alias HTTP.

Reconstruir `categoriaId/subcategoriaId`, `marca`, `galeriaJson`, `opcionesJson` e `items` desde relaciones. Para nombres iguales usar siempre el ID; importar `seoPath` actual. Los flags ausentes en Firestore se convierten siguiendo los defaults de las funciones actuales, no los defaults SQL indiscriminadamente.

Mantener el motor de cotización y analítica como referencia. Un cálculo SQL alternativo se permite después de pruebas de equivalencia, no durante el corte inicial. Los snapshots JSON de pruebas deben permitir comparar precios, cantidades, tienda elegida, stock agrupado, disponibilidad y ahorro con tolerancia documentada para el transporte de números exactos.

Reglas para borrado administrativo:

- Producto con referencias históricas: la API puede marcar `deleted_at` y retirarlo; los listados/detalles administrativos excluyen tombstones para reproducir la eliminación visible, y SEO devuelve 404. No borrar sus relaciones históricas para satisfacer una FK.
- Las FK evitan borrar una categoría/familia usada y dejar fichas sin taxonomía. Dar un error claro o una operación transaccional de reasignación; no conservar como “funcionalidad” la corrupción accidental de referencias.
- Oferta retirada: guardar historial y desvincular selección FK; snapshots/referencias preservados.
- Local/cuenta: usar flujo explícito de privacidad y minimización, no cascadas indiscriminadas sobre contratos o evidencia.

## 5. Transacciones que deben implementarse

| Operación | Una unidad atómica SQL |
|---|---|
| Crear cotización | bloquear fila de dueño → comprobar cuota → cabecera + ítems → selección si procede |
| Guardar cotización | verificar dueño → cabecera → reemplazar/actualizar ítems conservando orden → updated_at |
| Vincular producto a local | verificar permiso/contrato → oferta con UNIQUE local/producto → historial → catálogo actualizado → revisión/outbox |
| Aprobar solicitud | bloquear solicitud → si aprobada con mismo producto, devolver resultado actual → validar producto/local → crear oferta solo si no existe → historial → resolución |
| Guardar precio/stock | validar → update de oferta → evidencia before/after → revisión/outbox |
| Corregir reclamo | bloquear reclamo/oferta → corregir precio → historial vinculado → resolver → revisión/outbox |
| Aceptar primer ingreso | documentos actuales → consentimientos + estado de perfil + contrato/snapshots + resumen comercial |
| Suspender contrato | contrato + local + retiro de ofertas + revisión/outbox |
| Retiro/reposición IP | decisión + evento ordenado + guardar/restaurar estado previo → revisión/outbox |
| Marketing | evento + estado del usuario + supresión cuando corresponda |
| Bloquear datos | solicitud + flag/fecha; desbloquear solo si no quedan bloqueos abiertos |
| Actualizar producto/taxonomía | datos/atributos/derechos → revisión estática + revisión comercial afectada → outbox |
| Incrementar métricas | UPDATE contador atómico; jamás almacenar visitantes |
| Corte nocturno | reclamo de job único → lectura consistente → todos los totales/rankings → publicación completa del corte |

El job puede marcar running primero y calcular en transacción independiente; no publicar filas parciales como último corte. Al fallar, conservar reporte anterior. Un reintento manual actualiza la misma identidad job/fecha con auditoría, sin crear una segunda ejecución programada automática.

El outbox se escribe junto con el cambio. El worker reconoce eventos por ID/revisión y puede reejecutarlos. Si todavía no terminó, la API devuelve datos actuales o invalida el artefacto: no servir silenciosamente nombres viejos al cliente hasta que recargue.

## 6. Migrar por etapas con una sola fuente de verdad

1. Importar a SQL en modo sombra; Firestore sigue siendo la fuente de escritura.
2. Reflejar cambios mediante eventos/outbox o captura de cambios idempotente. Conciliar retraso y fallos. No hacer dos escrituras independientes sin recuperación.
3. Comparar lecturas en segundo plano (sin duplicar envíos de correos, contadores, consentimientos o efectos administrativos).
4. Habilitar lectura SQL por dominio con feature flag interno; mantener formato de respuesta.
5. Antes de cambiar escrituras, acordar el mecanismo de reversión de cambios SQL recientes. Un simple flag a Firestore perdería datos que ya no están allí.
6. Corte de escritura con pausa breve controlada si aún no existe sincronización bidireccional confiable: drenar escrituras/eventos, conciliar último snapshot, cambiar fuente y reabrir.
7. El período de rollback requiere replay de SQL hacia Firestore con IDs/versiones o volver a pausar y reconciliar. No declarar rollback instantáneo si no está implementado.
8. Mantener respaldos por los plazos autorizados, verificar recuperación y eliminar staging/copia antigua cuando termine la ventana aprobada.

Orden sugerido de dominios: catálogo/taxonomía/marcas → ofertas/historial → contratos/consentimientos → cotizaciones → privacidad/gobierno/métricas. Mientras convivan, usar referencias estables y el mismo motor; cada dominio debe tener una fuente de verdad explícita. Privacidad elimina/minimiza en **ambos** sistemas durante la transición.

## 7. Pruebas obligatorias antes del corte

**Integridad:** importar todos los productos reales, no solo ejemplos; verificar FK/atributos/opciones, marcas y las dos identidades de “Conector rápido”; conservar paths; probar renombre, baja y restauración; comparar conteos de campos/hijos y snapshots históricos.

**Concurrencia en PostgreSQL real:** dos conexiones creando la tercera cotización, dos altas del mismo producto/local, aprobación y alta manual simultáneas, dos aprobaciones iguales/diferentes, guardados de cotización en competencia, corrección de reclamo repetida y dos disparos del mismo job. Documentar SQLSTATE, reintentos e idempotencia.

**Precios/cotizaciones:** base sin ofertas, cero precio, stock cero, oferta vencida/futura, contrato suspendido/cambiado, dueño inactivo, selección explícita retirada, stock insuficiente compartido entre líneas, varias ofertas, local único/proximidad, formato/unidad medible, productos renombrados, nombres duplicados y totales vivos.

**Permisos:** maestro A no ve B; local A no edita B; ferretería no crea admin; público no recibe UID/perfil/derechos/hash de seguimiento; marketing no enumera correos; actividad SQL no reemplaza timeout de cliente; falta de aceptación/bloqueo mantiene guardas.

**Privacidad y resiliencia:** export por UID, correo no verificado, verificado con coincidencia exacta, eliminación con Auth fallando, revocación de acceso durante saga, minimización de JSON/payloads, limpieza de cachés y staging, retención con legalHold, restauración que no revive cuentas borradas ni cachés antiguas.

**UX:** escritorio/móvil, header/footer, logo/iconos, sugerencias/filtros, loading/error/reintento, guardar conserva detalle, login vuelve a URL previa, modal de cotización, selección persistida, PDF, dashboard comercial e inicio público. Comparar screenshots con baseline; no rediseñar durante la migración.

**Costo/rendimiento:** índices con EXPLAIN ANALYZE, latencia fría/caliente, pool máximo versus concurrencia de Functions, GIN y tamaño del índice publicado, lectura incremental de ofertas, CDN/IndexedDB, costo del corte nocturno y backups. No asumir que PostgreSQL es más rápido solo por ser relacional.

## Fuera del alcance de esta propuesta

La implementación de transición usa la instancia Cloud SQL agregada al proyecto, las herramientas de instalación/copia y el backend PostgreSQL. Firebase Auth permanece sin migrar. La base activa se selecciona con USE_SQL_DATABASE; los procedimientos y límites operativos actuales están en [activación de PostgreSQL](activacion-postgresql.md).
