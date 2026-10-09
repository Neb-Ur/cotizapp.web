# Piloto de Findi con ferreterías ficticias

Activado el 9 de octubre de 2026 en `cotizapp-d71c8`, con PostgreSQL como BD activa.

## Datos para probar

| Ferretería ficticia | Productos | Casos sin stock |
| --- | ---: | ---: |
| Findi Norte (Prueba) | 856 | 41 |
| Findi Sur (Prueba) | 856 | 47 |
| Findi Centro (Prueba) | 856 | 36 |
| Findi Construcción (Prueba) | 856 | 35 |

Total: 3.424 ofertas. Cada producto tiene cuatro precios diferentes, con IVA incluido. Los valores y el stock son simulados y deterministas, sin pretensión de representar precios comerciales reales. No se añadieron direcciones, coordenadas, RUT ni teléfonos reales. Los cuatro perfiles propietarios son registros sintéticos sin cuentas de acceso en Firebase Authentication, no credenciales para entregar a personas.

Las tiendas y sus ofertas se identifican con `esPrueba: true` y `lotePrueba: findi-pilot-2026-10`. Los nombres visibles llevan `(Prueba)`. Sus condiciones indican que no existe venta ni retiro. El banner público advierte que son ficticias y ofrece un enlace a Contacto para recibir feedback.

No se inventaron firmas ni aceptaciones de contratos para estas entidades. Su publicación requiere expresamente `PILOT_STORES_ENABLED=true`; las ferreterías reales conservan sus requisitos de cuenta y contrato vigente.

La prueba de búsqueda por cercanía no aplica a estas ferreterías, pues no tienen una ubicación real. Para probar las cotizaciones utiliza «Todas las ferreterías».

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

1. Desactivar únicamente los registros del lote, conservando el catálogo maestro y las cotizaciones:

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/seed-pilot-stores.mjs --deactivate --apply --firebase-cli-auth
```

2. Cambiar `PILOT_STORES_ENABLED=false` en `functions/.env` y desplegar la API:

```sh
firebase deploy --only functions:api --project cotizapp-d71c8
```

La desactivación pone las cuatro tiendas y propietarios inactivos y sus ofertas no publicadas, invalida el catálogo y excluye sus precios de la búsqueda y de nuevas comparaciones. La variable también impide publicarlas si se mantuviera algún registro activo por error. El banner se oculta cuando la API devuelve la variable desactivada.

Las cotizaciones conservan sus artículos; al recalcular dejan de usar precios ficticios. Si todavía no existen ofertas reales, se informan como incompletas y no se permite exportar un total comercial inventado. Las imágenes y productos base continúan visibles.

## Verificación

Se verificaron en producción las cuatro tiendas, 3.424 ofertas, 856 productos y precios distintos para cada producto. Se probó una cotización de tres productos, su total y el PDF generado. Se revisó la interfaz en escritorio y móvil, y se cubrieron por pruebas la desactivación, la descripción persistida, el mensaje de WhatsApp y la advertencia en el PDF.
