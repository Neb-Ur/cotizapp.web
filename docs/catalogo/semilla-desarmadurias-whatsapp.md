# Desarmadurías de prueba y contacto WhatsApp

Lote `trovio-junkyards-whatsapp-2026-10-14`, definido en [el manifiesto](semilla-desarmadurias-whatsapp.json).

Cuatro locales nuevos: Trovio Oriente, Poniente, Mecánica y Carrocería, todos marcados **(Prueba)**. Cada uno publica 20 ofertas sobre maestros automotrices existentes, con ocho referencias de iluminación compartidas para comparar locales, incluyendo focos/neblineros KUV100. Se agregan 80 ofertas, cuatro locales y cuatro propietarios SQL sintéticos; no se crean cuentas de autenticación, contratos firmados ni nuevos maestros.

Las ofertas heredan los rangos vehiculares del maestro. Precio, stock y condición son simulados; las imágenes pertenecen a la referencia de catálogo y no representan una unidad física disponible. La compatibilidad sigue pendiente de verificación.

El usuario autorizó **+56 9 9103 6780** como contacto público de prueba para estas cuatro desarmadurías y las cuatro anteriores. El número se asigna exclusivamente a estos ocho locales ficticios. No se usa como sustituto de teléfonos faltantes de otros negocios.

El botón de WhatsApp aparece en las tarjetas y fichas de locales, y en cada oferta de la ficha de producto. Abre una pestaña con un borrador; no envía mensajes automáticamente. Desde un producto incluye nombre, local y enlace canónico. Desde el directorio pregunta de forma genérica por disponibilidad. Los locales piloto indican «Este es un mensaje de prueba desde Trovio». El botón queda deshabilitado si no hay teléfono público válido. El contacto usa únicamente `telefonoContactoPublico`, sin recurrir al teléfono privado del propietario; el clic no selecciona la oferta de una cotización.

Preparación:

```sh
node functions/scripts/seed-junkyards-whatsapp.mjs --firebase-cli-auth
```

Aplicación explícita:

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/seed-junkyards-whatsapp.mjs --firebase-cli-auth --apply
```

La escritura se realiza en una transacción serializable, con respaldo privado previo, validación de identidad y rechazo de cambios sobre locales reales o teléfonos públicos distintos. La repetición conserva precios/stock editados y no duplica documentos. Invalida la caché de ofertas; no modifica el esquema SQL.

## Acceso de las cuentas de prueba — 15 de octubre de 2026

Se habilitaron las ocho identidades reservadas de desarmadurías en Firebase Authentication, conservando los UID y sus vínculos existentes con Cloud SQL. Se verificó inicio de sesión con contraseña, sesión de la API, local asociado y disponibilidad del onboarding para cada cuenta.

La herramienta `functions/scripts/enable-junkyard-auth.mjs --firebase-cli-auth` comprueba las ocho identidades de las tres semillas sin escribir. Para habilitar las cuentas se usa `--apply`, `CONFIRM_PROJECT_ID=cotizapp-d71c8` y una contraseña de prueba mediante `PILOT_AUTH_PASSWORD`; `--reset-password` permite restablecerla de forma explícita. La herramienta valida todas las identidades antes de modificar Authentication y no modifica catálogos ni registra aceptaciones legales. Las contraseñas se entregan de forma privada y no se guardan en el repositorio.

Al entrar por primera vez, el usuario debe revisar y aceptar las condiciones del panel. Las direcciones `demo.test` son identidades de prueba, no buzones de correo.

### Correos simplificados

Se simplificaron los correos en Firebase Authentication y en los perfiles SQL, conservando los UID, locales, productos y aceptaciones existentes. La herramienta admite los correos originales de las semillas y los simplificados para poder reanudar una actualización interrumpida, y verifica colisiones en ambos sistemas antes de escribir.

| Desarmaduría | Correo de acceso |
| --- | --- |
| Trovio | `trovio@demo.test` |
| Ruta Norte | `norte@demo.test` |
| Patio Central | `central@demo.test` |
| Garage Sur | `sur@demo.test` |
| Trovio Oriente | `oriente@demo.test` |
| Trovio Poniente | `poniente@demo.test` |
| Trovio Mecánica | `mecanica@demo.test` |
| Trovio Carrocería | `carroceria@demo.test` |

La contraseña compartida de prueba se entregó directamente al usuario y no se incorpora al repositorio.
