# Informe de ampliación del catálogo: condición de productos y repuestos

**Decisión vigente al 14 de octubre:** la compatibilidad automotriz se administra en el producto maestro por variante, junto con su nombre e imagen propios. Las asociaciones de oferta de etapas anteriores quedan para transición/historial. [Contrato y conversión](productos-maestro-automotrices.md).

Fecha: 12 de octubre de 2026. Código analizado: `3ef5bfb`.

Revisión del plan: incorpora las recomendaciones de compatibilidad posteriores al análisis inicial. La línea base de pruebas de la sección 10 corresponde al commit indicado, no a una nueva ejecución ni al código de futuras etapas.

## 1. Conclusión

**La arquitectura actual permite incorporar repuestos y desarmadurías sin rehacer la aplicación. La ampliación completa es de alcance medio, no un cambio menor de formularios.**

Se reutilizan el catálogo maestro, la taxonomía, las marcas de fabricante, las ofertas, las cuentas, la ubicación, las reseñas y gran parte de las cotizaciones. Los cambios de mayor riesgo son permitir varias publicaciones del mismo producto en un local, filtrar sus asociaciones de vehículos y conservar la pieza exacta al cotizar.

**Cada repuesto es un producto del mismo catálogo actual.** Las categorías y familias de repuestos se agregan a esa estructura. Productos con códigos o especificaciones diferentes tienen identidades diferentes; dos unidades del mismo repuesto, una nueva y otra usada, pueden compartir producto maestro y tener publicaciones distintas.

Para las desarmadurías, la identificación principal será **marca, modelo y año del vehículo**, por ejemplo «Alternador Chevrolet Corsa 2008». El fabricante del repuesto será un dato opcional: publicar no exigirá conocerlo ni completar dos marcas.

Agregar solamente una condición a las ofertas es una etapa acotada. Abrir el sistema a piezas usadas con fotografías propias, distintas condiciones y varios vehículos requiere cambios coordinados de base de datos, API, búsqueda, importación, interfaz y cotizaciones.

Esta revisión entrega un diseño y un plan de ejecución. **No incorpora funcionalidades nuevas ni modifica datos de producción.** Las propuestas de nombres y tablas son orientativas hasta implementar cada etapa. No se ha realizado una auditoría legal ni una medición de carga en producción.

## 2. Alcance y decisiones de producto

Requisitos tomados de la conversación:

- Mantener funcionando el negocio ferretero actual.
- Incorporar condición física: nuevo, usado, reacondicionado y para reparar.
- Permitir locales de repuestos y desarmadurías.
- Incorporar cada repuesto como producto del catálogo existente, con sus categorías y familias.
- Usar marca, modelo y año del vehículo en el flujo de desarmadurías; fabricante del repuesto opcional.
- Mostrar filtros de marca según el contexto: vehículo en repuestos y marca comercial actual en ferretería.
- Una publicación puede tener varias asociaciones de marca, modelo y año.
- El vendedor registra esas asociaciones manualmente; el sistema no deduce que una pieza sirve para otro vehículo.
- Conservar búsqueda, filtros, relaciones, precios, stock y cotizaciones.
- Implementar por etapas y publicar cada una antes de avanzar a la siguiente, conforme a la autorización posterior del usuario.

Fuera del alcance inicial: inferencia automática de compatibilidad, búsqueda por VIN, catálogo automotriz externo, pagos, reservas de stock, despacho, integración con inventarios externos y conversión de Trovio en una tienda que venda directamente.

**Criterio de avance:** agregar relaciones y capacidades opcionales sin reinterpretar campos existentes. Cada etapa debe funcionar también con productos, locales y cotizaciones antiguos que no tengan datos de vehículos. La habilitación pública se controla por configuración y comienza con locales piloto.

## 3. Qué existe hoy y qué se puede reutilizar

| Área | Estado observado | Reutilización y cambio necesario |
| --- | --- | --- |
| Taxonomía | Categoría → subcategoría → familia → producto maestro | Agregar ramas para repuestos sin reemplazar las familias existentes. |
| Identidad del producto | ID propio, familia, marca de fabricante, modelo, descripción y atributos | Conservar IDs; separar la identidad del repuesto de los vehículos declarados por el vendedor. |
| Marca | `products.brand_id` y `marcaId` enlazan una marca por producto | Conservar su uso actual; fabricante opcional en repuestos. La marca visible principal en el flujo automotriz será la del vehículo, mediante relaciones adicionales. |
| Modelo | `product_models` pertenece a una familia; el adaptador crea el ID con familia, marca y etiqueta | No es un catálogo de modelos de vehículos relacionado mediante una FK a su marca. |
| Atributos | Definiciones por familia, valores tipados y opciones | Sirven para medidas, material, posición u otras especificaciones; no reemplazan las asociaciones múltiples de vehículos. |
| Oferta | Local + producto maestro, precio final con IVA, stock, SKU, vigencia y condiciones | Es la base adecuada para la condición física y la publicación concreta. |
| Restricción de oferta | Una oferta por combinación de local y producto maestro | Debe evolucionar para varias piezas distintas del mismo maestro. |
| Imágenes | Galería del maestro, activos multimedia y subida exclusiva del admin | Agregar galería de publicación y subida autorizada del dueño del local. |
| Locales | Dueño, cuenta, ubicación, contrato y estado de publicación | Agregar tipo de negocio sin cambiar inicialmente el rol interno `ferreteria`. |
| Directorio y reseñas | Locales paginados, filtros por lugar, evaluación de maestros autenticados | Reutilizar sobre los mismos IDs de locales; sumar tipo de negocio. |
| Cotizaciones | Líneas con IDs de producto, local y oferta; precios capturados y verificación | Extender snapshots con condición y asociaciones; revisar las alternativas para no sustituir piezas diferentes. |
| Invitados | Una cotización conservada en `localStorage`; autenticación para guardar en cuenta/obtener PDF | Preservar el borrador y los nuevos campos al iniciar sesión. No es almacenamiento compartido entre dispositivos. |
| Métricas | Indicadores de catálogo y cotizaciones por local, actualización cada dos horas | Distinguir publicaciones de productos maestros y evitar duplicar cotizaciones. |

El catálogo también permite productos maestros sin ofertas. Eso debe mantenerse: una ficha genérica no debe recibir precio, stock, condición ni fotografías de una pieza física inventada.

### Evidencia principal en el repositorio

- [Esquema relacional](../../sql/findi/001-schema.sql): marcas, modelos, productos, atributos, ofertas y líneas de cotización.
- [Compatibilidad del runtime SQL](../../sql/findi/005-runtime-compatibility.sql) y [codec](../../functions/src/database/codec.ts): columnas tipadas más `api_payload`, materialización de modelos, imágenes y líneas.
- [Adaptador PostgreSQL](../../functions/src/database/postgres.ts): lecturas del payload, transacciones e invalidación de caché.
- [Creación y edición de ofertas](../../functions/src/routes/store-catalog.routes.ts) y [resolución de solicitudes](../../functions/src/services/product-request-resolution.service.ts).
- [Construcción de ofertas públicas](../../functions/src/services/catalog-search.service.ts), [búsqueda paginada](../../functions/src/domain/product-search.ts) y [rutas de búsqueda](../../functions/src/routes/search.routes.ts).
- [Optimizador compartido](../../functions/src/domain/quotation.ts), [captura de precios](../../functions/src/domain/quotation-validity.ts), [servicio de cotizaciones](../../functions/src/services/quotation.service.ts) y [verificación](../../functions/src/services/quotation-verification.service.ts).
- [Importación del catálogo](../../src/app/core/services/firebase-data.service.ts), [plantilla y parser](../../src/app/core/utils/catalog-import.util.ts).
- [Directorio](../../functions/src/services/store-directory.service.ts), [permisos del local](../../functions/src/lib/ownership.ts) y [subida de imágenes](../../functions/src/routes/images.routes.ts).

## 4. Hallazgos que condicionan la ampliación

### 4.1. «Estado» ya significa varias cosas

El maestro tiene `estado` activo/inactivo; la oferta tiene `activo` y `publicado`; el stock y la vigencia también determinan su disponibilidad. Ninguno describe si la pieza es nueva o usada.

Propuesta: usar un campo explícito como `condicion` / `condition` en la oferta. No reutilizar `estado`, `condicionesOferta` ni los estados administrativos. «Para reparar» es una condición, no un permiso para publicar un producto suspendido.

No se puede afirmar que todas las ofertas antiguas son nuevas solo porque el sistema era ferretero. Antes del backfill hay que revisar los registros y decidir si se confirma «nuevo» o se mantiene una condición temporal «sin especificar». Los productos maestros genéricos permanecen sin condición física.

### 4.2. Marca del vehículo como identificación principal en desarmadurías

Un repuesto puede estar fabricado por Bosch y estar declarado para un Toyota o un Nissan. Cambiar `marcaId` del maestro para guardar Toyota rompería el significado del filtro por fabricante.

Esta diferencia se resuelve internamente. El vendedor de una desarmaduría debe poder publicar «Alternador Chevrolet Corsa 2008» seleccionando Chevrolet, Corsa y el año, aunque desconozca al fabricante del alternador. No se exigirá fabricante, código de fabricante ni una marca ficticia para completar la ficha.

`product_models` tampoco resuelve esta necesidad: tiene una FK a familia, no una FK a marca de vehículo. El codec utiliza la marca en el hash del ID, pero eso no es una relación referencial de marca → modelo.

Recomendación revisada: **reutilizar `brands` como registro de nombres de marcas**, agregando una clasificación de usos que permita fabricante, vehículo o ambos. Esa clasificación puede representarse con una relación `brand_uses`; no debe imponer un único uso excluyente. Las referencias actuales `products.brand_id` / `marcaId` siguen significando fabricante o marca comercial del producto. La marca del vehículo se obtiene por una relación adicional, nunca cambiando el significado de esos campos.

Para modelos, la recomendación de menor impacto es **conservar `product_models` y agregar `vehicle_models` con FK a `brands`**. Reutilizar también la tabla de modelos es posible, pero exige distinguir tipos, revisar su FK de familia y modificar el codec que materializa modelos actuales. Por eso no se da por aprobado ese cambio como una simplificación. En el punto 4 se verifica con el esquema y fixtures si aporta una ventaja concreta; sin esa evidencia, se mantiene la recomendación de modelos separados. El usuario sigue viendo un solo flujo Marca → Modelo → Año, independientemente de esta decisión interna.

Estas referencias clasifican los productos del catálogo compartido; no constituyen un catálogo separado de repuestos. En las familias que admiten vehículos, el filtro visible **Marca → Modelo → Año** consulta las relaciones de vehículos. En las demás familias, «Marca» conserva el significado y comportamiento actuales. Si se ofrece fabricante en repuestos, se identifica explícitamente como «Fabricante del repuesto» y queda como opción secundaria. Las sugerencias actuales de marcas comerciales no deben incorporar automáticamente todas las marcas de vehículos por compartir tabla.

### 4.3. Una asociación debe guardar la combinación completa

Guardar marcas `[Toyota, Nissan]`, modelos `[Corolla, Sentra]` y años en listas independientes produciría combinaciones que nadie declaró.

Ejemplo ilustrativo, sin afirmar compatibilidad real:

| Publicación | Marca de vehículo | Modelo | Desde | Hasta |
| --- | --- | --- | --- | --- |
| P-100 | Toyota | Corolla | 2010 | 2013 |
| P-100 | Nissan | Sentra | 2015 | 2017 |

Una búsqueda de Toyota + Sentra no debe encontrar P-100. Tampoco Toyota + Corolla + 2016. Los tres criterios deben coincidir en **una misma fila** de asociación.

El modelo elegido debe pertenecer a la marca seleccionada mediante FK/validación del servidor. Los años deben ser enteros y formar un intervalo coherente. Si no se declaran años, la interfaz debe decir «años no especificados», sin interpretar que sirve para todos; con un filtro de año concreto, esa asociación no debería contar como coincidencia confirmada.

### 4.4. Una publicación por local y producto es un límite real

La unicidad está en dos capas:

- SQL: `UNIQUE(store_id, product_id)` en `offers`.
- API: la creación consulta si ya hay una oferta para ese local y maestro y devuelve `CATALOGO_ALREADY_LINKED`.

La aprobación de solicitudes también reutiliza la primera oferta encontrada en esa combinación. Quitar solamente el índice SQL no basta: la API seguiría rechazando, y una aprobación podría apuntar a otra pieza.

Dos piezas usadas con distinto desgaste, fotos o vehículos deben tener distintos IDs de oferta/publicación. La condición no debe ser parte de una unicidad que impida vender dos piezas diferentes que sean ambas usadas. El SKU puede ayudar a distinguirlas, pero requiere decidir y validar su unicidad por local y no sustituye al ID.

### 4.5. El precio «desde» debe respetar los filtros de la publicación

La búsqueda paginada hoy filtra los maestros y luego agrega las ofertas por producto. El filtro por local y el radio se aplican antes de calcular precios. Esto ofrece una base reutilizable.

Al sumar condición y vehículos, primero se deben seleccionar las ofertas coincidentes y después calcular mínimo, máximo, stock relevante y cantidad de locales. No vale mostrar una card que coincide por una publicación y poner el precio de otra publicación de distinta condición o vehículo.

La cantidad de ferreterías ya usa IDs en la búsqueda paginada. Debe seguir contando locales distintos, no número de publicaciones. Algunos endpoints anteriores agrupan por nombre de producto y nombre de local; hay que revisar sus consumidores y evitar mezclar productos o sucursales homónimos.

### 4.6. No todos los filtros mencionados ya existen

La búsqueda paginada expone texto, categoría, subcategoría, familia, marca de fabricante, local y proximidad. No expone hoy filtros arbitrarios de atributos ni marca/modelo/año de vehículo.

Hay atributos tipados y fichas técnicas; eso no significa que la pantalla pública permita filtrar por todos ellos. Incorporarlos es un trabajo adicional, con valores disponibles por familia y validación de cada tipo.

El detalle del producto sí ordena ofertas por distancia si tiene ubicación y coordenadas válidas; las ofertas sin distancia quedan al final, o se excluyen al aplicar un radio. La búsqueda paginada general admite `relevance`, `price-asc`, `price-desc` y `stores`; calcular cercanía no equivale a ofrecer un orden general por distancia. No debe prometerse ese orden sin ampliarlo y probarlo.

### 4.7. Las cotizaciones tienen identidad de oferta, pero requieren una política más estricta

El optimizador conserva una selección explícita por `productoFerreteriaId` en el cálculo mixto. Sin embargo, al construir alternativas de una sola tienda (`linesFor(store)`), permite elegir otra oferta del mismo maestro en esa tienda, omitiendo el bloqueo de la selección individual. Esto puede ser válido para materiales equivalentes; no lo es automáticamente para dos piezas usadas distintas.

Antes de habilitar varias piezas, se debe definir y aplicar: **una publicación concreta seleccionada no se cambia sin una acción explícita del usuario**. Las alternativas deben presentarse como alternativas, y respetar condición y asociaciones declaradas.

La captura de precios guarda todas las ofertas por producto y conserva los precios anteriores. Si luego se agrega otra publicación del mismo maestro, `capturedProducts` impide incorporar ofertas nuevas de ese maestro. En el catálogo actual es una decisión de congelar precios por producto; con múltiples piezas hay que revisar cómo incorporar una publicación recién elegida sin renovar silenciosamente el resto de la cotización.

Los campos nuevos también necesitan cambios en `normalizeItems`, snapshots de precios, verificación y PDF. No basta con añadirlos a un tipo TypeScript: el normalizador actual conserva una lista explícita de campos y descartaría otros.

### 4.8. Las imágenes de la pieza aún no están modeladas

La galería actual se vincula al maestro y la subida es exclusiva del admin. Una foto de una pieza usada no debe reemplazar la imagen de referencia compartida por todos los locales.

Se puede reutilizar el procesamiento y almacenamiento de imágenes, pero hace falta un endpoint para el dueño de la publicación, relación multimedia de oferta, validación del propietario, límites, orden de galería y tratamiento de fotos retiradas. La ficha y la cotización deben distinguir «imagen de referencia» de «foto de esta publicación».

### 4.9. La importación identifica productos de una manera que dejará de ser suficiente

La plantilla actual contiene nombre, SKU, precio, stock y código de barras. La actualización busca SKU o código de barras y, como respaldo, nombre; rechaza coincidencias ambiguas.

Dos piezas pueden compartir nombre y código de fabricante/código de barras. Para varias publicaciones, la exportación debe incluir ID de publicación y la reimportación debe actualizar por ese ID o por un SKU inequívoco del local. No actualizar varias piezas por nombre ni elegir la primera.

Para asociaciones múltiples, conviene una hoja separada que referencie la publicación y tenga una fila por marca/modelo/intervalo. La plantilla antigua debe continuar funcionando para el catálogo actual; los campos nuevos deben ser opcionales cuando no correspondan.

### 4.10. SQL y payload deben evolucionar juntos

Aunque muchos nombres del código sigan diciendo Firestore, `db` puede usar PostgreSQL. El adaptador conserva un `api_payload` y también materializa columnas y relaciones SQL.

Una migración que agregue columnas sin actualizar payloads y mappings puede generar diferencias entre el dashboard, la API y consultas SQL de métricas. Agregar colecciones nuevas exige registrar su mapping y su persistencia; las asociaciones y las fotos de publicación requieren materialización o repositorios específicos.

Además, la invalidación actual enumera claves de catálogo estático y ofertas. Nuevas tablas de vehículos/asociaciones deben participar de esa invalidación. Si se escriben con SQL directo, deberán invalidar explícitamente las revisiones correspondientes.

### 4.11. El uso de vehículos depende del producto, no del rubro del vendedor

Una ferretería puede vender repuestos y una desarmaduría puede vender herramientas. El tipo de negocio organiza el directorio y ayuda con la presentación, pero no determina las relaciones permitidas de cada producto.

Agregar una capacidad explícita a la familia, por ejemplo `supports_vehicle_applications`, con valor inicial `false` para las familias actuales. Solo las familias habilitadas ofrecen campos y filtros de vehículos. No inferir esa capacidad por nombres, texto del producto o rol de la cuenta.

El servidor valida esta regla al guardar asociaciones. En búsquedas generales que mezclen familias, los parámetros de marca comercial y marca de vehículo deben ser distintos; la interfaz debe etiquetarlos claramente o pedir elegir la familia antes de mostrar el filtro automotriz. No reutilizar el parámetro antiguo `marcaId` con otro significado según quién esté conectado.

## 5. Diseño propuesto

### Entidades y responsabilidades

| Entidad | Responsabilidad | Cambio propuesto |
| --- | --- | --- |
| `products` | Qué producto es, incluido cada repuesto | Mantener catálogo compartido, identidad, familia y especificaciones comunes; fabricante opcional para repuestos. |
| `offers` | Qué pieza/lote publica un local | Agregar condición, descripción propia y habilitar varias publicaciones. Conservar precio, stock, SKU y vigencia. |
| `stores` | Quién publica y dónde | Agregar `business_type`: ferretería, tienda de repuestos o desarmaduría. |
| `families` | Qué capacidades corresponden a un producto | Añadir habilitación explícita de asociaciones de vehículos; las familias actuales empiezan deshabilitadas. |
| `brands` y uso de marca propuesto (`brand_uses`) | Registro compartido de marcas y sus usos | Mantener IDs y referencias comerciales; permitir uso como fabricante, vehículo o ambos. |
| `product_models` | Modelos actuales de producto | Conservar relación con familia y materialización existente. |
| `vehicle_models` | Modelos de una marca de vehículo | Nueva relación con FK a `brands` y validación de uso como vehículo; no modificar por defecto `product_models`. |
| `offer_vehicle_applications` | Asociaciones declaradas por el vendedor | Oferta + modelo de vehículo + intervalo de años opcional; la marca se deriva del modelo. |
| `offer_media` | Fotografías de esa publicación | Vincular oferta a activos multimedia propios, sin tocar `product_media`. |
| Líneas/snapshots de cotización | Qué se seleccionó y cotizó | Oferta exacta + condición + descripción y asociaciones relevantes capturadas. |

No se propone reemplazar tablas existentes ni mover las ofertas a otro sistema. El ID actual de oferta puede seguir siendo el ID de publicación. La FK de modelo determina su marca; si la API recibe ambos IDs debe comprobar su consistencia.

### Flujo de publicación para una desarmaduría

Ejemplo de carga y presentación, sin afirmar compatibilidad técnica:

| Campo visible | Ejemplo | Comportamiento |
| --- | --- | --- |
| Producto/repuesto | Alternador | Pertenece al catálogo compartido; si falta, se usa el flujo de solicitud de producto. |
| Marca del vehículo | Chevrolet | Selección de marca de vehículo. |
| Modelo | Corsa | Opciones pertenecientes a Chevrolet. |
| Año o rango | 2008, o 2006–2009 | Declaración del vendedor; si se desconoce, se indica sin especificar. |
| Condición | Usado | Propia de la publicación. |
| Fotos, precio y stock | Fotos de la pieza y valores del local | Propios de la publicación. |
| Fabricante del repuesto | Vacío | Opcional; no bloquea la publicación. |

La ficha puede identificarse como «Alternador Chevrolet Corsa 2008», conservando por separado el producto y sus relaciones. Ese título no se utiliza como clave única ni sustituye la identidad por código o especificaciones cuando se conocen. Cambiar solamente la condición de una unidad no crea otro producto maestro. Si se conoce que dos repuestos tienen códigos o especificaciones distintos, se registran como productos diferentes aunque ambos se llamen alternador.

El vendedor puede agregar más asociaciones completas de marca/modelo/año manualmente. El sistema no deriva otras aplicaciones del vehículo de origen ni presenta una asociación desconocida como compatibilidad confirmada.

### Reglas de integridad

1. Cada publicación pertenece a un solo local y un solo maestro.
2. Varias publicaciones del mismo maestro son posibles en el mismo local; repetir una petición no debe crear duplicados involuntarios. Añadir una clave de idempotencia para creación/importación cuando se habilite esta posibilidad.
3. La condición física es un valor permitido y separado de visibilidad/disponibilidad.
4. Cada asociación referencia un modelo válido; no crea automáticamente otras asociaciones.
5. Evitar filas duplicadas de asociación e intervalos invertidos; definir cómo tratar intervalos solapados antes de importar.
6. Sin asociaciones no significa «universal». En la primera versión, un filtro de vehículo concreto exige una asociación declarada.
7. Un local solo puede modificar sus publicaciones, asociaciones y fotos. El admin conserva su acceso administrativo.
8. Las fotos de publicaciones no alteran el maestro ni otras publicaciones.
9. La selección de cotización valida que la oferta pertenece al producto y al local declarados; conservar la comprobación relacional existente.
10. Una cotización histórica conserva los datos de la selección aunque luego se edite o retire la publicación.
11. Campos nuevos ausentes en datos antiguos no bloquean lectura, búsqueda, edición ni cotización; no generan compatibilidad ficticia.
12. Las asociaciones de vehículos requieren una familia habilitada, aunque el vendedor tenga otro tipo de negocio.
13. IDs y parámetros de fabricante existentes mantienen su significado; las consultas de vehículos usan parámetros distintos.

### Tratamiento del catálogo público

Mantener una card por producto maestro es una primera opción coherente con el catálogo actual. Bajo filtros, la card muestra precios y locales de las publicaciones que cumplen esos filtros. Al abrir el detalle, se mantienen los filtros y se listan publicaciones distinguibles por condición y foto.

Para una desarmaduría con piezas muy diferentes, puede añadirse más adelante una vista de publicaciones. No hace falta cambiar todo el catálogo a una card por pieza en la primera etapa.

El registro y los menús pueden decir «Negocio» o «Vendedor» cuando incluya otros rubros. El rol interno `ferreteria`, las rutas y los IDs existentes pueden mantenerse por compatibilidad; un renombre integral ahora aumenta el alcance sin aportar una capacidad necesaria.

## 6. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación previa a publicar |
| --- | --- | --- |
| Confundir fabricante y vehículo | Filtros actuales incorrectos | Relaciones y parámetros distintos aunque se comparta `brands`; regresión de `marcaId` y sugerencias. |
| Modificar modelos existentes para ahorrar una tabla | Relaciones de familia o materialización dañadas | Mantener `product_models`; evaluar reutilización solo con evidencia de compatibilidad en el punto 4. |
| Mostrar campos de vehículos solo por rubro del vendedor | Repuestos de otros negocios quedan mal clasificados | Capacidad explícita por familia y validación del servidor. |
| Quitar unicidad solo en SQL | API sigue rechazando o aprobación reutiliza otra pieza | Cambiar juntos creación, solicitudes e importación; idempotencia. |
| Combinar asociaciones independientes | Resultados de vehículos no declarados | Una fila por combinación; consulta sobre la misma asociación. |
| Precio de una publicación que no coincide | Card engañosa y cotización incorrecta | Filtrar ofertas antes de agregación y conservar contexto al abrir ficha. |
| Optimizador sustituye una pieza usada | Se cotiza algo distinto de lo elegido | Bloqueo por oferta; alternativas explícitas y equivalencia definida. |
| Snapshot no incorpora otra oferta del mismo maestro | Nueva pieza seleccionada aparece sin precio | Captura por publicación seleccionada, manteniendo los precios históricos. |
| Importación actualiza por nombre/código ambiguo | Sobrescribe otra pieza | ID de publicación, SKU único cuando se use para resolver y rechazo de ambigüedad. |
| Cambiar columnas sin payloads/mappings | API y SQL entregan datos distintos | Backfill coordinado y pruebas de ida y vuelta del adaptador. |
| Caché no se invalida | Filtros/fotos/condición desactualizados | Revisiones para nuevas relaciones y prueba tras edición. |
| Edición de piezas sin aislamiento por dueño | Cambios entre locales | Verificación del propietario en API y pruebas negativas. |
| Sumar publicaciones como locales/cotizaciones | Métricas infladas | Contar IDs distintos y separar maestros, publicaciones y unidades. |
| Crecer el snapshot completo en memoria | Más carga y latencia | Medir; índices SQL y consultas paginadas de asociaciones cuando haga falta. |

La paginación actual reduce la respuesta de la pantalla, pero el backend obtiene y procesa el snapshot del catálogo. Para un volumen grande de publicaciones automotrices, habrá que medir memoria, tiempos y tamaño de caché; no hay un benchmark de capacidad incluido en esta revisión.

## 7. Plan de trabajo por puntos

Se conserva la numeración discutida y se divide el punto 6 en dos entregas. Las asociaciones del punto 5 se preparan sobre las ofertas actuales; la creación múltiple no se habilita hasta superar la preparación de cotizaciones del punto 6A.

| Punto | Entrega | Dependencia y condición para avanzar | Alcance |
| --- | --- | --- | --- |
| 1 | Análisis, relaciones y línea base de regresión | Este informe; ninguna funcionalidad nueva | Documentación |
| 2 | Condición de la oferta en edición, detalle y cotización | Resolver backfill; preservar activo/publicado | Acotado, transversal |
| 3 | Tipos de negocio en perfil, registro, directorio y admin | Conservar cuentas, roles, contratos y reseñas | Acotado a medio |
| 4 | Marcas compartidas con usos, modelos de vehículos y capacidad por familia | Mantener `marcaId` y `product_models`; resolver diseño físico antes de migrar; familias actuales sin vehículos | Medio |
| 5 | Asociaciones manuales múltiples y validación | Punto 4; trabajar por ID de oferta actual | Medio |
| 6A | Preparar cotizaciones para identidad de publicación | Bloqueo de oferta elegida, captura al agregar otra oferta del mismo maestro, conservación de datos históricos e invitados; regresión del cálculo actual | Alto dentro de la ampliación |
| 6B | Varias publicaciones del mismo maestro/local | 6A aprobado; creación, solicitudes e importación compatibles e idempotentes; conservar IDs | Alto dentro de la ampliación |
| 7 | Fotos y observaciones de publicación | Propiedad y permisos por oferta; maestro conservado | Medio |
| 8 | Editor y carga masiva por tipo/familia | En desarmadurías, marca/modelo/año y fabricante opcional; asociaciones y publicaciones; plantilla antigua compatible | Medio a alto |
| 9 | Filtros combinados y paginación | Filtrar publicaciones antes de precios/conteos; atributos como entrega explícita adicional | Alto dentro de la ampliación |
| 10 | Detalle/cotización/PDF/verificación completos | Base de identidad y captura aprobada en 6A; completar presentación y regresión | Alto dentro de la ampliación |
| 11 | Navegación, admin y métricas por rubro | No duplicar conteos; revisión escritorio/móvil | Medio |
| 12 | Piloto pequeño y publicación gradual | Todas las regresiones y prueba de migración aprobadas | Validación y despliegue |

**Condición de publicación:** 6B no se activa si 6A permite sustitución silenciosa de una pieza o pierde precios/datos históricos. El punto 10 completa presentación y flujo; no es la primera comprobación de seguridad de selección.

Los puntos 4–10 pueden desplegar soporte compatible y deshabilitado mientras se implementan. El acceso al flujo de repuestos se abre a locales piloto cuando el recorrido mínimo de publicación, filtros, selección, cotización y verificación esté completo. Desplegar una migración no equivale a habilitar la funcionalidad para todos.

Por cada punto: diseño concreto, migración si corresponde, API/modelos, interfaz, pruebas pertinentes, revisión del resultado y publicación de lo autorizado. No se agrupan todas las etapas en un despliegue único.

## 8. Migración y publicación sin romper lo actual

1. Crear migraciones nuevas posteriores a las existentes; no editar migraciones ya aplicadas.
2. Añadir tablas/campos de forma compatible, inicialmente opcionales donde los datos actuales no aporten la información.
3. Comprobar en una base aislada que la carga conserva IDs, relaciones, ofertas, fotografías y cotizaciones anteriores.
4. Actualizar mappings, columnas reconocidas, codec y payloads, además de los permisos SQL necesarios para las tablas nuevas.
5. Mantener las respuestas antiguas; agregar campos sin cambiar la forma de endpoints que aún devuelven arrays.
6. Conservar la restricción de una oferta por local/maestro hasta que sus consumidores soporten varias publicaciones. No habilitar la nueva creación parcialmente.
7. Antes de activar el nuevo rubro, comprobar filtro, agregación, edición/importación y selección exacta con un conjunto pequeño de datos de prueba.
8. Desplegar respetando el mecanismo existente que conserva bundles antiguos y la coordinación entre Hosting y API.
9. Si falla la nueva experiencia, deshabilitar su creación/visibilidad mediante configuración sin borrar publicaciones ni cotizaciones.

### Activación y control de cada etapa

- Usar configuración del servidor con la ampliación deshabilitada por defecto y una lista de locales piloto. La API aplica esa autorización, además de los permisos existentes; ocultar controles en el frontend no basta.
- Habilitar capacidades automotrices solo en familias revisadas; conservar el funcionamiento de todas las familias anteriores.
- Antes de migrar producción, comprobar una copia de respaldo recuperable y probar la migración sobre datos representativos en una base aislada. Tener un archivo de respaldo sin comprobar recuperación no cumple esta condición.
- Comparar IDs, relaciones y respuestas de los flujos antiguos antes/después. Los nuevos campos opcionales no deben cambiar filtros ni totales de una cotización anterior.
- Cada etapa debe tener criterios de aceptación, pruebas aplicables y una forma de desactivar sus nuevas acciones. Si falla una regresión existente, no se habilita la etapa.
- Validar al menos el recorrido de búsqueda, filtros combinados, importación antigua, invitado → cuenta, PDF y permisos; añadir pruebas de nuevos comportamientos según la etapa.
- Revisar cargas, errores y resultados del piloto antes de ampliar acceso. Las lecturas de cotizaciones históricas siguen disponibles aunque se desactive la creación automotriz.

Una vez que haya múltiples ofertas por local/maestro, **no se puede restaurar sin más la restricción antigua ni volver a una API que elija la primera oferta**. La reversión debe conservar el soporte de lectura y desactivar las nuevas acciones. No fusionar piezas o eliminar registros para forzar un rollback.

## 9. Matriz de regresión y aceptación

| Flujo | Comprobación imprescindible |
| --- | --- |
| Catálogo ferretero | Bases sin ofertas siguen visibles; maestros inactivos no aparecen; no se inventan precios. |
| Marca actual | Filtrar fabricante sigue dando el mismo significado y los enlaces antiguos funcionan. |
| Marcas compartidas | Una marca puede tener ambos usos; referencias antiguas y sugerencias comerciales conservan su significado. |
| Modelos existentes | Familia, ID y materialización de modelos de producto siguen funcionando sin datos de vehículos. |
| Capacidad por familia | Una ferretería puede publicar repuestos en una familia habilitada; una desarmaduría conserva campos normales en familias sin vehículos. |
| Marca en repuestos | Marca → Modelo → Año utiliza vehículos; se puede publicar y encontrar un repuesto sin conocer su fabricante. |
| Identidad de repuestos | Códigos/especificaciones distintos conservan productos distintos; nueva/usada del mismo repuesto no obliga a duplicar el maestro. |
| Taxonomía | Categoría/subcategoría/familia se combinan y limpian sin relaciones inválidas. |
| Asociaciones | Varias marcas/modelos por publicación; modelo de otra marca se rechaza; intervalo inválido se rechaza. |
| Combinación de filtros | Marca/modelo/año coincide en una misma asociación y condición/local/radio en la misma oferta. |
| Precios | Mínimo/máximo provienen solo de publicaciones coincidentes; dos ofertas del mismo local cuentan como un local. |
| Paginación | Filtrar y ordenar antes de paginar; totales correctos y sin duplicados; página se reajusta al cambiar filtros. |
| Ubicación | Coordenadas inválidas/sin ubicación, permiso denegado y radio; orden de distancia donde realmente exista. |
| Publicación múltiple | Dos piezas usadas del mismo maestro/local se crean y editan de forma independiente. Reintento no duplica la petición. |
| Importación | Archivo antiguo funciona; ID/SKU resuelve exactamente; nombre/código ambiguo nunca selecciona la primera pieza. |
| Solicitudes | Aprobación no se liga a una pieza distinta por compartir local/maestro; reintentos son idempotentes. |
| Cotización invitada | Límite de una, recarga restaura borrador y selección, detalle sin cuenta, acceso a PDF pide autenticación. |
| Cotización en cuenta | Límite de dos, traslado del borrador conserva selección y campos; permisos por propietario. |
| Cálculo | Oferta elegida no cambia al recalcular o proponer una sola tienda; sin stock no se sustituye silenciosamente. |
| Stock | Líneas repetidas de la misma oferta suman su demanda; piezas distintas mantienen stock independiente. No se promete reserva. |
| Precios históricos | Editar precio/condición/foto de oferta no cambia la identidad ni precios capturados de una cotización emitida. |
| Nueva línea | Agregar otra publicación del mismo maestro obtiene su precio sin renovar todo el documento. |
| PDF/verificación | Identifica pieza, condición, local, cantidades y total; conserva información capturada y periodo informativo de diez días. |
| Seguridad | Dueño de A no modifica ofertas/asociaciones/fotos de B; evaluar sigue exigiendo maestro autenticado. |
| Directorio | Tipos de negocio combinan con lugar y paginación; ver productos conserva el local preseleccionado. |
| Caché | Cambio de asociación/condición/foto se refleja conforme a la política; índice no pierde el fabricante actual. |
| Activación | API impide nuevas acciones fuera del piloto; desactivar conserva datos, lecturas históricas y cotizaciones existentes. |
| Compatibilidad de migración | Datos antiguos sin nuevos campos conservan IDs, relaciones, filtros y totales; SQL y payload coinciden. |
| Métricas | Maestros/publicaciones/locales se distinguen; cotizaciones por local no se duplican; calendario de dos horas se conserva. |
| Presentación | Escritorio y móvil: dos cards por fila en listados móviles, tabla de cotización identificable, popovers accesibles y estados de carga. |

La matriz describe la aceptación del recorrido completo. Las comprobaciones ya realizadas se registran por etapa en la sección 12; aprobar las referencias y asociaciones no valida todavía filtros ni selección automotriz en cotizaciones. La revisión visual completa del nuevo flujo permanece pendiente.

## 10. Línea base de validación

Se ejecutaron los comandos de pruebas existentes sobre el código previo a la ampliación:

```sh
npm --prefix functions test
npm test -- --watch=false
```

Resultado registrado en el análisis inicial de `3ef5bfb`: **146 pruebas de backend y 211 pruebas de frontend aprobadas** (50 archivos de pruebas de frontend). Cero fallos. La compilación de Functions y la compilación de la aplicación para pruebas también finalizaron correctamente. Estos números son una referencia histórica: se debe renovar la línea base sobre el commit de inicio de cada implementación.

La ejecución de frontend dejó advertencias del entorno de pruebas: ubicación de un mock de `firebase/auth` y `window.scrollTo` no implementado en jsdom. No impidieron las pruebas; no se corrigieron porque esta entrega es de análisis. No se ejecutó un despliegue ni una compilación adicional de producción.

Las suites incluyen contratos de rutas, catálogo y búsqueda, marcas, detalles, importación, cotizaciones, stock, límites, vigencia, verificación, directorio, permisos y persistencia SQL con fixtures locales. Pasar esas pruebas no demuestra compatibilidad automotriz ni capacidad de carga; establece una referencia para detectar regresiones.

No se consultaron datos privados de producción ni se crearon cuentas, publicaciones o cotizaciones durante este análisis.

## 11. Decisiones recomendadas para comenzar

- Empezar por condición física en la oferta, no por un renombre global de «ferreterías».
- Mantener fabricante del producto y vehículo como conceptos separados.
- Reutilizar marcas mediante usos adicionales; mantener modelos de producto y recomendar modelos de vehículo separados mientras no se demuestre una ventaja segura de unificarlos.
- Habilitar asociaciones por familia, no por tipo de negocio; campos ausentes en datos antiguos no bloquean sus flujos.
- Presentar marca/modelo/año del vehículo como identificación principal para desarmadurías y dejar el fabricante del repuesto opcional.
- Mantener todos los repuestos en el catálogo existente; las referencias de vehículos solo amplían sus relaciones y filtros.
- Usar asociaciones manuales completas por publicación, sin deducciones automáticas.
- Conservar IDs existentes; ampliar la oferta a publicación concreta en lugar de crear un inventario paralelo.
- Completar 6A (selección exacta y snapshots) antes de activar 6B (varias publicaciones).
- Mantener las cards por maestro inicialmente; mostrar y seleccionar la pieza en el detalle.
- Abrir un piloto de pocas familias y locales antes de cargar un catálogo automotriz amplio.
- Desplegar soporte compatible primero y activar el nuevo recorrido por configuración del servidor cuando esté completo y validado.

El primer punto implementado es el **2: condición de la oferta**; su resultado se registra en la sección 12. Los registros existentes permanecen sin condición física confirmada y no se asignan atributos de piezas usadas a los maestros compartidos.

## 12. Seguimiento de implementación

### Punto 2 — completado y publicado

- Condición física en la oferta: `sin_especificar`, `nuevo`, `usado`, `reacondicionado` y `para_reparar`. Campo independiente de activo/publicado, stock y condiciones comerciales.
- Selector en la edición del catálogo del local; condición informada en detalle, cotización, PDF y verificación. Las ofertas sin condición conocida conservan la presentación compacta del stock en el detalle.
- Validación del servidor y del adaptador SQL, conservación de la condición en actualizaciones antiguas que no envían el campo y evidencia en historial de oferta.
- Precios capturados conservan la condición de emisión. Las alternativas entre tiendas no cambian la condición de una oferta explícitamente elegida. El bloqueo completo de identidad de pieza sigue correspondiendo al punto 6A.
- Migración `015-offer-condition.sql` aplicada. Las 3.424 ofertas existentes quedaron sin especificar, sin asumir que eran nuevas; se verificó la conservación de IDs, relaciones de local/producto, precios, stock y publicación.
- Cloud SQL rechazó respaldos administrados por las restricciones del período gratuito de SQL Connect. Se creó una copia local privada de los esquemas de negocio y migración, fuera del repositorio, y se verificó la restauración de 63 tablas/12.504 filas y la migración en una base aislada. Esta copia no incluye Firebase Authentication ni reemplaza un plan permanente de respaldos de infraestructura.
- Validación: 146 pruebas existentes de backend y cuatro nuevas de condición/migración aprobadas; se repitieron 13 pruebas relacionadas tras ajustar la comparación. Las 212 pruebas de frontend y la compilación de producción pasaron. Persisten advertencias previas de presupuestos CSS y del entorno de pruebas.
- Hosting y API publicados y comprobados: búsqueda pública, condiciones del detalle y entrada del panel. El cambio no habilita vehículos ni varias publicaciones del mismo maestro/local.

### Punto 3 — completado y publicado

- Clasificación del local: `ferreteria`, `repuestos` y `desarmaduria`, con etiquetas Ferretería, Tienda de repuestos y Desarmaduría. El rol interno del vendedor continúa siendo `ferreteria`; el tipo de negocio no concede permisos ni cambia la aprobación de la cuenta.
- Selector en creación de locales desde admin, edición administrativa y perfil del dueño. El API de registro conserva el tipo indicado para un local; las solicitudes antiguas que omiten el campo siguen funcionando. El registro público de maestros conserva su flujo actual.
- Directorio con tipo visible y filtro opcional combinado con nombre, región, comuna y paginación. Se conservan la ruta `/ferreterias`, los enlaces de productos por local y las reseñas existentes; evaluar sigue requiriendo maestro autenticado.
- Migración `016-store-business-type.sql` aplicada. Los cinco locales anteriores quedaron clasificados como ferreterías. Se verificó que dueños, nombres, estados, contratos y roles de usuarios permanecieron iguales.
- Respaldo local privado previo a la migración, fuera del repositorio; restauración de 63 tablas/12.506 filas con contenido coincidente y prueba de la migración en la base aislada.
- Validación: 150 pruebas existentes de backend aprobadas y cinco pruebas nuevas de clasificación, creación, permisos, filtro y persistencia SQL aprobadas. Las 213 pruebas de frontend y la compilación de producción pasaron. En Chrome con datos de prueba, directorio y selector comprobados a 1440, 768, 375 y 320 píxeles, sin desbordamiento horizontal.
- Hosting y API publicados. Comprobaciones públicas: cuatro locales anteriores siguen visibles, el filtro de ferretería conserva sus resultados, el tipo desarmaduría devuelve cero mientras no haya locales de ese tipo, los tipos inválidos se rechazan y las reseñas propias exigen autenticación. La búsqueda y la condición del punto 2 siguen funcionando.
- Commit de implementación: `ecf51af`. Esta etapa agrega clasificación; aún no habilita marca/modelo/año de vehículos ni publicaciones múltiples. No modifica documentos legales ni declara resuelta la revisión de textos por rubro prevista para las etapas posteriores.

### Punto 4 — completado y publicado

- Marcas compartidas con usos `fabricante` y `vehiculo`; una marca puede tener ambos. Habilitar una marca existente para vehículos conserva su ID y sus relaciones anteriores. Las marcas exclusivamente vehiculares no entran en las opciones comerciales de `/marcas` ni en las sugerencias del buscador.
- Se conserva `product_models` y se agrega `vehicle_models`, con relación obligatoria a una marca habilitada para vehículos. Las pruebas SQL verifican que las referencias del producto y su modelo comercial permanecen intactas. Los modelos vehiculares conservan su ID al renombrar, tienen nombres normalizados únicos por marca y pueden activarse o desactivarse; su marca no se reasigna desde la API.
- Capacidad explícita por familia: `permiteVehiculos` / `supports_vehicle_applications`. El administrador puede guardarla al crear o editar una familia. Las actualizaciones antiguas que omiten el campo conservan el valor existente; los tipos inválidos se rechazan.
- Panel de referencias en **Administrador → Productos → Taxonomía**: registrar marcas de vehículos, habilitar marcas existentes y administrar sus modelos. Las escrituras exigen administrador autenticado. El catálogo público de referencias devuelve marcas vehiculares y modelos activos; todavía no incorpora asociaciones ni filtros de vehículos en publicaciones.
- Migración `017-vehicle-reference-catalog.sql` aplicada en la misma base PostgreSQL. Las ocho marcas existentes conservan sus IDs y quedan con uso fabricante; las 101 familias quedan con vehículos deshabilitados. Se verificó la conservación del contenido existente de productos, modelos comerciales, ofertas, cotizaciones, imágenes, locales y usuarios. Se actualizaron el codec, mappings, metadatos de columnas, invalidación de caché y los diagramas completos.
- Respaldo local privado previo a la modificación, conservado fuera del repositorio. Restauración de 63 tablas/12.507 filas en una base aislada, con contenido coincidente, y comprobación de la migración sobre esa copia. También se compararon los datos conservados después de aplicar la migración. El respaldo cubre los esquemas de negocio y conciliación; no incluye Firebase Authentication ni sustituye respaldos permanentes de infraestructura.
- Validación: **162 pruebas de backend y 215 de frontend aprobadas**, más compilación de producción. En Cloud SQL se comprobaron permisos del usuario runtime, relación de modelo con uso vehicular y unicidad de modelo por marca; las escrituras de prueba se revirtieron. Persisten las advertencias previas de presupuestos CSS y del entorno de pruebas. La revisión visual manual de escritorio/móvil queda pendiente porque no hubo navegador conectado disponible en esta sesión.
- Hosting y API publicados, conservando 153 bundles anteriores. Comprobaciones posteriores: ocho marcas comerciales y 101 familias conservadas; búsqueda con los mismos 856 productos; referencias vehiculares inicialmente vacías; acceso administrativo anónimo rechazado; bundle del nuevo panel disponible. El smoke de producción pasó con 856 productos y 3.424 ofertas activas, incluyendo detalle, HTML de producto, canonical, JSON-LD, sitemap y respuestas 404.

### Punto 5 — implementado y publicado; habilitación de piloto pendiente

Entrega del 13 de octubre de 2026. [Contrato de datos, permisos y configuración](asociaciones-vehiculos.md).

- Hasta 20 asociaciones manuales por ID de oferta existente. Cada fila conserva la combinación completa de marca/modelo/años y los nombres resueltos por el servidor. La marca debe corresponder al modelo y tener uso vehicular; las familias requieren habilitación explícita. No se infieren vehículos ni compatibilidades.
- Años enteros entre 1886 y 2100, con intervalo coherente. Un año se registra con ambos extremos iguales; desconocido se conserva como ambos nulos y se presenta como «Años no especificados». Para el mismo modelo se rechazan duplicados, rangos solapados y la combinación de una fila sin años con otras de ese modelo. Rangos separados se conservan sin fusionarse.
- Los modelos inactivos conservan sus asociaciones previas, pero no admiten declaraciones nuevas ni cambios de años. Las ofertas antiguas sin asociaciones siguen funcionando. Las ediciones normales de precio/stock conservan las declaraciones, incluso si luego se deshabilita la familia.
- Lectura y reemplazo explícito de asociaciones mediante GET/PUT por local y oferta. Dueño o administrador, comprobación de pertenencia de la oferta, contrato vigente para guardar y validaciones de local, dueño, familia y referencias dentro de la transacción. El cambio y su historial se guardan juntos; un rechazo no sustituye la lista anterior. Enviar `[]` retira explícitamente las declaraciones.
- Editor en el catálogo del dueño y acceso «Vehículos» en el catálogo administrativo del local. Cada fila permite marca, modelo y años; el guardado es explícito con «Guardar vehículos». Los controles aparecen conforme a la autorización del servidor, y las declaraciones previas permanecen legibles al desactivar nuevas escrituras.
- La API exige `VEHICLE_APPLICATIONS_ENABLED=true` **y** el ID del local en `VEHICLE_APPLICATION_PILOT_STORE_IDS`, también para administradores. Se conserva esta configuración en CI. La configuración desplegada está deshabilitada y no contiene locales piloto; no se abre todavía el recorrido público automotriz.
- Migración `018-offer-vehicle-applications.sql` aplicada a la misma base. Nueva tabla hija con FK a oferta y combinación modelo/marca, comprobación de años, unicidad, permisos privados y borrado de hijos al eliminar la oferta. Codec, mappings, columnas y diagramas actualizados; los cambios de oferta invalidan la caché mediante el mecanismo existente.
- Respaldo previo privado fuera del repositorio, con restauración de **65 tablas/12.514 filas** en una base aislada. Contenido coincidente antes y después de probar la migración. En producción se compararon marcas, usos, modelos, familias, productos, ofertas, cotizaciones, imágenes, locales y usuarios con el respaldo; no se inventaron asociaciones. No incluye Firebase Authentication ni sustituye un plan permanente de respaldos.
- **168 pruebas de backend y 218 de frontend aprobadas**, más compilación de producción. Pruebas de asociaciones, permisos, piloto, modelos inactivos, intervalos, conservación de datos y persistencia SQL; en Cloud SQL se comprobó también el usuario runtime y una edición de precio después de deshabilitar la familia. Las escrituras de comprobación se revirtieron. La revisión visual manual sigue pendiente por ausencia de navegador conectado; persisten las advertencias previas de CSS y del entorno de pruebas.
- Hosting y API publicados, conservando 178 bundles anteriores. Comprobaciones posteriores: ocho marcas comerciales, 101 familias y los mismos 856 resultados de búsqueda; endpoints nuevos protegidos contra acceso anónimo y bundle del editor disponible. Smoke aprobado con 856 productos/3.424 ofertas activas, detalle, HTML, canonical, JSON-LD, sitemap y 404. PostgreSQL continúa activo, la ampliación queda deshabilitada y hay cero locales piloto.

### Actualización de textos y conexiones — 13 de octubre de 2026

- Portada: «Encuentra lo que necesitas. Compara mejor.», creación de cotizaciones con productos y sección «Explora el catálogo». Menú, directorio, paneles, detalle, cotizaciones, PDF y mensajes de WhatsApp usan «locales» y «productos» donde corresponde. Los tipos de negocio conservan sus etiquetas específicas.
- Condición presentada como «Condición de esta publicación» y asociaciones como «Vehículos declarados por el vendedor». Metadatos SEO, HTML inicial de productos, aviso de prueba y solicitud de acceso por WhatsApp alineados con la terminología general. Se conservan rutas, IDs, roles y el significado de los campos existentes.
- Se corrigió el despliegue de CI para conservar, además de PostgreSQL y el piloto automotriz, la configuración pública de R2 y `PILOT_STORES_ENABLED`. Los secretos permanecen vinculados mediante Firebase; no se copian contraseñas ni claves R2 al archivo de configuración generado. Dos pruebas nuevas verifican esta conservación y el selector SQL.
- Validación: 170 pruebas de backend y 218 de frontend aprobadas, compilación de producción y comprobación del grafo de bundles activo con los textos finales. Hosting y API publicados, conservando 177 bundles anteriores. Se invalidó la caché derivada del catálogo para actualizar los textos calculados, sin modificar productos, precios, stock ni cotizaciones guardadas.
- Comprobaciones públicas: nuevos textos de portada, bundle administrativo actual, R2 habilitado, locales de prueba activos, referencias vehiculares disponibles y endpoints de asociaciones protegidos. PostgreSQL continúa conectado y se mantiene la habilitación gradual de asociaciones. La revisión visual manual sigue pendiente por falta de navegador conectado.

### Portada y catálogo inicial de repuestos — 13 de octubre de 2026

- Nueva portada de taller con materiales, herramientas y piezas automotrices. Se conserva la imagen anterior y se publican versiones WebP optimizadas. [Archivos y prompts de ImageGen](imagenes-portada-repuestos-2026-10-13.md).
- El inicio muestra un material, una herramienta y hasta dos repuestos, conserva los IDs, enlaces y precios de la API al completar la carga y evita productos duplicados. Incluye el acceso a «Repuestos automotrices» entre las seis categorías visibles.
- Se incorporan cuatro fichas base: alternador, amortiguador, filtro de aceite y pastillas de freno. El importador crea una categoría, dos subcategorías, cuatro familias y cuatro maestros en PostgreSQL; conserva un recibo privado y no sobrescribe registros existentes. Segunda ejecución comprobada sin nuevas escrituras. No requiere cambios de esquema.
- Las fichas tienen imágenes genéricas generadas e identificadas como referenciales. No se crean ofertas, precios, stock, marcas comerciales ni compatibilidades. El catálogo pasa a 860 productos y conserva las 3.424 ofertas activas anteriores; los cuatro repuestos tienen cero ofertas. Las familias permiten referencias vehiculares, pero la configuración de asociaciones sigue deshabilitada y sin locales piloto.
- La caché pública conserva el origen y la indicación de imagen referencial y cambia su política para reconstruir los snapshots anteriores. No expone metadatos editoriales privados.
- Validación: 174 pruebas de backend y 219 de frontend aprobadas, más compilación de producción. Comprobaciones públicas de selección del inicio, búsqueda automotriz, fichas sin ofertas, imágenes, páginas de productos y categoría, junto con el smoke de producción. La revisión visual en navegador queda pendiente por ausencia de navegador conectado; se revisaron los archivos de imagen.

### Selector de local y filtros públicos de vehículos — 13 de octubre de 2026

- El buscador usa «Local» y carga ferreterías, tiendas de repuestos y desarmadurías desde el mismo directorio público. Se conserva el parámetro `ferreteriaId` para enlaces existentes.
- Marca, modelo y año del vehículo en Repuestos automotrices, independientes del fabricante del producto. Opciones del catálogo vehicular real, modelo limitado a su marca y selecciones dependientes limpiadas al cambiar marca/modelo. Estado vacío y reintento de referencias; los filtros quedan guardados en la URL.
- Búsqueda y detalle filtran por combinaciones completas declaradas en cada oferta, antes de calcular precios, cantidad de locales y paginación. Años desconocidos no se tratan como todos los años. Los filtros combinan texto, taxonomía, local y radio; las fichas sin asociaciones no se presentan como compatibles.
- Declaraciones normalizadas de ofertas públicas en la caché, con nueva política de reconstrucción. No se cambia el esquema SQL ni se crean ofertas o compatibilidades para demostrar resultados. Se cargaron seis marcas y trece modelos de referencia, con nombres respaldados por fuentes primarias, conservando las relaciones existentes. [Manifiesto y fuentes](catalogo-vehiculos-inicial.md). Se conservan la configuración de escrituras del piloto y los datos existentes.
- Validación: 180 pruebas de backend y 234 de frontend aprobadas; combinaciones, límites de años, aislamiento de ofertas, precios, paginación, parámetros inválidos, UI y continuidad al abrir/reintentar el detalle. Compilación de producción y comprobaciones públicas. La revisión visual en navegador continúa pendiente por falta de navegador conectado. [Contrato actualizado](asociaciones-vehiculos.md).

### Semilla automotriz con años y ofertas de prueba — 13 de octubre de 2026

- Se utilizan seis marcas, trece modelos y cuatro maestros existentes. Se incorporan dos locales y sus usuarios SQL de prueba: tienda de repuestos y desarmaduría; ocho ofertas con precio/stock/condición simulados y veinticuatro asociaciones completas de marca/modelo/rangos de años. [Manifiesto, ejemplos y carga](semilla-repuestos-vehiculos.md).
- Un mismo maestro/modelo puede tener varios intervalos disjuntos en una oferta. Corolla 2010 encuentra el alternador en dos locales; Corolla 2018 solo en uno; el año 2013 del hueco no se incluye. Los filtros y precios operan sobre las ofertas que coinciden y conservan el contexto al abrir la ficha.
- Registros identificados con `esPrueba`, lote y nombres «(Prueba)». Las condiciones advierten que asociaciones, precios y stock son simulados y no acreditan compatibilidad real ni disponibilidad comercial. No se crean cuentas de Firebase Authentication, contratos firmados o vehículos vinculados a compradores reales.
- Carga transaccional en el mismo catálogo SQL, sin cambios de esquema ni sobrescribir datos anteriores. Recibo privado previo, validación de relaciones/IDs/familias y repetición sin cambios. Se conserva la configuración de escrituras del piloto y el límite de una oferta por maestro/local.
- Validación: 25 pruebas de semilla/PostgreSQL aprobadas, más comprobaciones públicas de intervalos, huecos, precio, local, detalle y catálogo. Se conservan 860 maestros y las 3.424 ofertas anteriores; se agregan ocho ofertas de prueba, total 3.432 activas. El punto 6A sigue pendiente.

### Maestros automotrices por variante — 14 de octubre de 2026

- Pieza, marca/modelo del vehículo, rango de años y especificación en el maestro; nombre generado, fabricante separado y galería independiente. Formulario administrativo para compatibilidad y creación de variantes; el vendedor conserva precio/stock/condición por oferta. [Contrato actualizado](productos-maestro-automotrices.md).
- Migración `019-product-vehicle-applications.sql` aplicada, codec/mappings/metadatos y diagramas actualizados. Relaciones producto/modelo/marca y rangos completos, RLS, identidad única para variantes activas y validaciones de oferta. Respaldo privado de tablas afectadas; se comprobó conservación de los datos anteriores al ampliar el esquema.
- Filtros sobre compatibilidad del maestro, con descubrimiento de fichas sin ofertas. La API/caché pública y detalle conservan los campos; las ofertas no amplían los vehículos del maestro. Cambiar compatibilidad con ofertas publicadas requiere otra variante.
- Conversión transaccional del lote de prueba: 26 maestros específicos (incluidos dos radiadores KUV100 sin ofertas), 24 ofertas, siete marcas/catorce modelos; cuatro maestros genéricos y ocho ofertas anteriores archivados con IDs conservados. Se mantienen precios/condiciones y las 71 unidades simuladas del lote. Segunda preparación sin nuevas escrituras pendientes. Las fotos genéricas no se reutilizan como fotos de variantes específicas.
- Validación: 190 pruebas de backend y 236 de frontend aprobadas, más compilación de producción. Tras ajustar clasificación y formulario se comprobaron también 27 pruebas de API/SQL y siete del formulario. Comprobaciones públicas de rangos, precios, fichas sin ofertas, SEO/HTML y semilla; SQL confirma 26 aplicaciones normalizadas. Catálogo activo: 882 maestros/3.448 ofertas. La revisión visual manual sigue pendiente por falta de navegador conectado. El punto 6A conserva su alcance pendiente.

### Ampliación de catálogo KUV100 y desarmadurías de prueba — 2026-10-14

- Se cargó el [lote ampliado KUV100](semilla-kuv100-ampliada.md): 44 maestros por pieza/código e intervalo de años, 53 URLs de imágenes y cuatro galerías con varias vistas. Incluye focos delanteros/traseros, neblineros, biseles, carrocería, luneta, instrumentos, distribución, sensores, embrague, dirección y frenos.
- Tres nuevas desarmadurías ficticias aportan 110 ofertas (44, 44 y 22). Cada maestro tiene ofertas en dos o tres locales, con precios, condiciones y stock simulados. Las ofertas heredan la compatibilidad del maestro. No se crean cuentas de autenticación ni contratos firmados ficticios.
- Las fuentes quedan enlazadas en cada ficha y en el manifiesto. Todas las compatibilidades siguen siendo referenciales: se distingue el año declarado por el proveedor del intervalo editorial de prueba; las imágenes externas ilustran la referencia de catálogo, no una unidad física de las desarmadurías. Se descartaron marcadores sin imagen y copias idénticas de una misma galería.
- Importador transaccional de creación exclusiva, idempotente, con recibo previo privado y validación de identidad. Conserva las fichas y ofertas anteriores y no requiere una nueva migración de esquema. Se crearon 173 registros; la segunda preparación devuelve cero pendientes. Validación: 194 pruebas de backend y smoke público aprobados. Catálogo activo: 926 maestros/3.558 ofertas. Se comprobaron filtros públicos por vehículo, años 2016–2024 y local, incluyendo exclusión fuera de rango.

### Lote de 200 productos adicionales — 2026-10-14

- [Manifiesto y fuentes de la ampliación](semilla-expansion-200.md): 100 repuestos (30 KUV100, 25 Scorpio, 24 XUV500, 14 Accent y siete Rio) y 100 productos de herramientas/construcción de 21 marcas, con 244 imágenes externas y 400 ofertas de prueba, dos locales por maestro.
- Se seleccionan referencias y códigos distintos del catálogo anterior. La compatibilidad permanece referencial y distingue intervalos declarados por el proveedor de intervalos editoriales para probar filtros. Las fotos ilustran referencias de catálogo; precios, stock y condiciones de oferta son simulados.
- Se reutilizan locales/propietarios sintéticos existentes. Se agregan dos modelos vehiculares y tres familias, conservando los usos previos de las marcas. No se requiere otra migración de esquema.
- Importación reanudable en bloques atómicos de 20 maestros y sus ofertas, con respaldo previo privado, validación de identidad y conservación de ediciones anteriores. Las 198 pruebas de backend pasaron, incluidas persistencia normalizada, caché, idempotencia, rechazo de IDs ajenos y reversión de bloques inválidos.
- Carga aplicada: 621 registros nuevos y ampliación del uso de Mahindra a fabricante; reanudación comprobada desde 80 productos, sin reescribir los bloques anteriores. SQL confirmó conservación de los 930 maestros previos (926 activos) y las marcas previas; la API conservó las 3.558 ofertas anteriores. La segunda preparación devuelve cero creaciones. Filtros por vehículo/año/local comprobados para los cinco modelos del lote.
- Catálogo público final: 1.126 productos/3.958 ofertas activas, con galerías, fichas y filtros de fabricante comprobados. Compilación de producción correcta y despliegue de Hosting/API completado desde una copia aislada; configuración de SQL, R2, locales piloto y enlaces a secretos conservada.

El siguiente punto es el **6A: selección exacta de publicación y captura de datos/precios en cotizaciones**. Los puntos 6A–12 permanecen pendientes. El punto 5 prepara asociaciones sobre ofertas existentes; todavía no habilita publicaciones múltiples ni snapshots automotrices en cotizaciones/PDF. Los filtros públicos de vehículos ya están implementados sobre declaraciones guardadas.

### Más desarmadurías y consultas por WhatsApp — 2026-10-14

- [Lote y funcionamiento del contacto](semilla-desarmadurias-whatsapp.md): cuatro desarmadurías ficticias adicionales, con 20 ofertas cada una (80 nuevas). Reutilizan maestros automotrices e incluyen referencias compartidas de focos/neblineros para comparar disponibilidad simulada entre locales.
- Número de prueba autorizado por el usuario en las ocho desarmadurías. Botón con icono de WhatsApp en tarjetas/fichas de locales y en las ofertas de producto; borrador genérico desde el directorio y consulta con producto/local/enlace desde su ficha. Los mensajes de locales piloto indican que son de prueba. Sin envío automático ni uso del teléfono privado del propietario como alternativa.
- Carga transaccional aplicada: 88 registros nuevos y cuatro contactos actualizados; no crea cuentas de autenticación ni modifica el esquema. Preserva datos existentes y precios editados al repetir. La API confirma 1.126 maestros, 4.038 ofertas activas y 13 locales públicos, ocho de ellos desarmadurías de prueba. La segunda preparación devuelve cero creaciones y cero actualizaciones de contacto.
- Validación: 241 pruebas de frontend aprobadas. Las 202 pruebas de backend aprobaron tras generar la plantilla compilada para las comprobaciones de HTML. Compilaciones de producción y funciones correctas; advertencias de presupuestos CSS preexistentes. El alcance pendiente del punto 6A se conserva.
