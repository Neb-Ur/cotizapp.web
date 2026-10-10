# Directorio de ferreterías y reseñas

`/ferreterias` lista locales publicados en Trovio, incluyendo los que aún no tienen ofertas. Se muestran solo locales habilitados para publicar y con propietario activo, siguiendo la misma elegibilidad del catálogo. El directorio se pagina en el servidor y permite buscar por nombre y filtrar por región y comuna. Las sucursales se identifican por su ID, aunque tengan el mismo nombre comercial.

`/ferreterias/:storeId` muestra contacto, puntuación promedio y reseñas paginadas. Un maestro autenticado puede publicar, editar y eliminar su propia reseña: de 1 a 5 estrellas y un comentario de 5 a 1500 caracteres. El servidor obtiene el autor de la sesión; no acepta una identidad enviada por el cliente. Se publica solo el primer nombre y no se exponen UID, correo ni otros datos de la cuenta en las reseñas. No se crean puntuaciones ni opiniones iniciales ficticias.

## Productos del local

«Ver productos» lleva a `/buscar?ferreteriaId=...&ferreteria=...`. El buscador conserva ese filtro y permite cambiarlo o quitarlo. El servidor aplica el ID antes de calcular precios, contar locales y paginar: los productos sin oferta publicada de ese local quedan fuera. El filtro se conserva en los enlaces a la ficha del producto para preseleccionar la oferta de la ferretería.

## Persistencia

La migración [013-store-reviews.sql](../sql/findi/013-store-reviews.sql) crea `findi.store_reviews`, con claves foráneas a `stores` y `users`, restricción única por local/maestro, validaciones de estrellas/comentario y acceso exclusivo del backend. La colección de compatibilidad es `real_resenasFerreteria`.

Las reseñas propias se incluyen en la exportación de la cuenta. Al eliminar una cuenta se eliminan sus reseñas; si se elimina una ferretería se eliminan las reseñas de ese local. Los promedios se calculan desde las reseñas vigentes, sin contadores que puedan quedar desactualizados.

La migración se incluye en el script existente `functions/scripts/bootstrap-sql.mjs` y debe aplicarse antes de desplegar la API.

## API

- `GET /api/directorio-ferreterias`: directorio paginado y opciones de filtros.
- `GET /api/directorio-ferreterias/:storeId`: ficha y reseñas paginadas.
- `GET`, `PUT`, `DELETE /api/directorio-ferreterias/:storeId/mi-resena`: consultar, guardar o eliminar la reseña del maestro autenticado.

Las lecturas públicas usan respuestas explícitas que omiten los datos privados de propietarios y autores. Las escrituras usan la autenticación, validación de rol y límites de solicitudes existentes.

El detalle de cotización ahora muestra carga hasta que los productos y precios están listos, permite reintentar errores e ignora respuestas de una cotización anterior cuando se cambia de ruta.
