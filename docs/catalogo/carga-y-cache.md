# Carga del inicio y caché del catálogo

Actualizado el 9 de octubre de 2026.

El inicio muestra cuatro productos y ocho categorías mediante `/api/catalogo-inicio`. Esta respuesta pequeña no marca como completo el catálogo compartido del navegador: los 856 productos siguen descargándose en segundo plano para los demás flujos. Si ya hay fichas guardadas, se muestran inmediatamente. El estado de las cards usa señales y una rama exclusiva de plantilla; no se mantienen skeletons debajo o encima de los productos.

La copia de fichas y taxonomía del navegador puede conservarse siete días. Las ofertas de una copia validada hace más de un minuto se descartan antes de mostrarla y se vuelven a consultar, incluso si la versión sigue igual. También se filtran ofertas que no comenzaron o ya vencieron. Los cambios se comprueban en segundo plano; no se espera esa comprobación para mostrar las fichas disponibles.

El servidor conserva la publicación hasta que una escritura relevante, un cambio de política o el inicio/vencimiento de una oferta la invalida. Usa una misma hora de referencia para calcular vigencia y próxima transición. La publicación SQL está en un único registro JSON de `public_cache_artifacts`; Firestore conserva su formato por fragmentos. La limpieza preserva la publicación actual y la revisión del catálogo y utiliza una sola eliminación SQL para registros antiguos. La reconstrucción reutiliza las lecturas de productos, tiendas, propietarios y taxonomía al calcular ofertas.

El índice de sugerencias calcula los slugs en un recorrido del catálogo, conservando los sufijos de los productos con nombres repetidos. Las búsquedas paginadas calculan los enlaces solo para los productos de la página.

## Verificación

- 113 pruebas del backend y 13 pruebas del inicio/caché del navegador aprobadas.
- Las pruebas DOM comprueban que las cards y los skeletons no coexisten y que la respuesta pequeña puede mostrarse mientras sigue pendiente el catálogo completo.
- Comprobaciones en producción de producto, navegación SEO, sitemap, canonical, JSON-LD, noindex y 404 aprobadas; se conservaron los 856 productos.
- Antes del cambio, una reconstrucción de catálogo tomó 9,3 segundos. Después, la descarga completa tomó aproximadamente 1,8–1,9 segundos con la caché preparada.
- La respuesta de las cuatro cards del inicio tomó 1,3 segundos al primer acceso de la instancia y 0,5–0,6 segundos en los siguientes. Su cuerpo fue de unos 2 KB, frente a unos 532 KB del catálogo completo.
- La versión publicada permaneció igual después de más de un minuto sin cambios; no se reconstruye por cumplir ese plazo.

Son mediciones puntuales de API. El arranque de una instancia, la red y la carga inicial de JavaScript también influyen en el tiempo visible. La prueba del DOM se realizó en el entorno de tests; no hubo un navegador de automatización disponible para una captura visual en producción.
