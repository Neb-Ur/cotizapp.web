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

## Segunda optimización móvil publicada

Código: `8cc80b5` (incluye `7e4463e`). Se conservó Manrope y sus seis subconjuntos de caracteres; los archivos originales v20 se sirven desde `/assets/fonts/` con su licencia SIL OFL. Se precarga únicamente el subconjunto latino y se aplica caché inmutable a los archivos versionados. Se retiraron la conexión a Google Fonts y la declaración de Space Grotesk, que no tenía usos en el código.

La portada no descarga ahora el índice del buscador oculto del encabezado ni su taxonomía completa. Las categorías se cargan al abrir el menú, con estado de carga y reintento que fuerza una petición nueva después de un error. Al entrar a una página con el buscador del encabezado, este mantiene su índice y sugerencias.

Firebase Auth mantiene el acceso por correo/contraseña y el mismo orden de persistencia local, sesión e IndexedDB. Se retiró el resolver preventivo de popup/redirección, que no se utiliza en los flujos actuales y abría iframes adicionales en móvil. [Fundamento de Firebase para seleccionar dependencias](https://firebase.google.com/docs/auth/web/custom-dependencies).

Se retiró el tema global `indigo-pink.css` de Angular Material: no hay componentes Material activos en los imports ni en las plantillas. Se comprobaron los formularios actuales, basados en controles propios y PrimeNG. No se eliminaron dependencias del proyecto ni se cambiaron las reglas de autenticación del backend.

### Mediciones móviles en trovio.cl

Dos ejecuciones consecutivas de Lighthouse 12.8.2, con perfiles nuevos, sin extensiones y la misma configuración móvil de la medición anterior. Los valores varían con las condiciones de la ejecución; no representan datos de campo.

| Métrica | Antes de esta segunda optimización | Ejecución A | Ejecución B |
| --- | --- | --- | --- |
| Rendimiento | 80 | 96 | 99 |
| Accesibilidad | 100 | 100 | 100 |
| Buenas prácticas | 100 | 100 | 100 |
| SEO | 100 | 100 | 100 |
| FCP | 2,6 s | 1,2 s | 1,3 s |
| LCP | 3,7 s | 1,4 s | 1,5 s |
| TBT | 200 ms | 210 ms | 110 ms |
| CLS | 0,00069 | 0,00009 | 0,00009 |
| Peticiones | 49 | 39 | 39 |
| Transferencia total | 1.087.475 bytes | 441.384 bytes | 442.093 bytes |

El HTML inicial sin comprimir pasó de 226.263 a 161.323 bytes. El paquete inicial de producción pasó de 966,26 a 849,28 kB sin comprimir. Se verificó en producción el tipo `font/woff2`, HTTP 200 y `Cache-Control: public,max-age=31536000,immutable` de la fuente precargada. Los informes finales no registraron peticiones al índice del encabezado en la portada, iframes de Auth ni fuentes externas.

### Comprobaciones de esta segunda entrega

- Compilación de producción: nueve rutas prerenderizadas. 298 pruebas frontend correctas.
- Navegador móvil y escritorio: categorías a demanda, error de conexión simulado y recuperación al reintentar.
- Cuenta de prueba: acceso por correo/contraseña, recarga de sesión y segunda pestaña. Se mantuvieron las preferencias de persistencia.
- Búsqueda por marca/modelo/año, consentimiento persistido, autorización y revocación de analítica, y cotización de invitado con producto.
- Formulario de registro revisado en móvil sin crear cuentas ni aceptar declaraciones legales.

Informes completos: `/tmp/trovio-lighthouse-mobile-phase2-a-20261018.report.html` y `/tmp/trovio-lighthouse-mobile-phase2-b-20261018.report.html`.
