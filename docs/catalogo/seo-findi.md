# SEO de Findi

El catálogo base se indexa aunque todavía no tenga ofertas de ferreterías. El sitemap incluye productos activos y páginas no vacías de categorías, familias y marcas; excluye fichas inactivas y marcas genéricas. No se inventan fechas de modificación, precios ni valoraciones.

Las rutas `/categorias/:slug`, `/familias/:slug` y `/marcas/:slug` entregan HTML inicial con título, descripción, canonical, productos enlazados y datos estructurados CollectionPage/ItemList/BreadcrumbList. Al cargar JavaScript reutilizan el catálogo, filtros, tarjetas y cotizaciones existentes. Las fichas públicas entregan Product y BreadcrumbList; AggregateOffer solo se publica cuando hay ofertas reales en el catálogo público.

Los enlaces del inicio, menú, sugerencias y fichas permiten descubrir estas páginas. El buscador libre y los filtros adicionales conservan `/buscar`; no se crean páginas indexables por cada combinación arbitraria. Las URLs canónicas no incluyen parámetros de sesión, cotización ni filtros.

Las páginas privadas y de autenticación mantienen noindex. Las rutas inexistentes responden HTTP 404. Los datos SEO públicos se generan con el catálogo cacheado y se revalidan con las mismas revisiones de las modificaciones administrativas.

## Operación pendiente fuera del código

Verificar la propiedad del dominio en Google Search Console y enviar `https://cotizapp-d71c8.web.app/sitemap.xml`. Revisar cobertura de indexación, consultas y Core Web Vitals con datos reales. Si se adopta un dominio propio, actualizar SITE_URL en frontend/backend/index/robots y redirigir permanentemente el dominio anterior. No hay credenciales de Search Console configuradas en este proyecto; no se ha enviado el sitemap desde esta implementación.

Agregar descripciones técnicas originales y comprobables desde el admin, y fotos con derechos de uso cuando estén disponibles. El marcado Product sin ofertas ni reseñas puede ser indexado como contenido, pero no reúne por sí solo todos los requisitos de un resultado enriquecido con precio. No se prometen posiciones ni plazos de indexación.

## Productos con el mismo nombre

Si dos fichas activas generan el mismo slug, una conserva la URL original y las otras reciben un sufijo estable derivado de su ID. El orden no depende del orden de lectura de Firestore. Sitemap, páginas de familia, índice de sugerencias, tarjetas, canonical, ficha cacheada y carga de ofertas utilizan esa identidad para separar, por ejemplo, conectores eléctricos y de riego. Los enlaces originales siguen funcionando.
