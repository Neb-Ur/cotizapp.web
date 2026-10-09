# Cotizaciones: plazo informativo y verificación por código

Los 10 días son una recomendación: «Genera tu cotización y realiza la compra dentro de los 10 días para mantener los precios cotizados». No bloquean la edición, descarga, envío ni consulta del documento después de ese plazo. Findi permite preparar cotizaciones, no procesa compras ni reserva stock.

## Código y documento verificable

Al guardar una cotización el servidor emite un código aleatorio, por ejemplo `TRV-1234-ABCD-5678-EF90`. Se muestra en el detalle, se puede copiar y aparece en el PDF y el mensaje de WhatsApp. Los códigos anteriores con prefijo `FND-` siguen siendo válidos.

Cada modificación guardada emite un nuevo código. El anterior conserva su versión original: no cambia silenciosamente el contenido de un PDF que ya se entregó. El maestro debe guardar sus cambios antes de descargar o enviar la versión modificada.

El precio se calcula en el servidor desde las ofertas guardadas de la cotización. El cliente no puede asignar precios a los registros verificables. Un artículo inventado, una oferta que no corresponde o un producto sin precio disponible no se incorpora como una línea válida de la ferretería.

## Consulta de la ferretería

En el menú de la ferretería se agregó **Cotizaciones**. El local ingresa el código presentado por el maestro y consulta:

- Productos que quedaron asignados a esa ferretería en la cotización guardada.
- Cantidades, precios unitarios, subtotales y total con IVA de sus productos.
- Fecha de los precios registrados y plazo recomendado de compra.
- Identificación de prueba si corresponde al piloto.

Las alternativas de otras ferreterías y los datos personales, dirección de obra y descripción privada del maestro no se entregan a ese local. Si no tiene productos asignados en esa versión, la API devuelve el mismo resultado que para un código inexistente. Consultar fuera de los 10 días sigue permitido y muestra un aviso informativo.

La consulta requiere Firebase Authentication, rol ferretería y propiedad del local solicitado. El administrador puede consultar como parte de su gestión. No existe una consulta pública por código.

## Persistencia

`findi.quotations.api_payload` conserva los artículos y precios capturados, más el código de su versión actual. `findi.quotation_verifications` contiene las versiones verificables, indexadas por código, con sus líneas y metadatos mínimos. La creación de la versión y la actualización de la cotización son una única transacción.

Una restricción de PostgreSQL impide modificar las versiones emitidas. Las migraciones `011-quotation-verification.sql` y `012-advisory-quotation-period.sql` crean la tabla y permiten que se emita un nuevo código incluso fuera del plazo informativo original. Sus registros no almacenan identidad ni contacto del maestro.

Las dos cotizaciones existentes recibieron código sin cambiar artículos ni precios. Para completar únicamente registros que todavía no tengan código:

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/initialize-quotation-codes.mjs --apply --firebase-cli-auth
```

El script hace copia privada previa, conserva los códigos existentes y verifica cada cotización dentro de la transacción.
