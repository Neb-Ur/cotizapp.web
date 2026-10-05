# Limpieza de datos — 4 de octubre de 2026

Ejecutada en Firebase `cotizapp-d71c8` por petición del propietario.

- Se conserva únicamente `rubenbenavidessilva@gmail.com`, con su UID, credenciales y perfil de administrador originales.
- Se eliminaron las otras 25 cuentas de Authentication, después de deshabilitarlas y revocar sus sesiones.
- Se eliminaron los datos de Firestore de ambos entornos: catálogo, taxonomía, ferreterías, ofertas, registros, consentimientos y cachés. También se limpiaron las subcolecciones.
- Se eliminaron las 8 imágenes del bucket `cotizapp-d71c8-catalog-assets`.
- Se retiraron el seed, sus imágenes locales, la documentación de credenciales y la ejecución del seed en GitHub Actions.

La verificación final confirmó una cuenta en Authentication, un documento en Firestore (`usuarios` del administrador) y cero archivos en el bucket. El servicio puede volver a crear documentos de caché vacía cuando recibe tráfico; no son datos de negocio.

No se desplegó código ni se modificó la contraseña del administrador. En la limpieza inicial se conservó la estructura de entornos. La actualización posterior usa únicamente datos reales y elimina el selector administrativo, los avisos y las excepciones de prueba.

El script `functions/scripts/reset-database.mjs` realiza un inventario sin modificar datos por defecto. Para aplicar exige `--apply` y `CONFIRM_PROJECT_ID` igual a `FIREBASE_PROJECT_ID`; además verifica que la cuenta a conservar sea un administrador activo único. La opción `--firebase-cli-auth` utiliza una sesión local vigente de Firebase CLI sin copiar credenciales al repositorio.
