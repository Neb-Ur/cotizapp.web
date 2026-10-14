# Productos maestros automotrices por variante — 14 de octubre de 2026

La compatibilidad del repuesto pertenece al producto maestro. Una ficha identifica una variante concreta con pieza, marca/modelo del vehículo, años, especificaciones y galería propia. El fabricante del repuesto continúa siendo un campo independiente. Precio, stock, condición y unidad publicada pertenecen a la oferta del local.

## Identidad y nombre

- `nombrePieza`: Radiador, Alternador, etc.
- `detalleVariante`: motor, transmisión, posición, código u otra característica que distingue piezas con los mismos vehículos y años.
- `compatibilidadVehiculos`: hasta veinte combinaciones completas de marca, modelo y años. Los años son obligatorios, enteros entre 1886 y 2100; no se admiten solapamientos para un mismo modelo. Un solo año usa ambos extremos iguales.
- `nombre`: generado en servidor desde esos campos y los nombres del catálogo vehicular; no se aceptan nombres de marca/modelo enviados como autoridad por el cliente.
- `catalogoNivel`: `producto_comercial` para una variante automotriz.

Ejemplo de formato: `Radiador Mahindra KUV100 2016–2019 · Semilla (Prueba)`. Para una misma pieza con varios rangos disjuntos del mismo modelo se enumeran los rangos; para aplicaciones adicionales a otros modelos, el nombre conserva la principal e indica cuántas adicionales existen. La lista completa se presenta en el detalle y participa en la búsqueda.

Los nombres de Mahindra/KUV100 se respaldan en el [manual del fabricante](https://mvault-cloudfront.mahindra.com/2025/08/26/Owners-Manuals/KUV100/owners-manual-KUV100.html). **Los rangos y variantes de la semilla son ficticios**: esta fuente no acredita compatibilidad de radiadores ni diferencias físicas entre esos períodos.

Una pieza distinta necesita otro maestro y otra galería. Los mismos años con otro motor/código pueden diferenciarse mediante `detalleVariante`. Una pieza idéntica aplicable a varios vehículos o períodos conserva un maestro y varias aplicaciones. No se genera una ficha por cada año individual de un intervalo.

## Persistencia y administración

Migración `019-product-vehicle-applications.sql` aplicada a la misma base. `products` incorpora `part_name`, `variant_label` y una identidad normalizada interna. La tabla hija `product_vehicle_applications` referencia producto y pareja modelo/marca y conserva rangos/nombres. Una restricción única parcial evita duplicar variantes activas con la misma familia, fabricante, pieza, especificación y conjunto de aplicaciones. Las tablas tienen RLS y acceso exclusivo del backend.

El administrador puede editar pieza, especificación, marca/modelo y rangos en la ficha del maestro; el nombre se calcula automáticamente. La imagen/galería se guarda en esa misma ficha. Al crear otra variante se vacía la galería copiada para cargar la fotografía correspondiente.

La API comprueba capacidad vehicular de la familia, pertenencia del modelo a la marca, actividad de referencias, años y duplicados. Se conservan aplicaciones previas de modelos retirados al editar otros campos. Si ya existen ofertas publicadas, cambiar los vehículos/años requiere crear otra variante para conservar la identidad comercial. Las ofertas heredan la compatibilidad del maestro y no pueden ampliarla por su editor de vehículos.

La migración conserva los datos anteriores; se guardó un respaldo privado de las tablas afectadas y sus referencias y se comparó el contenido antes/después. La ampliación del esquema no altera productos, ofertas o cotizaciones existentes. No sustituye un respaldo permanente de infraestructura.

## Búsqueda y presentación

Marca/modelo/año filtran productos maestros antes de agregar precios. Un producto compatible sin ofertas permanece como ficha con «Sin ofertas disponibles»; nunca se presenta precio cero como oferta. Si se elige un local, solo se muestran variantes con ofertas de ese local. Las restricciones de oferta anteriores conservadas por transición no amplían la compatibilidad del maestro.

Nombre, compatibilidad y aviso de simulación se publican en las fichas y cachés permitidas. La política de caché cambia para reconstruir snapshots anteriores. Las galerías no se comparten automáticamente entre maestros. La semilla no reutiliza imágenes genéricas como si fueran fotografías específicas; utiliza «Imagen no disponible» hasta cargar fotos verificadas.

## Conversión de la semilla

`functions/scripts/convert-seed-master-variants.mjs` transforma únicamente el lote automotriz anterior, conservando sus IDs y registros históricos:

- Veinticuatro maestros específicos a partir de las veinticuatro aplicaciones anteriores; veinticuatro ofertas enlazadas a las variantes.
- Dos maestros Radiador Mahindra KUV100 de prueba, 2016–2019 y 2020–2023, sin ofertas. Permiten verificar descubrimiento por compatibilidad sin locales/precios.
- Una marca y un modelo de referencia adicionales y una familia Radiadores; total siete marcas vehiculares/catorce modelos.
- Cuatro maestros genéricos y ocho ofertas del lote anterior archivados, sin borrarlos ni reescribir cotizaciones. Se rechaza la conversión si esos maestros tienen ofertas ajenas al lote.
- Los precios y condiciones se conservan desde las ofertas fuente. El stock se distribuye entre sus variantes y conserva el total: 71 unidades simuladas activas del lote.

El importador guarda un recibo privado previo, crea solo IDs ausentes y archiva solo los registros semilla identificados. La segunda preparación comprobada devuelve cero creaciones y cero archivos pendientes. No habilita escrituras globales del piloto ni publicaciones múltiples por maestro/local.

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/migrate-product-vehicles.mjs --firebase-cli-auth --apply
node functions/scripts/convert-seed-master-variants.mjs --firebase-cli-auth
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/convert-seed-master-variants.mjs --firebase-cli-auth --apply
```

Validación: 190 pruebas de backend y 236 de frontend aprobadas; comprobación adicional de 27 pruebas de API/SQL y siete de formulario tras los últimos ajustes. Se comprobaron nombres, independencia de fotos, unicidad, rangos, permisos de edición de compatibilidad, ofertas fuera de rango y productos sin ofertas, junto con regresiones de catálogo y cotizaciones. En producción: 26 relaciones normalizadas de maestros, 26 variantes, 24 ofertas del lote, búsqueda y HTML de las fichas, e invariantes de stock. Catálogo activo: 882 maestros y 3.448 ofertas. La revisión visual en navegador queda pendiente por ausencia de navegador conectado.

El punto 6A (selección exacta y snapshots de publicaciones en cotizaciones) continúa pendiente; esta entrega no lo sustituye.
