# Flujo de entrega

Por instrucción del propietario, todo cambio implementado debe cerrarse con validaciones apropiadas, commit, push a GitHub y despliegue a producción. No detenerse en una propuesta o en cambios locales. Informar el resultado y cualquier bloqueo real sin afirmar que algo se publicó si no se comprobó.

Repositorio: `origin`, rama habitual `main`. Producción: Firebase `cotizapp-d71c8`, sitio `https://trovio.cl`, función `api` en `southamerica-west1`.

Antes de desplegar funciones, conservar la configuración actualmente desplegada (SQL, almacenamiento y demás conexiones) mediante las utilidades de `functions/scripts/lib/server-config.mjs`. No sobrescribirla con valores locales incompletos. Aplicar las nuevas migraciones SQL necesarias usando el registro y verificación de hashes existentes; no modificar migraciones históricas.

No versionar archivos `.env`, credenciales, tokens, accesos locales ni artefactos temporales de pruebas. No crear cotizaciones o cuentas ficticias en producción para verificar un despliegue; usar fixtures locales y comprobaciones de lectura o solicitudes rechazadas.
