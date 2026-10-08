# Catálogo implementado

## Estructura

Categoría → subcategoría → familia → producto comercial concreto.

El tipo, color, espesor, largo, ancho, acabado y presentación son atributos del producto. El inventario versión 2 contiene 18 categorías, 80 subcategorías, 101 familias y 816 tipos propuestos. MDF, OSB, terciados, OLB, aglomerados, tableros melamínicos, enchapados, HDF y hardboard tienen familias separadas. MDF utiliza campos obligatorios de largo, ancho, espesor, color y acabado cuando se habilita una ficha desde el editor.

Los 816 productos base están activos en Firebase aunque ninguna ferretería los tenga. No requieren marca, formato o presentación comercial confirmados para existir como base genérica. No tienen fotos, galería, GTIN, precio ni stock inventados. Los 18 ejemplos investigados siguen como referencias documentales.

## Administración y catálogo público

El catálogo muestra productos base y variantes comerciales. Cada base conserva su familia y atributos; las variantes concretas identifican su marca, formato, color, espesor, acabado y presentación. El administrador puede usar **Crear variante** para registrar otro producto de la misma familia sin reemplazar el producto base.

La portada, sugerencias y búsqueda incluyen productos sin ofertas. Se muestra **Sin ofertas disponibles** y se oculta el precio cuando no existe una ferretería asociada. No se crean ofertas ficticias para llenar la portada. La ficha de detalle sigue disponible para consultar el producto.

El control **Visible en el catálogo** permite habilitar o retirar una ficha. Los productos base pueden mantenerse genéricos y activos; las variantes comerciales deben completar los atributos obligatorios del editor. Una imagen ausente no genera solicitudes a servicios externos de relleno.

Precio, stock y SKU de cada ferretería siguen separados del maestro. Las ofertas por volumen admiten m³ sin conversiones implícitas de volumen a masa.

## Carga repetible

Desde la raíz del repositorio:

```sh
FIREBASE_PROJECT_ID=cotizapp-d71c8 npm run catalog:import -- --firebase-cli-auth
FIREBASE_PROJECT_ID=cotizapp-d71c8 CONFIRM_PROJECT_ID=cotizapp-d71c8 npm run catalog:import -- --firebase-cli-auth --apply
```

La primera orden simula la carga. La segunda crea solamente documentos faltantes y exige que el proyecto de destino coincida. También se admiten credenciales de aplicación por defecto omitiendo `--firebase-cli-auth`. La sesión de Firebase CLI debe estar vigente.

La carga valida IDs, relaciones y campos antes de escribir. Usa lotes de creación sin reemplazar registros existentes, detecta conflictos de identidad de taxonomía y conserva los productos editados por el administrador al repetirse. No borra datos, no modifica usuarios ni crea ofertas. Genera un comprobante local privado en `tmp/catalog-import/` con las rutas creadas para permitir una reversión selectiva revisada; no borrar colecciones completas para revertir.

El archivo de origen es [inventario-propuesto.json](inventario-propuesto.json); las plantillas y los borradores se adaptan al esquema real mediante [catalog-plan.mjs](../../functions/scripts/lib/catalog-plan.mjs). Importar los datos no despliega las nuevas pantallas ni los endpoints: el código de frontend y Functions se publica con el flujo de despliegue habitual del proyecto.

## Resultado de la carga

Carga aplicada y verificada en `cotizapp-d71c8`: 18 categorías, 80 subcategorías, 101 familias, 1.084 definiciones de atributos y 816 productos base activos, con un atributo de tipo por ficha. Total: 2.915 documentos. Se conservaron las cuentas y ofertas existentes. Se comprobó el tipo numérico de las medidas, sin generar variantes de color/espesor ficticias.

La compilación de producción y las pruebas de frontend/backend pasan. Los productos base fueron activados el 6 de octubre de 2026 y el catálogo público incluye los registros sin ofertas.

## Publicación verificada — 6 de octubre de 2026

Se publicaron Hosting y la función `api`. La búsqueda pública devuelve 816 productos activos sin exigir ofertas; la ficha de MDF desnudo responde con cero ferreterías. La portada publicada usa «Productos y materiales» e incluye las bases del catálogo. Precio y cantidad de ferreterías se muestran solamente cuando existen ofertas. Verificación: 101 pruebas de frontend, 74 de backend y compilación de producción correctas.

### Caché de fichas y carga de ofertas

El detalle separa dos consultas a `/api/productos/detalle`:

- `vista=ficha`: producto, taxonomía y atributos, sin precios, stock ni contactos comerciales. El servidor mantiene esta información en memoria durante cinco minutos y agrupa las lecturas concurrentes. No consulta ofertas ni reconstruye su caché para entregar una ficha.
- `vista=ofertas`: precios, stock y condiciones de las ferreterías, sin volver a consultar atributos. Usa la caché pública existente, con una antigüedad máxima de un minuto y su invalidación por cambios comerciales.

El navegador conserva cada ficha consultada en `localStorage` durante una hora, incluso al recargar. Los precios no se guardan en esa caché: se vuelven a solicitar al abrir el detalle. Una modificación de ficha puede tardar hasta una hora en aparecer en un navegador que ya la tenga guardada; en otro navegador, la caché del servidor puede tardar hasta cinco minutos en renovarse. Si el almacenamiento está bloqueado, se consulta normalmente la API.

La ficha se muestra antes de terminar la consulta de ofertas. Mientras tanto, solo la sección de precios indica que está cargando; una falla conserva la ficha y permite reintentar. La ausencia de ferreterías se anuncia únicamente después de una consulta de ofertas correcta. Las respuestas de una ruta anterior se descartan.

En producción se mantiene la página pública preparada por el servidor para enlaces y buscadores, con la ficha y sus atributos. Esa página tampoco espera precios. El navegador completa las ofertas. En desarrollo local se mantiene el renderizado en el navegador para evitar esperas en `ng serve`.

### Buscador del header: sugerencias locales por tipo

El desplegable combina únicamente productos, familias y marcas reales relacionadas. Las categorías y subcategorías siguen formando parte del índice para encontrar productos por su clasificación, pero no tienen una sección en las sugerencias. En escritorio usa dos columnas; en móvil, una lista vertical. No incorpora precios ni imágenes remotas. Enter busca todo el texto; las flechas permiten seleccionar un resultado, Enter lo abre y Escape cierra. Las categorías, familias y marcas abren filtros reales, y los productos abren su ficha.

`GET /api/catalogo-busqueda` entrega un índice compacto de productos activos y taxonomía. Se construye con la caché de datos estáticos de cinco minutos, sin consultar ofertas. Su versión es una huella del contenido público: los cambios de precios y stock no la modifican. El parámetro `v` permite responder solo con la versión cuando no hay cambios. La respuesta HTTP tiene caché de un minuto.

El navegador precarga el índice después del primer render, lo guarda en IndexedDB y prepara el texto en memoria una sola vez. Al escribir, las sugerencias se calculan localmente sin peticiones por letra. Al volver a entrar, utiliza el índice guardado mientras comprueba actualizaciones en segundo plano; la comprobación al enfocar se limita a una cada cinco minutos cuando tiene éxito. Un índice guardado permanece disponible durante fallos de conexión. Si IndexedDB está bloqueado, la búsqueda funciona con la memoria de la página. La primera visita necesita descargar el índice; los resultados completos y precios siguen requiriendo conexión.

Se normalizan tildes, mayúsculas, plurales simples y unidades pegadas a números, y se aceptan palabras en cualquier orden. La página de resultados aplica la misma normalización y puede filtrar por marca. Los valores `Por especificar`, `Sin marca` y otros marcadores genéricos no se presentan como marcas.

Ante fallos iniciales de conexión, la descarga del índice hace hasta dos reintentos automáticos, con esperas de 250 y 500 ms. Si todos fallan y no existe un índice guardado, se muestra la opción de reintentar. Una caché dañada o un fallo al leerla no impiden descargar una copia nueva. Esta recuperación se comprobó en Chrome con una primera respuesta 503, en vistas de escritorio y móvil, sin nuevas peticiones al seguir escribiendo.

### Registro de marcas

Las marcas comerciales se guardan en la colección `marcas`, con `nombre`, `nombreNormalizado` y `creadoEn`. El identificador determinista se deriva del nombre normalizado (sin diferencias de tildes, mayúsculas o espacios). Cada producto conserva `marca` como nombre visible y `marcaId` como referencia estable. Crear o editar un producto registra o reutiliza la marca en una transacción; las escrituras requieren el rol admin. Una etiqueta genérica como «Sin marca» o «Por especificar» deja `marcaId: null` y no crea registros comerciales.

El admin recibe sugerencias de marcas existentes en el campo Marca y puede escribir una nueva. `GET /api/marcas` entrega solo ID y nombre. El índice de búsqueda incluye nombres canónicos y referencias; al seleccionar una marca, la búsqueda usa `marcaId` y conserva `marca` como etiqueta visible. Los enlaces antiguos con el nombre siguen funcionando. Los productos antiguos sin referencia pueden filtrarse usando su identidad normalizada mientras se migran. Las sugerencias solo incluyen marcas vinculadas a productos coincidentes.

`functions/scripts/migrate-product-brands.mjs` ofrece comprobación y aplicación idempotente de referencias existentes, verificando dentro de cada transacción que la marca del producto no haya cambiado. Se aplicó en `cotizapp-d71c8`: 816 productos revisados, cero marcas comerciales identificadas y cero productos modificados. Las marcas aparecerán al completar los productos comerciales con su fabricante; no se asignan fabricantes ficticios a referencias base. Los cambios del índice conservan la política de actualización de cinco minutos.

Una futura fusión de nombres alternativos debe reasignar las referencias al ID elegido; no basta con editar el nombre visible. La colección permite incorporar metadatos de marca sin duplicarlos en cada producto.

### Tanda comercial 01 · 7 de octubre de 2026

Se incorporaron 40 productos comerciales verificados de Bosch, Makita, Stanley, Sika, Volcanita, Trupan, Cbb Cementos y Ceresita. [Listado y fuentes oficiales](productos-comerciales-tanda-01.md). La colección compartida `marcas` se vincula mediante `marcaId`; la carga incluye los atributos y amplía únicamente las opciones de tipo necesarias. Los productos genéricos permanecen como referencias base y el catálogo alcanza 856 productos activos. Las fichas comerciales no contienen ofertas ni imágenes inventadas.
