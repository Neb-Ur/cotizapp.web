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

## Seguimiento, duplicación y plantilla de pintura — 25 de octubre de 2026

**Seguimiento comercial.** En Mis cotizaciones y en el detalle se puede seleccionar Borrador, Enviado, Aceptado o Rechazado y confirmar con Actualizar. Es un registro manual: descargar o compartir no marca el documento como enviado ni comunica nada al cliente. Es independiente de la disponibilidad y de la vigencia de precios. Los documentos anteriores aparecen como Borrador. Guardar cambios de contenido, renovar precios o agregar materiales devuelve el documento a Borrador. El estado también se conserva en el navegador para cotizaciones sin cuenta; al importarlas a una cuenta se crea un borrador nuevo.

La API de estado verifica propietario, estado anterior y código de la versión de materiales para rechazar actualizaciones basadas en contenido anterior. Actualiza únicamente seguimiento y fechas: conserva precios y código, sin generar ni modificar registros de verificación. No se puede marcar Enviado o Aceptado un documento incompleto ni una plantilla con costos por completar.

**Duplicación.** Mis cotizaciones permite duplicar un documento en una cuenta de maestro, manteniendo el límite existente de dos guardados. La copia recibe un ID, código y captura de precios nuevos. Conserva materiales, cantidades, estrategia por local, cálculo de pintura, alcance, partidas y recargo. No copia cliente, dirección, ubicación de búsqueda, estado comercial ni precios históricos. Se abre como Borrador para revisar cliente, ubicación, cantidades, costos y ofertas actuales. Si un material ya no tiene una oferta disponible, la copia aparece incompleta. El original conserva su contenido y estado.

**Plantilla de pintura.** El editor de presupuesto ofrece una plantilla que agrega preparación de superficies, aplicación de pintura, limpieza final y traslado. Conserva partidas anteriores y no sobrescribe cliente, alcance, condiciones ni recargo. Se agrega una sola vez; las partidas siguen siendo editables o se pueden quitar. Los costos iniciales son cero, pendientes de completar, y bloquean exportar hasta ser informados o quitar las partidas no aplicables. La lista de revisión orienta sobre preparación, protección y accesorios; no inventa materiales ni cantidades. La calculadora sigue agregando únicamente los envases calculados para la pintura elegida.

`workflowStatus`, `workflowUpdatedAt` y el identificador de plantilla se conservan en el `api_payload` existente de PostgreSQL; no requieren migración de esquema. Las pruebas incluyen autorización por propietario, estados obsoletos, conservación de verificaciones, cuotas, captura de precios actuales al duplicar, persistencia SQL, edición local, bloqueo de PDF y controles de interfaz.

Publicación verificada el 25 de octubre de 2026: Hosting y API desplegados; 246 pruebas de backend y 77 pruebas de frontend afectado aprobadas, además del smoke SSR. La revisión de navegador con cuenta simulada local comprobó cambio manual de estado y apertura de la copia como borrador, a 320, 390, 768 y 1440 px sin desbordamiento. En producción se comprobó la plantilla de cuatro partidas, exportación bloqueada con costos pendientes y respuestas 401 a ambos endpoints nuevos sin sesión. No se crearon cotizaciones de prueba en producción.

## Cerámicas y porcelanatos — 25 de octubre de 2026

La portada ofrece **Calcular materiales**, con opciones Pintura y Cerámicas y porcelanatos dentro de la cotización. Se conservan los enlaces directos `herramienta=pintura` y se incorpora `herramienta=ceramicas`; `herramienta=materiales` abre el selector. Alternar calculadoras conserva las medidas mientras la página está abierta.

El cálculo admite de uno a treinta espacios rectangulares de distintas medidas y un descuento de superficie por espacio. Suma las superficies netas, aplica una vez el adicional por cortes y pérdidas y redondea hacia arriba el total dividido por los m² por caja. El 10 % inicial es editable. Ejemplo: cocina de 3,5 × 2,8 m y pasillo de 2 × 1 m menos 0,2 m² suman 11,6 m²; con 10 % adicional se requieren 12,76 m². Una caja de 2 m² da siete cajas y 14 m² comprados.

La cobertura se ingresa desde el envase o ficha del producto, sin deducirla del formato de la palmeta. Se exige confirmar que el precio utilizado corresponde a una caja con esa cobertura; cambiar producto o cobertura obliga a reconfirmar. El selector excluye accesorios, adhesivos y productos declarados por m² o pieza. Los productos del catálogo sin presentación requieren confirmación con el local. El cálculo no verifica automáticamente la declaración del usuario ni certifica la presentación de las ofertas: debe revisarse al escoger el local.

**Agregar cajas** crea una línea `calculationSource: tiles`. Recalcular reemplaza solo esa línea; conserva pintura y otros materiales. Se admite una selección de cerámica por cálculo, repartida entre varios espacios. Las cantidades finales siguen siendo editables. Retirar o cambiar el producto de la línea elimina su cálculo asociado. Adhesivo y fragüe se agregan aparte según su compatibilidad y rendimiento.

La plantilla editable agrega retiro de revestimiento, preparación de base, instalación, fragüe, limpieza, traslado y retiro de escombros. Conserva los datos y costos previos, se puede combinar con pintura y evita repetir limpieza o traslado. Quita las partidas no incluidas y completa sus costos antes de exportar o marcar el documento Enviado/Aceptado. `templateId` conserva compatibilidad con la primera plantilla; `templateIds` identifica las plantillas combinadas.

`tilePlan` guarda espacios, descuentos, adicional, cobertura, producto y confirmación de venta por caja en el `api_payload` de PostgreSQL. No requiere migración. Se conserva al editar, duplicar, restaurar borradores o importar la cotización local a una cuenta. Clientes anteriores que no envían ese campo no lo borran. Los PDF de materiales y de trabajo incluyen medidas, supuestos, cajas estimadas y cobertura comprada; los costos internos del presupuesto permanecen ocultos por defecto.

Publicación verificada: Hosting y API actualizados el 25 de octubre de 2026. Pasaron 252 pruebas de backend, 79 pruebas de frontend afectado y el smoke SSR. El recorrido local de navegador comprobó dos espacios, siete cajas, combinación de calculadoras, guardado y restauración, plantilla de siete partidas y ausencia de desbordamiento entre 320 y 1440 px. Se renderizaron y revisaron ambos PDF. La revisión pública encontró seis opciones del catálogo, calculó siete cajas con datos de prueba, exigió confirmar la venta por caja, bloqueó exportar la plantilla sin costos y confirmó respuestas 400/401 a entradas inválidas o sin sesión. No se crearon cotizaciones de prueba en producción.
