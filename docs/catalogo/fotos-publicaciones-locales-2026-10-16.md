# Estado y fotos propias de publicaciones — 16 de octubre de 2026

Cada local conserva una publicación por producto maestro. El maestro mantiene sus imágenes genéricas, nombre y compatibilidad; la publicación del local incorpora condición y hasta doce fotos propias.

## Recorrido

1. En «Agregar productos», el vendedor selecciona la pieza y su estado, precio y stock.
2. Al agregar una sola pieza se abre «Editar producto y fotos». Las fotos también se administran desde el catálogo del local.
3. El vendedor puede seleccionar varias fotos JPG, PNG, WebP o AVIF, de hasta 8 MB cada una. La subida guarda cada archivo correctamente procesado; una falla posterior conserva los archivos anteriores y permite reintentar.
4. Las fotos se optimizan a WebP, con una variante para detalle y otra para miniatura. Se almacenan en R2, en rutas independientes por local y oferta.
5. El detalle público combina las imágenes genéricas con las fotos de las publicaciones visibles. Sobre cada foto aparece «Imagen de catálogo» o el nombre de su local y su condición actual. Las miniaturas identifican la fuente y cada oferta con fotos tiene un acceso «Ver fotos de este local».
6. La eliminación retira la foto de la galería de esa publicación y solicita la eliminación de sus dos archivos en R2. Eliminar la publicación retira también sus fotos. La ficha maestra y las galerías de otros locales permanecen independientes.

## Persistencia y permisos

- `fotosPublicacion` guarda metadatos acotados dentro del JSONB persistente de la oferta (`offers.api_payload`); su contrato se registra en el mapa de persistencia. No requiere una nueva columna SQL.
- La subida y eliminación exigen sesión, rol de local o administrador, propiedad del local, publicación correspondiente y acuerdo comercial vigente. El acceso se comprueba antes de procesar el archivo; la propiedad del local y el vínculo de la publicación se vuelven a comprobar dentro de la transacción de escritura.
- Los clientes no pueden asignar URLs ni atribuciones mediante la edición genérica de una oferta. La API genera los IDs, rutas y autor de las fotos. El nombre público se obtiene del local asociado a la oferta.
- La atribución pública excluye claves de almacenamiento y UID del autor. Las fotos de ofertas ocultas, vencidas o fuera del filtro vehicular no se incluyen.
- El detalle carga las fotos de los locales junto a las ofertas, sin incorporarlas a la ficha genérica persistida en el navegador. Las respuestas dinámicas usan `Cache-Control: no-store`.
- Si una foto de un local falla, se muestra el marcador de imagen no disponible; no se sustituye por una imagen genérica debajo del nombre del vendedor.

## Recursos de procesamiento

La API dispone de 1 GiB y hasta cuatro solicitudes simultáneas por instancia. Sharp limita su caché a 16 MB y utiliza un hilo de procesamiento. La verificación en producción detectó que el límite anterior de 256 MB agotaba la memoria durante las subidas.

## Validación automatizada

272 pruebas de frontend y 215 de backend aprobadas, más compilación de producción. Incluyen alta con condición, subida y eliminación desde el formulario, fallas parciales de carga, límites de archivos, permisos, atribución pública, aislamiento entre locales, persistencia SQL y recuperación de imágenes fallidas.
