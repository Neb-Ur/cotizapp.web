# Estado de CotizApp — 4 de octubre de 2026

> Esta es la auditoría inicial del commit `8d414a8`. Las correcciones posteriores están documentadas en [correcciones importantes](fixes-important-2026-10-04.md).

## Dictamen

**La aplicación tiene una base técnica funcional, pero todavía no está lista para una operación comercial con datos reales.** El sitio público carga, las pruebas actuales pasan y el SEO básico está implementado. Hay un riesgo crítico de privacidad, errores en búsqueda/catálogo/cotización y tareas operativas pendientes.

En producción se observan **60 productos maestros, todos identificados como demostración, y 0 ofertas activas**. `/buscar` muestra 0 resultados y la sección de destacados de inicio queda vacía. Es un piloto navegable; actualmente no permite comparar precios reales ni comprobar el recorrido de compra/cotización con ferreterías reales.

Revisión del código en commit `8d414a8` y del sitio `https://cotizapp-d71c8.web.app`. No se modificaron funcionalidades ni se realizaron escrituras de negocio en producción. Las reproducciones de errores del backend usaron exclusivamente datos simulados en memoria.

## Qué se verificó

| Verificación | Resultado |
|---|---|
| Pruebas frontend | 41 aprobadas, 12 archivos |
| Pruebas backend | 15 aprobadas; compilación TypeScript aprobada |
| Compilación Angular de producción | Aprobada; nueve rutas prerenderizadas; tres advertencias de presupuesto CSS |
| Smoke de producción | Aprobado: catálogo, ficha API/HTML, canonical, demo noindex, 404, cuenta privada noindex |
| `npm audit`, frontend y Functions | 0 vulnerabilidades conocidas reportadas en ambos lockfiles |
| Navegador Chrome, escritorio | Inicio, búsqueda, ficha, login, registro, recuperación y 404 sin errores JavaScript ni imágenes rotas en la muestra |
| Navegador Chrome, móvil 390 px | Inicio, búsqueda, ficha y login sin desbordamiento horizontal |
| API caída, simulada en navegador | Confirmado: búsqueda presenta “No encontramos productos” en lugar de informar el error |
| Búsqueda por URL en producción | Confirmado: `/buscar?q=cemento` deja el campo vacío |
| Reproducciones aisladas | Correo no verificado/exportación; sucursales homónimas; aprobación sin oferta; reposición que sigue inactiva |

Las pruebas existentes no cubren todos los recorridos de negocio. Que pasen no elimina los hallazgos siguientes. `npm audit` tampoco constituye una auditoría de permisos o de lógica de aplicación.

## Hallazgos prioritarios

### P0 — Exportación/eliminación pueden asociar datos de terceros por correo no verificado

**Confirmado en código y reproducido con datos simulados.** `requireAuth` valida el token, pero no exige `email_verified`; también deja pasar cuentas Firebase sin perfil. `/privacy/export` toma el correo de Firebase y `accountRows` incluye solicitudes de contacto, denuncias de propiedad intelectual y reclamos de precios por coincidencia de correo, sin acreditar su propiedad.

La reproducción aislada aceptó un token con `email_verified: false` y exportó una solicitud de contacto de otro registro que usaba ese correo. El mismo mecanismo se reutiliza en la eliminación: puede borrar solicitudes de contacto y minimizar denuncias/reclamos asociados por correo.

**Impacto:** acceso indebido a registros privados y posible alteración de información ajena cuando una cuenta se registra con un correo que todavía no tenía cuenta Firebase. No se intentó explotar esta condición en producción; debe verificarse también la configuración real de registro de Firebase.

**Acción:** exigir propiedad verificada del correo antes de operaciones que vinculen datos por email; asociar registros a UID o a un mecanismo verificado de reclamación; exigir autenticación reciente para eliminación. La ausencia de perfil debe tratarse explícitamente.

Evidencia: `functions/src/lib/auth.ts:34`, `functions/src/routes/privacy.routes.ts:106`, `functions/src/routes/privacy.routes.ts:126`, `functions/src/services/account-data.service.ts:49`.

### P1 — La búsqueda desde inicio no aplica el texto ingresado

**Confirmado en código y navegador de producción.** Inicio navega a `/buscar?q=...`, pero `DashboardMaestroComponent` nunca lee `q` para inicializar `tableProductSearch`. El usuario llega a una búsqueda sin su filtro.

**Acción:** aplicar el parámetro al inicializar y al cambiar la URL; comprobar también enlaces compartidos y navegación atrás.

Evidencia: `src/app/pages/home/home.component.ts:63`, `src/app/pages/dashboard-maestro/dashboard-maestro.component.ts:122`.

### P1 — El optimizador mezcla sucursales que tienen el mismo nombre

**Confirmado con reproducción aislada.** La alternativa “todo en una tienda” agrupa por `storeName`, no por `storeId`. Dos sucursales llamadas “Ferretería Central”, cada una con un material distinto, aparecen como una única tienda capaz de cubrir toda la cotización. La selección en la ficha también identifica tiendas por nombre.

**Impacto:** estrategia de compra imposible en una sola sucursal, cantidades de ferreterías incorrectas y selección ambigua.

**Acción:** usar IDs de tienda/sucursal en optimización, selección, persistencia, conteos y PDF; conservar el nombre solo para mostrarlo.

Evidencia: `functions/src/domain/quotation.ts:21`, `functions/src/domain/quotation.ts:35`, `src/app/pages/producto-detalle/producto-detalle.component.ts:177`.

### P1 — La importación puede vincular automáticamente un producto equivocado

**Confirmado por revisión de código; pendiente de prueba completa con un catálogo controlado.** Si la fila no coincide con un producto existente, `suggestMatches` permite coincidencias por fragmentos de nombre o marca; cualquier sugerencia con puntuación positiva puede ser elegida. `importCatalogBatch` toma la primera y crea/actualiza la oferta sin exigir coincidencia exacta ni confirmación.

**Impacto:** precio y stock de una presentación, tamaño o marca pueden publicarse sobre otra ficha. El contador de “posible_match” existe, pero esta rama informa “subido”.

**Acción:** vincular automáticamente solo coincidencias inequívocas; enviar candidatos ambiguos a revisión antes de publicar.

Evidencia: `src/app/core/services/firebase-data.service.ts:978`, `src/app/core/services/firebase-data.service.ts:1005`, `src/app/core/services/firebase-data.service.ts:2112`.

### P1 — Aprobar una solicitud no incorpora el producto al catálogo de la ferretería

**Confirmado en frontend/backend y reproducido con datos simulados.** El endpoint de resolución solo cambia estado y producto sugerido de la solicitud. No crea la oferta en `productosFerreteria`; el frontend tampoco la crea, pero anuncia “Solicitud aprobada y aplicada correctamente”.

**Impacto:** la ferretería sigue sin el producto solicitado, aunque administración lo ve aprobado. Precio y cantidad de referencia no se aplican a una oferta.

**Acción:** definir y ejecutar transaccionalmente la incorporación de la oferta al aprobar, con validación del maestro y control de duplicados; o cambiar expresamente el flujo/mensaje para requerir un paso posterior.

Evidencia: `functions/src/routes/product-requests.routes.ts:41`, `src/app/core/services/firebase-data.service.ts:1057`, `src/app/pages/dashboard-admin-validaciones/dashboard-admin-validaciones.component.ts:1702`.

### P1 — Reponer una oferta retirada no la vuelve a activar

**Confirmado con reproducción aislada.** `retiro_preventivo` pone `activo:false`. Después, `repuesto` pone `publicado:true`, pero conserva `activo:false`; el constructor del catálogo público sigue excluyéndola.

**Acción:** guardar y restaurar el estado anterior de publicación/actividad, sin reactivar ofertas que ya estaban inactivas por otra causa.

Evidencia: `functions/src/routes/intellectual-property.routes.ts:143`, `functions/src/services/catalog-search.service.ts:31`.

### P1 — Errores de carga se presentan como ausencia de datos

**Confirmado en código y con fallo de API simulado en Chrome.** Cargadores de búsqueda, proyectos, catálogo propio y solicitudes capturan errores sin propagarlos. Algunas promesas quedan guardadas como si la carga hubiera terminado correctamente. La interfaz puede mostrar 0 resultados/ninguna cotización y no reintentar hasta una carga forzada.

**Impacto:** una caída o un error de permisos se confunde con pérdida de información. La prueba con respuestas 503 mostró “No encontramos productos para la búsqueda actual”.

**Acción:** distinguir vacío, carga y error; permitir reintento y descartar promesas fallidas. Mantener datos previos solo con un aviso de que no pudieron actualizarse.

Evidencia: `src/app/core/services/firebase-data.service.ts:1724`, `src/app/core/services/firebase-data.service.ts:1791`, `src/app/core/services/firebase-data.service.ts:1811`.

## Otros problemas y deuda técnica

| Prioridad | Hallazgo | Evidencia y acción |
|---|---|---|
| P2 | Importación inicial pierde identificadores/opciones de la fila | La rama de vinculación pasa solo precio y stock. El helper genera SKU desde el maestro y fuerza `isPublished:true`; no conserva el SKU/identificador de la fila ni respeta la opción de publicación en esta rama. Revisar `firebase-data.service.ts:668`, `:691`, `:1005`. |
| P2 | Registro permite sobrescribir un perfil existente | `/auth/register` escribe con `merge:true` sin rechazar perfiles existentes; cambia rol, estado y fecha. No permite convertirse en admin, pero puede alterar un perfil ya establecido. Separar creación, recuperación y edición. `auth.routes.ts:13`, `:51`. |
| P2 | Borrador compartido entre cuentas del mismo navegador | La clave `construcomparador-project-draft` no incluye UID; logout no la borra y eliminación limpia claves con prefijo `cotizapp`, que no incluye esta. Puede conservar dirección de obra y materiales para el siguiente usuario. `proyecto-detalle.component.ts:31`, `:456`; `auth.service.ts`, métodos logout y clearAfterAccountDeletion. |
| P2 | Ficha técnica pierde valores válidos | `valorTexto || valorNumero || valorOpcion || valorBooleano || ''` convierte `0` y `false` en vacío; además muestra el ID de la definición como etiqueta. Usar valores nulos explícitos y resolver etiquetas de atributos. `firebase-data.service.ts:1419`. |
| P2 | Búsqueda puede ocultar productos al crecer | Sin filtro taxonómico se limita a 100 productos antes de paginar. La búsqueda/paginación también se hace sobre el catálogo completo descargado. Añadir paginación real y búsquedas del servidor; evitar que el usuario vea un total artificialmente reducido. `dashboard-maestro.component.ts:610`. |
| P2 | Importaciones masivas compiten con límites de API | Cada fila produce solicitudes individuales y recargas de catálogo; el límite de escritura es 60/minuto por IP e instancia. No se observa control de ritmo/reintento de 429 en este importador. Medir con archivos de 100/500 filas y diseñar lotes con progreso y recuperación. `firebase-data.service.ts:782`; `functions/src/lib/rate-limit.ts`. |
| P2 | Riesgo de duplicados y actualizaciones parciales | Vincular oferta hace “buscar si existe” y luego crear fuera de una transacción. Actualizar perfil escribe datos antes de validar todas las coordenadas. Separar validación de persistencia y proteger unicidad/concurrencia. `store-catalog.routes.ts:57`; `auth.routes.ts:95`. |
| P2 | URLs de producto no tienen identificador estable | El slug se deriva solo del nombre, elimina acentos y se trunca a 120 caracteres. Nombres distintos pueden producir el mismo slug; renombrar cambia URL sin redirección histórica. Usar ID estable y política de redirección. No se confirmó colisión entre los 60 productos actuales. `product-url.util.ts:1`; `public-pages.routes.ts:6`. |
| P3 | Documentación desactualizada | README aún dice Angular 17; dependencias usan Angular 21. Promete cotizaciones sin límites, mientras interfaz/backend permiten 2. `docs/code-architecture.md` menciona MockApiService y flags de Karma anteriores. Alinear documentación y alcance real. |

## SEO

**La base está bien, pero eso no significa que el catálogo ya tenga potencial de tráfico comercial.**

Comprobado en producción:

- Las nueve rutas estáticas revisadas responden 200, tienen título específico, canonical y un H1.
- `robots.txt` y `sitemap.xml` responden correctamente. El sitemap contiene nueve URLs estáticas.
- Las fichas demo responden 200 con nombre, canonical, contenido inicial y `noindex`. Que no aparezcan en sitemap es coherente con su estado de demostración.
- Productos y rutas inexistentes devuelven HTTP 404; páginas privadas llevan `X-Robots-Tag: noindex, nofollow`.
- La ficha real está preparada para generar JSON-LD Product/AggregateOffer, pero no se pudo validar una oferta real porque hay cero ofertas públicas.

Pendientes:

1. `/auth` y `/producto` entregan inicialmente el HTML de inicio, con título/canonical de inicio e `index, follow`, sin cabecera noindex. Angular luego cambia la página. `/auth` debería redirigir coherentemente a login; la ruta legacy de producto requiere una política definida para URLs vacías y URLs con query.
2. Login, registro y páginas privadas también entregan inicialmente contenido de inicio. La cabecera noindex las protege, pero conviene alinear HTML inicial y metadatos con la ruta en lugar de depender del navegador.
3. La ficha servida por Functions tiene metadatos/schema más reducidos que el frontend; usa la imagen genérica de inicio. Unificar generación para que las vistas previas tengan imagen y datos del producto.
4. El sitemap deriva productos de ofertas: un maestro real sin ofertas no entra en él aunque su ficha sea indexable. Definir si esas fichas deben indexarse; evitar decisiones implícitas.
5. No se verificaron Search Console, cobertura real de Google, posiciones, backlinks ni Core Web Vitals de usuarios reales. Lighthouse no mide esos resultados.

## Rendimiento y accesibilidad

Medición de **Lighthouse 12.8.2, móvil simulado, inicio de producción**, 4 de octubre de 2026:

| Categoría | Puntaje |
|---|---:|
| Rendimiento | 60/100 |
| Accesibilidad | 91/100 |
| Buenas prácticas | 100/100 |
| SEO básico automático | 100/100 |

FCP 1,9 s; **LCP 5,5 s**; bloqueo total 490 ms; CLS 0,046; tiempo interactivo 8,6 s. Es una sola medición de laboratorio, con red/CPU simuladas; no representa un percentil de usuarios reales ni una garantía de velocidad.

El elemento LCP es la imagen principal. Lighthouse también señaló entrega de imágenes no adaptada al tamaño móvil, trabajo de JavaScript, carga de fuentes y falta de compresión en la respuesta del catálogo público. Priorizar imagen móvil/srcset, fuentes, menos trabajo al inicio y compresión/paginación de API.

Problemas de accesibilidad comprobados: el botón de búsqueda de inicio pierde su nombre accesible en móvil al ocultar la etiqueta, y textos del bloque de beneficios y el enlace “Solicitar acceso” tienen contraste insuficiente. Añadir nombre accesible explícito y ajustar colores. Revisar también teclado y lector de pantalla en paneles privados; la prueba pública no los certifica.

La compilación de producción de esta revisión dejó avisos de presupuesto de estilos en los tres paneles; el bundle inicial fue aproximadamente 888 kB sin comprimir. No son errores de compilación, pero respaldan la necesidad de trabajar rendimiento.

## Funcionalidades: implementación y límites de validación

| Área | Estado |
|---|---|
| Sitio público, navegación, páginas informativas | Funciona en las rutas revisadas |
| Catálogo/comparador | Implementado; vacío de ofertas reales en producción; búsqueda desde inicio tiene bug |
| Registro/login/recuperación | Pantallas y conexión Firebase presentes; recorrido real con correo controlado pendiente; propiedad del correo no se exige en operaciones sensibles |
| Cotizaciones y optimización | Implementadas, pruebas unitarias aprobadas; bug de sucursales homónimas; máximo 2 guardadas |
| Historial | Lista de cotizaciones guardadas con precios recalculados; no es un historial inmutable del presupuesto original |
| Exportación PDF/compartir | Implementada; pruebas cubren casos básicos/cancelación; entrega nativa Android/iOS y PDF largo pendientes de validación real |
| Ubicación/cercanía | Implementada; permisos/dispositivos y coordenadas comerciales reales pendientes |
| Catálogo ferretería/importación | Implementado; coincidencias ambiguas e identificadores requieren corrección |
| Solicitudes de nuevos productos | Registro y revisión presentes; aprobación no completa la incorporación de oferta |
| Administración/moderación | Implementada; reposición de oferta tiene bug |
| Métricas ferretería | Contadores de vistas/selecciones, no ventas ni visitas únicas; eventos públicos pueden repetirse, no constituyen analítica robusta |
| Privacidad y denuncias | Amplia implementación, pero el hallazgo P0 impide darla por segura |
| Contacto/soporte | Guarda solicitudes para gestión en admin; no se observa envío automático de email; WhatsApp deshabilitado |
| Pagos/suscripciones, checkout, ERP, chat | Fuera del MVP; su ausencia no es un bug |

## Operación y seguridad que requieren revisión de configuración

- Completar identidad del operador, RUT, domicilio y representante. La configuración y el footer público siguen mostrando datos pendientes y “no usar en producción”. Verificar que los buzones de soporte/legal/privacidad existan y se atiendan. Este informe no certifica cumplimiento jurídico.
- MFA admin: el backend lo exige solo si `REQUIRE_ADMIN_MFA=true`. No se encontró flujo de enrolamiento/desafío MFA en el frontend revisado. Antes de activarlo, comprobar ambos extremos con una cuenta controlada; no se verificó el valor desplegado de la variable.
- Confirmar cuentas demo deshabilitadas/revocadas en Firebase Auth. El bloqueo de acceso API existe y sus pruebas pasan, pero esto no acredita la configuración de todas las cuentas.
- Confirmar reglas Firestore realmente desplegadas. El archivo local niega acceso directo del navegador; el despliegue estándar no publica reglas/indexes automáticamente.
- Backups/restauración, IAM, alertas, presupuesto, retención y seguimiento de solicitudes tienen documentación, pero no se verificó su ejecución en consola. La matriz declara expresamente gestión manual y ausencia de borrado automático general.
- El rate limit vive en memoria por instancia; no es un límite global distribuido. Las métricas públicas agregadas son manipulables por repetición de eventos y deben interpretarse con ese límite.
- `deleteAccountData` ignora cualquier error de eliminación en Firebase Auth, no solo “usuario no existe”: puede informar éxito aunque la cuenta de autenticación sobreviva. Registrar y tratar errores/reintentos explícitamente.
- Hay múltiples lecturas completas de colecciones y listados sin paginación. El endpoint de usuarios además consulta ferreterías por cada perfil. Revisar costo y latencia con datos de volumen real.

## Orden recomendado

1. Cerrar P0 de privacidad y añadir pruebas de autorización por identidad verificada.
2. Corregir búsqueda `q`, identificación por sucursal, aprobación/reposición e importación ambigua.
3. Hacer visibles errores de red y recuperar cargas fallidas.
4. Probar el recorrido completo con un maestro, administración y dos ferreterías controladas: contrato, activación, carga, modificación, búsqueda, cotización, PDF, logout y privacidad.
5. Incorporar ofertas reales autorizadas y completar identidad/canales de operación antes de abrir comercialmente.
6. Mejorar rendimiento móvil/accesibilidad y alinear SEO inicial de rutas legacy/privadas.
7. Validar backups, MFA, permisos, monitoreo y retención; actualizar documentación.

## Alcance y evidencia de la revisión

Se revisaron frontend, routers/backend, optimizador, importación, privacidad, moderación, caché, hosting y CI/CD. Se probaron rutas públicas por HTTP y navegador y se ejecutaron pruebas/dependency audit. Las comprobaciones no sustituyen E2E autenticado, una auditoría completa de seguridad o pruebas de carga.

No se crearon cuentas reales, aceptaron contratos, enviaron formularios ni alteraron datos de producción. No se verificaron emails de recuperación/soporte, permisos Firebase/IAM, backups, facturación, servicios de correo o MFA desplegado. Sin ofertas reales no se pudieron contrastar comercialmente precios/stock ni calcular ahorro real.

Evidencia temporal local: `/tmp/cotizapp-audit/` contiene capturas, respuestas públicas, resultados de navegador y `lighthouse-home.json`. Los comandos de reproducción de backend reemplazaron Firestore/Auth por dobles de prueba en memoria, sin llamadas de datos reales.
