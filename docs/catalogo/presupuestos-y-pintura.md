# Presupuesto de trabajo y calculadora de pintura

## Recorrido

Desde la portada se puede abrir **Calcular pintura**, o desplegar esa herramienta dentro de cualquier cotización. Se ingresan medidas, superficies de igual tamaño, área de puertas y ventanas, manos y adicional por pérdidas. Después se selecciona una pintura del catálogo y se confirman su rendimiento en m² por litro y mano y los litros del envase.

El resultado muestra superficie neta, litros estimados y envases completos redondeados hacia arriba. **Agregar pintura a la cotización** crea una línea identificada como calculada. Recalcular reemplaza únicamente esa línea; conserva los otros materiales. Cambiar de pintura exige confirmar otra vez rendimiento y presentación. No se deducen litros desde el nombre del producto.

Ejemplo: 5 × 4 m, dos superficies, 4 m² de aberturas, dos manos, 10 m²/L/mano y 10 % adicional producen 36 m² y 7,92 L. Con envases de 4 L se agregan dos unidades. Las cantidades finales siguen siendo editables. El cálculo incluye pintura; sellador, preparación y accesorios se agregan por separado.

## Presupuesto

En **Presupuesto de trabajo**, activar **Preparar un presupuesto para mi cliente** habilita cliente, alcance, partidas de mano de obra, otros gastos, recargo sobre el costo y condiciones. Las partidas admiten cantidades fraccionarias y costos unitarios finales en pesos chilenos. Los materiales usan el precio de la estrategia de compra seleccionada y conservan el IVA incluido. No se agrega automáticamente otro impuesto.

El recargo se aplica a la suma de materiales, mano de obra y gastos. No es margen sobre ventas: $100.000 de costo más 25 % son $125.000. Los importes se redondean a pesos por partida. Se rechazan importes negativos, no finitos, cantidades inválidas y costos fuera del límite.

Los costos se guardan en la cotización y en los borradores por cuenta. Un campo numérico local sin terminar puede corregirse al volver a abrir el borrador; no permite guardar en el servidor ni exportar hasta corregirse. La importación de una cotización local tras iniciar sesión conserva presupuesto y cálculo.

## PDF y verificación

Al activar el presupuesto, las acciones de PDF y compartir generan un presupuesto de trabajo. Por defecto incluye alcance, cantidades, conceptos y total de venta; no incluye precios de proveedores, costos unitarios internos ni recargo. **Incluir mis costos y el recargo en el PDF** habilita explícitamente ese desglose. La vista interna siempre muestra el cálculo.

El listado de cotizaciones muestra el total presupuestado y compartir desde el listado conserva el formato del presupuesto. Se admite un presupuesto de mano de obra sin materiales. Si existen materiales sin oferta con stock suficiente, se impide exportar.

El código sigue verificando únicamente materiales y precios registrados por local. Mano de obra, gastos, recargo, cliente y condiciones no se copian al registro de verificación del local. En un presupuesto sin materiales no se muestra el código en el PDF.

## Persistencia y comprobaciones

`workBudget` y `paintingPlan` son objetos versionados dentro del `api_payload` de la cotización SQL; no requieren una migración de tablas. El servidor valida los datos y calcula el desglose desde los precios de materiales del servidor. Los clientes anteriores que no envían esos campos no eliminan un presupuesto existente. Retirar la línea de pintura elimina su cálculo asociado.

Se verifican fórmulas, entradas inválidas, privacidad del PDF, conservación de borradores, edición, importación tras login, integración del editor, acceso desde portada y persistencia con el repositorio PostgreSQL. Los PDF de ejemplo se renderizan para revisar el formato del cliente y el interno.

## Publicación del 24 de octubre de 2026

Publicados Hosting y la función API en `cotizapp-d71c8`. La comprobación en producción confirmó las capacidades `workBudgets: 1` y `paintingCalculator: 1`, el acceso desde la portada, la página de cotización y el bundle entregado con ambas herramientas. También confirmó el rechazo de costos inválidos y la autenticación obligatoria para crear cotizaciones, sin crear una cotización de prueba en producción.

El smoke general aprobó los 956 productos y 3624 ofertas activas, además de fichas, canónicas, JSON-LD, noindex privado y respuestas 404. Las pruebas cubren fórmulas, persistencia SQL, edición y borradores, privacidad del PDF y controles de la interfaz; se inspeccionó el PDF renderizado del cliente y el interno.
