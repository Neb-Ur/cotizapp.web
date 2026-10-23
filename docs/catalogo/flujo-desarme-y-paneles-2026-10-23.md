# Vehículos de desarme y paneles de operación

## Decisión de producto

El local registra un vehículo de origen, selecciona piezas y completa precios. Una pieza del vehículo equivale a una unidad. Guardar no publica: solo el botón de publicación crea ofertas con precio y estado completos. El resto se conserva como borrador. La experiencia utiliza tres pasos navegables: Vehículo → Piezas → Precios. El último paso se conserva en `pasoActual`.

Locales y administración comparten estructura de navegación: header con marca, Ir a inicio y Salir; menú lateral en escritorio y drawer accesible en móvil. El footer global permanece fuera del área de trabajo. El público conserva su navegación de búsqueda. Los enlaces del panel mantienen sección y acción en la URL, incluido Atrás/Adelante.

## Identidad y catálogo

Separar tres entidades existentes evita mezclar precios locales con la ficha técnica:

1. **Tipo de pieza**: nombre y sistema del nomenclátor (`donorTemplate`, IDs estables). Ejemplo: foco delantero izquierdo. No se debe generar la combinación de todos los autos y piezas de antemano.
2. **Producto maestro/variante**: pieza, familia, marca/modelo por ID, rango de años y variante técnica. El nombre se deriva de esos campos: `Radiador Hyundai Accent 2015 · 1.6`. La función `automotiveProductName` mantiene una sola convención. `automotiveIdentity` compara identidad técnica para reutilizar maestros; precio, local, patente y VIN no participan de esa identidad.
3. **Oferta de una pieza física**: referencia al maestro, local, `vehiculoDonanteId`, `piezaDonanteId`, precio, condición, fotos y stock 0/1. Dos autos idénticos pueden tener ofertas independientes del mismo maestro. Los IDs de oferta por vehículo+pieza hacen seguro reintentar publicaciones.

El vehículo conserva marca/modelo/año y motor en campos propios. El nombre visible no reemplaza las referencias. Patente y VIN permanecen privados. Tras publicar, el motor no se puede cambiar dejando las ofertas anteriores con otra identidad. Una ficha con nombre de pieza explícito o variante diferente se rechaza al vincularla. El vehículo de origen no demuestra compatibilidad universal con otros años/motores: nuevas fichas conservan su revisión pendiente.

El nomenclátor debe mantenerse curado por administración y ampliarse por sistema y posición, con alias de búsqueda para nombres locales (ej. motor de arranque/motor de partida). La excepción «No encuentro una pieza» conserva el flujo de propuesta publicada y revisión posterior. La lista actual es una plantilla inicial; no se declara exhaustiva de todas las piezas de todos los vehículos.

## Guardado y recuperación

Después del primer guardado válido, las ediciones se guardan tras una pausa de 800 ms. La UI muestra cambios pendientes, guardando, guardado o error con reintento. No se usa la pantalla global de bloqueo para ese guardado de fondo. Las solicitudes se serializan con `revision` del servidor; si el usuario escribe durante una solicitud, se conserva su edición y se envía otra revisión. Cambiar paso, salir del editor, navegar a otra sección o abrir una publicación espera el guardado. Un error mantiene el editor y los datos en pantalla. Cerrar/recargar la pestaña con cambios pendientes activa la advertencia del navegador.

Los precios se ingresan como CLP; escritorio permite Tab y Enter, móvil usa teclado numérico. Fotos y elección manual de ficha se despliegan por pieza. Las piezas publicadas se administran en su oferta individual. El servidor y la prevalidación del Excel rechazan stock superior a una unidad para ofertas de desarme.

## Evolución de escala

Antes de ampliar significativamente el catálogo, migrar las búsquedas por identidad a un campo/índice persistido derivado de `automotiveIdentity`, con backfill de maestros existentes y manejo de colisiones revisado. La resolución actual de propuestas conserva la búsqueda transaccional de maestros y taxonomía para no introducir duplicados durante una migración incompleta; no se sustituye por una caché no transaccional. También conviene versionar el nomenclátor en base de datos con IDs independientes del nombre, alias y familias administrables. Esto permite renombrar piezas sin cambiar IDs ni romper los borradores previos. Estas dos migraciones quedan fuera de este cambio de interfaz.

## Verificación

Pruebas automatizadas de navegación por rol/acción, selección filtrada, formato CLP, revisiones concurrentes, salida con error y reanudación. Pruebas backend de stock unitario, motor bloqueado y aislamiento de maestros simulados. Revisión Playwright local con datos de prueba, sin crear publicaciones en producción. Capturas en `output/diseno-desarme/qa`.

Desplegado el 2026-10-23 con el commit `a57378e`. Ver [registro de despliegue](despliegue-paneles-y-catalogo-2026-10-23.md).

Resultado de comprobaciones: suite completa frontend 329 pruebas y backend 255 pruebas correctas; después de los últimos ajustes, 40 regresiones frontend y 16 backend correctas. Compilación de producción correcta con 9 rutas prerenderizadas. Recorrido Playwright: alta, selección, autosave, reanudación, precio móvil visible sobre las acciones, drawer con Escape, navegación admin y Atrás, sin errores JavaScript. Reporte visual: `design-qa.md` (passed). La recuperación ante un conflicto de revisión exige una acción explícita para reemplazar los cambios locales por la versión guardada; no los descarta silenciosamente.
