# Imágenes de productos

La web carga las imágenes directamente desde el navegador. No busca imágenes en internet durante la navegación ni usa una función para descargar o copiar imágenes externas a Storage.

El orden es:

1. `imagenStorageUrl`: URL servible de nuestro archivo en Storage, si está guardada.
2. `imagenExternaUrl`: URL HTTPS directa de una imagen externa.
3. `assets/product-image-unavailable.svg`: placeholder local de Findi, tanto si faltan URLs como si fallan ambas.

`imagenPrincipalUrl` conserva el contrato existente y contiene la URL preferida. Las fichas antiguas que solo tienen ese campo siguen funcionando. `imagenStoragePath` es la referencia estable del archivo; no se consulta Storage para comprobar si existe en cada visita. Las imágenes de galería tienen el mismo fallback. Un cambio de producto reinicia la selección; los errores no generan bucles de reintentos.

PostgreSQL conserva los archivos en `media_assets` y sus asociaciones en `product_media`. La URL externa de respaldo se guarda como otro recurso asociado, sin duplicar la URL principal ni agregarla automáticamente a la galería. El recurso de Storage conserva `storage_path`. Los datos de compatibilidad guardan los campos anteriores en la misma transacción. No se crean tablas adicionales.

La carga inicial incluye **12 productos comerciales** con imágenes contrastadas contra fichas oficiales de Bosch, Makita, Stanley y Volcanita. La fuente, modelo, URL y verificación de cada archivo están en [el manifiesto](imagenes-externas-tanda-01.json). Se verificaron respuesta HTTP y tipo de imagen; se descartaron páginas 404, logos y fotografías genéricas de marca. Los productos sin coincidencia comprobada muestran el placeholder. Las fotografías externas se pueden reemplazar desde el editor seleccionando el origen «URL externa»; no se declara automáticamente una autorización ni una revisión de derechos.

Carga en la base activa, desde la raíz y con credenciales administrativas:

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/import-external-product-images.mjs --apply --firebase-cli-auth
```

El importador vuelve a comprobar los archivos, exige una coincidencia exacta por nombre, conserva imágenes ya existentes y crea un respaldo privado fuera de Git. Los cambios se guardan mediante el adaptador SQL y actualizan la revisión del catálogo y la invalidación de caché en la misma transacción. No escribe en Firestore ni sube archivos a Storage.
