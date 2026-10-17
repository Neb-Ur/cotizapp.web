# Inventario por vehículo donante

Fecha: 16 de octubre de 2026 (Chile).

## Flujo del local

Disponible para desarmadurías y locales de repuestos. Las ferreterías conservan la carga individual y Excel.

- **Mis vehículos** en la navegación del panel y **Agregar por vehículo** en Mi catálogo.
- Asistente de tres pasos: identificar vehículo, seleccionar piezas, revisar y publicar. Modal amplio en escritorio y pantalla completa en celular. Se monta en un portal sobre el documento para que los efectos visuales del panel no desplacen su posición fija; el contenido tiene desplazamiento independiente.
- Marca, modelo y año del catálogo vehicular; motor, patente, VIN, transmisión y código interno opcionales. La identidad del vehículo queda fija tras guardarlo.
- Plantilla de más de 70 piezas organizada en ocho sistemas. Ninguna pieza viene seleccionada. Es posible añadir otras piezas, hasta 120 por vehículo.
- Cada pieza seleccionada tiene precio, stock (inicial 1), condición (inicial Usado), producto maestro y fotografías opcionales.
- Las coincidencias se presentan como sugerencias, que el local debe confirmar. No se asigna automáticamente una variante técnica por conocer el vehículo de origen.
- **Guardar borrador** conserva el avance. **Guardar y elegir piezas / revisar** también guarda. Cerrar sin guardar no conserva las últimas ediciones de los campos.
- Las fotos se guardan al subirlas. Las fotos generales del vehículo no aparecen en el catálogo público; las fotos de las piezas se transfieren a la publicación correspondiente y aparecen en la galería pública existente con el nombre del local.
- La publicación procesa grupos de diez piezas. Cada pieza se confirma en su propia transacción. Un error no revierte las demás; los identificadores estables permiten reintentar sin duplicar.
- Las piezas completas con maestro activo compatible se publican. Las incompletas quedan como borrador. Las completas sin maestro generan una solicitud administrativa idempotente.
- Si el local identifica una variante existente y publica mientras había una propuesta pendiente, la propuesta se cierra automáticamente con una nota; no permanece duplicada en la bandeja del admin.
- Al aprobar una solicitud, el admin vincula una identidad técnica validada y devuelve la pieza a borrador. El propietario revisa y publica; aprobar no crea automáticamente una oferta ni mezcla piezas de dos vehículos.
- La ficha pública cuenta locales únicos y publicaciones por separado, ya que un mismo local puede ofrecer varias piezas del mismo maestro.
- Desde un vehículo se abre la publicación exacta para editar precio, stock, condición, fotos o retirarla. Las publicaciones existentes no se sobrescriben al reintentar el lote.
- Eliminar una publicación desvincula su pieza del vehículo. Eliminar un vehículo exige eliminar antes sus publicaciones; retira sus solicitudes pendientes y limpia sus fotos privadas.

## Datos y garantías

Migraciones: `sql/findi/020-donor-vehicles.sql` y `021-donor-trigger-search-path.sql`, aplicadas en Cloud SQL mediante el registro existente de migraciones.

- `findi.donor_vehicles`: vehículo privado, propietario a través de `store_id`, referencias de marca/modelo, año, estado, revisión y borradores en `api_payload`.
- `offers.donor_vehicle_id` / `donor_item_id`: procedencia de una publicación. FK compuesta impide vincular un vehículo de otro local; un trigger restringe estas publicaciones a desarmadurías/repuestos.
- Índice único parcial `(store_id,product_id)` para ofertas habituales sin vehículo. Índice único `(donor_vehicle_id,donor_item_id)` para piezas individuales. Dos vehículos pueden publicar el mismo maestro con distintos precios, fotos y condición.
- Escritura del inventario con revisión optimista: una pestaña desactualizada recibe conflicto y no pisa los cambios de otra.
- Identificadores deterministas para ofertas y propuestas; reintentar conserva los valores ya mantenidos en una publicación.
- Todas las rutas privadas requieren autenticación, rol, propiedad y tipo real del local. Escrituras y fotos requieren el contrato vigente. La propiedad se vuelve a comprobar dentro de las transacciones de guardado/publicación/fotos.
- La API no acepta fotos, enlaces de publicación ni estado de resolución aportados por el cliente como evidencia confiable. Las claves de R2 y el usuario de carga no se exponen al navegador.
- Patente, VIN y fotos generales nunca se copian a las ofertas ni a los índices públicos.
- Compatibilidades del maestro conservan sus rangos de años. No se genera compatibilidad nueva a partir del año del donante.
- Carga individual, aprobación de solicitudes habituales y CSV inicial distinguen ofertas habituales de piezas con procedencia. Excel requiere SKU/código único para modificar piezas de vehículos y no las actualiza solo por nombre.
- Exportación y eliminación de cuenta incluyen el inventario privado y respetan el orden de las FK: ofertas, vehículos, locales.

## API

Base: `/ferreterias/:storeId/vehiculos-donantes`.

- `GET /`: inventario privado y plantilla.
- `PUT /:vehicleId`: guardar identidad/borradores y revisión.
- `GET /:vehicleId/candidatos`: maestros activos con compatibilidad registrada para marca, modelo y año; el local confirma la variante.
- `POST /:vehicleId/publicar`: `piezaIds`, entre 1 y 10, devuelve resultado individual y vehículo actualizado.
- `POST /:vehicleId/piezas/:itemId/fotos`: imagen binaria, hasta 8 MB, 12 fotos por pieza.
- `DELETE /:vehicleId/piezas/:itemId/fotos/:photoId`.
- `itemId=vehiculo`: fotos generales privadas.
- `DELETE /:vehicleId`: elimina borradores si no existen publicaciones asociadas.

Las fotos de una pieza publicada se administran desde las rutas de fotos de la oferta existentes. Las imágenes se alojan en el CDN público de R2; las fotos generales no se listan públicamente, pero su URL puede compartirse desde el inventario.

## Validación

Pruebas automatizadas: asistente, selección explícita de variante, guardado, reintentos, navegación por rubro, permisos, aislamiento de propietarios, lotes parciales, propuestas, transferencia de fotos, unicidad SQL y conservación de la carga habitual. Compilación de producción con prerender.

La verificación de navegador y publicación se registra al cerrar la entrega.

## Alcance posterior

Plantillas personalizadas por local/tipo de carrocería y sugerencias históricas de precios quedan para una siguiente etapa. El vehículo donante no sustituye una verificación técnica de variante y compatibilidad.
