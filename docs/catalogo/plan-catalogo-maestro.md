# Plan de catálogo maestro CotizApp

Fecha de investigación: **5 de octubre de 2026**. Estado: propuesta para revisión e incorporación por tandas. Mercado inicial: construcción y ferretería en Chile.

Implementación y uso: [implementacion.md](implementacion.md).

## Resultado y alcance

Propuesta de **18 categorías, 80 subcategorías, 101 familias y 816 tipos de producto**, más **18 referencias comerciales investigadas**. El inventario completo se enumera en este documento y está disponible en [inventario-propuesto.json](inventario-propuesto.json). Las referencias con atributos observados están en [ejemplos-investigados.json](ejemplos-investigados.json); el registro de fuentes, en [fuentes.json](fuentes.json).

Los 816 tipos son una propuesta editorial de cobertura: todavía no son 816 SKU verificados. Un tipo como «tornillo para madera» necesitará productos comerciales concretos por marca, modelo, medida y empaque. No se generaron combinaciones ficticias de tamaños/marcas. La implementación incorpora los tipos como productos base activos, sin fotos ni necesidad de ofertas de ferreterías. Las variantes comerciales se completan por separado. Las referencias investigadas están pendientes de completar antes de publicar.

Este es el listado completo de **esta primera propuesta**, no una afirmación de que contiene todos los productos existentes en las tiendas. Incluye obra gruesa, materiales, instalaciones, terminaciones, herramientas, faena y exterior. Electrodomésticos, decoración, muebles domésticos, automotriz y químicos agrícolas quedan para una expansión posterior. Los kits se incorporarán solamente cuando exista una ficha que detalle sus componentes.

## Qué aprendimos de las tiendas

Sodimac permite navegar por departamentos y por sistemas/materiales de conducción; sus listados también pueden incluir vendedores externos. La plataforma que muestra una ficha y quien vende el producto deben registrarse por separado. [Catálogo de gasfitería y electricidad](https://www.sodimac.cl/sodimac-cl/content/catalogo-proyectos-gasfiteria-electricidad), [tubos PPR](https://www.sodimac.cl/sodimac-cl/b/tubos-ppr).

Easy utiliza rutas como materiales → ladrillos/bloques/pastelones → bloques y materiales → aislación → térmico. Sus filtros de aislación incluyen material, espesor, marca y uso. Para tornillos utiliza una ruta de más de tres niveles, con filtros por medidas y material. En CotizApp conviene mantener tres niveles y representar medidas, uso y acabados como atributos. [Bloques](https://www.easy.cl/materiales-de-construccion/ladrillos-bloques-y-pastelones/bloques), [aislación térmica](https://www.easy.cl/materiales-de-construccion/aislacion/termico), [tornillos](https://www.easy.cl/ferreteria-y-gasfiteria/fijaciones-y-adhesivos/tornillos/tornillos-y-soberbios).

Construmart agrupa materiales en aglomerantes, acero, prefabricados, tabiquería/aislación y techumbre, entre otros. Sus formatos publicados ayudan a identificar los atributos necesarios para placas, cubiertas y aislantes. Los valores incompletos de una sesión anónima no son precios utilizables. [Materiales de construcción](https://www.construmart.cl/materiales-de-construccion).

Las categorías de las tiendas sirven para organizar la búsqueda; la ficha local del fabricante debe respaldar prestaciones y compatibilidad. Sika Chile declara una presentación específica para Sikaflex-1A y Arauco muestra formatos de tableros: no se deben trasladar tamaños o prestaciones de una versión de otro país. [Sika Chile](https://chl.sika.com/es/construccion/sellado-y-pegadoelastico/selladores-para-pisos/sikaflex-1a.html), [Arauco Chile](https://new.arauco.com/chile/ayuda-para-tus-proyectos/optimizador-de-corte/).

**Límite de la investigación:** parte de Sodimac y Easy se revisó mediante extractos indexados de sus páginas oficiales porque la apertura completa estaba limitada. La indexación puede ser anterior a la consulta. El registro final identifica este estado; no se verificó disponibilidad, precios actuales ni la totalidad de sus menús. Las clasificaciones mezcladas o marcas ambiguas se revisarán, en vez de replicarlas automáticamente.

## Estructura que usaremos

| Nivel | Ejemplo | Regla |
|---|---|---|
| Categoría | Maderas y tableros | Departamento estable; corresponde a `categoryId`. |
| Subcategoría | Tableros | Agrupación de navegación; corresponde a `subcategoryId`. |
| Familia | MDF | Comparte plantilla técnica; corresponde a `familyId`. |
| Atributo: tipo | MDF desnudo, ranurado o resistente a humedad | Característica del producto; no es un nivel adicional de navegación. |
| Producto maestro | Marca + línea/modelo + espesor + formato + empaque | Identidad comercial exacta compartida por las ferreterías. |
| Oferta de ferretería | Producto maestro + vendedor + SKU propio | Precio, stock, IVA, vigencia y condiciones de la tienda. |

Ejemplo: MDF de 15 mm y MDF de 18 mm no se fusionan; tampoco placa individual y paquete de placas. El color puede crear una variante comercial sin convertirse en categoría. «Volcanita», «Trupán» y otras denominaciones comerciales se conservan como marca/línea cuando corresponda; la búsqueda usa también términos genéricos como yeso cartón y MDF. Las familias de material abarcan varios tipos, pero las prestaciones obligatorias pueden depender del tipo seleccionado.

## Datos mínimos por producto comercial

1. Nombre normalizado, categoría, subcategoría, familia y tipo; marca y modelo/código fabricante, o ausencia de marca confirmada.
2. GTIN/EAN cuando exista y pueda validarse; código del fabricante; referencias de cada tienda por separado. Un número en la URL de Easy no es un GTIN.
3. Atributos de identidad aplicables: material, medidas, grado/serie, conexiones, color/acabado y presentación. Indicar unidades y conservar el texto original de la medida.
4. Unidad vendida y contenido: pieza, caja, saco, rollo, paquete o volumen. Separar cantidad de unidades, longitud total, masa neta y cobertura útil.
5. Descripción propia breve, uso declarado, restricciones relevantes y enlace de ficha técnica; documentos de seguridad cuando correspondan. No inventar prestaciones.
6. Procedencia por campo: URL, fabricante/tienda, fecha consultada, método de lectura, texto observado y persona revisora. Evidencias técnicas con versión y fecha del documento.
7. Imágenes y textos con evidencia de procedencia y uso conforme al [registro de contenido](../governance/content-rights-register.md). Esta investigación no descargó fotos ni copió descripciones comerciales.
8. Estado de revisión: `propuesto`, `investigado`, `validado`, `publicado`, `retirado`. Estos son estados propuestos para el proceso; no se asume que el backend ya los implemente.

Precio, stock, sucursal, comuna, IVA, condiciones y fecha de actualización pertenecen a **la oferta**, no al producto maestro. Un producto puede existir sin oferta. Ningún ejemplo de este documento contiene precios o stock inferidos.

## Normalización y comparación

- Guardar medidas numéricas en mm para geometría, m para longitudes vendidas, kg/l para contenido y m² para cobertura; conservar pulgadas, calibre y medidas nominales cuando definan compatibilidad. Sección eléctrica en mm², no mm.
- Diferenciar ancho total de ancho útil de una cubierta; superficie geométrica de cobertura vendida; medida nominal de medida real de madera y tubos.
- No convertir galones a litros sin confirmar el volumen declarado del producto. No convertir m³ de áridos a kg sin densidad documentada. No deducir resistencia térmica de un nombre comercial.
- No deducir piezas por caja con superficies redondeadas: el gres Forest declara 20 × 120 cm y 1,19 m² por caja. Registrar ambos y verificar la cantidad de piezas en la ficha. [Producto Easy](https://www.easy.cl/gres-porcelanato-forest-roble-20x120-cm-119-m2-1203478/p).
- Precio comparable: calcular por kg, l, m, m² o unidad únicamente con contenido confirmado y misma presentación/identidad. Mostrar también precio por empaque. No comparar productos técnicamente distintos como equivalentes.
- Valores ausentes = desconocido; no cero. Un precio «$0» de una página incompleta queda pendiente, no se publica como oferta gratuita.
- GTIN se conserva como texto, con ceros iniciales y validación de longitud/dígito. SKU de tiendas iguales no demuestra que sean el mismo producto. Sin GTIN, usar marca + código fabricante + atributos de identidad confirmados y revisión humana.
- Normas, certificaciones, resistencia estructural, propiedades al fuego, aptitud para agua potable y protección personal requieren evidencia específica del modelo; nunca se heredan solamente de la familia.
- La misma ficha indexada en varias tiendas no cuenta como múltiples confirmaciones independientes de una prestación. Ante contradicción, conservar ambas fuentes y bloquear aprobación hasta resolverla.

## Plantillas de características

El anexo enumera atributos por cada familia. Son **campos a investigar**, no valores técnicos asumidos. `identityCandidates` del JSON propone qué atributos pueden distinguir variantes; su obligatoriedad se define por tipo, no marcando todos los campos como obligatorios.

Todos los tipos llevan marca/modelo, identificación comercial, unidad/empaque y procedencia. Las medidas no aplicables quedan sin dato. En familias mixtas, por ejemplo cinta frente a masilla de juntas, la plantilla usa campos comunes y campos específicos condicionales. Las resistencias, presiones y rendimientos deben incluir condiciones de ensayo/uso y referencia técnica, además del número.

| Perfil | Características que deben permitir filtrar y comparar |
|---|---|
| Cementos/morteros | Tipo, masa neta, resistencia/clase declarada, aplicación, rendimiento y condiciones. |
| Aceros | Sección, espesor, largo, grado, recubrimiento y masa lineal cuando esté documentada. |
| Madera/tableros | Material/especie, formato, espesor, tratamiento, grado, humedad/exposición y borde. |
| Aislantes | Material, dimensiones, densidad, conductividad y resistencia térmica con espesor/condiciones. |
| Cubiertas | Perfil, material, espesor, largo, ancho total/útil y sistema compatible. |
| Químicos | Base, contenido, componentes, sustratos, curado, consumo condicionado y documentación. |
| Fijaciones | Diámetro/calibre, largo, rosca, cabeza, huella, material, recubrimiento y unidades. |
| Tuberías/fittings | Sistema/material, diámetros y roscas de cada conexión, unión, PN/serie y condiciones. |
| Electricidad | Modelo, tensión, corriente, sección/polos, IP y certificación específica. |
| Pinturas | Base, acabado, color/código, contenido, sustrato y rendimiento con manos/condiciones. |
| Pisos | Material, largo/ancho/espesor, terminación, caja/cobertura, instalación y prestaciones. |
| Herramientas | Modelo, energía/potencia, medidas/encastre, capacidad y composición exacta del kit. |
| EPP | Modelo, talla, clase, compatibilidad, norma/evidencia y vencimiento cuando corresponda. |

## Incorporación por tandas

La prioridad propuesta sigue dependencia de obra y cobertura inicial, no estadísticas de ventas que todavía no tenemos. Primero se aprueban las plantillas; después se completa un conjunto pequeño de SKU reales y se amplía con las ferreterías.

**Tanda 0 — preparación:** revisar taxonomía, sinónimos, unidades y plantillas; definir el expediente de fuentes y derechos; preparar importación en seco. Resultado: estructura aprobada y lista de campos mínimos por tipo.

**Piloto de la tanda 1:** completar 50 SKU reales repartidos entre cemento/mortero, ladrillos/bloques, barras/mallas, pino dimensionado, OSB/terciado/MDF, yeso cartón, aislación y cubiertas. Los 50 son una meta de trabajo, no productos ya obtenidos. Al menos cinco fichas revisadas por cada una de estas ocho áreas; las diez restantes cubren huecos. Confirmar variantes existentes, sin fabricar combinaciones para llegar a la meta.

Después del piloto: lotes de **100–150 SKU comerciales verificados**. Como objetivo inicial, alcanzar 1.000 SKU: 250 de tanda 1 y 125 de cada tanda 2–7. No equivale a cubrir los 816 tipos: algunos necesitarán muchas variantes y otros se dejarán pendientes si no hay proveedor/evidencia. La cobertura por tipo se informa separadamente del total de SKU.

| Tanda | Alcance | Tipos propuestos | Meta inicial de SKU reales |
|---|---|---:|---:|
| 1 | Obra gruesa, acero, madera, tabiquería, aislación y techumbre | 189 | 250 |
| 2 | Químicos, adhesivos, fijaciones y herrajes | 93 | 125 |
| 3 | Gasfitería y electricidad | 118 | 125 |
| 4 | Iluminación, energía, pinturas y pisos | 109 | 125 |
| 5 | Puertas, ventanas, baño, cocina y agua caliente | 72 | 125 |
| 6 | Herramientas, consumibles, maquinaria y faena | 144 | 125 |
| 7 | Seguridad, jardín, riego y cercos | 91 | 125 |

**Salida de cada lote:** fichas investigadas + fichas validadas + pendientes con causa; reporte de duplicados; cambios de taxonomía; evidencia técnica y de contenido; archivo de importación validado y resumen de altas/actualizaciones. Se procesan primero las familias prioritarias; cada lote puede distribuirse entre varias tandas según datos disponibles de las ferreterías.

**Criterios para publicar:** 100% de SKU publicados con identidad, familia, empaque/unidad y fuente; cero GTIN inválidos, referencias de familia huérfanas o duplicados exactos; atributos obligatorios por tipo completos; ninguna prestación sin respaldo ni precio/stock inventado; contenido con evidencia de uso. Los registros incompletos quedan pendientes y no cuentan como SKU publicados.

**Responsabilidades:** administrador aprueba taxonomía y altas maestras; encargado de catálogo investiga y normaliza; revisor comprueba atributos/evidencia; cada ferretería confirma únicamente sus ofertas y contenidos autorizados. Para un equipo pequeño, una persona puede asumir varios roles dejando registrada cada revisión.

## Cómo encaja en el código actual

El modelo existente tiene `TaxonomyOption`, `FamilyTemplate` y `CatalogProduct` en [app.models.ts](../../src/app/core/models/app.models.ts). Ya separa categoría/subcategoría/familia y dispone de `specValues`, marca, tipo, empaque y campos de derechos. El backend dispone de rutas de taxonomía y productos maestros, con atributos asociados por separado.

| Elemento de este plan | Destino o trabajo requerido |
|---|---|
| IDs y relaciones de taxonomía | Mapear a categorías/subcategorías/familias; conservar mapa de IDs si ya existen equivalentes. |
| Características por familia | Transformar a `FamilyTemplate.specFields` con tipo, unidad y obligatoriedad revisados. |
| Tipo de producto | `productType`; agregar validación de tipo contra su familia al importar. |
| Datos técnicos | `specValues` actualmente almacena cadenas; diseñar normalización numérica para filtros/comparaciones. |
| Producto comercial | Producto maestro y atributos; no crear una oferta sin precio/stock confirmados por vendedor. |
| Imágenes/textos | Completar `imageRights`/`contentRights` y referencias del registro antes de publicación. |
| Áridos por volumen | `measurementUnit` admite kg/l/m/m²/m³/unidad; soporte de m³ incorporado en ofertas y comparación. |
| GTIN y varios identificadores | Verificar persistencia y unicidad; separar código fabricante, código de tienda y GTIN. |
| Procedencia y revisión | Diseñar almacenamiento por campo/documento; los estados del plan aún no son estados del backend. |
| Campos condicionales | Revisar soporte de plantilla por tipo para familias mixtas; el esquema actual no expresa todas las condiciones. |

Estos JSON son la fuente editorial del importador `npm run catalog:import`, que los adapta al esquema de Firestore. La importación crea taxonomía, plantillas y productos base activos; conserva registros existentes y no crea ofertas, precios ni stock.

Secuencia de carga: exportar estado actual y preparar reversión → resolver equivalencias de taxonomía → validar plantillas → validar/normalizar productos en un área de preparación → ejecutar vista previa de altas y actualizaciones → aplicar lote con identificador e idempotencia → comprobar relaciones y fichas → habilitar ofertas de ferreterías. Un rechazo debe identificar la fila y el campo; una actualización no elimina ofertas ni cambia su precio. No usar nombres visibles como claves ni borrar el catálogo para reimportarlo.

## Referencias investigadas: punto de partida del piloto

Cada fila muestra únicamente atributos observados en una fuente oficial directa o indexada. **Ninguna es una ficha comercial completamente validada**. No se usaron GTIN, precios, stock ni imágenes. El JSON detalla pendientes y modo de lectura. La familia sugerida se revisa cuando la fuente no acredita su aptitud: por ejemplo, «mueblería» no demuestra uso estructural.

| Referencia | Marca observada | Características observadas | Fuente | Pendiente antes de publicar |
|---|---|---|---|---|
| Placa Volcanita RH BR | Volcán | espesorMm: 12.5; anchoMm: 1200; largoMm: 2400; superficieDeclaradaM2: 2.88 | [S12](https://tienda.volcan.cl/products/5000598-volcanita-rh-br-125-x-12-x-24) | Presentación vendida, código comercial y ficha técnica vigente. |
| MDF TRUPAN 15 mm | Arauco | espesorMm: 15; anchoMm: 1520; largoMm: 2440 | [S13](https://new.arauco.com/chile/ayuda-para-tus-proyectos/optimizador-de-corte/) | SKU/GTIN, grado exacto y presentación. |
| ARAUCOPLY Master mueblería 18 mm | Arauco | espesorMm: 18; anchoMm: 1220; largoMm: 2440 | [S13](https://new.arauco.com/chile/ayuda-para-tus-proyectos/optimizador-de-corte/) | Revisar familia: la línea mueblería no acredita uso estructural; grado y SKU pendientes. |
| Sikaflex-1A gris | Sika | baseQuimica: poliuretano; componentes: 1; contenidoUnipackMl: 600; unipacksPorCaja: 20 | [S14](https://chl.sika.com/es/construccion/sellado-y-pegadoelastico/selladores-para-pisos/sikaflex-1a.html) | Confirmar oferta por unipack o por caja; SKU/GTIN y versión de hoja técnica. |
| Bloque de hormigón liso | Bottai | dimensionesDeclaradasCm: 19 × 19 × 39 | [S04](https://www.easy.cl/materiales-de-construccion/ladrillos-bloques-y-pastelones/bloques) | Orientación largo/ancho/alto, resistencia, peso, SKU y uso estructural. |
| Tablero OSB 11,1 mm | Por confirmar | espesorMm: 11.1; anchoMm: 1220; largoMm: 2440 | [S07](https://www.easy.cl/materiales-de-construccion/maderas-y-tableros/tableros) | Marca real, grado, SKU/GTIN y aptitud estructural; familia provisional. |
| MDF Durolac blanco | Arauco | espesorMm: 2.8; anchoMm: 1520; largoMm: 2440; color: blanco | [S07](https://www.easy.cl/materiales-de-construccion/maderas-y-tableros/tableros) | Código de diseño, SKU/GTIN y caras revestidas. |
| Tablero OLB 8 mm | Masisa | espesorMm: 8; anchoMm: 1220; largoMm: 2440 | [S07](https://www.easy.cl/materiales-de-construccion/maderas-y-tableros/tableros) | Grado y aptitud estructural; revisar familia antes de aprobar. |
| Tapacanto encolado blanco | Rehau | anchoMm: 21; largoM: 10; color: blanco | [S07](https://www.easy.cl/materiales-de-construccion/maderas-y-tableros/tableros) | Material, espesor, SKU/GTIN y unidad vendida. |
| Porcelanato concreto 60 × 60 | Baldara | anchoMm: 600; largoMm: 600; areaCajaM2: 1.44; codigoRetailer: 1102919 | [S16](https://www.easy.cl/porcelanato-piso-muro-60x60-cm-concreto-144-m2-baldara-1102919/p) | Espesor, acabado, rectificado, GTIN y resistencia documentada. |
| Gres porcelanato Forest Roble | Cañuelas | anchoMm: 200; largoMm: 1200; areaCajaM2: 1.19; codigoRetailer: 1203478 | [S17](https://www.easy.cl/gres-porcelanato-forest-roble-20x120-cm-119-m2-1203478/p) | Piezas por caja, acabado, espesor y GTIN. |
| Taladro percutor atornillador GSB 183-LI | Por confirmar | modelo: GSB 183-LI; tensionV: 18; mandrilMm: 13; codigoRetailer: 1432830 | [S18](https://www.easy.cl/taladro-percutor-atornillador-13-mm-18v-gsb-183-li-1432830/p) | Marca y kit exacto en ficha vigente; baterías/cargador, GTIN y código fabricante. |
| Tubo PPR PN16 | Hoffens | diametroNominalMm: 20; largoM: 3; PN: PN16; vendedorObservado: Imperial | [S03](https://www.sodimac.cl/sodimac-cl/b/tubos-ppr) | SKU/GTIN, espesor, serie y temperatura de referencia del PN. |
| Cable libre de halógeno negro | Nexans | seccionMm2: 6; conductores: 1; largoM: 100; color: negro | [S15](https://www.sodimac.cl/sodimac-cl/lista/CATG36440/Cable-libre-de-halogeno) | Modelo, tensión, clase conductor, certificación, SKU/GTIN y presentación. |
| Plancha acanalada zinc aluminio AZ-150 | Cintac | espesorMm: 0.35; anchoTotalMm: 851; largoMm: 3660; recubrimientoDeclarado: AZ-150 | [S09](https://www.construmart.cl/materiales-de-construccion) | Ancho útil, SKU/GTIN, tolerancia y ficha técnica. |
| Teja Asturias negra | Inppa | espesorMm: 0.4; anchoTotalMm: 1010; largoMm: 3660; color: negro | [S09](https://www.construmart.cl/materiales-de-construccion) | Cobertura útil, código fabricante y sistema de montaje documentado. |
| Aislante Fisiterm | Feltrex | anchoM: 2.4; largoM: 15; areaDeclaradaM2: 36 | [S09](https://www.construmart.cl/materiales-de-construccion) | Espesor, densidad, resistencia térmica, composición y SKU. |
| Lana de vidrio R122 | Volcán | espesorMm: 50; anchoM: 1.2; largoM: 24; areaDeclaradaM2: 28.8; denominacionComercial: R122 | [S09](https://www.construmart.cl/materiales-de-construccion) | Resistencia térmica y unidad en ficha; R122 no se convierte automáticamente a valor R. |

## Inventario completo propuesto

Estructura aprobada: **categoría → subcategoría → familia → producto concreto**. Los tipos listados son atributos y borradores para completar; no un quinto nivel de navegación. Color, espesor, largo, ancho, acabado, marca/modelo y empaque distinguen variantes comerciales. Se incluyen solamente combinaciones existentes y verificadas.

Ejemplo ilustrativo: Maderas y tableros → Tableros → MDF → MDF negro 15 mm, o MDF negro 18 mm, con marca, línea, formato y presentación confirmados. Negro/rojo son filtros de color; 15/18 mm son filtros de espesor. Este ejemplo no acredita que esas combinaciones estén disponibles en un proveedor.

### Obra gruesa

Tanda 1 · 6 familias · 42 tipos.

#### Aglomerantes

**Cementos y cales** (`fam-cementos-y-cales`).

Tipos a incorporar:

- Cemento de uso general.
- Cemento de alta resistencia inicial.
- Cemento para albañilería.
- Cemento blanco.
- Cal hidratada.
- Cal para mortero.

Características a investigar: masa neta kg, presentación, tipo de ligante, clase declarada, rendimiento con condiciones, ficha técnica.

**Morteros predosificados** (`fam-morteros-predosificados`).

Tipos a incorporar:

- Mortero de pega de ladrillos.
- Mortero de pega de bloques.
- Mortero de estuco.
- Mortero de reparación.
- Mortero de nivelación.
- Mortero autonivelante.
- Mortero de relleno.
- Grout cementicio.

Características a investigar: masa neta kg, presentación, aplicación, resistencia declarada, espesor de aplicación, rendimiento con condiciones, ficha técnica.

#### Áridos

**Áridos de construcción** (`fam-aridos-de-construccion`).

Tipos a incorporar:

- Arena fina.
- Arena gruesa.
- Arena de estuco.
- Gravilla.
- Grava.
- Ripio.
- Estabilizado.
- Base granular.

Características a investigar: material, unidad de venta, contenido declarado, granulometría, lavado, densidad declarada, humedad declarada.

#### Albañilería y prefabricados

**Ladrillos y bloques** (`fam-ladrillos-y-bloques`).

Tipos a incorporar:

- Ladrillo fiscal.
- Ladrillo cerámico hueco.
- Ladrillo princesa.
- Ladrillo refractario.
- Bloque de hormigón.
- Bloque de hormigón celular.
- Bloque de vidrio.

Características a investigar: material, dimensiones, presentación, geometría, resistencia declarada, uso estructural declarado, peso, color, ficha técnica.

**Pavimentos y elementos prefabricados** (`fam-pavimentos-y-elementos-prefabricados`).

Tipos a incorporar:

- Adoquín de hormigón.
- Pastelón de hormigón.
- Solera.
- Solerilla.
- Canaleta prefabricada.
- Tapa de cámara de hormigón.
- Peldaño prefabricado.
- Baldosa de cemento.

Características a investigar: material, dimensiones, presentación, resistencia declarada, acabado, peso, color, ficha técnica.

#### Hormigones

**Hormigones y mezclas secas** (`fam-hormigones-y-mezclas-secas`).

Tipos a incorporar:

- Hormigón predosificado.
- Hormigón de reparación.
- Hormigón para fundaciones.
- Mezcla para sobrelosa.
- Mezcla para radier.

Características a investigar: masa neta kg, presentación, resistencia declarada, árido máximo, rendimiento declarado, rendimiento con condiciones, ficha técnica.

### Acero y estructuras

Tanda 1 · 4 familias · 28 tipos.

#### Acero de refuerzo

**Barras y mallas de refuerzo** (`fam-barras-y-mallas-de-refuerzo`).

Tipos a incorporar:

- Barra estriada.
- Barra lisa.
- Malla electrosoldada.
- Escalerilla de albañilería.
- Estribo prefabricado.
- Barra de espera.

Características a investigar: material, sección o dimensiones, largo mm, espesor mm, presentación, grado, diámetro, cuantía o separación, masa lineal, acabado.

#### Perfiles

**Perfiles estructurales** (`fam-perfiles-estructurales`).

Tipos a incorporar:

- Perfil cuadrado.
- Perfil rectangular.
- Perfil tubular redondo.
- Ángulo de acero.
- Canal U.
- Perfil C.
- Viga I.
- Viga H.
- Pletina.
- Barra maciza cuadrada.

Características a investigar: material, sección o dimensiones, largo mm, espesor mm, presentación, sección, espesor, grado, masa lineal, acabado.

#### Planchas

**Planchas metálicas** (`fam-planchas-metalicas`).

Tipos a incorporar:

- Plancha de acero lisa.
- Plancha de acero diamantada.
- Plancha galvanizada lisa.
- Plancha de aluminio lisa.
- Plancha de acero inoxidable.
- Plancha desplegada.

Características a investigar: material, sección o dimensiones, largo mm, espesor mm, presentación, tipo de superficie, recubrimiento, masa lineal, acabado.

#### Uniones estructurales

**Conectores y soportes** (`fam-conectores-y-soportes`).

Tipos a incorporar:

- Escuadra estructural.
- Conector de viga.
- Soporte de poste.
- Placa de unión.
- Anclaje de estructura.
- Colgador de vigueta.

Características a investigar: material, dimensiones, presentación, capacidad declarada, sistema compatible, peso, color, ficha técnica.

### Maderas y tableros

Tanda 1 · 12 familias · 39 tipos.

#### Madera sólida

**Madera dimensionada y elaborada** (`fam-madera-dimensionada-y-elaborada`).

Tipos a incorporar:

- Pino dimensionado seco.
- Pino dimensionado verde.
- Pino cepillado.
- Pino impregnado.
- Cuartón de madera.
- Listón de madera.
- Tabla de madera.
- Viga laminada.

Características a investigar: especie, sección nominal, sección real mm, largo mm, tratamiento, humedad, dimensión nominal y real, grado declarado.

#### Tableros

**OSB** (`fam-osb`).

Tipos a incorporar:

- Tablero OSB estructural.
- Tablero OSB para revestimiento.

Características a investigar: material, largo mm, ancho mm, espesor mm, color, acabado, presentación, grado declarado, exposición declarada, ficha técnica.

**Terciados** (`fam-terciados`).

Tipos a incorporar:

- Terciado estructural.
- Terciado para moldaje.
- Terciado marino.
- Terciado ranurado.

Características a investigar: material, largo mm, ancho mm, espesor mm, color, acabado, presentación, grado declarado, exposición declarada, ficha técnica.

**OLB** (`fam-olb`).

Tipos a incorporar:

- Tablero OLB.

Características a investigar: material, largo mm, ancho mm, espesor mm, color, acabado, presentación, grado declarado, exposición declarada, ficha técnica.

**MDF** (`fam-mdf`).

Tipos a incorporar:

- Tablero MDF desnudo.
- Tablero MDF resistente a humedad.
- Tablero MDF ranurado.

Características a investigar: material, largo mm, ancho mm, espesor mm, color, acabado, presentación, grado declarado, exposición declarada, ficha técnica, color en masa o superficial, resistencia a humedad declarada, tipo de ranurado.

**Aglomerados** (`fam-aglomerados`).

Tipos a incorporar:

- Tablero de partículas.

Características a investigar: material, largo mm, ancho mm, espesor mm, color, acabado, presentación, grado declarado, exposición declarada, ficha técnica.

**Tableros melamínicos** (`fam-tableros-melaminicos`).

Tipos a incorporar:

- Tablero melamínico.

Características a investigar: material, largo mm, ancho mm, espesor mm, color, acabado, presentación, grado declarado, exposición declarada, ficha técnica, sustrato, código de diseño, caras revestidas.

**Tableros enchapados** (`fam-tableros-enchapados`).

Tipos a incorporar:

- Tablero enchapado.

Características a investigar: material, largo mm, ancho mm, espesor mm, color, acabado, presentación, grado declarado, exposición declarada, ficha técnica.

**HDF** (`fam-hdf`).

Tipos a incorporar:

- Tablero HDF.

Características a investigar: material, largo mm, ancho mm, espesor mm, color, acabado, presentación, grado declarado, exposición declarada, ficha técnica.

**Hardboard** (`fam-hardboard`).

Tipos a incorporar:

- Tablero hardboard.

Características a investigar: material, largo mm, ancho mm, espesor mm, color, acabado, presentación, grado declarado, exposición declarada, ficha técnica.

#### Terminaciones de madera

**Molduras y tapacantos** (`fam-molduras-y-tapacantos`).

Tipos a incorporar:

- Guardapolvo de madera.
- Cornisa de madera.
- Junquillo.
- Tapajunta.
- Cuarto rodón.
- Moldura MDF.
- Tapacanto melamínico.
- Tapacanto PVC.
- Tapacanto ABS.

Características a investigar: material, perfil, largo mm, ancho mm, presentación, adhesivo incorporado, espesor, color.

#### Revestimientos

**Revestimientos de madera y compuestos** (`fam-revestimientos-de-madera-y-compuestos`).

Tipos a incorporar:

- Machihembrado de madera.
- Siding de madera.
- Panel ranurado decorativo.
- Panel de listones.
- Deck de madera.
- Deck WPC.
- Revestimiento wall panel WPC.

Características a investigar: material, largo mm, ancho mm, espesor mm, presentación, perfil, sustrato, tratamiento, área nominal calculada, acabado.

### Tabiquería y aislación

Tanda 1 · 5 familias · 37 tipos.

#### Placas

**Placas de yeso cartón** (`fam-placas-de-yeso-carton`).

Tipos a incorporar:

- Placa de yeso cartón estándar.
- Placa de yeso cartón resistente a humedad.
- Placa de yeso cartón resistente al fuego.
- Placa de yeso cartón acústica.
- Placa de yeso cartón de alta dureza.
- Placa perforada para cielos.

Características a investigar: material, largo mm, ancho mm, espesor mm, presentación, tipo ST/RH/RF declarado, tipo de borde, masa por área, área nominal calculada, acabado.

**Placas cementicias y fibrocemento** (`fam-placas-cementicias-y-fibrocemento`).

Tipos a incorporar:

- Placa lisa de fibrocemento.
- Placa ranurada de fibrocemento.
- Placa cementicia.
- Placa para soporte de cerámica.
- Siding de fibrocemento.
- Panel de cemento reforzado.

Características a investigar: material, largo mm, ancho mm, espesor mm, presentación, composición, tipo de borde, acabado, área nominal calculada.

#### Perfilería liviana

**Perfiles para tabiques y cielos** (`fam-perfiles-para-tabiques-y-cielos`).

Tipos a incorporar:

- Montante de tabique.
- Canal de tabique.
- Perfil omega.
- Perfil de cielo.
- Ángulo perimetral.
- Perfil portante.
- Conector de perfilería.
- Suspensor de cielo.

Características a investigar: material, sección o dimensiones, largo mm, espesor mm, presentación, sistema, sección, espesor, masa lineal, acabado.

#### Aislación

**Aislantes térmicos y acústicos** (`fam-aislantes-termicos-y-acusticos`).

Tipos a incorporar:

- Lana de vidrio.
- Lana de roca.
- Aislante de fibra de poliéster.
- Aislante de fibra reciclada.
- Poliestireno expandido EPS.
- Poliestireno extruido XPS.
- Panel de poliuretano.
- Aislante reflectivo.
- Espuma acústica.

Características a investigar: material, espesor mm, largo mm, ancho mm, presentación, conductividad declarada, resistencia térmica declarada, reacción al fuego documentada, área útil declarada, densidad.

#### Terminación de tabiques

**Cintas masillas y esquineros** (`fam-cintas-masillas-y-esquineros`).

Tipos a incorporar:

- Masilla para juntas.
- Pasta de terminación.
- Cinta de papel para juntas.
- Cinta de fibra de vidrio.
- Esquinero metálico.
- Esquinero PVC.
- Banda acústica.
- Sellador acústico.

Características a investigar: tipo, contenido neto y unidad, presentación, sustrato compatible, tipo de refuerzo, ficha técnica, hoja de seguridad, vida útil declarada.

### Techumbre y evacuación de lluvia

Tanda 1 · 6 familias · 43 tipos.

#### Cubiertas

**Planchas de cubierta metálicas** (`fam-planchas-de-cubierta-metalicas`).

Tipos a incorporar:

- Plancha acanalada zinc aluminio.
- Plancha trapezoidal zinc aluminio.
- Plancha metálica prepintada.
- Teja metálica.
- Panel de cubierta aislado.
- Plancha ondulada galvanizada.

Características a investigar: material, sección o dimensiones, largo mm, espesor mm, presentación, perfil, recubrimiento, ancho útil, pendiente mínima documentada, masa lineal, acabado.

**Tejas y cubiertas no metálicas** (`fam-tejas-y-cubiertas-no-metalicas`).

Tipos a incorporar:

- Teja asfáltica.
- Teja de arcilla.
- Teja de hormigón.
- Plancha ondulada de fibrocemento.
- Plancha bituminosa.
- Teja plástica.

Características a investigar: material, dimensiones, presentación, perfil, cobertura útil, peso, color, ficha técnica.

#### Cubiertas traslúcidas

**Policarbonato y cubiertas plásticas** (`fam-policarbonato-y-cubiertas-plasticas`).

Tipos a incorporar:

- Policarbonato alveolar.
- Policarbonato compacto.
- Policarbonato ondulado.
- Plancha PVC traslúcida.
- Plancha de poliéster reforzado.
- Panel acrílico de cubierta.

Características a investigar: material, largo mm, ancho mm, espesor mm, presentación, estructura, protección UV, transmisión declarada, área nominal calculada, acabado.

#### Accesorios de cubierta

**Remates y fijaciones de cubierta** (`fam-remates-y-fijaciones-de-cubierta`).

Tipos a incorporar:

- Cumbrera metálica.
- Cumbrera para teja.
- Caballetes.
- Tapacán metálico.
- Limahoya.
- Limatesa.
- Tapagoteras.
- Perfil H para policarbonato.
- Perfil U para policarbonato.

Características a investigar: material, perfil, largo mm, ancho mm, presentación, sistema compatible, espesor, color.

#### Evacuación pluvial

**Canaletas y bajadas** (`fam-canaletas-y-bajadas`).

Tipos a incorporar:

- Canaleta PVC.
- Canaleta metálica.
- Bajada de agua PVC.
- Bajada de agua metálica.
- Codo de bajada.
- Unión de canaleta.
- Tapa de canaleta.
- Soporte de canaleta.
- Embudo de bajada.
- Rejilla de hojas.

Características a investigar: material, diámetro nominal y sistema, largo mm, presentación, sección, diámetro, tipo de unión, diámetro exterior mm, espesor mm.

#### Membranas

**Fieltros y barreras de cubierta** (`fam-fieltros-y-barreras-de-cubierta`).

Tipos a incorporar:

- Fieltro asfáltico.
- Membrana hidrófuga.
- Barrera de vapor.
- Membrana transpirable.
- Cinta de unión de membrana.
- Membrana autoadhesiva de cubierta.

Características a investigar: material, espesor mm, largo mm, ancho mm, presentación, función, permeabilidad declarada, masa por área, área útil declarada, densidad.

### Impermeabilización adhesivos y químicos

Tanda 2 · 5 familias · 39 tipos.

#### Impermeabilización

**Impermeabilizantes** (`fam-impermeabilizantes`).

Tipos a incorporar:

- Impermeabilizante cementicio.
- Impermeabilizante acrílico.
- Impermeabilizante asfáltico.
- Membrana líquida de poliuretano.
- Impermeabilizante elastomérico.
- Hidrorrepelente para fachada.
- Impermeabilizante para fundación.
- Manto asfáltico.

Características a investigar: tipo, contenido neto y unidad, presentación, base química, soporte, uso, consumo documentado, ficha técnica, hoja de seguridad, vida útil declarada.

#### Sellado

**Selladores y espumas** (`fam-selladores-y-espumas`).

Tipos a incorporar:

- Silicona acética.
- Silicona neutra.
- Silicona sanitaria.
- Sellador poliuretano.
- Sellador acrílico.
- Sellador híbrido.
- Espuma expansiva.
- Cordón de respaldo.
- Sellador refractario.

Características a investigar: tipo, contenido neto y unidad, presentación, base química, curado, movimiento declarado, compatibilidad, ficha técnica, hoja de seguridad, vida útil declarada.

#### Adhesivos

**Adhesivos de montaje y carpintería** (`fam-adhesivos-de-montaje-y-carpinteria`).

Tipos a incorporar:

- Cola fría.
- Adhesivo de contacto.
- Adhesivo de montaje.
- Adhesivo epóxico.
- Adhesivo cianoacrilato.
- Adhesivo para PVC.
- Adhesivo poliuretano.
- Adhesivo para pisos vinílicos.

Características a investigar: tipo, contenido neto y unidad, presentación, sustrato, tiempo abierto documentado, resistencia declarada, ficha técnica, hoja de seguridad, vida útil declarada.

#### Aditivos

**Aditivos para cemento y hormigón** (`fam-aditivos-para-cemento-y-hormigon`).

Tipos a incorporar:

- Aditivo hidrófugo.
- Acelerante de fraguado.
- Retardador de fraguado.
- Plastificante.
- Superplastificante.
- Puente de adherencia.
- Desmoldante.
- Curador de hormigón.

Características a investigar: tipo, contenido neto y unidad, presentación, función, dosificación documentada, ficha técnica, hoja de seguridad, vida útil declarada.

#### Reparación

**Reparadores y resinas** (`fam-reparadores-y-resinas`).

Tipos a incorporar:

- Masilla epóxica.
- Resina de inyección.
- Reparador de fisuras.
- Endurecedor superficial.
- Anclaje químico.
- Reparador de madera.

Características a investigar: tipo, contenido neto y unidad, presentación, composición, soporte, resistencia documentada, ficha técnica, hoja de seguridad, vida útil declarada.

### Fijaciones y herrajes

Tanda 2 · 6 familias · 54 tipos.

#### Fijaciones

**Tornillos** (`fam-tornillos`).

Tipos a incorporar:

- Tornillo para madera.
- Tornillo para yeso cartón.
- Tornillo autoperforante.
- Tornillo para cubierta.
- Tornillo para aglomerado.
- Tornillo para hormigón.
- Tornillo para máquina.
- Tornillo soberbio.
- Tornillo tirafondo.

Características a investigar: tipo, material, diámetro o calibre, largo mm, unidades por envase, tipo de cabeza, huella, rosca, recubrimiento, acabado, grado declarado.

**Clavos grapas y remaches** (`fam-clavos-grapas-y-remaches`).

Tipos a incorporar:

- Clavo corriente.
- Clavo para techo.
- Clavo de acero.
- Clavo para moldura.
- Grapa para madera.
- Grapa para cable.
- Remache pop.
- Remache estructural.

Características a investigar: tipo, material, diámetro o calibre, largo mm, unidades por envase, recubrimiento, tipo de cabeza, acabado, grado declarado.

**Pernos tuercas y arandelas** (`fam-pernos-tuercas-y-arandelas`).

Tipos a incorporar:

- Perno hexagonal.
- Perno coche.
- Perno de anclaje.
- Perno ojo.
- Espárrago roscado.
- Tuerca hexagonal.
- Tuerca autofrenante.
- Tuerca mariposa.
- Arandela plana.
- Arandela de presión.

Características a investigar: tipo, material, diámetro o calibre, largo mm, unidades por envase, rosca, grado, recubrimiento, acabado, grado declarado.

#### Anclajes

**Tarugos y anclajes** (`fam-tarugos-y-anclajes`).

Tipos a incorporar:

- Tarugo plástico.
- Tarugo para tabique.
- Anclaje de expansión.
- Anclaje tipo cuña.
- Anclaje hembra.
- Anclaje basculante.
- Anclaje de golpe.
- Camisa para anclaje químico.

Características a investigar: tipo, material, diámetro o calibre, largo mm, unidades por envase, sustrato, capacidad documentada, diámetro de perforación, acabado, grado declarado.

#### Herrajes

**Bisagras soportes y correderas** (`fam-bisagras-soportes-y-correderas`).

Tipos a incorporar:

- Bisagra de libro.
- Bisagra de cazoleta.
- Bisagra de portón.
- Bisagra piano.
- Corredera telescópica.
- Corredera de rodillo.
- Escuadra para repisa.
- Soporte para repisa.
- Pistón para mueble.

Características a investigar: material, dimensiones, presentación, capacidad documentada, apertura, compatibilidad, peso, color, ficha técnica.

#### Amarre

**Amarres cintas y cuerdas** (`fam-amarres-cintas-y-cuerdas`).

Tipos a incorporar:

- Abrazadera metálica.
- Abrazadera plástica.
- Cinta perforada.
- Zuncho.
- Cuerda de polipropileno.
- Cuerda de nylon.
- Cable de acero.
- Cadena de acero.
- Tensor de cable.
- Grillete.

Características a investigar: material, perfil, largo mm, ancho mm, presentación, resistencia documentada, ancho, espesor, color.

### Gasfitería y conducción de fluidos

Tanda 3 · 7 familias · 62 tipos.

#### Tuberías

**Tuberías para agua** (`fam-tuberias-para-agua`).

Tipos a incorporar:

- Tubo PVC hidráulico.
- Tubo PPR.
- Tubo PP-RCT.
- Tubo de cobre.
- Tubo PEX.
- Tubo multicapa.
- Tubo de polietileno.
- Tubo de acero galvanizado.

Características a investigar: material, diámetro nominal y sistema, largo mm, presentación, diámetro nominal, serie o PN, unión, temperatura declarada, diámetro exterior mm, espesor mm.

**Tuberías y accesorios sanitarios** (`fam-tuberias-y-accesorios-sanitarios`).

Tipos a incorporar:

- Tubo PVC sanitario.
- Tubo PVC de ventilación.
- Codo sanitario.
- Tee sanitaria.
- Yee sanitaria.
- Copla sanitaria.
- Reducción sanitaria.
- Tapón sanitario.
- Manguito sanitario.
- Registro sanitario.

Características a investigar: material, diámetro nominal y sistema, largo mm, presentación, diámetro nominal, unión, serie, uso, diámetro exterior mm, espesor mm.

#### Fittings

**Fittings de agua** (`fam-fittings-de-agua`).

Tipos a incorporar:

- Codo hidráulico PVC.
- Tee hidráulica PVC.
- Copla hidráulica PVC.
- Codo PPR.
- Tee PPR.
- Copla PPR.
- Unión americana PPR.
- Adaptador PPR roscado.
- Fitting de cobre.
- Fitting de bronce.
- Fitting PEX.
- Fitting de polietileno.

Características a investigar: tipo, material, conexiones y sistema, presentación, diámetros de entrada y salida, ángulo, rosca, unión, PN, presión nominal, ficha técnica.

#### Válvulas

**Llaves y válvulas** (`fam-llaves-y-valvulas`).

Tipos a incorporar:

- Llave de bola.
- Llave de paso.
- Llave de jardín.
- Válvula de retención.
- Válvula de compuerta.
- Válvula reductora de presión.
- Válvula de seguridad.
- Válvula flotador.
- Llave angular.

Características a investigar: tipo, material, conexiones y sistema, presentación, diámetro, rosca, presión, fluido compatible, presión nominal, ficha técnica.

#### Conexiones

**Flexibles sifones y desagües** (`fam-flexibles-sifones-y-desagues`).

Tipos a incorporar:

- Flexible para lavamanos.
- Flexible para WC.
- Flexible para lavadora.
- Sifón botella.
- Sifón tubular.
- Sifón flexible.
- Desagüe de lavamanos.
- Desagüe de lavaplatos.
- Desagüe de tina.
- Rejilla de piso.

Características a investigar: tipo, material, conexiones y sistema, presentación, conexión, longitud, compatibilidad, presión nominal, ficha técnica.

#### Gas

**Conducción y accesorios de gas** (`fam-conduccion-y-accesorios-de-gas`).

Tipos a incorporar:

- Flexible para gas.
- Regulador de gas.
- Llave de paso para gas.
- Tubo de cobre para gas.
- Fitting para gas.
- Conector de artefacto a gas.

Características a investigar: tipo, material, conexiones y sistema, presentación, combustible, conexión, presión, certificación documentada, presión nominal, ficha técnica.

#### Sellado de conexiones

**Consumibles de gasfitería** (`fam-consumibles-de-gasfiteria`).

Tipos a incorporar:

- Cinta PTFE.
- Sellador de roscas.
- Pasta para soldar cobre.
- Soldadura para cobre.
- Limpiador PVC.
- Empaque de goma.
- O-ring.

Características a investigar: tipo, contenido neto y unidad, presentación, fluido, compatibilidad, formato, ficha técnica, hoja de seguridad, vida útil declarada.

### Electricidad y canalización

Tanda 3 · 6 familias · 56 tipos.

#### Conductores

**Cables y alambres eléctricos** (`fam-cables-y-alambres-electricos`).

Tipos a incorporar:

- Alambre eléctrico rígido.
- Cable eléctrico flexible.
- Cable libre de halógenos.
- Cable multipolar.
- Cable concéntrico.
- Cable de tierra.
- Cable para panel solar.
- Cable de datos.
- Cable coaxial.

Características a investigar: tipo, modelo, tensión nominal V, presentación, sección mm², número de conductores, aislación, tensión, reacción al fuego documentada, ficha técnica, certificación y evidencia.

#### Canalización

**Tubos canaletas y cajas** (`fam-tubos-canaletas-y-cajas`).

Tipos a incorporar:

- Tubo conduit PVC.
- Tubo conduit metálico.
- Tubo corrugado.
- Canaleta eléctrica.
- Bandeja portacables.
- Escalerilla portacables.
- Caja de derivación.
- Caja de empalme.
- Caja para mecanismo.
- Curva de conduit.
- Prensaestopa.

Características a investigar: material, dimensiones, presentación, sección, grado IP documentado, sistema, peso, color, ficha técnica.

#### Mecanismos

**Interruptores enchufes y placas** (`fam-interruptores-enchufes-y-placas`).

Tipos a incorporar:

- Interruptor simple.
- Interruptor doble.
- Interruptor triple.
- Conmutador.
- Pulsador.
- Enchufe simple.
- Enchufe doble.
- Toma industrial.
- Placa de mecanismo.
- Dimmer.
- Toma USB.

Características a investigar: tipo, modelo, tensión nominal V, presentación, corriente nominal, tensión, tipo de conexión, serie, grado IP, ficha técnica, certificación y evidencia.

#### Protecciones

**Protecciones y tableros** (`fam-protecciones-y-tableros`).

Tipos a incorporar:

- Interruptor termomagnético.
- Interruptor diferencial.
- Protector de sobretensión.
- Fusible.
- Portafusible.
- Tablero eléctrico.
- Gabinete eléctrico.
- Barra de distribución.
- Barra de tierra.

Características a investigar: tipo, modelo, tensión nominal V, presentación, polos, corriente, curva, capacidad de corte, sensibilidad, grado IP, ficha técnica, certificación y evidencia.

#### Conexión

**Alargadores conectores y terminales** (`fam-alargadores-conectores-y-terminales`).

Tipos a incorporar:

- Alargador múltiple.
- Alargador carrete.
- Extensión eléctrica.
- Enchufe volante.
- Toma volante.
- Terminal eléctrico.
- Conector rápido.
- Regleta de conexión.
- Cinta aisladora.
- Tubo termocontraíble.

Características a investigar: tipo, modelo, tensión nominal V, presentación, corriente, longitud, sección, cantidad de tomas, ficha técnica, certificación y evidencia.

#### Puesta a tierra

**Elementos de puesta a tierra** (`fam-elementos-de-puesta-a-tierra`).

Tipos a incorporar:

- Barra de puesta a tierra.
- Abrazadera de puesta a tierra.
- Conector de tierra.
- Cámara de inspección de tierra.
- Mejorador de terreno.
- Soldadura exotérmica.

Características a investigar: material, sección o dimensiones, largo mm, espesor mm, presentación, dimensiones, compatibilidad, masa lineal, acabado.

### Iluminación y energía

Tanda 4 · 5 familias · 34 tipos.

#### Luminarias

**Luminarias interiores** (`fam-luminarias-interiores`).

Tipos a incorporar:

- Panel LED.
- Downlight LED.
- Plafón LED.
- Foco de riel.
- Luminaria estanca.
- Tira LED.
- Perfil para tira LED.
- Lámpara de escritorio.

Características a investigar: tipo, modelo, tensión nominal V, presentación, potencia, flujo luminoso, temperatura de color, base, grado IP, ficha técnica, certificación y evidencia.

**Luminarias exteriores y de emergencia** (`fam-luminarias-exteriores-y-de-emergencia`).

Tipos a incorporar:

- Proyector LED.
- Aplique exterior.
- Luminaria de jardín.
- Luminaria solar.
- Luz de emergencia.
- Señal luminosa de salida.
- Baliza.

Características a investigar: tipo, modelo, tensión nominal V, presentación, potencia, flujo luminoso, grado IP, autonomía declarada, ficha técnica, certificación y evidencia.

#### Fuentes de luz

**Ampolletas y tubos** (`fam-ampolletas-y-tubos`).

Tipos a incorporar:

- Ampolleta LED.
- Ampolleta halógena.
- Tubo LED.
- Ampolleta inteligente.
- Ampolleta filamento LED.
- Lámpara compacta.

Características a investigar: tipo, modelo, tensión nominal V, presentación, base, potencia, flujo, temperatura de color, regulable, ficha técnica, certificación y evidencia.

#### Energía solar

**Equipos fotovoltaicos y accesorios** (`fam-equipos-fotovoltaicos-y-accesorios`).

Tipos a incorporar:

- Panel fotovoltaico.
- Inversor solar.
- Controlador de carga.
- Batería para sistema solar.
- Conector solar.
- Soporte de panel solar.
- Kit solar documentado.

Características a investigar: tipo, modelo, tensión nominal V, presentación, potencia, tensión, corriente, compatibilidad, capacidad, ficha técnica, certificación y evidencia.

#### Respaldo

**Generación y respaldo eléctrico** (`fam-generacion-y-respaldo-electrico`).

Tipos a incorporar:

- Generador a gasolina.
- Generador diésel.
- Generador inverter.
- UPS.
- Estación de energía portátil.
- Cargador de batería.

Características a investigar: tipo, modelo, energía, presentación, potencia continua y máxima, combustible, autonomía documentada, potencia, capacidad, peso, ficha técnica.

### Pinturas y preparación de superficies

Tanda 4 · 4 familias · 39 tipos.

#### Pinturas

**Pinturas de muro y fachada** (`fam-pinturas-de-muro-y-fachada`).

Tipos a incorporar:

- Látex interior.
- Látex exterior.
- Esmalte al agua.
- Esmalte sintético.
- Pintura elastomérica.
- Pintura texturada.
- Pintura antihumedad.
- Pintura para cielos.

Características a investigar: tipo, base, acabado, color o código de color, contenido neto y unidad, presentación, uso, color, rendimiento con condiciones, ficha técnica.

#### Tratamientos

**Pinturas y protectores especiales** (`fam-pinturas-y-protectores-especiales`).

Tipos a incorporar:

- Anticorrosivo.
- Convertidor de óxido.
- Pintura para pisos.
- Pintura epóxica.
- Pintura para piscina.
- Pintura alta temperatura.
- Pintura demarcatoria.
- Barniz.
- Lasur.
- Protector de madera.

Características a investigar: tipo, base, acabado, color o código de color, contenido neto y unidad, presentación, sustrato, uso, componentes, rendimiento con condiciones, ficha técnica.

#### Preparación

**Selladores pastas y diluyentes** (`fam-selladores-pastas-y-diluyentes`).

Tipos a incorporar:

- Sellador de muro.
- Imprimante.
- Pasta muro interior.
- Pasta muro exterior.
- Masilla de reparación.
- Aguarrás.
- Diluyente sintético.
- Diluyente para laca.
- Removedor de pintura.
- Limpiador de superficies.

Características a investigar: tipo, contenido neto y unidad, presentación, base, compatibilidad, uso, ficha técnica, hoja de seguridad, vida útil declarada.

#### Aplicación

**Herramientas y accesorios de pintura** (`fam-herramientas-y-accesorios-de-pintura`).

Tipos a incorporar:

- Rodillo de lana.
- Rodillo de espuma.
- Rodillo de microfibra.
- Brocha.
- Pincel.
- Bandeja de pintura.
- Extensor de rodillo.
- Espátula.
- Raspador.
- Cinta de enmascarar.
- Plástico protector.

Características a investigar: material, dimensiones, presentación, ancho, superficie compatible, peso, color, ficha técnica.

### Pisos y revestimientos

Tanda 4 · 4 familias · 36 tipos.

#### Pisos minerales

**Cerámicas porcelanatos y piedras** (`fam-ceramicas-porcelanatos-y-piedras`).

Tipos a incorporar:

- Cerámica de piso.
- Cerámica de muro.
- Porcelanato esmaltado.
- Porcelanato técnico.
- Gres cerámico.
- Mosaico cerámico.
- Mosaico vítreo.
- Revestimiento de piedra natural.
- Baldosa hidráulica.

Características a investigar: material, largo mm, ancho mm, espesor mm, acabado, presentación, rectificado, uso, resistencia documentada, área por caja, piezas por caja, área útil declarada, lote y tono.

#### Pisos livianos

**Pisos flotantes vinílicos y textiles** (`fam-pisos-flotantes-vinilicos-y-textiles`).

Tipos a incorporar:

- Piso laminado.
- Piso vinílico SPC.
- Piso vinílico LVT.
- Piso vinílico en rollo.
- Piso de madera de ingeniería.
- Piso de madera sólida.
- Alfombra modular.
- Cubre piso.
- Pasto sintético.

Características a investigar: material, largo mm, ancho mm, espesor mm, acabado, presentación, sistema de instalación, capa de uso, clase documentada, área por caja, piezas por caja, área útil declarada, lote y tono.

#### Instalación

**Adhesivos fragües y niveladores** (`fam-adhesivos-fragues-y-niveladores`).

Tipos a incorporar:

- Adhesivo para cerámica.
- Adhesivo para porcelanato.
- Adhesivo flexible para revestimiento.
- Fragüe cementicio.
- Fragüe epóxico.
- Nivelador de piso.
- Cruceta.
- Clip de nivelación.
- Cuña de nivelación.

Características a investigar: tipo, contenido neto y unidad, presentación, soporte, formato de revestimiento, clasificación documentada, color, ficha técnica, hoja de seguridad, vida útil declarada.

#### Terminaciones

**Perfiles y bases de piso** (`fam-perfiles-y-bases-de-piso`).

Tipos a incorporar:

- Guardapolvo MDF.
- Guardapolvo PVC.
- Perfil de transición.
- Perfil reductor.
- Nariz de grada.
- Perfil de terminación cerámica.
- Espuma para piso flotante.
- Manta acústica para piso.
- Barrera de humedad para piso.

Características a investigar: material, perfil, largo mm, ancho mm, presentación, compatibilidad, espesor, color.

### Puertas ventanas y cerrajería

Tanda 5 · 4 familias · 36 tipos.

#### Puertas

**Puertas y marcos** (`fam-puertas-y-marcos`).

Tipos a incorporar:

- Puerta interior lisa.
- Puerta interior moldurada.
- Puerta de madera sólida.
- Puerta metálica.
- Puerta exterior reforzada.
- Puerta plegable.
- Puerta cortafuego documentada.
- Marco de puerta madera.
- Marco de puerta metálico.

Características a investigar: material, dimensiones, presentación, ancho, alto, espesor, mano, resistencia documentada, peso, color, ficha técnica.

#### Ventanas

**Ventanas y accesorios** (`fam-ventanas-y-accesorios`).

Tipos a incorporar:

- Ventana aluminio corredera.
- Ventana PVC corredera.
- Ventana abatible.
- Ventana proyectante.
- Ventana termopanel.
- Ventana fija.
- Mosquitero.
- Burlete de ventana.
- Cremona.

Características a investigar: material, dimensiones, presentación, tipo de apertura, vidrio, ancho, alto, peso, color, ficha técnica.

#### Cerrajería

**Cerraduras y seguridad mecánica** (`fam-cerraduras-y-seguridad-mecanica`).

Tipos a incorporar:

- Cerradura de pomo.
- Cerradura de embutir.
- Cerradura de sobreponer.
- Cerradura digital.
- Cerrojo.
- Candado.
- Cilindro de cerradura.
- Manilla.
- Cierra puerta.
- Tope de puerta.

Características a investigar: material, dimensiones, presentación, tipo, backset, mano, compatibilidad, peso, color, ficha técnica.

#### Portones

**Portones y automatización** (`fam-portones-y-automatizacion`).

Tipos a incorporar:

- Motor para portón corredera.
- Motor para portón abatible.
- Cremallera de portón.
- Rueda de portón.
- Riel de portón.
- Control remoto.
- Fotocélula.
- Brazo hidráulico.

Características a investigar: tipo, modelo, energía, presentación, peso y dimensiones compatibles, tensión, accionamiento, potencia, capacidad, peso, ficha técnica.

### Baño cocina y agua caliente

Tanda 5 · 4 familias · 36 tipos.

#### Artefactos sanitarios

**WC lavamanos y duchas** (`fam-wc-lavamanos-y-duchas`).

Tipos a incorporar:

- WC de dos piezas.
- WC de una pieza.
- WC suspendido.
- Lavamanos de pedestal.
- Lavamanos sobrepuesto.
- Lavamanos empotrado.
- Receptáculo de ducha.
- Tina.
- Urinario.
- Bidet.

Características a investigar: material, dimensiones, presentación, conexión, descarga, consumo declarado, peso, color, ficha técnica.

#### Grifería

**Griferías** (`fam-griferias`).

Tipos a incorporar:

- Monomando lavamanos.
- Mezclador lavamanos.
- Monomando lavaplatos.
- Mezclador lavaplatos.
- Monomando ducha.
- Mezclador tina ducha.
- Grifería temporizada.
- Ducha teléfono.
- Columna de ducha.

Características a investigar: tipo, material, conexiones y sistema, presentación, tipo de montaje, conexión, caudal declarado, presión nominal, ficha técnica.

#### Mobiliario y accesorios

**Muebles y accesorios sanitarios** (`fam-muebles-y-accesorios-sanitarios`).

Tipos a incorporar:

- Mueble de lavamanos.
- Mueble de lavaplatos.
- Lavaplatos de acero inoxidable.
- Lavadero.
- Asiento WC.
- Estanque WC.
- Mecanismo de descarga.
- Mecanismo de llenado.
- Mampara de ducha.
- Cabina de ducha.

Características a investigar: material, dimensiones, presentación, compatibilidad, peso, color, ficha técnica.

#### Agua caliente

**Calefonts termos y accesorios** (`fam-calefonts-termos-y-accesorios`).

Tipos a incorporar:

- Calefont gas licuado.
- Calefont gas natural.
- Termo eléctrico.
- Termo solar.
- Calentador eléctrico instantáneo.
- Ducto de evacuación.
- Kit de instalación documentado.

Características a investigar: tipo, modelo, energía, presentación, capacidad o caudal, tiro, tensión, certificación documentada, potencia, capacidad, peso, ficha técnica.

### Herramientas y consumibles

Tanda 6 · 9 familias · 100 tipos.

#### Herramientas eléctricas

**Perforación y atornillado** (`fam-perforacion-y-atornillado`).

Tipos a incorporar:

- Taladro eléctrico.
- Taladro percutor.
- Taladro atornillador inalámbrico.
- Rotomartillo SDS Plus.
- Rotomartillo SDS Max.
- Martillo demoledor.
- Atornillador de impacto.
- Llave de impacto.
- Atornillador para tabiques.

Características a investigar: tipo, modelo, alimentación, presentación, mandril, encastre, torque, velocidad, percusión, potencia W, tensión V, baterías y accesorios incluidos.

**Corte desbaste y lijado** (`fam-corte-desbaste-y-lijado`).

Tipos a incorporar:

- Esmeril angular.
- Sierra circular.
- Sierra caladora.
- Sierra sable.
- Sierra ingleteadora.
- Sierra de banco.
- Lijadora orbital.
- Lijadora de banda.
- Fresadora.
- Cepillo eléctrico.
- Pulidora.

Características a investigar: tipo, modelo, alimentación, presentación, diámetro o carrera, velocidad, capacidad de corte, encastre, potencia W, tensión V, baterías y accesorios incluidos.

**Equipos y accesorios de herramienta** (`fam-equipos-y-accesorios-de-herramienta`).

Tipos a incorporar:

- Multiherramienta oscilante.
- Pistola de calor.
- Pistola de pintura.
- Mezclador eléctrico.
- Aspiradora de taller.
- Batería de herramienta.
- Cargador de herramienta.
- Estación de soldadura electrónica.

Características a investigar: tipo, modelo, alimentación, presentación, compatibilidad, energía, capacidad, potencia W, tensión V, baterías y accesorios incluidos.

#### Herramientas manuales

**Llaves alicates y destornilladores** (`fam-llaves-alicates-y-destornilladores`).

Tipos a incorporar:

- Llave ajustable.
- Llave punta corona.
- Llave Allen.
- Llave Torx.
- Llave de tubo.
- Juego de dados.
- Llave de torque.
- Alicate universal.
- Alicate de corte.
- Alicate de punta.
- Destornillador plano.
- Destornillador Phillips.
- Destornillador Torx.

Características a investigar: tipo, modelo, medida, presentación, material, perfil, aislación documentada, peso.

**Carpintería albañilería y sujeción** (`fam-carpinteria-albanileria-y-sujecion`).

Tipos a incorporar:

- Martillo de carpintero.
- Martillo de goma.
- Combo.
- Serrucho.
- Formón.
- Lima.
- Escofina.
- Prensa sargento.
- Prensa de banco.
- Llana.
- Platacho.
- Cuchara de albañil.
- Cortador de cerámica.
- Cortatubo.
- Remachadora.
- Engrapadora.

Características a investigar: tipo, modelo, medida, presentación, material, uso, peso.

#### Medición

**Instrumentos de medición** (`fam-instrumentos-de-medicion`).

Tipos a incorporar:

- Huincha de medir.
- Nivel de burbuja.
- Nivel láser.
- Distanciómetro.
- Escuadra.
- Calibrador.
- Micrómetro.
- Multímetro.
- Pinza amperimétrica.
- Detector de materiales.
- Termómetro infrarrojo.
- Medidor de humedad.

Características a investigar: tipo, modelo, medida, presentación, rango, precisión declarada, unidad, alimentación, material, peso.

#### Consumibles

**Brocas puntas y sierras copa** (`fam-brocas-puntas-y-sierras-copa`).

Tipos a incorporar:

- Broca metal HSS.
- Broca para hormigón.
- Broca para madera.
- Broca SDS Plus.
- Broca SDS Max.
- Broca para cerámica.
- Sierra copa bimetálica.
- Sierra copa diamantada.
- Punta Phillips.
- Punta Torx.
- Punta Allen.
- Avellanador.

Características a investigar: tipo, medida, encastre o conexión, unidades por envase, diámetro, longitud, encastre, material de trabajo, compatibilidad, material.

**Discos hojas y abrasivos** (`fam-discos-hojas-y-abrasivos`).

Tipos a incorporar:

- Disco de corte metal.
- Disco de desbaste metal.
- Disco diamantado.
- Disco flap.
- Disco de lijado.
- Hoja de sierra circular.
- Hoja de sierra caladora.
- Hoja de sierra sable.
- Lija de papel.
- Lija al agua.
- Banda de lija.
- Piedra de afilar.

Características a investigar: tipo, medida, encastre o conexión, unidades por envase, diámetro, espesor, orificio, grano, velocidad máxima, compatibilidad, material.

#### Almacenamiento

**Organización y transporte de herramientas** (`fam-organizacion-y-transporte-de-herramientas`).

Tipos a incorporar:

- Caja de herramientas.
- Maleta de herramientas.
- Carro de herramientas.
- Bolso de herramientas.
- Organizador de tornillos.
- Cinturón de herramientas.
- Panel para herramientas.

Características a investigar: material, dimensiones, presentación, capacidad, peso, color, ficha técnica.

### Maquinaria equipos y faena

Tanda 6 · 5 familias · 44 tipos.

#### Equipos de construcción

**Mezcla compactación y corte** (`fam-mezcla-compactacion-y-corte`).

Tipos a incorporar:

- Betonera.
- Vibrador de hormigón.
- Placa compactadora.
- Pisón compactador.
- Cortadora de pavimento.
- Cortadora de cerámica eléctrica.
- Allanadora de pavimento.
- Regla vibratoria.

Características a investigar: tipo, modelo, energía, presentación, capacidad, potencia, dimensiones de trabajo, peso, ficha técnica.

#### Soldadura y aire

**Soldadura compresores y accesorios** (`fam-soldadura-compresores-y-accesorios`).

Tipos a incorporar:

- Soldadora MMA.
- Soldadora MIG MAG.
- Soldadora TIG.
- Cortadora plasma.
- Compresor de aire.
- Pistola neumática.
- Manguera neumática.
- Regulador de aire.

Características a investigar: tipo, modelo, energía, presentación, proceso, corriente, caudal, presión, ciclo de trabajo, potencia, capacidad, peso, ficha técnica.

#### Consumibles de soldadura

**Electrodos y accesorios de soldadura** (`fam-electrodos-y-accesorios-de-soldadura`).

Tipos a incorporar:

- Electrodo revestido.
- Alambre MIG.
- Varilla TIG.
- Tobera MIG.
- Punta de contacto MIG.
- Portaelectrodo.
- Pinza de masa.
- Cepillo de soldadura.

Características a investigar: tipo, medida, encastre o conexión, unidades por envase, material, diámetro, proceso, clasificación documentada, compatibilidad.

#### Acceso y carga

**Escaleras andamios e izaje** (`fam-escaleras-andamios-e-izaje`).

Tipos a incorporar:

- Escalera tijera.
- Escalera telescópica.
- Escalera multipropósito.
- Andamio modular.
- Plataforma de andamio.
- Rueda de andamio.
- Teclé manual.
- Teclé eléctrico.
- Eslinga.
- Gata hidráulica.

Características a investigar: material, dimensiones, presentación, capacidad documentada, altura, configuración, peso, color, ficha técnica.

#### Traslado y obra

**Implementos de faena** (`fam-implementos-de-faena`).

Tipos a incorporar:

- Carretilla.
- Carro de carga.
- Transpaleta manual.
- Pala.
- Chuzo.
- Picota.
- Balde de construcción.
- Batea.
- Cono de faena.
- Lona de protección.

Características a investigar: material, dimensiones, presentación, capacidad, peso, color, ficha técnica.

### Seguridad y protección personal

Tanda 7 · 4 familias · 39 tipos.

#### Protección personal

**EPP de cabeza ojos y respiración** (`fam-epp-de-cabeza-ojos-y-respiracion`).

Tipos a incorporar:

- Casco de seguridad.
- Lente de seguridad.
- Antiparra.
- Protector facial.
- Careta de soldar.
- Protector auditivo de copa.
- Tapón auditivo.
- Respirador reutilizable.
- Respirador desechable.
- Filtro para respirador.
- Cartucho para respirador.

Características a investigar: tipo, modelo, talla o ajuste, presentación, talla, clase, norma y evidencia, compatibilidad, norma declarada, evidencia documental, vencimiento declarado.

**EPP de manos pies y cuerpo** (`fam-epp-de-manos-pies-y-cuerpo`).

Tipos a incorporar:

- Guante de cuero.
- Guante anticorte.
- Guante de nitrilo.
- Guante dieléctrico.
- Guante de soldador.
- Zapato de seguridad.
- Bota de seguridad.
- Overol.
- Chaleco reflectante.
- Traje impermeable.
- Rodillera.

Características a investigar: tipo, modelo, talla o ajuste, presentación, talla, material, clase, norma y evidencia, norma declarada, evidencia documental, vencimiento declarado.

#### Trabajo en altura

**Protección contra caídas** (`fam-proteccion-contra-caidas`).

Tipos a incorporar:

- Arnés de cuerpo completo.
- Cabo de vida.
- Absorbedor de energía.
- Línea de vida.
- Conector mosquetón.
- Anclaje de seguridad.
- Retráctil anticaídas.

Características a investigar: tipo, modelo, talla o ajuste, presentación, capacidad, longitud, clase, norma y evidencia, compatibilidad, norma declarada, evidencia documental, vencimiento declarado.

#### Prevención

**Incendio señalización y emergencia** (`fam-incendio-senalizacion-y-emergencia`).

Tipos a incorporar:

- Extintor PQS.
- Extintor CO2.
- Gabinete de extintor.
- Detector de humo.
- Detector de gas.
- Detector de monóxido.
- Señal de seguridad.
- Cinta de peligro.
- Botiquín.
- Lavaojos.

Características a investigar: material, dimensiones, presentación, capacidad, tipo, clase, norma y evidencia, peso, color, ficha técnica.

### Jardín riego cercos y exterior

Tanda 7 · 5 familias · 52 tipos.

#### Riego

**Riego y mangueras** (`fam-riego-y-mangueras`).

Tipos a incorporar:

- Manguera de jardín.
- Manguera de riego.
- Cinta de goteo.
- Gotero.
- Aspersor.
- Microaspersor.
- Programador de riego.
- Electroválvula de riego.
- Filtro de riego.
- Conector rápido.
- Pistola de riego.

Características a investigar: material, diámetro nominal y sistema, largo mm, presentación, diámetro, presión, caudal declarado, conexión, diámetro exterior mm, espesor mm.

#### Bombas y estanques

**Bombas estanques y tratamiento de agua** (`fam-bombas-estanques-y-tratamiento-de-agua`).

Tipos a incorporar:

- Bomba periférica.
- Bomba centrífuga.
- Bomba sumergible.
- Bomba de achique.
- Bomba presurizadora.
- Estanque de agua.
- Fosa séptica.
- Filtro de agua.
- Equipo hidroneumático.

Características a investigar: tipo, modelo, energía, presentación, caudal, altura, potencia, capacidad, fluido compatible, peso, ficha técnica.

#### Cercos

**Mallas alambres y cierres** (`fam-mallas-alambres-y-cierres`).

Tipos a incorporar:

- Malla acma de cierre.
- Malla hexagonal.
- Malla cuadrada.
- Malla galvanizada tejida.
- Malla raschel.
- Malla plástica.
- Alambre galvanizado.
- Alambre recocido.
- Alambre de púas.
- Poste de cerco.
- Concertina.

Características a investigar: material, sección o dimensiones, largo mm, espesor mm, presentación, abertura, diámetro, recubrimiento, altura, masa lineal, acabado.

#### Herramientas de jardín

**Herramientas y máquinas de jardín** (`fam-herramientas-y-maquinas-de-jardin`).

Tipos a incorporar:

- Tijera de podar.
- Serrucho de poda.
- Rastrillo.
- Azadón.
- Cortacésped.
- Orilladora.
- Desbrozadora.
- Motosierra.
- Cortasetos.
- Soplador.
- Pulverizador.
- Hidrolavadora.

Características a investigar: tipo, modelo, alimentación, presentación, energía, capacidad, dimensión de trabajo, potencia W, tensión V, baterías y accesorios incluidos.

#### Suelos y cultivo

**Sustratos y accesorios de cultivo** (`fam-sustratos-y-accesorios-de-cultivo`).

Tipos a incorporar:

- Tierra de hoja.
- Sustrato de cultivo.
- Compost.
- Humus.
- Corteza decorativa.
- Gravilla decorativa.
- Macetero.
- Tutor de plantas.
- Geotextil de jardín.

Características a investigar: material, unidad de venta, contenido declarado, composición, volumen, uso, granulometría, humedad declarada.

## Registro de fuentes y límites

Consulta realizada el 5 de octubre de 2026. «Extracto indexado» indica que se consultó información de la página oficial recuperada por el buscador; no certifica una lectura completa ni una actualización de ese día.

| ID | Fuente primaria | Lectura | Uso en el plan |
|---|---|---|---|
| S01 | [Sodimac · Construcción](https://www.sodimac.cl/sodimac-cl/lista/CATG10005/Construccion) | extracto indexado; apertura completa limitada por tamaño | Referencia de navegación de construcción; no se levantó el catálogo completo. |
| S02 | [Sodimac · Catálogo gasfitería y electricidad](https://www.sodimac.cl/sodimac-cl/content/catalogo-proyectos-gasfiteria-electricidad) | extracto indexado | Separa conducción por materiales/sistemas y fijaciones por tipo. |
| S03 | [Sodimac · Tubos PPR](https://www.sodimac.cl/sodimac-cl/b/tubos-ppr) | extracto indexado | Distinguir vendedor de marketplace de la tienda que aloja la ficha. |
| S04 | [Easy · Bloques](https://www.easy.cl/materiales-de-construccion/ladrillos-bloques-y-pastelones/bloques) | extracto indexado; sitio limita apertura directa | Ruta materiales → ladrillos/bloques/pastelones → bloques. |
| S05 | [Easy · Aislación térmica](https://www.easy.cl/materiales-de-construccion/aislacion/termico) | extracto indexado | Filtros observados: tipo, peso, marca, material, espesor y uso. |
| S06 | [Easy · Tornillos](https://www.easy.cl/ferreteria-y-gasfiteria/fijaciones-y-adhesivos/tornillos/tornillos-y-soberbios) | extracto indexado | Ruta más profunda que los tres niveles actuales de CotizApp; filtros por medida/material/uso. |
| S07 | [Easy · Tableros](https://www.easy.cl/materiales-de-construccion/maderas-y-tableros/tableros) | extracto indexado | Agrupa tableros por material y formato; requiere revisar clasificación de productos mezclados. |
| S08 | [Easy · Pisos y pinturas](https://www.easy.cl/catalogo-pisos-y-pinturas) | extracto indexado | Separa revestimientos de adhesivos y fragües. |
| S09 | [Construmart · Materiales de construcción](https://www.construmart.cl/materiales-de-construccion) | página de listado consultada | Familias de obra y filtros por aplicación/marca; algunas ofertas anónimas muestran valores incompletos. |
| S10 | [Construmart · Catálogo principal](https://www.construmart.cl/) | lectura directa | Cobertura de madera, materiales, herramientas y terminaciones. |
| S11 | [Volcán · Volcanita RH 12,5 mm](https://volcan.cl/productos/volcanita-rh-espesor-12-5-mm/) | extracto indexado | Fabricante: tipo y espesor, enlaces de documentación técnica. |
| S12 | [Volcán · RH BR 12,5 × 1,2 × 2,4](https://tienda.volcan.cl/products/5000598-volcanita-rh-br-125-x-12-x-24) | extracto indexado; apertura directa fallida | Formato declarado; no se descargaron imágenes ni documentos. |
| S13 | [Arauco Chile · Optimizador de corte](https://new.arauco.com/chile/ayuda-para-tus-proyectos/optimizador-de-corte/) | extracto indexado; apertura directa fallida | Ejemplos de formatos MDF y terciados; catálogo de selección, no oferta de tienda. |
| S14 | [Sika Chile · Sikaflex-1A](https://chl.sika.com/es/construccion/sellado-y-pegadoelastico/selladores-para-pisos/sikaflex-1a.html) | lectura directa | Fabricante local: base química y presentación; no trasladar variantes de otros países. |
| S15 | [Sodimac · Cable libre de halógeno](https://www.sodimac.cl/sodimac-cl/lista/CATG36440/Cable-libre-de-halogeno) | extracto indexado | Ejemplo de sección, longitud y marca; modelo técnico todavía pendiente. |
| S16 | [Easy · Porcelanato Baldara](https://www.easy.cl/porcelanato-piso-muro-60x60-cm-concreto-144-m2-baldara-1102919/p) | extracto indexado | Formato y cobertura por caja. |
| S17 | [Easy · Gres Forest Roble](https://www.easy.cl/gres-porcelanato-forest-roble-20x120-cm-119-m2-1203478/p) | extracto indexado | Cobertura declarada: no inferir piezas por caja a partir de valores redondeados. |
| S18 | [Easy · GSB 183-LI](https://www.easy.cl/taladro-percutor-atornillador-13-mm-18v-gsb-183-li-1432830/p) | extracto indexado | Mandril y tensión; contenido del kit pendiente de confirmar. |

## Próxima tanda concreta

Completar el piloto de 50 SKU, empezando por las referencias de placas, tableros, cubiertas y aislación ya localizadas, y sumando cemento, albañilería, acero y madera. Cada búsqueda debe producir una ficha con identidad y empaque confirmados o un pendiente explícito. Al terminar el piloto se revisan los filtros y comparaciones con ofertas reales de las ferreterías; después se continúa con lotes de 100–150 SKU según este plan.
