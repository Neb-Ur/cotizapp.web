# Piloto de Trovio con ferreterías ficticias

Activado el 9 de octubre de 2026 en `cotizapp-d71c8`, con PostgreSQL como BD activa.

## Datos para probar

| Ferretería ficticia | Productos | Casos sin stock |
| --- | ---: | ---: |
| Trovio Norte (Prueba) | 856 | 41 |
| Trovio Sur (Prueba) | 856 | 47 |
| Trovio Centro (Prueba) | 856 | 36 |
| Trovio Construcción (Prueba) | 856 | 35 |

Total: 3.424 ofertas. Cada producto tiene cuatro precios diferentes, con IVA incluido. Los valores y el stock son simulados y deterministas, sin pretensión de representar precios comerciales reales. No se añadieron direcciones, coordenadas, RUT ni teléfonos reales. Los cuatro perfiles propietarios son sintéticos y ahora tienen cuentas de acceso en Firebase Authentication, vinculadas mediante los mismos IDs `pilot-owner-1` a `pilot-owner-4`. Cada cuenta administra únicamente su ferretería demo.

Las tiendas y sus ofertas se identifican con `esPrueba: true` y `lotePrueba: findi-pilot-2026-10`. Los nombres visibles llevan `(Prueba)`. Sus condiciones indican que no existe venta ni retiro. El banner público advierte que son ficticias y ofrece un enlace a Contacto para recibir feedback.

No se inventaron firmas ni aceptaciones de contratos para estas entidades. Su publicación requiere expresamente `PILOT_STORES_ENABLED=true`; las ferreterías reales conservan sus requisitos de cuenta y contrato vigente.

La prueba de búsqueda por cercanía no aplica a estas ferreterías, pues no tienen una ubicación real. Para probar las cotizaciones utiliza «Todas las ferreterías».

## Acceso de las ferreterías demo

| Ferretería | Correo de acceso |
| --- | --- |
| Trovio Norte (Prueba) | pilot-1@example.invalid |
| Trovio Sur (Prueba) | pilot-2@example.invalid |
| Trovio Centro (Prueba) | pilot-3@example.invalid |
| Trovio Construcción (Prueba) | pilot-4@example.invalid |

Los correos `.invalid` son identidades de prueba sin buzón; no reciben recuperación de contraseña. La contraseña se entrega por separado y no se guarda en este repositorio. Las cuentas sintéticas se crean con correo marcado como verificado para permitir el acceso de prueba. No se registran aceptaciones de condiciones ni contratos automáticamente: el primer ingreso presenta el flujo de aceptación vigente.

Para habilitar los accesos, proporciona `PILOT_AUTH_PASSWORD` en el entorno y ejecuta:

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/enable-pilot-store-auth.mjs --apply --firebase-cli-auth
```

El script valida que las cuatro identidades pertenecen al lote sintético antes de crear cuentas. Repetirlo conserva las contraseñas existentes. Usa `--reset-password` explícitamente junto a la variable para restablecerlas. No altera las tiendas, ofertas ni cotizaciones existentes.

## Cotizaciones para maestros

- Creación y edición con nombre, descripción opcional de hasta 2.000 caracteres y dirección de obra.
- Descripción persistida en la BD y conservada al volver, cambiar la estrategia de compra o añadir artículos.
- Comparación entre tiendas y compra combinada, con cantidades y disponibilidad.
- PDF con nombre, descripción, detalle, totales, IVA y advertencia explícita de prueba. La advertencia también aparece en el pie de cada página.
- Compartir mediante el menú nativo cuando el dispositivo admite archivos.
- Preparar envío a un número de WhatsApp: descarga el PDF y abre un mensaje prellenado. La persona debe adjuntar el PDF y enviar el mensaje en WhatsApp. El enlace no adjunta archivos automáticamente.

Se mantiene el límite actual de dos cotizaciones guardadas por maestro. Cada participante usa su propia cuenta; las cotizaciones no son públicas. El número destinatario solo se usa localmente para abrir WhatsApp y no se guarda en la BD.

## Cargar o completar la tanda

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/seed-pilot-stores.mjs --apply --firebase-cli-auth
```

El script valida el proyecto, hace una copia privada previa y reserva los IDs del piloto. Las ofertas se insertan por lote en PostgreSQL y renuevan la revisión del catálogo. Repetirlo no sobrescribe ofertas existentes ni reactiva registros desactivados.

## Terminar el piloto antes del lanzamiento

1. Deshabilitar los accesos demo y revocar sus sesiones:

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/enable-pilot-store-auth.mjs --disable --apply --firebase-cli-auth
```

2. Desactivar únicamente los registros del lote, conservando el catálogo maestro y las cotizaciones:

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/seed-pilot-stores.mjs --deactivate --apply --firebase-cli-auth
```

3. Cambiar `PILOT_STORES_ENABLED=false` en `functions/.env` y desplegar la API:

```sh
firebase deploy --only functions:api --project cotizapp-d71c8
```

La desactivación pone las cuatro tiendas y propietarios inactivos y sus ofertas no publicadas, invalida el catálogo y excluye sus precios de la búsqueda y de nuevas comparaciones. La variable también impide publicarlas si se mantuviera algún registro activo por error. El banner se oculta cuando la API devuelve la variable desactivada.

Las cotizaciones conservan sus artículos y los precios guardados con un plazo informativo de compra de 10 días, identificados como prueba. Al renovar una cotización después de retirar el piloto, se consultan únicamente las ofertas reales disponibles. Si no existen ofertas reales, se informa como incompleta y no se permite exportar un total inventado. Las imágenes y productos base reales continúan visibles. Los productos maestros marcados `esPrueba: true` se excluyen del catálogo público cuando la variable está desactivada.

## Verificación

Se verificaron en producción las cuatro tiendas, 3.424 ofertas, 856 productos y precios distintos para cada producto. Se probó una cotización de tres productos, su total y el PDF generado. Se revisó la interfaz en escritorio y móvil, y se cubrieron por pruebas la desactivación, la descripción persistida, el mensaje de WhatsApp y la advertencia en el PDF.


## Clasificación desde administración — 16 de octubre de 2026

Al crear un local, el administrador elige «Local de prueba»: por defecto «No, es un local real». Puede cambiarlo después desde «Editar local». El valor booleano `esPrueba` se guarda en el local y aparece como «De prueba» en su listado administrativo. El propietario no puede asignarse esta clasificación desde su perfil.

- `PILOT_STORES_ENABLED=true`: incluye locales reales y locales de prueba; se mantienen los requisitos de estado activo y de cuenta. Los locales reales conservan la exigencia de contrato vigente.
- `PILOT_STORES_ENABLED=false`: excluye locales de prueba, sus ofertas y fotos del directorio y de las búsquedas públicas, incluso si tienen un contrato vigente. Excluye además los productos maestros y ofertas semilla marcados individualmente `esPrueba: true`.
- El filtro también se aplica a autocompletado, portada, fichas públicas, páginas SEO y sitemap. Los contadores de ofertas públicas usan la misma exclusión.
- La administración conserva todos los registros para poder editarlos. No se borran locales, productos ni cotizaciones históricas.

La variable es configuración del servidor: cambiarla requiere desplegar la API. La caché pública cambia de política y la caché estática se separa por valor de la variable. Los archivos ya almacenados en el CDN de imágenes no se convierten en privados; lo que se retira es su inclusión en las galerías y ofertas públicas.
