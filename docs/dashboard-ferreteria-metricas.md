# Dashboard diario de ferreterías

La ferretería inicia sesión en `/dashboard/ferreteria`, dentro del mismo layout público de Findi. La cabecera cambia el buscador por navegación de negocio: Dashboard, Mi catálogo, Agregar productos, Carga por Excel y Mi perfil. En móvil estas opciones están en el menú. “Ir a inicio” permite recorrer la web pública, que conserva “Ir a dashboard” mientras la sesión está activa.

## Actualización y costo

`refreshStoreDailyAnalytics` se ejecuta una vez al día a las **02:00, America/Santiago**, mediante Cloud Scheduler y Cloud Functions en `southamerica-east1`, una región compatible con Scheduler. La API pública conserva su región de Santiago (`southamerica-west1`). Lee las cotizaciones guardadas y el catálogo una vez por ejecución; escribe un resumen por ferretería en `real_storeDailyAnalytics`. Un control por fecha local evita repetir el cálculo si Cloud Scheduler entrega el evento más de una vez. Las escrituras se hacen por lotes y reemplazan el resumen: repetir el cálculo no acumula ni duplica estadísticas. No hay listeners, sondeo ni recálculo al abrir el dashboard.

El endpoint privado `GET /ferreterias/propietario/:ownerId/dashboard` verifica el rol y la propiedad y devuelve únicamente los resúmenes del dueño. El inicio no descarga el catálogo completo; este se obtiene al entrar en Mi catálogo. Los contadores de visualización/selección preexistentes se muestran al corte nocturno, no en vivo.

No se guardan nombres, correos, direcciones, IDs de cotizaciones ni IDs de clientes en los resúmenes.

## Definiciones

- **Cotizaciones con tus productos:** cotizaciones guardadas actualmente que atribuyen al menos una línea a la ferretería. Las cotizaciones eliminadas no integran este corte; no es un histórico de toda la vida.
- **Unidades cotizadas:** suma de cantidades atribuidas, diferenciada de líneas y de productos distintos. Una cotización con varias líneas cuenta una sola vez en el contador de cotizaciones.
- **Cotizaciones activas:** con productos y actividad (`updatedAt` o `createdAt`) en los últimos 30 días; se excluyen estados de cierre/archivo cuando existen. Hoy no hay una acción de cierre en el producto, por lo que la ventana de actividad es la definición vigente.
- **Monto activo:** valor referencial con IVA de las líneas atribuidas en cotizaciones activas, usando precios, disponibilidad, stock conjunto y radio geográfico al corte. Una oferta elegida sin disponibilidad conserva su demanda pero aporta cero al monto. No equivale a ventas, ingresos ni reserva de stock; no incluye despacho.
- **Atribución:** la oferta/ferretería seleccionada, la compra en una sola ferretería aplicada o la oferta usada por la optimización. No se atribuye demanda a todas las tiendas que venden el mismo producto. Las sucursales se separan por ID; nombres antiguos se resuelven únicamente cuando no son ambiguos.
- **Más cotizados:** productos ordenados por cantidad de cotizaciones, luego unidades, máximo 20. Los nombres se resuelven por ID maestro para conservar continuidad ante cambios del catálogo.
- **Últimos 7 días:** cotizaciones creadas durante los siete días anteriores al corte, comparadas con el período anterior. Sin base anterior se evita mostrar un porcentaje ficticio.
- **Oportunidades:** productos publicados, sin stock, precios sin fecha o sin actualización en 30 días y productos más cotizados que necesitan reposición.

Se muestra la fecha del último corte; una cuenta nueva o un fallo de lectura tienen estados explícitos. El mantenimiento del catálogo continúa disponible si el resumen falla.

## Primer cálculo y operaciones

Después de compilar las funciones, puede generarse un primer corte con sesión Firebase CLI vigente:

```sh
FIREBASE_PROJECT_ID=cotizapp-d71c8 CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/refresh-store-daily-analytics.mjs
```

La función programada tiene concurrencia e instancias limitadas a uno. No se aplican reintentos automáticos para mantener un cálculo diario; ante un fallo, se conserva la fecha del último reporte y se puede ejecutar el comando anterior de forma controlada.

## Cotización desde producto

Un visitante que pulsa Crear cotización abre Registro con el producto, cantidad y ferretería en `returnUrl`. Puede entrar por Login si ya tiene cuenta. El registro incluye las aceptaciones obligatorias; si una cuenta necesita aceptar una actualización legal, se preserva el mismo destino durante esa aceptación. Al autenticarse vuelve al producto con el modal de Nueva cotización abierto.

Un maestro autenticado crea y selecciona una cotización en el modal sin salir de la ficha. Crear no agrega automáticamente el producto. La sección “Cotización seleccionada” y el botón “Agregar a cotización seleccionada” realizan la incorporación explícita, con carga, prevención de duplicados y atribución a la oferta escogida. La selección se conserva por cuenta entre productos y se valida contra las cotizaciones existentes.
