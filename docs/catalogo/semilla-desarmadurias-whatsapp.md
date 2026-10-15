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
