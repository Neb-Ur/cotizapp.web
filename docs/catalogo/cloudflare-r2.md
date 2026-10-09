# Imágenes de Findi en Cloudflare R2

## Estado

R2 está configurado para el bucket `findi` y la URL pública `https://pub-2e849653aba84af8958b9be3963f820d.r2.dev`. El Account ID está en el archivo local `functions/.env`; las dos credenciales permanecen en Secret Manager de Firebase. `IMAGE_STORAGE_PROVIDER=r2` activa las cargas del administrador.

La activación del 9 de octubre de 2026 incluye la migración de las 12 imágenes existentes a 24 archivos WebP: detalle y miniatura por producto. Sus URL externas se conservan como respaldo. La URL `r2.dev` actual sirve para probar; sigue pendiente conectar un dominio propio para disponer de caché CDN y escalar el tráfico.

## Funcionamiento

- El administrador sube un JPG, PNG, WebP o AVIF de hasta 8 MB desde el editor del catálogo maestro. El servidor comprueba el contenido real y limita la imagen a 16 millones de píxeles; rechaza SVG y archivos animados.
- La API genera dos archivos WebP, sin ampliar el original ni conservar EXIF: `detalle.webp` hasta 1280 × 1280, y `miniatura.webp` hasta 480 × 480. Ambos conservan su proporción.
- Cada carga usa `productos/<UUID>/…`. Nunca se sobrescribe una URL existente. Los objetos llevan `Cache-Control: public, max-age=31536000, immutable`.
- La API responde las URL y las rutas de ambos archivos. El usuario debe guardar el producto para asociarlos a su ficha. Subir una imagen no modifica automáticamente la procedencia ni el respaldo de derechos del producto.
- PostgreSQL guarda los datos de compatibilidad en el producto y normaliza los recursos en `media_assets` / `product_media`. Los campos son `imagenStorageUrl`, `imagenStoragePath`, `imagenMiniaturaUrl`, `imagenMiniaturaPath`, e `imagenExternaUrl` como respaldo.
- Las tarjetas solicitan la miniatura; si falla, intentan la imagen de detalle, la URL externa y el placeholder. Los detalles usan la versión de 1280. El navegador descarga directamente desde el dominio público de R2; no usa Firebase Storage, nuestra API ni una consulta SQL para descargar cada imagen.
- Un guardado invalida el catálogo y sus fichas mediante el mecanismo existente. Las URL externas anteriores siguen disponibles como respaldo cuando se carga una imagen propia.

## Configurar Cloudflare

1. Crear un bucket **R2 Standard**, por ejemplo `findi-imagenes`. No activar Infrequent Access ni Cloudflare Images para este flujo.
2. Conectar un dominio público propio, por ejemplo `imagenes.tu-dominio.cl`, desde la configuración del bucket. El dominio debe estar en Cloudflare. `r2.dev` sirve para pruebas; no usarlo como URL final de producción.
3. Crear credenciales de la API S3 de R2 con lectura/escritura de objetos, limitadas a ese bucket. No se necesita un token de administración de toda la cuenta.
4. Guardar las credenciales como secretos de Firebase, desde una terminal local. No ponerlas en Angular, Git ni en el chat:

```sh
firebase functions:secrets:set FINDI_R2_ACCESS_KEY_ID --project cotizapp-d71c8
firebase functions:secrets:set FINDI_R2_SECRET_ACCESS_KEY --project cotizapp-d71c8
```

Cada comando solicita el valor de forma interactiva.

5. Completar las variables **no secretas** de `functions/.env`:

```dotenv
IMAGE_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=<identificador-de-cuenta-de-32-caracteres>
R2_BUCKET=findi
R2_PUBLIC_BASE_URL=https://pub-2e849653aba84af8958b9be3963f820d.r2.dev
```

La URL actual `r2.dev` permite probar las cargas y la lectura pública; tiene límites de tráfico y no ofrece la caché CDN de un dominio propio. Antes de escalar producción, conectar un dominio propio y actualizar `R2_PUBLIC_BASE_URL`.

Conservar todas las variables PostgreSQL existentes. El endpoint S3 se construye con el Account ID; no debe confundirse con la URL pública.

6. Compilar y desplegar. La función `api` vincula explícitamente ambos secretos. Deben estar creados antes de desplegar, incluso si las cargas están temporalmente desactivadas; el proveedor controla el uso de R2 en las solicitudes:

```sh
npm run build
firebase deploy --only hosting,functions:api --project cotizapp-d71c8
```

No se necesita Worker ni CORS de subida en R2: el navegador sube a la API autenticada de Findi y el servidor escribe a R2. El dominio público debe permitir GET de las imágenes. Las credenciales no llegan al navegador.

## Validación después de activar

- `GET /api/config` debe devolver `imageStorage.enabled: true`. Esto comprueba las variables públicas, no prueba las credenciales ni la disponibilidad del dominio.
- Iniciar sesión como admin, abrir un producto y desplegar «Imágenes y respaldo de derechos».
- Subir un archivo y esperar el estado de éxito. Guardar el producto: antes del guardado la carga no está asociada a la ficha.
- Abrir la tarjeta y el detalle; confirmar que las dos URL responden 200 y sus cabeceras incluyen el tipo WebP y la política de caché. Repetir una carga y comprobar que la URL cambia.
- Si las credenciales o el bucket fallan, la API devuelve un error de carga y el formulario conserva su imagen anterior. Si falla una de las dos escrituras, intenta borrar ambos objetos de esa carga.

## Operación y limpieza

Los archivos previamente publicados se conservan al sustituir una imagen para no romper URL cacheadas. Una carga que el administrador no guarda puede dejar archivos sin asociación. No activar una regla de expiración para todo `productos/`: también borraría imágenes publicadas. La limpieza debe comparar las rutas del bucket con `media_assets.storage_path`, aplicar un período de gracia y revisar candidatos antes de borrarlos. No hay borrado automático habilitado.

Para detener nuevas cargas: `IMAGE_STORAGE_PROVIDER=disabled` y desplegar `api`. Las imágenes ya publicadas continúan visibles mientras su dominio y objetos sigan activos.

Referencias oficiales: [SDK S3 para R2](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/), [bucket público y caché con dominio propio](https://developers.cloudflare.com/r2/buckets/public-buckets/), [credenciales de R2](https://developers.cloudflare.com/r2/api/tokens/).


## Migrar la tanda inicial

El script solo copia las imágenes de los 12 productos del manifiesto verificado. Exige coincidencia exacta por nombre y URL original, conserva imágenes propias existentes, guarda un respaldo privado en `tmp/sql-migration/`, valida la lectura pública de ambas versiones y escribe las asociaciones mediante el adaptador PostgreSQL. No cambia la procedencia ni las referencias de derechos del contenido. La escritura invalida el catálogo mediante el mecanismo SQL existente.

Desde la raíz, con Node 22 y Firebase CLI autenticado:

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node --env-file=functions/.env functions/scripts/migrate-product-images-to-r2.mjs --apply --firebase-cli-auth
```

Puede ejecutarse nuevamente: omite productos que ya tienen `imagenStorageUrl`. Si una carga se completa pero falla la validación pública o el guardado posterior, sus archivos pueden quedar sin asociación; se aplica la revisión de limpieza descrita arriba.
