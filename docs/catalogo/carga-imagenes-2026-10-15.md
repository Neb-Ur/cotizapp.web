# Ampliación de imágenes — 15 de octubre de 2026

Se agregan imágenes a 52 fichas que estaban sin imagen: 48 URLs externas y cuatro ilustraciones generadas. No cambia la identidad, fabricante, compatibilidad vehicular, precio ni stock de ningún producto.

## Fotos externas

[Manifiesto de 48 URLs](imagenes-externas-tanda-03.json), con página de origen, título comercial, marca del proveedor, dimensiones y fecha de comprobación. Las referencias se buscaron en el catálogo público de Dimaco y se contrastaron por tipo de producto y sinónimos usados en Chile (por ejemplo, atornillador/destornillador y PTFE/teflón). Se revisó visualmente el conjunto; se descartaron una canaleta y una cámara de inspección cuya foto o aplicación era ambigua.

Incluye herramientas, fittings de cobre/polietileno/PPR, adhesivos, cintas, protección de soldadura, perfiles, mallas, materiales de reparación y otros productos. Las fichas son genéricas y mantienen su fabricante «Por especificar»: la foto comercial ilustra el tipo de producto, no asigna automáticamente la marca, medidas, presentación ni prestaciones del proveedor a la ficha. La API conserva la indicación de imagen referencial y el detalle muestra su aviso existente. Se conserva el enlace al origen, sin declarar autorización o derechos revisados que no se hayan comprobado. Se enlazan las imágenes externas sin copiarlas a R2.

## Imágenes generadas

[Manifiesto, prompts completos y SHA-256](imagenes-generadas-tanda-02.json). Se utilizó la herramienta integrada `image_gen`, una generación independiente por producto, con fondo blanco, objeto completo, luz de estudio y sin marcas, texto, dimensiones ni certificaciones:

- [Arandela plana](imagenes/ia-tanda-02/arandela-plana.webp): disco metálico plano con orificio central.
- [Ángulo de acero](imagenes/ia-tanda-02/angulo-acero.webp): perfil laminado de sección L y textura de acero.
- [Arena fina](imagenes/ia-tanda-02/arena-fina.webp): muestra de arena beige fina sobre fondo blanco.
- [Adoquín de hormigón](imagenes/ia-tanda-02/adoquin-hormigon.webp): bloque rectangular gris con cantos biselados.

Las cuatro se guardan en el repositorio y se publican en R2 mediante el servicio de imágenes existente, que produce detalle y miniatura WebP. Los productos conservan `origenImagen: ai_generated`, `imagenReferencial: true`, proveedor OpenAI y el hash del archivo; el detalle muestra el aviso de imagen generada con IA. No se generan sustitutos para repuestos específicos de marca/modelo.

## Carga y comprobación

Se reutiliza `functions/scripts/import-product-image-batch.mjs`, ahora con identificador de lote opcional validado para distinguir `urls-tanda-03` de `ia-tanda-02`. El importador comprueba identidad, conserva imágenes previas, valida URLs/archivos, guarda respaldo privado y actualiza cada producto con una comprobación transaccional de concurrencia. Las escrituras pasan por el adaptador SQL existente, normalizan los recursos e invalidan el catálogo público. Repetir omite las fichas ya cargadas.

Con Node 22, configuración R2 y autenticación de Firebase disponibles:

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node --env-file=functions/.env functions/scripts/import-product-image-batch.mjs --firebase-cli-auth --apply --manifest docs/catalogo/imagenes-generadas-tanda-02.json
CONFIRM_PROJECT_ID=cotizapp-d71c8 node --env-file=functions/.env functions/scripts/import-product-image-batch.mjs --firebase-cli-auth --apply --manifest docs/catalogo/imagenes-externas-tanda-03.json
```

La carga modifica datos e imágenes; no requiere desplegar Hosting ni API. Se compilaron las funciones y pasaron las siete pruebas de almacenamiento/divulgación de imágenes.

Resultado comprobado en producción: **626 de 1.126 productos con imagen** (antes 574), 500 pendientes, 25 con archivos en R2 y 12 con imagen generada en el catálogo completo. Se conservaron las imágenes de los demás productos, nombres, marcas, compatibilidades y las 4.038 ofertas. Las ocho URL R2 nuevas respondieron como WebP con caché inmutable y tamaños de detalle/miniatura correctos; la API mantiene la divulgación de IA. Segunda ejecución: cero cargas y 52 fichas preservadas. [Resumen de cobertura y verificaciones](cobertura-imagenes-2026-10-15.json).
