# Inicio del administrador y métricas de visitas

El panel admin abre en **Inicio**. Carga métricas una vez al entrar; **Actualizar métricas** consulta nuevos totales. No hay listeners ni sondeo. Los accesos a las demás secciones se conservan.

- Visitas únicas hoy, últimos 7 y 30 días y tendencia de 14 días, en `America/Santiago`.
- Una IP cuenta una vez por día, aunque recargue o use otra pestaña. Los períodos suman los únicos diarios: no son personas únicas entre días. Redes compartidas y direcciones cambiantes impiden identificar personas con precisión.
- Maestros registrados, ferreterías activas (indicando las demos), productos activos, ofertas publicadas con stock de locales habilitados, cotizaciones guardadas, cotizaciones nuevas hoy y solicitudes de productos pendientes.
- Las cotizaciones locales sin cuenta no están en el servidor. No se inventan visitas anteriores a la implementación. Solo se contabiliza navegación que autoriza analítica opcional.

`POST /analytics/visit` exige consentimiento de analítica versión 3 y usa únicamente la IP resuelta por el proxy confiable de Express; no acepta una IP enviada por el navegador. La normaliza y genera un HMAC por día usando `FINDI_VISIT_ANALYTICS_KEY` en Secret Manager. No almacena IP completa, cuenta, páginas, dispositivo ni geolocalización. El HMAC es un seudónimo temporal, no anonimización irreversible.

La clave diaria y el incremento del agregado se escriben en una sentencia atómica con clave única `(visit_date, visitor_key)`, de modo que reintentos y solicitudes concurrentes no duplican el contador. Los identificadores vencen a medianoche de Chile. La tarea de métricas de ferretería los purga cada dos horas y elimina los totales diarios anteriores a 90 días. La purga no resta visitas del agregado.

El banner solicita una nueva elección cuando encuentra el consentimiento anterior versión 2. Recordar preferencias y medir visitas son autorizaciones separadas. El aviso explica finalidad, Google Cloud, transferencias, datos y conservación. Revocar la analítica detiene nuevos envíos. Los registros técnicos preexistentes de infraestructura tienen su política independiente.

`GET /admin/dashboard` verifica autenticación y rol admin en el servidor y devuelve solo totales, con `Cache-Control: private, no-store`. Nunca devuelve claves diarias. Las tablas nuevas de la migración `014-visit-analytics.sql` tienen RLS y acceso únicamente al backend.
