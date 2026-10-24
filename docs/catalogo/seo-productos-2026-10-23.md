# Fragmentos de productos — 23 de octubre de 2026

Search Console informó dos elementos `Product` inválidos en `/productos/tapon-sanitario`, rastreados el 17 de octubre: faltaba `offers`, `review` o `aggregateRating`. El HTML público revisado el 23 de octubre todavía contenía un `Product` sin esos campos; en esa respuesta inicial se encontró un solo script JSON-LD.

La corrección se aplica al HTML de Functions y al servicio SEO de Angular. Se emite `Product` únicamente con ofertas reales de precio positivo y finito y stock positivo y finito. Las fichas sin esas ofertas y las de prueba usan `WebPage` con sus migas de navegación. Las fichas reales sin ofertas siguen siendo indexables como contenido informativo; no son candidatas a un fragmento de producto mientras carezcan de datos elegibles. No se agregan precios ni reseñas ficticias.

Ambas capas usan la misma identidad canónica `#product` para un producto elegible. Angular elimina todos los scripts con el identificador propio antes de publicar el nuevo marcado, incluidas posibles copias duplicadas. También se reemplazó el mensaje de carga permanente en el HTML sin ofertas por una explicación de disponibilidad.

Los tres archivos PrimeIcons señalados en la captura responden actualmente HTTP 200; ese error histórico de fuentes es independiente del campo obligatorio ausente.

Validación local: 13 pruebas backend y 9 pruebas frontend correctas, incluidas fichas sin ofertas reales, productos de prueba, ofertas válidas, actualización de disponibilidad y sustitución del marcado del servidor. No se ha publicado este cambio ni se ha realizado una validación de Google contra la versión modificada.

Después de publicar frontend y Functions, probar la URL publicada en Search Console o en la prueba de resultados enriquecidos. Si no tiene ofertas, se espera que no aparezca un elemento `Product` inválido; cuando tenga ofertas reales podrá emitir `Product`. Después solicitar una nueva revisión del informe; los datos del rastreo anterior no cambian inmediatamente.

Referencia: [requisitos de fragmentos de producto de Google](https://developers.google.com/search/docs/appearance/structured-data/product-snippet).
