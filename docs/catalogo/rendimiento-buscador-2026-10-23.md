# Buscador: carga inicial y rendimiento — 2026-10-23

## Problemas encontrados

La búsqueda esperaba las tres solicitudes de taxonomía antes de pedir la página de productos. Antes y durante esa espera, los encabezados usaban el contador inicial 0, y el mensaje vacío podía aparecer sin que hubiese respuesta del servidor.

La resolución de fichas por slug buscaba en el catálogo calculando `seoProductSlug(producto, todos)` para cada candidato: esa función vuelve a recorrer todos los productos. El mismo patrón se repetía por tarjeta y en las listas de páginas públicas/sitemap.

El índice de sugerencias se normalizaba y volvía a serializar/hashar en cada solicitud. IndexedDB podía retrasar el inicio de su descarga hasta 1,5 segundos.

## Cambios

- Productos y taxonomía se cargan en paralelo. La inicialización comparte una promesa para evitar solicitudes duplicadas y conserva el control de respuestas antiguas por ID.
- Encabezados y filtros muestran «Cargando productos…»; un loader con placeholders mantiene visible la carga. El estado vacío y el contador cero se reservan para una respuesta confirmada. Si llegan antes los productos, se muestran aunque la taxonomía siga pendiente.
- Las URLs se resuelven mediante `productSeoSlugIndex`, una construcción por lote que conserva la desambiguación anterior. Se usa en paginación, ficha, ofertas, páginas públicas y sitemap.
- El índice de sugerencias preparado se reutiliza por identidad del catálogo con `WeakMap`. Revisiones, invalidación y TTL de `getStaticCatalog()` siguen determinando cuándo se reconstruye; no se omite la comprobación de revisiones.
- IndexedDB tiene 40 ms para proporcionar una versión cacheada y evitar una descarga completa innecesaria. Después se inicia la red aunque IndexedDB siga bloqueado. Una lectura tardía no reemplaza un índice más nuevo, y una caché válida tardía limpia un error de red previo.

## Medición

Mediciones de producción anteriores al cambio, desde el entorno de trabajo: página Mahindra (`vista=productos`, 20 resultados), 671–957 ms y 17.506 bytes JSON; índice de sugerencias, 1.875–2.021 ms y 452.305 bytes JSON. Estas cifras incluyen red y no garantizan latencia idéntica en otros dispositivos.

Benchmark local con los 1.126 productos del índice público: localizar la última ficha con el algoritmo anterior tomó 1.241 ms; con índice por lote, 2 ms, devolviendo el mismo ID. Se mide únicamente ese cálculo de CPU, no el tiempo completo de una llamada HTTP.

La compatibilidad del buscador legado de ofertas se conserva: no se reemplaza su respuesta completa por una página, porque existen consumidores de cotizaciones. La latencia de base de datos/red y el arranque de instancias siguen siendo componentes distintos de estas mejoras.

## Verificación

Pruebas de inicialización paralela/deduplicada, carga antes de resultado vacío, respuestas antiguas, caché local bloqueada/tardía, uso de versión local rápida, invalidación del índice y trabajo lineal de nombres. Playwright local con API demorada, viewports 1440×1024 y 390×844: sin falso cero, productos visibles antes que la taxonomía, sin desbordamiento ni errores JavaScript. Capturas en `output/catalogo-carga`.

Cambios locales; sin commit ni despliegue en este turno.

Resultado: 32 pruebas frontend y 33 backend correctas; compilación de producción correcta con 9 rutas prerenderizadas. `git diff --check` correcto. La revisión adversarial verificó la invalidación del índice y detectó el error residual de red tras caché local tardía, corregido y cubierto por regresión.

## Sesiones: dos horas de inactividad

El plazo de cierre por inactividad cambia de 30 a 120 minutos. La interacción renueva el plazo y se comparte entre pestañas del mismo usuario; recargar o renovar el token no reinicia el contador. Los mensajes de login reflejan dos horas. Se comprobó que la sesión permanece activa a los 30 minutos y hasta el último milisegundo anterior a las dos horas, y que expira al alcanzar el límite. Verificación conjunta: 58 pruebas frontend y compilación de producción correctas, además de las 33 pruebas backend de rendimiento anteriores.
