# Despliegue de paneles, catálogo y cotizaciones — 2026-10-23

- Código desplegado: `a57378e3de1fdd63cdd0a273d8c576d495756c42`, subido a `origin/main`.
- Proyecto Firebase: `cotizapp-d71c8`.
- Despliegue: Hosting y función `api` en `southamerica-west1`.
- Revisión activa: `api-00124-dir`; operación completada correctamente.
- Se conservaron la configuración de PostgreSQL y almacenamiento, además de 732 bundles anteriores para mantener compatibles las pestañas abiertas.

## Verificación posterior

En `https://trovio.cl` y `https://cotizapp-d71c8.web.app` se verificaron respuestas 200 y referencias a los bundles nuevos en inicio, buscador, cotizaciones, panel del local, panel admin y repuestos. Los hashes SHA-256 de los archivos principales JS/CSS coinciden con la compilación desplegada.

API: `/api/config` y `/api/catalogo-busqueda` responden 200; `/api/admin/usuarios` y la ruta de inventario de desarme sin sesión responden 401. La función figura ACTIVE con `USE_SQL_DATABASE=true`.

Estas comprobaciones no crearon cuentas, productos ni cotizaciones en producción. Las pruebas funcionales de alta/edición y responsive se ejecutaron previamente con fixtures locales, según `design-qa.md` y `flujo-desarme-y-paneles-2026-10-23.md`.
