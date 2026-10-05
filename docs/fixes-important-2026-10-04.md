# Correcciones importantes — 4 de octubre de 2026

Correcciones locales posteriores a la [auditoría inicial](status-app-2026-10-04.md), sobre el commit `8d414a8`. No se desplegó ni se modificaron datos de negocio en producción.

## Corregido

| Hallazgo | Resultado |
|---|---|
| Privacidad de registros vinculados por correo | Exportación y eliminación usan UID. Los registros anónimos vinculados por correo solo se incluyen cuando Firebase acredita que ese mismo correo está verificado. Fallos de Auth se propagan y no generan un comprobante de eliminación exitosa. |
| Eliminación con sesiones antiguas | El backend exige autenticación de los últimos cinco minutos. El centro de privacidad confirma la contraseña y renueva el token antes de eliminar. Incluye acciones para verificar el correo y actualizar su estado. |
| Búsqueda desde inicio | `/buscar?q=...` aplica el texto, reinicia la página y actualiza los resultados al cambiar el parámetro. Se retiró el corte arbitrario de 100 productos. |
| Sucursales homónimas | Selección, optimizador, alternativas de compra, conteos y cotizaciones guardadas usan IDs de sucursal. Se mantienen nombres para presentar los resultados y compatibilidad con selecciones antiguas cuando son inequívocas. Una selección ambigua o desaparecida permanece incompleta y no cambia silenciosamente a otra tienda. |
| Importación de coincidencias aproximadas | Solo un código de barras o nombre exacto e inequívoco vincula un maestro automáticamente. Sugerencias aproximadas se envían a revisión. Se rechazan identificadores ambiguos de ofertas existentes. |
| Identidad y opciones del CSV | Nuevas ofertas y solicitudes conservan SKU, código de barras, stock cero y la elección de publicación. |
| Aprobación de solicitudes | La aprobación crea o reutiliza la oferta en una transacción, registra evidencia de precio y enlaza la solicitud. Aprobar nuevamente no duplica ni sobrescribe una oferta existente. Solicitudes aprobadas antiguas sin oferta pueden repararse mediante la misma operación. |
| Reposición de ofertas retiradas | Se restaura el estado previo de actividad y publicación, incluso cuando la oferta ya estaba desactivada. Para retiros anteriores que no guardaron el estado previo, se mantiene la reposición activa como comportamiento de compatibilidad. |
| Cargas fallidas | Los paneles muestran el fallo y permiten reintentar. Se conservan datos previos durante fallos de actualización y se evitan mensajes de catálogo/cotizaciones vacíos cuando hay un error. El manejo de promesas en getters se registra una sola vez para mantener estable el renderizado. |
| Registro de perfiles | Un registro repetido no puede reemplazar rol, estado ni datos del perfil existente. |
| Actualización parcial de perfil | Se validan coordenadas antes de confirmar el lote de cambios de usuario y ferretería. |
| Borradores privados | El borrador incluye UID en su clave; se elimina el antiguo borrador compartido. Logout y eliminación limpian borradores incluso si Firebase falla. |
| Ficha técnica | Se conservan `0` y `false`; el detalle API entrega etiquetas legibles de atributos. |
| SEO de rutas antiguas | Hosting redirige `/auth` a login. `/producto?product=...` redirige a la ficha conservando los parámetros de selección/cotización; sin producto lleva al buscador. Las rutas antiguas tienen protección noindex. Las vistas previas de fichas usan la imagen del producto. |
| Accesibilidad de inicio | El botón de búsqueda tiene nombre accesible aun cuando su texto se oculta en móvil. Se mejoró el contraste de la franja de beneficios. |

## Validación

- **50 pruebas frontend**, en 15 archivos, aprobadas.
- **31 pruebas backend**, aprobadas. Las nuevas reproducciones usan Firestore/Auth simulados en memoria, sin escrituras externas.
- Compilación TypeScript de frontend y Functions aprobada.
- Compilación Angular de producción aprobada: **nueve rutas prerenderizadas**. Persisten las tres advertencias previas de presupuesto CSS de dashboards; no impiden compilar.
- Se conserva el contrato de las rutas API existentes: orden, método, autenticación y número de middlewares.
- Chrome local sobre la compilación de producción: búsqueda desde inicio, enlaces con `q`, selección de sucursal exacta, rechazo de selección antigua ambigua, error 503 y recuperación mediante reintento.
- Seis rutas revisadas en escritorio y móvil: inicio, búsqueda, ficha, login, registro y recuperación de contraseña. Sin errores JavaScript ni desbordamientos horizontales.
- Git sin archivos sin fusionar ni marcadores de conflicto en el código revisado; `git diff --check` aprobado.

Comandos reproducibles: `npm test -- --watch=false`, `npm --prefix functions test`, `npm run build`, `npx tsc --noEmit -p tsconfig.app.json`. Evidencias locales adicionales: `/tmp/cotizapp-fixes-frontend-test.log`, `/tmp/cotizapp-fixes-functions-test.log`, `/tmp/cotizapp-fixes-build.log` y `/tmp/cotizapp-fixes-browser.json`.

## Pendientes que estas correcciones no sustituyen

- Desplegar frontend, Functions y configuración de Hosting juntos; la producción auditada todavía conserva el comportamiento anterior.
- Incorporar ofertas reales. La auditoría encontró 60 maestros de prueba y cero ofertas públicas; estos cambios no fabrican precios ni convierten registros de prueba en datos comerciales.
- Comprobar en un entorno Firebase controlado el recorrido autenticado completo con maestro, ferretería y administrador, incluidos verificación de correo y autenticación reciente. Las pruebas locales no acreditan configuración real de correos, MFA, respaldos ni permisos del proyecto.
- Alinear identidad legal y datos comerciales con los del operador real.
- Mejorar rendimiento móvil y reducir CSS; no se atribuye una mejora de Lighthouse a esta entrega sin una nueva medición de producción.
- Añadir recuperación/progreso para importaciones que alcancen límites de API, paginación de servidor para catálogos grandes y una política de IDs estables/redirecciones históricas de slugs.
- Alinear HTML inicial de otras rutas privadas, ampliar schema del producto y verificar Search Console e indexación efectiva después del despliegue.

Las pruebas cubren los comportamientos señalados y las regresiones existentes. No equivalen a una garantía del 100% de flujos en producción ni a una certificación de la configuración externa.
