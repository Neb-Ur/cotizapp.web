# Ampliación semilla Mahindra KUV100 — 2026-10-14

Se agregan **44 maestros específicos**, **53 URLs de imágenes** (cuatro galerías con varias vistas), **tres desarmadurías ficticias** y **110 ofertas**. Cada producto conserva pieza, marca vehicular, modelo, intervalo de años y código o referencia del proveedor en su nombre. Las ofertas heredan la compatibilidad del maestro y comparten su galería; las fotografías no representan las unidades físicas simuladas.

## Alcance y procedencia

Las fichas se prepararon con referencias públicas de Fitalia, Naya Purana y AllMotor. Se redactaron descripciones propias y se guardan los enlaces de procedencia. Los códigos de Fitalia se conservan como referencias del proveedor; no se declaran automáticamente códigos OEM.

**Todas las compatibilidades siguen siendo referenciales.** Cuando la fuente declara años cerrados se conservan; los intervalos abiertos se acotan editorialmente a 2023. Cuando no publica años, el manifiesto identifica explícitamente el intervalo de prueba, pendiente de validación por VIN, motor, versión, conectores y medidas. Un rango editorial no certifica que la pieza encaje en todos esos vehículos. No se dividen artificialmente las fichas usando la misma foto para inventar otra variante de años.

Las fotografías se enlazan mediante HTTPS desde sus proveedores, sin copiar archivos a R2 ni declarar propiedad, licencia o autorización sobre ellas. Se conserva `origenImagen: external_url`, `imagenReferencial: true` y el enlace de la ficha de origen. Su disponibilidad depende del sitio externo. El 14 de octubre se descargaron y validaron las 53 URLs como imágenes HTTP 200; se quitaron archivos idénticos de las galerías y marcadores sin imagen. Se inspeccionaron muestras de sensor y neblineros.

## Locales y ofertas

- Desarmaduría Ruta Norte (Prueba): 44 ofertas.
- Desarmaduría Patio Central (Prueba): 44 ofertas.
- Desarmaduría Garage Sur (Prueba): 22 ofertas.

Los propietarios son registros SQL sintéticos con correos `example.invalid`, sin cuentas de Firebase Authentication ni contratos comerciales firmados. Los locales no tienen direcciones, teléfonos ni coordenadas reales. Se publican mediante el modo piloto existente. Cada oferta declara que local, precio, stock y compatibilidad son de prueba; ninguna es una disponibilidad comercial real. Precios en CLP y stock deterministas permiten comparar dos o tres locales por maestro. Filtros de aceite, pastillas y distribución se ofrecen con condición nueva; el resto usa condiciones de prueba usadas o reacondicionadas.

## Carga y comprobación

Manifiesto: [semilla-kuv100-ampliada.json](semilla-kuv100-ampliada.json).

```sh
npm --prefix functions run build
node functions/scripts/seed-kuv100-catalog.mjs --firebase-cli-auth
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/seed-kuv100-catalog.mjs --firebase-cli-auth --apply
```

El importador requiere categoría, subcategorías mecánicas y Mahindra/KUV100 existentes. Crea únicamente IDs ausentes, valida la identidad de los registros encontrados y nunca sobrescribe precios, fotos o ediciones existentes. Se ejecuta en una transacción serializable y genera un recibo previo privado en `~/.local/share/cotizapp/backups/kuv100-catalog-*.json` con permisos 0600. No requiere cambiar el esquema ni reactivar la semilla genérica archivada.

Se prueban persistencia relacional de galerías y años, herencia desde el maestro, comparación entre locales, exclusión de años fuera de rango, idempotencia, rechazo de IDs ajenos y conservación de productos anteriores.

Carga aplicada a `cotizapp-d71c8`: 173 registros nuevos, sin sobrescrituras. Segunda preparación: cero pendientes y 177 documentos existentes, incluidos cuatro registros de taxonomía previos. Catálogo público: **926 maestros y 3.558 ofertas activas**. Las 194 pruebas de backend y el smoke de producción pasaron; la API pública confirmó los resultados por año (2016, 2017, 2018, 2019, 2020, 2021, 2023 y 2024) y por local. En 2024 el lote no devuelve coincidencias.

## Referencias por producto

Los años de esta tabla son los intervalos cargados para probar filtros. La evidencia concreta y sus límites están en `yearEvidence` del manifiesto y en cada descripción pública.

| Pieza | Referencia | Años cargados | Imágenes | Fuente |
| --- | --- | --- | --- | --- |
| Farol Neblinero Trasero Izquierdo | M60034P-ALT | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/farol-neblinero-trasero-izquierdo-mahindra-kuv-100) |
| Kit Distribucion | MHA007-KIT | 2016–2017 | 1 | [Ficha](https://www.fitalia.cl/products/kit-distribucion-mahindra-kuv-100) |
| Sensor Eje Leva | M200298 | 2017–2023 | 6 | [Ficha](https://www.fitalia.cl/products/sensor-eje-leva-mahindra-kuv-100) |
| Rodamiento Embrague | M190607 | 2016–2023 | 3 | [Ficha](https://www.fitalia.cl/products/rodamiento-embrague-mahindra-kuv-100) |
| Luneta Trasera | M120206 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/luneta-trasera-mahindra-kuv-100) |
| Juego de patines de Freno Trasero | M170013-ALT | 2016–2023 | 1 | [Ficha](https://www.fitalia.cl/products/juego-patin-freno-trasero-mahindra-kuv-100) |
| Cilindro Freno Trasero Derecho | FITALIA-8435784450220 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/cilindro-freno-trasero-derecho-mahindra-kuv-100) |
| Cilindro Freno Trasero Izquierdo | M30408 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/cilindro-freno-trasero-izquierdo-mahindra-kuv-100) |
| Filtro Aceite | M60423 | 2016–2023 | 1 | [Ficha](https://www.fitalia.cl/products/filtro-aceite-mahindra-kuv-100-xuv-500-xuv-300) |
| Bisel Neblinero Delantero Izquierdo | M20488 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/bisel-neblinero-delantero-izquierdo-mahindra-kuv-100-k6) |
| Bisel Neblinero Cromado Derecho | M20487 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/bisel-neblinero-cromado-derecho-mahindra-kuv-100-k6) |
| Bisel Neblinero Cromado Izquierdo | M20486 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/bisel-neblinero-cromado-izquierdo-mahindra-kuv-100-k6) |
| Soporte Tapabarro Derecho | M200805 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/soporte-tapabarro-derecho-mahindra-kuv-100-k4-k6) |
| Soporte Tapabarro | M200804 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/soporte-tapabarro-mahindra-kuv-100-k4-k6) |
| Sensor ABS Delantero | M200289 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/sensor-abs-delantero-mahindra-kuv-100) |
| Muñon Delantero Derecho con ABS | M130622 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/munon-delantero-derecho-con-abs-mahindra-kuv-100-k4-k6) |
| Muñon Delantero con ABS Izquierdo | M130621 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/munon-delantero-con-abs-izquierdo-mahindra-kuv-100-k4-k6) |
| Moldura Zocalo Derecho | M130389 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/moldura-zocalo-derecho-mahindra-kuv-100-k6-k6rf) |
| Moldura Puerta Trasera Izquierda | M130386 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/moldura-puerta-trasera-izquierda-mahindra-kuv-100-k6-k6rf) |
| Moldura Puerta Delantera Izquierda | M130384 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/moldura-puerta-delantera-izquierda-mahindra-kuv-100-k6-k6rf) |
| Amortiguador Delantero Derecho | M10592-ALT | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/amortiguador-delantero-derecho-kuv-100-1-2) |
| Foco delantero Izquierdo | M160457 | 2016–2023 | 1 | [Ficha](https://www.fitalia.cl/products/optico-izquierdo-mahindra-kuv-101) |
| Foco delantero Derecho | M160458 | 2016–2023 | 1 | [Ficha](https://www.fitalia.cl/products/optico-derecho-mahindra-kuv-100) |
| Juego de pastillas de Freno Delantero | M170006-ALT | 2016–2023 | 1 | [Ficha](https://www.fitalia.cl/products/juego-pastilla-freno-delantero-mahindra-kuv-100) |
| Kit Embrague | M110403-LUK | 2016–2023 | 1 | [Ficha](https://www.fitalia.cl/products/kit-embrague-mahindra-kuv-100) |
| Guia Cadena Distribucion | M70424 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/guia-cadena-distribucion-mahindra-kuv-100) |
| Tensor Cadena Bomba de Aceite | M210221 | 2016–2023 | 1 | [Ficha](https://www.fitalia.cl/products/tensor-cadena-bomba-de-aceite-mahindra-kuv-100) |
| Guia Superior Cadena Distribucion | M70426 | 2017–2023 | 1 | [Ficha](https://www.fitalia.cl/products/guia-superior-cadena-distribucion-mahindra-kuv-101) |
| Cadena Bomba Aceite | M30017 | 2016–2023 | 1 | [Ficha](https://www.fitalia.cl/products/cadena-bomba-aceite-mahindra-kuv-100) |
| Alternador | F000BL06B3 | 2016–2017 | 1 | [Ficha](https://nayapuranaonline.com/product/alternator-2608071955382) |
| Pilar delantero | 0102AAZ00810NA | 2016–2017 | 1 | [Ficha](https://nayapuranaonline.com/product/mahindra-kuv-100-front-piller) |
| Llanta | 0404AAA05851N | 2016–2017 | 1 | [Ficha](https://nayapuranaonline.com/product/mahindra-kuv-100-wheel-rim) |
| Foco delantero derecho | 1701AAA07781N | 2016–2017 | 1 | [Ficha](https://nayapuranaonline.com/product/mahindra-kuv-100-headlight-rh-side) |
| Marco radio | 0101EAZ02510NA | 2017–2023 | 1 | [Ficha](https://nayapuranaonline.com/product/mahindra-kuv-100-music-system-frame) |
| Tablero de instrumentos | 1301AAA03731N | 2017–2023 | 1 | [Ficha](https://nayapuranaonline.com/product/mahindra-kuv-100-speedometer) |
| Tablero interior | 0112AAZ05450N | 2017–2023 | 1 | [Ficha](https://nayapuranaonline.com/product/mahindra-kuv-100-dashboard) |
| Rejilla central de ventilación | 0112AAZ00660N | 2017–2023 | 1 | [Ficha](https://nayapuranaonline.com/product/mahindra-kuv-100-center-ac-vent) |
| Cremallera de dirección | 1101A3011N | 2017–2023 | 1 | [Ficha](https://nayapuranaonline.com/product/mahindra-kuv-100-steering-rack) |
| Neblinero delantero derecho | FF-5045M | 2020–2023 | 1 | [Ficha](https://nayapuranaonline.com/product/mahindra-kuv-100-fog-lamp-right) |
| Neblinero delantero izquierdo | FF-5046M | 2020–2023 | 1 | [Ficha](https://nayapuranaonline.com/product/mahindra-kuv-100-fog-lamp-left) |
| Foco trasero izquierdo | TL-6644M | 2016–2017 | 2 | [Ficha](https://nayapuranaonline.com/product/mahindra-kuv-100-taillamp-lh) |
| Foco trasero derecho | TL-6643M | 2020–2023 | 2 | [Ficha](https://nayapuranaonline.com/product/mahindra-kuv-100-taillamp-rh) |
| Neblinero delantero izquierdo | 1701DAA00461N | 2016–2019 | 1 | [Ficha](https://allmotor.cl/carroceria-interior-mahindra-kuv100-chile/1701daa00461n-neblinero-izquierdo-kuv-100-mahindra-4037) |
| Neblinero delantero derecho | 1701DAA00471N | 2016–2019 | 1 | [Ficha](https://allmotor.cl/carroceria-interior-mahindra-kuv100-chile/1701daa00471n-neblinero-derecho-kuv-100-mahindra-4038) |
