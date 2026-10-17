# SEO del catálogo automotriz

La portada conserva su diseño y su catálogo mixto. Un enlace discreto lleva a
`/repuestos`, que reutiliza las tarjetas, filtros y comparación existentes.

## Páginas públicas

- `/repuestos`: entrada del catálogo automotriz.
- `/marcas-vehiculos/<marca>`: piezas con compatibilidad explícita para una marca de vehículo.
- `/vehiculos/<marca-modelo>`: piezas con compatibilidad explícita para ese modelo.
- `/familias/<familia>`: se reutilizan las familias existentes para tipos de pieza.
- `/productos/<slug>`: se conservan las URLs de las fichas actuales.

La categoría anterior de repuestos redirige permanentemente a `/repuestos`,
conservando los parámetros de búsqueda. Las marcas fabricantes y las marcas de
vehículos mantienen filtros distintos. No se generan combinaciones vacías de
modelo/año, ni se deduce compatibilidad a partir de un vehículo donante.

## Contenido e indexación

Las páginas incluyen títulos, descripciones, canonical en trovio.cl, enlaces
rastreables y datos estructurados. El HTML inicial de las fichas contiene
atributos, imagen de catálogo identificada como referencial cuando corresponde,
compatibilidad explícita y ofertas reales con local, precio, stock y estado.
Las condiciones desconocidas no reciben un estado inventado en schema.org.

Los productos de prueba no generan precios ni compatibilidades para resultados
enriquecidos. Las páginas por vehículo requieren compatibilidad del maestro
que no esté marcada como referencial. Los productos reales sin ofertas pueden
ser descubiertos; no se inventan precios para ellos.

Si solo existen productos automotrices de prueba, `/repuestos` sigue disponible
con aviso de referencia y `noindex`, y queda fuera del sitemap. Cuando existe
inventario maestro real, el backend habilita su indexación y actualiza el
sitemap automáticamente. Marcas y modelos aparecen al incorporar compatibilidad
real. No hace falta desplegar de nuevo para crear cada combinación del catálogo.

## Validación

- `npm test -- --watch=false`
- `npm run build`
- `npm --prefix functions test`
- `PRODUCTION_URL=https://trovio.cl node scripts/smoke-production.mjs`

Las pruebas cubren navegación inicial, cambio de modelo, compatibilidad simulada,
productos de prueba, URLs canónicas, redirecciones, sitemap, páginas inexistentes
y HTML inicial con ofertas reales. El smoke también puede consultar el origen
Firebase: los canonical deben seguir apuntando al dominio público trovio.cl.

Publicar estas mejoras permite que Google descubra y evalúe las páginas; no
asegura una posición para la búsqueda «repuestos de autos». El siguiente paso
comercial es cargar inventario real con datos y fotografías propios de los locales.
