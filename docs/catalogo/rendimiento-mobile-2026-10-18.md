# Estabilidad de carga y accesibilidad — 18 de octubre de 2026

## Cambios publicados

La portada prerenderizada se ocultaba durante la primera navegación del cliente. Al retirarse y reconstruirse el contenido, el pie de página subía y bajaba, generando saltos importantes. Se agregó una señal de renderizado mediante TransferState para conservar el DOM público ya entregado por el servidor. Las entradas CSR y las rutas con guardas conservan su pantalla de carga y manejo de errores.

El aviso de privacidad se entrega ahora en el HTML inicial. Angular restaura después la decisión guardada en el navegador; la analítica continúa desactivada hasta contar con consentimiento. Se mantienen configurar, aceptar opcionales, rechazar opcionales, cambiar la decisión desde el footer y funcionar cuando el almacenamiento está bloqueado. La reproducción de eventos de hidratación permanece activada.

Se mejoró el contraste del texto secundario del footer, la correspondencia entre etiquetas visibles y nombres accesibles del logo y del enlace de acceso por WhatsApp, y la prioridad de la primera imagen destacada. Las restantes imágenes conservan carga diferida y sus alternativas cuando falla una URL.

## Mediciones de producción

Lighthouse 12.8.2, Chrome aislado sin extensiones, perfiles estándar de escritorio y móvil. Mediciones de laboratorio individuales, sujetas a variaciones de red y equipo; no son datos de campo ni garantizan una puntuación fija.

| Métrica | Móvil anterior | Móvil publicado | Escritorio anterior | Escritorio publicado |
| --- | --- | --- | --- | --- |
| Rendimiento | 58 | 80 | 97 | 99 |
| Accesibilidad | 96 | 100 | 96 | 100 |
| Buenas prácticas | 100 | 100 | 100 | 100 |
| SEO | 100 | 100 | 100 | 100 |
| CLS | 1,437 | 0,00069 | 0,007 | 0,011 |
| LCP | 3,9 s | 3,7 s | 1,1 s | 0,7 s |
| FCP | 1,2 s | 2,6 s | 0,7 s | 0,3 s |

La mejora principal es eliminar los saltos de contenido y corregir las observaciones de accesibilidad. El FCP móvil fue mayor en esta ejecución; no todos los tiempos mejoraron. El rendimiento móvil sigue en rango intermedio y el aviso de privacidad continúa siendo el elemento LCP. Cualquier siguiente optimización debe contrastarse con varias mediciones y datos de campo; no corresponde afirmar 100 en rendimiento ni Core Web Vitals aprobados con esta muestra.

## Comprobaciones funcionales

- Compilación de producción: nueve rutas prerenderizadas.
- 296 pruebas frontend correctas, incluyendo preservación de SSR, carga inicial con guardas y decisiones de privacidad con almacenamiento bloqueado.
- Playwright en producción, 390×844 y 1440×960: búsqueda de radiador por Mahindra KUV100 y año 2018, navegación a resultados, ausencia de desbordamiento horizontal y errores JavaScript.
- Consentimiento persistido después de recargar, configuración desde el footer, autorización y revocación de analítica. En esta prueba se interceptó el endpoint analítico para comprobar las llamadas sin generar visitas artificiales en las estadísticas.
- Cotización de invitado: abrir ficha, crear cotización local, seleccionar oferta disponible, agregar el producto y abrir el detalle de la cotización. Se utilizó un navegador aislado; la cotización quedó únicamente en ese contexto de prueba.

No se modificaron los endpoints de productos, inventario, autenticación ni las reglas comerciales.

Informes HTML de esta revisión: `/tmp/trovio-lighthouse-mobile-fixed-20261018.report.html` y `/tmp/trovio-lighthouse-desktop-fixed-20261018.report.html`. Los archivos temporales no se versionan. Código publicado: `0082cac`; las revisiones siguientes de código mantienen ese mismo contenido tras descartar una prueba de tipografía.
