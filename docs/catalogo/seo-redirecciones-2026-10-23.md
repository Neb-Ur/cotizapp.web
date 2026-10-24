# Redirecciones e indexación — 23 de octubre de 2026

Search Console muestra «Página con redirección» con último rastreo del 17 de octubre. La captura declara `https://trovio.cl/` como canónica y permite rastreo e indexación, pero no muestra la URL inspeccionada. No se puede atribuir esa exclusión concreta a una ruta sin conocerla.

La revisión pública confirmó que HTTP y www redirigen a HTTPS sin www. La portada HTTPS devuelve 200. Esas redirecciones de dominio son esperadas. La antigua categoría automotriz redirige a `/repuestos` y está excluida del sitemap.

Se encontró una inconsistencia adicional: ocho URLs publicadas en el sitemap y sus canónicas no llevan barra final, pero Hosting respondía 301 hacia la variante con barra: `/buscar`, `/maestros`, `/ferreterias`, `/contacto`, `/preguntas-frecuentes`, `/terminos-condiciones`, `/privacidad` y `/propiedad-intelectual`. Firebase usa ese comportamiento por defecto para carpetas prerenderizadas con `index.html`.

Se configuró `hosting.trailingSlash: false` para servir directamente la variante canónica sin barra. La prueba de producción ahora usa el dominio canónico, evita seguir redirecciones automáticamente y comprueba las ocho páginas y sus canónicas.

Validación local: 12 pruebas de scripts correctas. Con Firebase Hosting Emulator y los archivos compilados, las ocho páginas responden 200 sin redirección y con la canónica esperada; sus variantes con barra responden 301 conservando los parámetros de consulta. Esto no verifica todavía el cambio en producción.

Después de publicar Hosting: comprobar las ocho rutas con redirecciones desactivadas, enviar `https://trovio.cl/sitemap.xml` en Search Console e inspeccionar la URL final correspondiente al ejemplo afectado. Solicitar indexación de la canónica si procede. No es necesario eliminar redirecciones esperadas de HTTP, www o URLs antiguas para que sus destinos puedan indexarse. La indexación depende de Google y no cambia instantáneamente al modificar el hosting.

Referencias: [informe de indexación de Google](https://support.google.com/webmasters/answer/7440203#page_with_redirect), [configuración de barras finales en Firebase](https://firebase.google.com/docs/hosting/full-config#trailingslash).
