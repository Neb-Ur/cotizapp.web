# Asociaciones de vehículos por publicación

Soporte del punto 5 del [plan de ampliación](informe-expansion-repuestos-2026-10-12.md). Cada oferta actual puede guardar hasta 20 declaraciones manuales. Esto no habilita varias ofertas del mismo producto en un local ni modifica las cotizaciones.

## Arquitectura vigente

Desde el 14 de octubre la compatibilidad se administra en el [producto maestro por variante](productos-maestro-automotrices.md). Las reglas y endpoints de publicación descritos debajo corresponden a la etapa anterior y se conservan para transición. El editor de oferta no permite ampliar vehículos de un maestro con compatibilidad. La búsqueda consulta primero el maestro y permite descubrir fichas sin ofertas.

## Datos y validación

`asociacionesVehiculos` contiene filas completas: `marcaId`, `modeloId`, `anioDesde`, `anioHasta`, más los nombres resueltos por el servidor. La tabla `findi.offer_vehicle_applications` conserva el orden y referencia la oferta y la combinación modelo/marca de `vehicle_models`.

- El modelo debe pertenecer a la marca y esta debe tener uso vehículo. El fabricante del producto conserva su relación anterior.
- Los años son enteros entre 1886 y 2100, con inicio menor o igual al fin. Un solo año se guarda como intervalo de un año.
- Desconocido se guarda como ambos años nulos: no significa todos los años. La interfaz dice «Años no especificados».
- Para el mismo modelo se rechazan duplicados y rangos solapados, incluidos extremos compartidos. Una declaración sin años no se combina con otra de ese modelo. Los rangos separados se conservan como filas distintas, sin fusionarlos ni deducir otros vehículos.
- Un modelo inactivo conserva sus declaraciones anteriores; no se pueden agregar nuevas declaraciones ni ampliar sus años. Su lectura sigue disponible.

## API y permisos

`GET /api/ferreterias/:storeId/catalogo/:offerId/vehiculos` devuelve `applications` y `canEdit`. Requiere dueño del local o administrador. Continúa permitiendo leer las declaraciones guardadas si se desactiva la función.

`PUT` en la misma ruta reemplaza explícitamente la lista completa usando `{ "asociacionesVehiculos": [...] }`. Requiere los mismos permisos, contrato comercial vigente y autorización del local por configuración. El servidor vuelve a comprobar local, dueño, producto, familia, marca y modelo en la transacción de escritura. El cambio y su historial se guardan juntos. Enviar `[]` elimina las declaraciones; omitir el campo en una edición normal de precio o stock las conserva.

Las familias deben tener `permiteVehiculos=true` para registrar asociaciones. Una familia deshabilitada conserva las declaraciones anteriores y permite retirarlas por el endpoint autorizado. Los precios, stock y cotizaciones existentes no reciben asociaciones inventadas.

## Habilitación gradual

Las nuevas escrituras están deshabilitadas por defecto. La API exige **ambas** variables del servidor:

```dotenv
VEHICLE_APPLICATIONS_ENABLED=true
VEHICLE_APPLICATION_PILOT_STORE_IDS=<ids-de-locales-autorizados-separados-por-comas>
```

Sin la primera variable o sin el ID del local en la segunda, la API rechaza el guardado, incluso para un administrador. La interfaz del catálogo recibe `vehiculosEditables` del servidor y muestra el editor solo cuando corresponde, o muestra las declaraciones anteriores para lectura. La configuración se conserva también en despliegues de CI.

**Estado al entregar el punto 5:** soporte desplegado, sin habilitar locales piloto. No activar el recorrido público automotriz hasta completar selección exacta/captura de cotizaciones, filtros y verificación según el plan. Los filtros públicos se incorporaron posteriormente; la presentación de asociaciones en cotizaciones y la carga masiva siguen pendientes.

El editor está en la edición del producto del catálogo del dueño, con un botón explícito «Guardar vehículos». El administrador puede abrir «Vehículos» desde el catálogo del local autorizado. Estos controles operan sobre el ID de la oferta existente.

Para desactivar nuevas escrituras, configurar `VEHICLE_APPLICATIONS_ENABLED=false` y desplegar la API. No borrar las declaraciones ni volver a una versión que descarte sus campos al editar ofertas.

## Filtros públicos de vehículos — 13 de octubre de 2026

El catálogo público usa la etiqueta «Local» y las opciones del directorio sin restringir el tipo de negocio. Al seleccionar Repuestos automotrices, buscar repuestos o recibir resultados de esa categoría, presenta marca, modelo y año del vehículo. La marca comercial del producto conserva su filtro independiente. Las opciones se cargan de `/api/vehiculos/catalogo`; el modelo depende de la marca y el año requiere seleccionar modelo. Cambiar marca o modelo limpia las selecciones dependientes.

`GET /api/busqueda?vista=productos` acepta `vehiculoMarcaId`, `vehiculoModeloId` y `vehiculoAnio`, combinados con texto, taxonomía, local, orden y ubicación. El modelo exige marca; el año exige modelo y un entero entre 1886 y 2100. Marca, modelo y año deben coincidir en la misma fila declarada por el vendedor. Los intervalos incluyen ambos extremos; años desconocidos no coinciden con un año concreto. No se deduce compatibilidad desde nombres de producto o categorías.

El filtro se aplica a las ofertas públicas antes de calcular precios, locales, totales y paginación. Una ficha base sin ofertas/asociaciones permanece en el catálogo general, pero no se presenta como coincidencia de vehículo. La caché publica únicamente las declaraciones normalizadas de ofertas visibles; no incluye campos internos adicionales y se reconstruye al cambiar su política.

Los enlaces a fichas conservan estos parámetros. `/api/productos/detalle`, también con `vista=ofertas`, aplica la misma selección, y el detalle identifica que está mostrando ofertas filtradas por vehículo. Las cotizaciones conservan su comportamiento actual; esta entrega no completa el punto 6A ni habilita varias piezas del mismo maestro/local.

En producción se cargaron seis marcas y trece modelos como [referencias iniciales](catalogo-vehiculos-inicial.md). Posteriormente se agregó una [semilla automotriz de prueba](semilla-repuestos-vehiculos.md) con ocho ofertas y veinticuatro asociaciones simuladas. Los maestros no afirman compatibilidad técnica; las asociaciones semilla están identificadas como simulaciones en locales y ofertas de prueba. Las nuevas escrituras conservan su configuración de piloto; esta entrega permite consultar declaraciones existentes sin abrir escrituras globales.
