# Revisión de estabilidad y uso — 21 de octubre de 2026

Estado: correcciones de código implementadas; validación visual pendiente. No se certifica cobertura total, cumplimiento de accesibilidad ni calidad de premios de diseño.

## Alcance y ciclos

Se revisaron las rutas, navegación compartida, panel administrativo, panel del local, panel del maestro, catálogo, cotizaciones de invitado, diálogo compartido y controles flotantes. Se conserva el sistema visual existente (Manrope, azul marino, naranja, tokens de espacios y superficies).

1. Base: 298 pruebas de frontend aprobadas antes de editar. Revisión adversarial independiente encontró incoherencia de breakpoints, límites de foco, filtros sin comportamiento modal, recorte potencial de diálogos largos y borrado de cotizaciones sin protección.
2. Corrección: breakpoint de administración alineado en 1040 px; comportamiento compartido para menú administrativo y filtros móviles (foco, Escape, Tab, bloqueo/restauración del desplazamiento y cierre por fondo); semántica de navegación y destino actual. Se conserva el filtrado y sus parámetros existentes.
3. Verificación adversarial: se corrigió una regresión que ocultaba el diálogo de soporte al ocultar su host. Se ocultan solo los lanzadores de ayuda/piloto y el banner de cookies mientras un panel modal está abierto, manteniendo sus diálogos hermanos disponibles.
4. Pruebas de interacción: se descubrió que `keydown.tab` no entrega Shift+Tab al manejador Angular sin el modificador explícito. Se escucha `keydown` y el helper filtra Tab, compartiendo el comportamiento entre el menú público/local/maestro, el menú admin y UiModal. Se excluyen campos ocultos, deshabilitados y tabindex negativo.
5. Cotizaciones: maestro e invitado piden confirmación dentro de la aplicación antes de eliminar. Cancelar conserva el contenido. El maestro bloquea doble envío y mantiene un error recuperable cuando falla la API. Después de borrar se enfoca el título de la página.
6. Diálogos: distribución flex con contenido de altura reducible y desplazamiento propio, encabezado conservado y margen para el área segura móvil.

## Estado de los recorridos

| Paso | Recorrido | Estado comprobado |
| --- | --- | --- |
| 1 | Portada, buscador y navegación pública | Pruebas existentes conservadas; límites de teclado del menú reforzados. Render visual pendiente. |
| 2 | Catálogo y filtros móviles | Pruebas integradas de apertura, Shift+Tab, Escape, fondo y transición a escritorio. Render visual pendiente. |
| 3 | Administración | Breakpoint y comportamiento de menú corregidos; estados modal/cerrado y teclado cubiertos. Panel con sesión real pendiente. |
| 4 | Panel del local | Conserva navegación compartida y operaciones existentes; pruebas de catálogo existentes. Panel con sesión real pendiente. |
| 5 | Maestro y cotizaciones | Protección de borrado, cancelación, error y doble envío cubiertos. Panel con sesión real pendiente. |
| 6 | Invitado | Prueba integrada que conserva la cotización al cancelar y elimina solo al confirmar. Render visual pendiente. |
| 7 | Modales y soporte | Límites de teclado compartidos; corrección de estructura de desplazamiento. Altura/stacking renderizados y envío de soporte pendientes. |

## Rendimiento

El archivo abierto en el IDE corresponde a la medición móvil inicial del 18 de octubre (58). El informe posterior `docs/catalogo/rendimiento-mobile-2026-10-18.md` registra mediciones móviles 96 y 99 tras la segunda optimización. Es evidencia histórica, no una medición de esta revisión. Se conservaron prerenderizado, fuentes locales y carga diferida; no se añaden dependencias, imágenes ni solicitudes de red para las correcciones.

## Límite de validación visual

El inventario de Computer Use no expuso navegadores y crear una pestaña `iab` devolvió `Browser is not available: iab`. Se solicitó autorización para usar Playwright directamente, conforme a la habilidad de auditoría de Product Design; no se recibió respuesta durante esta revisión. No se ejecutó Playwright ni se fabricaron capturas. Las imágenes y reportes anteriores no se usan como evidencia visual actual.

Quedan pendientes capturas actuales y ciclos visuales a 360/390/768/1040/1050/1440 px; teclado móvil real; estados con datos largos, vacíos y errores; sesiones de maestro/local/admin; verificación de desbordamiento y superposición; Lighthouse posterior a los cambios. Se requiere evidencia renderizada antes de dar por terminada la petición de pulido visual completo.

Los cambios son locales. No se desplegó ni se modificaron cuentas o datos comerciales.

## Validación final de código

- Suite frontend: 65 archivos, 314 pruebas aprobadas (base: 62 archivos, 298 pruebas).
- Compilación de producción aprobada; nueve rutas prerenderizadas, sin alertas de presupuesto de tamaño.
- Verificación final de cotizaciones: nueve pruebas aprobadas, incluida restauración del foco al título tras eliminar la cotización de invitado (`/tmp/trovio-polish-quotations-20261021.log`).
- `git diff --check` aprobado. Vista de desarrollo local responde HTTP 200 en el puerto 5011.
- Árbitro, última ronda: sin regresiones P1/P2 nuevas identificadas por inspección de código; no certifica la experiencia renderizada.
- Logs: `/tmp/trovio-polish-tests-20261021.log` y `/tmp/trovio-polish-build-20261021.log`.
