# Revisión visual — paneles y carga por vehículo

Fecha: 2026-10-23. Alcance: menú compartido para local/admin, selección rápida y precios de piezas en escritorio y móvil.

## Referencias y evidencia

Referencias elegidas: `output/diseno-desarme/lista-rapida.png`, `precios-escritorio.png` y `precios-mobile.png`. El usuario pidió adaptarlas al header y footer reales de Trovio. No se evalúa una copia literal de las imágenes generadas.

Playwright local contra Angular de desarrollo, sin publicar ni modificar datos de producción. Sesión y API sustituidas con fixtures locales; esto verifica la interfaz y sus interacciones, no la autenticación real. Viewports: 1440×1024 y 390×844, deviceScaleFactor 1. Las referencias generadas se normalizaron a esos tamaños para comparar; el escritorio implementado se recortó al viewport superior. Comparaciones abiertas y revisadas: `output/diseno-desarme/qa/comparacion-escritorio.png` y `comparacion-mobile.png`. Se revisaron además las capturas de selección, menú móvil y administración.

## Hallazgos resueltos

- P2: el widget flotante de ayuda cubría acciones del editor. Se oculta durante la edición por vehículo.
- P2: la cabecera del local y títulos duplicados consumían la primera pantalla móvil. La cabecera del local se omite mientras se edita, conservando la identidad en el menú y el vehículo en el contenido. Se compactó el encabezado del editor.
- P2: formularios expandidos dentro de cada checkbox dificultaban seleccionar rápido. Ahora la selección es una lista independiente y los precios se completan en el tercer paso.
- P2: alturas mínimas heredadas producían paneles vacíos extensos. Se eliminaron del panel del local.

## Superficies revisadas

- Tipografía: Manrope del proyecto, jerarquía consistente, controles de precio legibles y foco visible.
- Espaciado: tabla con filas separadas en escritorio; una columna en móvil, controles táctiles de 44px o más, sin desbordamiento horizontal. Se comprobó que el primer precio móvil queda sobre la barra de acciones.
- Colores: tokens reales de Trovio, texto azul oscuro y acción naranja. Estado activo y foco distinguibles.
- Imágenes: marca real existente. No se inventaron fotos de vehículos ni piezas; las fotos reales son opcionales por publicación. Esta es una diferencia intencional respecto de las miniaturas ilustrativas del mock de escritorio.
- Contenido: unidad fija por pieza, precios CLP con IVA, borrador cuando falta precio y acciones que explican publicación/guardado. Menú por rol y capacidad del local.

## Interacciones comprobadas

Crear vehículo, cambiar de paso, seleccionar piezas, escribir precios, autosave, cerrar y retomar el último paso; menú móvil con Escape; navegación del admin y Atrás al resumen; footer global y ausencia de navbar público duplicado. Cero errores JavaScript en el recorrido. Las pruebas unitarias/backend complementan errores, concurrencia, permisos y stock.

Diferencias aceptadas: header/footer del producto real, navegación lateral completa según rol, tres piezas de prueba en lugar de cinco, estado predeterminado «Usado» y pasos navegables explícitos. En móvil se muestran menos filas simultáneamente que en el mock para conservar navegación, contexto y tamaños táctiles.

Resultado: sin P0/P1/P2 visuales pendientes en el alcance revisado. La ampliación del nomenclátor y la migración de índices de identidad se documentan aparte como evolución de catálogo, no como validación visual.

final result: passed
