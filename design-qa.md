# QA de la portada de búsqueda — 2026-10-15

final result: passed

Referencia: [imagen móvil aprobada](docs/diseno/portada-busqueda/referencia-mobile.png), 853 × 1844 px, normalizada a 390 × 844 para compararla con la captura real a escala 1. Implementación: portada existente de Trovio, revisión móvil 390 × 844 y escritorio 1440 × 1000. Playwright con Chrome headless y perfil aislado, autorizado expresamente por el usuario. No se usó su perfil personal.

## Iteraciones visuales

1. [Comparación inicial](docs/diseno/portada-busqueda/comparacion-inicial.png): bloqueada por P2. El logo quedaba centrado, la cabecera medía 73 px y los campos vehiculares tenían demasiado alto; las tarjetas comenzaban cerca de 695 px. Se alineó el logo a la izquierda, se compactaron cabecera y selectores conservando tamaño de texto legible y controles principales de al menos 44 px.
2. Se detectaron dos P2 adicionales: texto de los filtros traslucía a través de la cabecera durante el desplazamiento y la separación del catálogo retrasaba las tarjetas. Se hizo opaca la cabecera y se compactaron los espacios del encabezado del catálogo.
3. [Comparación final](docs/diseno/portada-busqueda/comparacion-final.png), referencia a la izquierda e implementación a la derecha: pasada. Cabecera de 60 px, hero con vehículo de 467,25 px, inicio de tarjetas a 612,25 px; sin desbordamiento horizontal. No quedan problemas P0/P1/P2 en los estados examinados.

Diferencias intencionales respecto de la imagen ilustrativa: se muestran productos, fotos, precios y locales reales del catálogo de prueba, sin inventar condición «Usado» para ofertas que pueden tener condiciones distintas. El texto oscuro sobre naranja mantiene mayor contraste. El título permite una sola línea si cabe en el ancho; se mantiene el diseño compacto, las cuatro opciones, los selectores vehiculares y la jerarquía de acciones. El aviso habla de compatibilidad registrada y pide confirmarla con el local.

## Comportamiento examinado

- [Móvil inicial](docs/diseno/portada-busqueda/mobile-final.png): cuatro opciones visibles en 2 × 2, vehículo dependiente marca/modelo/año, búsqueda principal, cotización secundaria y dos tarjetas por fila. Sin buscador duplicado en el encabezado.
- [Móvil enfocado](docs/diseno/portada-busqueda/mobile-buscador.png): el campo queda a 68,25 px, bajo la cabecera de 60 px. Sugerencias a partir de 120,25 px. Los botones flotantes se ocultan durante la búsqueda y vuelven al cerrarla.
- [Viewport reducido](docs/diseno/portada-busqueda/mobile-viewport-reducido.png): 390 × 480, sugerencias dentro del área visible. Se comprobó el evento de `VisualViewport` con pruebas automatizadas. Esto simula menor espacio disponible; no sustituye una prueba del teclado nativo de cada teléfono.
- [Escritorio](docs/diseno/portada-busqueda/desktop-final.png) y [búsqueda abierta](docs/diseno/portada-busqueda/desktop-buscador.png): rubros y filtros en filas, campo y botón en una fila; enfocar no desplaza la página.
- Navegación a resultados preservando rubro, marca, modelo y año. Buscar una segunda pieza desde el encabezado conserva el vehículo y limita sus sugerencias al contexto seleccionado. Cambio a Herramientas excluye los parámetros vehiculares de esa búsqueda.
- Escape, navegación por flechas/Enter, cierre exterior, enlace para ver todos los resultados, reintentos y respuestas asincrónicas antiguas cubiertos por pruebas de componentes.

[Mediciones y aserciones del navegador](docs/diseno/portada-busqueda/verificacion-navegador.json): cero errores de JavaScript. QA local servido con el bundle de producción, snapshot público real y el motor nuevo de filtrado; las demás lecturas públicas se consultaron mediante un proxy de prueba de solo lectura.

Validación: 261 pruebas de frontend y 204 de backend aprobadas, compilación de producción correcta. Las pruebas de backend verifican rubros disjuntos antes de paginar, intersección por vehículo y años inclusivos, ausencia de ofertas y rechazo de rubros inválidos. No se verificaron todos los teléfonos, teclados o lectores de pantalla.

## Superficies de fidelidad revisadas

- **Tipografía:** se reutiliza Manrope y la jerarquía del sitio. Texto de entrada y valores vehiculares de 16 px; título móvil de 29 px y desktop de 36 px. Se acepta la línea única del título cuando cabe para mantener el inicio compacto. Nombres largos de productos usan dos líneas con el texto completo disponible en el enlace; no hay palabras o controles cortados en los filtros.
- **Espaciado y composición:** cuadrícula móvil 2 × 2 y escritorio de cuatro columnas; selectores en tres columnas. Tras los ajustes, las tarjetas comienzan a 612,25 px, frente a aproximadamente 608 px en la referencia normalizada. Radios y sombras reutilizan los tokens del sitio. Sin desbordamiento de ancho.
- **Color:** azul marino y naranja existentes; estado activo explícito y contraste reforzado mediante texto oscuro sobre naranja. Foco visible en campos, botones y enlaces. Cabecera opaca al desplazar el formulario.
- **Imágenes e iconos:** fotografías existentes de referencias reales del catálogo, con proporción conservada mediante `object-fit: contain`. No se sustituyen por las piezas ilustrativas del mockup ni se generan imágenes ficticias de marcas/modelos. Se reutilizan el logotipo existente y PrimeIcons; no se dibujan sustitutos nuevos.
- **Contenido:** se conservan las cuatro opciones, “Tu vehículo”, búsqueda principal y cotización secundaria. La condición de cada oferta sigue en su ficha, en lugar de asignar “Usado” a todas las tarjetas. El texto de compatibilidad exige confirmación con el local.

No hizo falta otra comparación recortada: la comparación normalizada de dos columnas permite leer todos los rótulos y examinar los controles; la captura independiente del campo enfocado muestra además foco, texto y límites del panel a tamaño completo. Los cambios de contenido dinámico y de contraste descritos arriba se consideran diferencias intencionales, no defectos pendientes.

Checklist final: composición comparada; ajustes P2 recapturados; imágenes e iconos reales; contraste/foco/etiquetas revisados; interacciones verificadas; pruebas de frontend/backend aprobadas. La comprobación física con teclados iOS/Android y lectores de pantalla queda fuera de esta sesión.

## Verificación posterior al despliegue

Hosting y API publicados. Se comprobó que la portada entrega el bundle compilado y probado. La API devuelve rubros disjuntos: 782 materiales, 174 herramientas y 170 repuestos, sumando los 1.126 maestros activos. Se conservan 4.038 ofertas. Radiador KUV100 para 2018 selecciona 2016–2019 y para 2021 selecciona 2020–2023; un rubro desconocido devuelve 400.

El recorrido se repitió contra producción en navegador aislado: elegir Repuestos/Mahindra/KUV100/2018, escribir «radiador», comprobar la sugerencia y navegar a resultados manteniendo los filtros. Campo móvil visible, sin errores JavaScript. [Captura de producción](docs/diseno/portada-busqueda/mobile-produccion.png). Smoke de catálogo, HTML inicial de producto, canonical, JSON-LD, noindex privado y 404 real aprobado.
