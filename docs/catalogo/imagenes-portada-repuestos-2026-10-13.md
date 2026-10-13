# Imágenes y catálogo inicial de repuestos — 13 de octubre de 2026

La portada conserva el estilo de taller y espacio oscuro para el texto, e incorpora repuestos junto a materiales y herramientas. Se creó con la herramienta integrada ImageGen. Las cuatro imágenes de producto también fueron generadas con esa herramienta y son referencias genéricas, no fotografías de unidades disponibles. Se revisaron los cinco resultados antes de convertirlos a WebP, sin cambiar sus composiciones.

## Archivos finales

- Portada: `src/assets/home-hero-mixto-v1.webp`, 1600 × 711 píxeles.
- Alternador: `src/assets/catalogo/repuestos/alternador.webp` y `alternador-miniatura.webp`.
- Amortiguador: `src/assets/catalogo/repuestos/amortiguador.webp` y `amortiguador-miniatura.webp`.
- Filtro de aceite: `src/assets/catalogo/repuestos/filtro-aceite.webp` y `filtro-aceite-miniatura.webp`.
- Pastillas de freno: `src/assets/catalogo/repuestos/pastillas-freno.webp` y `pastillas-freno-miniatura.webp`.

Las imágenes de detalle miden 1200 × 1200 y las miniaturas 480 × 480. La portada anterior se conserva. Los originales generados permanecen en el directorio de imágenes de Codex; la aplicación consume las copias optimizadas del repositorio.

## Prompt final de portada

```text
Use case: ads-marketing. Asset type: photographic hero background for the existing Trovio product comparison website. Create one production-ready wide landscape photo approximately 2.3:1 (e.g. 2304x1024), no typography. Context from the supplied website screenshot: navy blue and orange interface, a workshop workbench with construction materials at the right, overlaid white hero copy at the left. Preserve this visual language while representing construction supplies, tools, AND automotive spare parts equally. Scene: believable clean professional workshop/store workbench, rich tactile wooden surface, subdued industrial background. RIGHT HALF contains a carefully arranged, physically plausible set of a silver automotive alternator (clearly recognizable aluminum vented housing and black pulley), a brake disc with separate brake pads, a small unbranded oil filter, alongside an unbranded orange-and-black cordless drill, measuring tape, one plain cement sack, a small clear tray of fasteners. A modest OSB panel in the far-right background, not dominating the composition. Automotive parts should be immediately recognizable, as prominent as the drill and cement. Keep all principal objects well inside the right half with cropping safety margins, concentrated between 60% and 92% of the image width; avoid important content at the extreme edges. LEFT 50% must be dark, soft-focus navy workshop negative space with no products or bright highlights, suitable for white text that will be placed by HTML. Nothing printed on the left. Camera: premium commercial still-life photography, eye-level slightly elevated view, realistic object scale, soft warm directional light on the objects against a cool dark blue background, restrained orange accents, high material detail, clean uncluttered composition. Constraints: no text, no logos, no brand names, no price tags, no watermarks, no people, no entire vehicle, no split collage, no UI elements. Realistic object geometry and separate recognizable products, not a fused mechanical sculpture.
```

## Prompts finales de producto

Se hizo una llamada independiente por producto. El prompt completo se forma con este prefijo, la descripción correspondiente y el sufijo común, separados por un espacio.

Prefijo:

```text
Use case: product-mockup. Asset type: reference image for a generic automotive spare-part master catalog card, NOT a specific physical item for sale. Primary request:
```

Descripciones:

```text
Alternador: One generic automotive alternator, realistic aluminum vented housing, copper windings subtly visible, black multi-groove pulley at front, intact mounting lugs. Three-quarter front view, standalone.
Amortiguador: One generic automotive shock absorber, separate standalone damper WITHOUT coil spring, black cylindrical body, polished chrome piston rod and realistic mounting eyelets. Lay diagonally, entirely visible. No brand.
Filtro de aceite: One generic automotive spin-on oil filter, plain black cylindrical housing with silver threaded base and visible ring of inlet holes. Three-quarter view allowing housing and base to be recognized. No label.
Pastillas de freno: A pair of generic automotive disc brake pads, clearly separate black metal backing plates with realistic gray friction material, one pad front-facing and one slightly angled. No brand.
```

Los nombres antes de los dos puntos identifican el archivo y no forman parte del prompt.

Sufijo:

```text
Clean professional product photography, neutral very pale gray seamless background, soft studio lighting, realistic mechanical proportions, crisp readable silhouette, gentle contact shadow. Square composition, object centered with at least 18% empty margin all around. No text, logos, labels, watermarks, boxes, hands, workshop, price tags or extra objects. The image is illustrative and will be labeled as a reference image in the catalog. Create one image of this product only.
```

## Datos y selección del inicio

El manifiesto `catalogo-repuestos-base.json` define una categoría, dos subcategorías, cuatro familias y cuatro productos base. El importador usa PostgreSQL y las mismas colecciones/tablas del catálogo existente, crea únicamente registros ausentes, comprueba identidad de los existentes y conserva un recibo privado. No crea ofertas, precios, stock ni asociaciones de vehículos.

El inicio selecciona un producto de materiales, uno de herramientas y hasta dos repuestos, con prioridad para imágenes útiles y ofertas reales disponibles. Si falta un grupo, completa las cuatro posiciones con productos existentes sin duplicarlos. Los accesos de categorías incluyen herramientas y repuestos entre las primeras seis posiciones cuando existen. La selección y los precios de la API se conservan por identidad al terminar la carga completa del catálogo; las fichas sin ofertas siguen mostrando «Sin ofertas disponibles».

La comprobación de la composición y de las imágenes se hizo sobre los archivos. La revisión del resultado visual en navegador permanece pendiente porque no hubo un navegador conectado disponible.
