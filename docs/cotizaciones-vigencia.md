# Vigencia y precios de las cotizaciones

Las cotizaciones guardadas conservan sus precios durante 10 días exactos desde la captura, con fecha y hora visibles en el detalle y en el PDF. Findi genera cotizaciones de materiales y no procesa compras. Se eliminó la referencia a «Despacho no incluido» de los detalles, las comparaciones, el dashboard y el PDF.

## Funcionamiento

- El servidor captura las ofertas correspondientes a los artículos al guardar. El cliente no puede enviar ni modificar los precios de esa captura.
- Se almacenan `pricingOffers`, `pricesCapturedAt`, `validUntil` y `pricingMode: snapshot` en el registro persistido de la cotización (`findi.quotations.api_payload`). Así se conserva su información sin depender de cambios posteriores en el catálogo.
- Cambiar nombre, descripción, cantidad o estrategia conserva los precios capturados y la misma fecha de vencimiento. Al agregar un producto nuevo se capturan sus ofertas actuales sin modificar las de los productos anteriores.
- Detalle, listado, PDF y envío usan la misma captura. Exportar o compartir de nuevo no extiende el plazo.
- Al vencer se mantienen el documento y sus artículos, pero se debe pulsar «Renovar precios y vigencia» para guardar cambios o volver a exportar. Esta acción consulta las ofertas actuales e inicia otro período de 10 días.
- Los indicadores diarios de las ferreterías usan los precios guardados cuando están disponibles y excluyen cotizaciones vencidas de los montos activos.
- La vigencia corresponde a los precios registrados en la cotización. No constituye una compra ni una reserva de stock.

Los precios ficticios del piloto mantienen su identificación y advertencia también en las cotizaciones guardadas. Al retirar las tiendas del piloto, sus ofertas desaparecen del catálogo público. Los documentos existentes conservan su captura hasta el vencimiento; una renovación ya no incorpora esas ofertas retiradas.

## Cotizaciones anteriores

Se inicializó la vigencia de las dos cotizaciones existentes tomando las ofertas disponibles al momento de esta actualización, sin modificar sus artículos, propietario, nombre ni fecha de creación. No se reconstruyeron precios históricos inexistentes. Se guardó una copia privada anterior a la modificación.

Para inicializar únicamente cotizaciones que todavía no tengan una captura, desde la raíz del repositorio:

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node --env-file=functions/.env functions/scripts/initialize-quotation-validity.mjs --apply --firebase-cli-auth
```

El script respeta las capturas existentes y verifica el estado de cada cotización dentro de la transacción.
