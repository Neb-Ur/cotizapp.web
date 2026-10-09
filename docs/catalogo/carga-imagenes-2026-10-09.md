# Imágenes del catálogo · 9 de octubre de 2026

La BD activa de PostgreSQL contiene 856 productos. Tras esta carga, 330 tienen imagen: 21 usan R2 y 309 una URL externa como fuente principal. Quedan 526 sin una imagen validada que corresponda a su ficha; mantienen la imagen local «Imagen no disponible».

## Imágenes generadas

Se crearon 8 ilustraciones fotográficas referenciales con la herramienta integrada `image_gen`: abrazadera metálica, abrazadera plástica, tablero OSB, bloque de hormigón, ladrillo fiscal, casco de seguridad, tornillo para madera y balde de construcción. Comparten fondo blanco, encuadre centrado y luz de estudio, sin marcas ni medidas inventadas.

Los archivos WebP, sus SHA-256, los productos asociados y los prompts exactos están en [el manifiesto de generación](imagenes-generadas-tanda-01.json). Los archivos finales están en `imagenes/ia-tanda-01/`. R2 contiene versiones de detalle y miniatura; las fichas muestran la advertencia de imagen generada con IA.

## Fotografías externas

Se consultaron los 844 productos que inicialmente no tenían imagen y se revisaron coincidencias de nombre, marca y familia. Se incorporaron 312 referencias aprobadas: 309 imágenes principales externas, una foto oficial Stanley almacenada en R2 porque fallaba como enlace directo en el navegador, y dos respaldos externos para productos con imagen generada. Las 12 imágenes previas en R2 se conservaron.

Las fuentes, URL y notas de correspondencia están en [el manifiesto externo](imagenes-externas-tanda-02.json). La búsqueda está registrada en [la auditoría](busqueda-imagenes-tanda-02.json). Se descartaron coincidencias ambiguas o de otra familia; una fotografía genérica no cambia la marca ni las características del producto. Las imágenes referenciales se identifican en la ficha.

La [cobertura y lista de pendientes](cobertura-imagenes.json) refleja la comprobación posterior a la importación. Los pendientes necesitan otra fuente o una nueva tanda de generación.

## Resolución y persistencia

Orden de respaldo: imagen en R2 (miniatura en tarjetas y detalle completo en ficha), imagen externa y, si fallan, recurso local. Las descargas de imágenes van directamente al proveedor. La BD guarda las URL y las asociaciones normalizadas; esta carga dejó 366 asociaciones en `product_media`.

La fuente de un respaldo externo se conserva como `external_url`, sin heredar el registro de generación o los derechos de la imagen IA. Las escrituras actualizan la revisión del catálogo para renovar su caché.

## Repetir una carga

Desde la raíz del repositorio, con Firebase CLI autenticado y R2 configurado:

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node --env-file=functions/.env functions/scripts/import-product-image-batch.mjs --manifest docs/catalogo/imagenes-generadas-tanda-01.json --apply --firebase-cli-auth
CONFIRM_PROJECT_ID=cotizapp-d71c8 node --env-file=functions/.env functions/scripts/import-product-image-batch.mjs --manifest docs/catalogo/imagenes-externas-tanda-02.json --apply --firebase-cli-auth
```

El importador comprueba ID y nombre, verifica archivos y enlaces, conserva imágenes existentes y hace una copia privada de los registros antes de modificarlos. Detecta cambios concurrentes antes de guardar. Las credenciales no se incluyen en los manifiestos ni en Git.

## Validación

- 14 pruebas de interfaz y 24 de backend aprobadas.
- Compilación de interfaz y funciones aprobada.
- Referencias de las 8 imágenes generadas y procedencia de sus respaldos verificadas en PostgreSQL.
- API e interfaz desplegadas en Firebase Hosting y Functions.
