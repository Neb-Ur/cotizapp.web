# Design QA — Menú de taxonomía CotizApp

Source visual truth: captura de referencia Sodimac adjunta por el usuario en la conversación (2406 × 1432 px; vista normalizada por el cliente a 2048 × 1219 px). La referencia se usa únicamente para el patrón de interacción: lista de categorías a la izquierda y detalle jerárquico a la derecha.

Implementation evidence:

- Desktop abierto y categoría activa por hover: `/tmp/cotizapp-taxonomy-desktop.png`
- Mobile drawer abierto y categoría expandida: `/tmp/cotizapp-taxonomy-mobile.png`

Viewport and state:

- Desktop: 1440 × 1000 CSS px, device scale factor 1, `/buscar`, menú abierto, `Fijaciones y sellantes` activa mediante `mouseenter`.
- Mobile: 390 × 900 CSS px, device scale factor 1, `/buscar`, drawer abierto, `Maderas y tableros` expandida.
- Fuente e implementación fueron comparadas en el mismo contexto visual de la conversación. No se persiste una copia local de la imagen adjunta del usuario.

## Full-view comparison evidence

La implementación conserva el modelo mental de la referencia sin copiar su identidad: el panel baja desde la navegación; las categorías permanecen visibles en una columna; al recorrerlas cambia el contenido de la derecha; las subcategorías son encabezados y las familias aparecen debajo. CotizApp usa su propia marca, tipografía, paleta navy/sand/orange, escala, radios y copy.

En mobile, la misma información se adapta al drawer existente. La lista no intenta comprimir dos columnas: cada categoría se abre como acordeón y revela `Ver toda la categoría`, subcategorías y familias.

## Focused region comparison evidence

- Desktop: se inspeccionaron apertura vertical, alineación con la navbar, estado hover/activo, columna izquierda, encabezado del detalle y jerarquía subcategoría/familia.
- Mobile: se inspeccionaron overlay, bloqueo del fondo, control de cierre, categorías, estado expandido y sangría de los tres niveles.
- No se requieren recursos raster ni fotografías para este componente. Los controles usan Font Awesome y los assets de marca existentes; no se recrearon iconos de la referencia.

## Findings

- P3 — Con la taxonomía piloto actual algunas categorías tienen solo una subcategoría y una familia, por lo que el panel derecho conserva espacio libre. Es un resultado correcto de los datos de Firebase y permitirá crecer sin rediseño.

## Required fidelity surfaces

- Fonts and typography: se mantienen Manrope/Space Grotesk, con jerarquía clara entre categoría, subcategoría y familia; no se imita la tipografía del retailer de referencia.
- Spacing and layout rhythm: panel alineado bajo la navbar, navegación 280 px + detalle flexible, filas táctiles de al menos 48 px y drawer móvil desplazable.
- Colors and visual tokens: se usan exclusivamente los tokens propios de CotizApp (`ink`, `sand`, `orange`, bordes y sombras existentes).
- Image quality and asset fidelity: no hay imágenes de contenido en el menú; iconos funcionales provienen de Font Awesome y la marca sigue usando su componente existente.
- Copy and content: copy propio de CotizApp y taxonomía real obtenida desde Firebase.

## Interaction checks

- El menú desktop abre hacia abajo desde la navegación.
- `mouseenter` sobre una categoría actualiza el encabezado, las subcategorías y las familias del panel derecho.
- Categoría, subcategoría y familia navegan a `/buscar` con sus parámetros jerárquicos.
- El drawer mobile conserva su desplazamiento lateral y expande una categoría por toque.
- Cierre mediante botón, clic exterior y tecla Escape.
- El fondo mobile queda bloqueado mientras el drawer está abierto.
- Consola del navegador: sin errores de aplicación.
- 25 pruebas unitarias aprobadas.

## Comparison history

1. La primera implementación mostraba seis tarjetas simultáneas. Se identificó como P1 porque no reproducía la exploración progresiva pedida y ocupaba demasiado espacio visual.
2. Se reemplazó por navegación de dos paneles: categorías persistentes a la izquierda y contenido contextual a la derecha.
3. Mobile inicialmente solo enlazaba categorías. Se añadió expansión táctil con subcategorías y familias, manteniendo el drawer lateral existente.
4. La revisión final confirmó jerarquía, estados activos, navegación, responsive y ausencia de errores de consola.

## Follow-up polish

- P3 opcional: incorporar iconos propios por categoría cuando la taxonomía y la biblioteca visual definitiva estén completas.

## Final result

final result: passed
