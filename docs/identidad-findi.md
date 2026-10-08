# Identidad visual de Findi

La aplicación conserva sus funciones y organización. El sistema visual sigue el símbolo redondeado de la F con lupa aportado por el usuario.

## Fundamentos

- Azul `#0F2D4A`: marca, encabezados y navegación activa.
- Naranja `#FF7A00`: acciones principales y detalles de énfasis. Texto azul sobre naranja para mantener contraste.
- Gris `#F3F5F8`: fondo y superficies secundarias.
- Gris `#6B7280`: textos secundarios; casi negro `#111827` para contraste.
- Manrope: tipografía común de títulos y controles.
- Radios: 6 px para detalles pequeños, 12 px para controles, 20 px para tarjetas, 24 px para paneles y modales, 32 px para contenedores grandes.
- Estados de éxito, advertencia y error conservan colores semánticos y textos explicativos.

## Aplicación

Los tokens se definen en `src/styles.scss`. Las reglas compartidas de las pantallas están en `src/styles/_findi-components.scss`, evitando duplicarlas en dashboards. Los componentes conservan sus reglas de distribución y adaptación móvil.

Se cubren inicio, header y buscador, catálogo, detalle de producto, dashboards de admin/maestro/ferretería, cotizaciones, autenticación, formularios públicos, páginas legales, footer y modales. Las tablas anchas se desplazan dentro de su contenedor.

El PDF de cotización usa el símbolo vectorial, encabezado azul, total destacado, pie y numeración. La paginación mantiene los bloques de cada artículo juntos cuando caben en una página. No cambia el cálculo de precios ni el IVA.

## Verificación

Se revisan las páginas públicas y los cuatro flujos internos principales a 390 y 1440 px. Las sesiones internas de revisión se simulan solo en un navegador local aislado, sin modificar autenticación ni escribir datos en Firebase. El PDF se renderiza con Poppler para revisar todas sus páginas y se comprueba la conservación de los importes.
