# SEO de trovio.cl — 17 de octubre de 2026

## Diagnóstico y cambios

La portada pública devolvía HTTP 200, pero su canonical, datos estructurados, metadatos sociales y sitemap apuntaban a `cotizapp-d71c8.web.app`. El HTML descargado medía aproximadamente 6,8 MB; 6,6 millones de caracteres correspondían al estado de hidratación, principalmente al catálogo completo. Se reemplazó esa descarga en el inicio por `/api/catalogo-inicio`, que entrega cuatro tarjetas y las categorías destacadas. El resto del catálogo se consulta cuando el flujo lo necesita. Se conserva el contenido inicial prerenderizado y los enlaces rastreables.

Se actualizaron dominio canónico, robots, sitemap, URLs de datos estructurados, enlaces compartidos por WhatsApp, enlaces de correo y API usada durante el prerenderizado. Título y descripción de la portada ahora mencionan repuestos, herramientas, materiales y Chile. Se mantienen las páginas HTML de categorías, familias, marcas y productos; no se publica una URL indexable por cada filtro arbitrario.

Los productos explícitamente marcados `esPrueba` quedan fuera del sitemap y responden `noindex`; las colecciones formadas únicamente por esos productos tampoco se indexan. El marcado AggregateOffer excluye locales de prueba, precios no positivos y stock no disponible, tanto en HTML como después de ejecutar JavaScript. El catálogo maestro sin ofertas puede seguir apareciendo como ficha informativa. Las imágenes referenciales y compatibilidades semilla requieren revisión editorial antes de competir como fichas técnicas verificadas. No basta con quitar la bandera de prueba para convertir información ficticia en información real.

No se agregó `meta keywords`: Google no la utiliza para posicionamiento. Las palabras clave deben estar presentes naturalmente en el contenido útil, título, encabezado, enlaces y descripción de la ficha.

## Palabras clave prioritarias

Estas son hipótesis de intención de búsqueda, sin volúmenes ni posiciones medidos. Se deben validar con consultas e impresiones de Search Console después del lanzamiento.

| Prioridad | Intención | Ejemplos | Página adecuada |
| --- | --- | --- | --- |
| Alta | Pieza y vehículo concreto | radiador Mahindra KUV100; foco delantero izquierdo Mahindra KUV100; neblinero Mahindra KUV100; alternador Hyundai Accent | Ficha de producto con variante y compatibilidad verificadas |
| Alta | Pieza, vehículo y año | radiador Mahindra KUV100 2018; foco Mahindra KUV100 2017 | Ficha cuyo rango registrado incluya realmente el año |
| Alta | Herramienta y marca/modelo | taladro Makita; esmeril angular Bosch; alicate Stanley | Marca, familia y ficha técnica del modelo disponible |
| Media | Material y especificación | cemento 25 kg precio; tablero OSB 11 mm; silicona poliuretano 600 ml | Familia o ficha con medida, formato y marca correctos |
| Media | Comparación | comparar precios de herramientas en Chile; cotizar materiales de construcción | Portada, categorías y contenido de ayuda |
| Media | Oferta usada | repuestos usados Mahindra KUV100; desarmaduría con repuestos Hyundai Accent | Catálogo automotriz y ofertas reales que indiquen estado |
| Condicional | Cercanía | desarmadurías en [comuna]; ferreterías en [comuna] | Solo cuando existan locales reales y cobertura suficiente |
| Marca propia | Navegación | Trovio; Trovio repuestos; Trovio cotizaciones | Inicio y páginas institucionales |

No crear páginas para cada año, comuna o combinación si solo repiten contenido o no tienen inventario útil. “Productos” es demasiado amplio como foco comercial. “Ferretería” y “desarmaduría” describen los negocios; el producto necesita describir la pieza que el comprador busca.

## Pauta editorial

Repuesto: `Pieza + lado/variante + marca vehículo + modelo + rango de años verificado`. Ejemplo de formato, sujeto a validación: `Foco delantero izquierdo Mahindra KUV100 [desde]–[hasta]`.

Herramienta: `Tipo + fabricante + modelo + especificación`. Material: `Tipo + marca + medida/formato`.

Cada ficha debería aportar descripción propia, código OEM o referencia cuando se conozca, medidas, posición/lado, motor o versión aplicable, rango comprobado, limitaciones de compatibilidad y fotografías pertinentes con texto alternativo descriptivo. Las publicaciones de cada local agregan su estado, fotos reales, stock y condiciones. El vehículo donante no demuestra por sí solo la compatibilidad de instalación.

Como próxima ampliación editorial, conviene una página útil por vehículo con suficiente catálogo, empezando por Mahindra KUV100, con familias de piezas, compatibilidades y enlaces a fichas. Esa ampliación no está incluida en este cambio.

## Search Console: siguiente paso del propietario

El propietario indicó que todavía no tiene Search Console configurado.

1. Abrir https://search.google.com/search-console y agregar una propiedad de tipo **Dominio**: `trovio.cl`.
2. Copiar el TXT de verificación que Google genere y agregarlo al proveedor DNS del dominio. No borrar los registros existentes de Firebase ni de correo.
3. Completar la verificación; después enviar `https://trovio.cl/sitemap.xml` en **Sitemaps**.
4. Inspeccionar la portada, una categoría y varias fichas reales: comprobar el canonical elegido, probar la URL publicada y solicitar indexación para una pequeña selección representativa.
5. Revisar semanalmente páginas indexadas, exclusiones, consultas, impresiones, clics y Core Web Vitals. Medir rendimiento móvil con PageSpeed Insights. Las métricas de campo requieren tráfico suficiente; no se asigna una puntuación inventada.

La consulta de red inicial encontró HTTPS operativo y redirección HTTP → HTTPS. `www.trovio.cl` no resolvía en ese momento. Configurar ese subdominio en Firebase/DNS con redirección a `https://trovio.cl` si se quiere aceptar la variante www. El antiguo dominio Firebase sigue sirviendo la aplicación: los canonical apuntan al nuevo dominio, pero la redirección permanente de todo el host antiguo requiere una estrategia de hosting que distinga dominios; no agregar una redirección global a la misma configuración porque también afectaría al dominio nuevo. Revisar esto antes de declarar finalizada una migración completa de dominio.

## Referencias

- [JavaScript y renderizado para Google](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Canonical y duplicados](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Migración de dominio](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- [Product para sitios comparadores](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)
- [Metaetiquetas admitidas: Google ignora meta keywords](https://developers.google.com/search/docs/crawling-indexing/special-tags)

La indexación y las primeras posiciones no se garantizan mediante cambios técnicos. También dependen de contenido útil, inventario real, competencia y señales externas. La mejora del peso HTML no equivale a una medición de Core Web Vitals.

## Verificación de esta entrega

Publicado en trovio.cl el 17 de octubre de 2026. HTML de portada sin comprimir: **6.858.021 → 224.159 bytes**, reducción aproximada de **97 %**, conservando cuatro tarjetas iniciales. Sitemap publicado: **992 URLs**, todas con el dominio nuevo. Se verificaron canonical, HTML y JSON-LD de una categoría y una ficha, respuesta 404 para un producto inexistente y CORS del dominio propio.

Playwright en producción: móvil 390×844 y escritorio 1440×960, cuatro tarjetas, filtro de repuestos y apertura de sugerencias, sin desbordamiento horizontal ni errores JavaScript; la portada no solicitó el catálogo completo. Compilación con nueve rutas prerenderizadas. Pruebas: **289 frontend y 235 backend**, correctas.

Esto no representa una puntuación de PageSpeed ni una auditoría de todos los Core Web Vitals. La verificación DNS, Search Console y la redirección completa del dominio antiguo siguen pendientes según las instrucciones anteriores.
