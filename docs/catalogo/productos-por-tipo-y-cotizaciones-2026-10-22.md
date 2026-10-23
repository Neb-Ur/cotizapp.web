# Productos por tipo y selección desde cotizaciones — 22 de octubre de 2026

## Comportamiento implementado

- Ferreterías: Material o Herramienta. Tiendas de repuestos y desarmadurías: Herramienta o Repuesto. La categoría del maestro determina el tipo; las herramientas son compartidas entre los tipos de local. Los maestros simulados no pueden vincularse a locales reales.
- Alta individual: elección obligatoria del tipo antes de buscar un maestro existente o crear un producto nuevo. Las propuestas crean un maestro activo, una oferta y una solicitud administrativa pendiente. La publicación conserva las reglas de elegibilidad del local: una cuenta pendiente o bloqueada no se vuelve pública por esta operación.
- Excel/CSV: un solo tipo por archivo, seleccionado antes de la carga. Se comprueba el archivo completo antes de escribir si una fila declara otro rubro o coincide con un producto existente de otro tipo. La columna opcional `rubro` acepta material/materiales, herramienta/herramientas y repuesto/repuestos. No se intenta adivinar la clase de un nombre nuevo: se usa la clase elegida.
- Importación: actualiza ofertas existentes por sus identificadores, vincula coincidencias exactas y publica propuestas nuevas con revisión posterior. Las ofertas por vehículo se actualizan por SKU/código de barras único y no se duplican como ofertas regulares al reimportar su Excel.
- Vehículos donantes: el tipo es Repuesto automáticamente. Se incluye Neumático en la plantilla. Cada pieza tiene su propia familia/sistema; si no hay variante, se crea una ficha por vehículo con compatibilidad declarada por el local, oferta y revisión pendiente, sin esperar aprobación para publicar. La compatibilidad sigue sujeta a revisión. Las piezas incompletas conservan su borrador.
- Administración: puede revisar o editar el maestro existente. Aprobar conserva la oferta, fotos, precio y stock. Cambiar el maestro de una pieza comprueba compatibilidad con el vehículo y actualiza su referencia atómicamente. Rechazar retira la oferta de la publicación y conserva los datos. Las resoluciones antiguas continúan con su flujo previo.
- Reintentos: identificadores estables y transacciones evitan duplicar maestro/oferta/solicitud. Si la propuesta fue rechazada o la oferta se eliminó, el servidor devuelve conflicto en lugar de anunciar una publicación inexistente. Los catálogos reales y de prueba no comparten maestros propuestos de forma que se oculte una oferta real.
- Cotizaciones: al pedir agregar productos, se guarda primero la cotización para conservar su ID y los cambios. Las tarjetas y sugerencias abren el detalle manteniendo la cotización y el contexto de búsqueda. El producto se agrega únicamente con la acción explícita en la ficha, con el local y cantidad elegidos. Los enlaces antiguos con `addProduct` también redirigen a la ficha y dejan de insertar una unidad.

## Verificación

Se agregaron pruebas de mezclas de rubros y declaraciones contradictorias antes de escribir, actualización exacta de ofertas donantes, contexto de cotización en tarjetas/sugerencias/detalle y guardado antes de buscar. Backend cubre publicación pendiente de revisión, rechazos, reintentos, separación prueba/real, compatibilidad y resolución sin duplicados. Una integración PostgreSQL/PGlite ejecuta la creación transaccional de herramientas y neumáticos con sus relaciones normalizadas.

El árbitro independiente encontró y permitió corregir duplicación de ofertas donantes, divergencias al cambiar maestros, conflictos de identidad automotriz, familias de prueba repetidas y respuestas de publicación falsas tras eliminar/rechazar.

Logs de esta revisión: `/tmp/trovio-product-flows-tests-final.log`, `/tmp/trovio-product-flows-backend-final.log`, `/tmp/trovio-product-flows-production-build.log`, `/tmp/trovio-product-flows-sql.log`.

Cambios locales, sin despliegue en esta revisión. Se conserva también la eliminación del enlace de portada solicitada en el turno anterior. No se accedió a credenciales locales ni se modificaron productos, cuentas o cotizaciones de producción. La comprobación en navegador con sesiones reales sigue pendiente; las pruebas de componentes y SQL no sustituyen esa revisión.

Resultados: suite completa de frontend, 320 pruebas aprobadas; suite completa de backend, 248 aprobadas; 21 regresiones enfocadas de backend aprobadas después del último bloqueo de maestros simulados (incluyen un caso adicional). La integración SQL de propuestas y neumáticos pasó. Compilación de producción y revisión de espacios del diff comprobadas. El cambio final de enlaces antiguos se verifica adicionalmente con la suite enfocada de cotizaciones (`/tmp/trovio-product-flows-quotation-final.log`).

Cierre: 13 pruebas enfocadas de cotizaciones aprobadas después de retirar el agregado automático por enlaces antiguos. Compilación final de producción aprobada, con nueve rutas prerenderizadas.

## Búsqueda adicional de bugs

Dos fallos reproducidos por pruebas que fallaron antes de corregirlos:

1. La carga inicial no aplicaba el detector de identificadores repetidos, que solo corría en el modo de actualización. Un Excel con dos nombres y el mismo SKU podía enviar ambas publicaciones, dejando un identificador ambiguo. Ahora todos los modos detectan duplicados; la carga inicial rechaza el archivo completo antes de escribir. El modo de actualización conserva el reporte de filas repetidas anterior.
2. El fallback por ID estable de un maestro propuesto solo verificaba que estuviera activo. Si administración había cambiado nombre y categoría, reenviar la propuesta original podía omitir la validación del tipo actual. Ahora ese fallback también comprueba la categoría actual y los tipos permitidos para el local.

Pruebas de reproducción: `rejects repeated SKUs in an initial Excel before publishing either product` y `a stale proposal cannot bypass a product type changed by administration`. Logs antes de la corrección: `/tmp/trovio-bug-excel-before.log`, `/tmp/trovio-bug-stale-before.log`. Verificaciones posteriores: `/tmp/trovio-bug-excel-after.log`, `/tmp/trovio-bug-backend-after.log`, `/tmp/trovio-bug-production-build.log`. Correcciones locales, sin despliegue.

### Código visible desde la creación de la cotización

El código de las cotizaciones guardadas en una cuenta se muestra al comienzo del detalle, fuera del panel de información, incluso sin productos. Incluye botón para copiar. La creación conserva el código emitido por el servidor inmediatamente. Las cotizaciones antiguas sin código reciben uno persistido con su registro verificable al cargarlas, conservando su vigencia y precios guardados; las siguientes lecturas reutilizan ese código. Las cotizaciones locales mantienen su flujo de verificación al guardarse en una cuenta.

La revisión adversarial detectó y se corrigió una consulta de catálogo dentro de la transacción del backfill: ahora las ofertas se cargan antes de abrirla, evitando agotar conexiones SQL. Validación: 15 pruebas frontend, 11 pruebas backend y compilación de producción con 9 rutas prerenderizadas correctas. Cambios locales, pendientes de despliegue.
