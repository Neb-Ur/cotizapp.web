# Despliegue de rendimiento y sesiones — 2026-10-23

- Código: `743fe3f11c109edbe10573a2d6b513b12f0d0e7a`, subido a `origin/main`.
- Firebase: `cotizapp-d71c8`, Hosting y función `api` en `southamerica-west1`.
- Revisión activa: `api-00125-feq`, actualización `2026-10-23T20:06:10.996458403Z`.
- Configuración de SQL y almacenamiento preservada desde la función desplegada, sin modificar el `.env` local.

## Cambios publicados

La sesión cierra tras dos horas sin actividad; la interacción renueva el plazo compartido entre pestañas. Recargar o renovar el token no reinicia el plazo. El login muestra la nueva política.

El buscador muestra carga y esqueletos antes de recibir productos, sin presentar un falso cero. Productos y taxonomía se solicitan en paralelo. Se optimizan la resolución de nombres y el índice de sugerencias.

## Verificación

- 58 pruebas frontend y 33 pruebas backend enfocadas correctas; compilación de producción correcta.
- Playwright local: carga demorada en escritorio y móvil, sin falso cero ni desbordamiento.
- Producción: seis rutas responden 200 en `trovio.cl` y `cotizapp-d71c8.web.app`; hashes SHA256 de bundles coinciden con el artefacto publicado.
- API pública de configuración e índice: 200. Rutas protegidas de usuarios y vehículos: 401 sin sesión.
- Función `ACTIVE` con SQL habilitado.
- Playwright en producción confirma el texto de cierre tras dos horas sin actividad. El límite temporal se comprobó con temporizadores controlados en las pruebas, sin esperar dos horas reales.
