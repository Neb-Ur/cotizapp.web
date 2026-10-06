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
