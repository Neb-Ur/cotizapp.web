# Ampliación de 200 productos — 2026-10-14

## Contenido del lote

- **100 repuestos específicos**: 30 para Mahindra KUV100, 25 para Mahindra Scorpio, 24 para Mahindra XUV500, 14 para Hyundai Accent y siete para Kia Rio.
- **100 productos de 21 marcas**: 59 herramientas y consumibles, 25 pinturas/protectores, 15 adhesivos/selladores/impermeabilizantes y un adhesivo para revestimientos.
- **244 URLs de imágenes**; 44 fichas tienen dos vistas. Se validó la descarga HTTP y el tipo de contenido de todas las URLs. Se inspeccionaron muestras de volante de motor y kit de taladro.
- **400 ofertas simuladas**, dos locales por maestro, en las tres desarmadurías de prueba y cuatro ferreterías piloto ya existentes. No se crean nuevos propietarios, locales, cuentas de autenticación ni contratos.

Marcas de herramientas/construcción: 3M, Agorex, Bahco, Bosch, Ceresita, Chilcorrofin, Einhell, Harden, Irimo, Klingspor, KWB, Loctite, Makita, Norton, Rust-Oleum, Sika, Sipa, Soudal, Stanley, Tesa y Truper.

Manifiesto: [semilla-expansion-200.json](semilla-expansion-200.json). Cada fila conserva proveedor, URL, nombre de referencia, código, imágenes y presentación. Las descripciones son redacción propia. Los códigos internos de proveedores no se declaran automáticamente códigos de fabricante.

## Identidad, años y procedencia

Se descartaron URLs/referencias ya presentes, modelos comerciales reconocidos entre los productos existentes, códigos repetidos y publicaciones del proveedor con marca contradictoria. Las colecciones de vehículos pueden incluir artículos ajenos a su nombre: se exigió que cada modelo apareciera explícitamente en el título de la referencia elegida. Un mismo SKU compartido entre colecciones se importa una sola vez; no se duplica para alcanzar la cantidad solicitada.

**Las 100 compatibilidades automotrices son referenciales.** Diecisiete fichas tienen un intervalo cerrado declarado en el párrafo correspondiente al modelo; las otras 83 utilizan intervalos editoriales para probar los filtros. La diferencia se conserva en `rangeMode`, `yearEvidence` y la descripción pública. Los intervalos editoriales no acreditan compatibilidad física. Deben confirmarse VIN, versión, motor, lado, medidas y conectores antes de convertir estas fichas en referencias comerciales verificadas.

Las fotografías permanecen en URLs HTTPS externas, con `origenImagen: external_url` e `imagenReferencial: true`. Ilustran la referencia de catálogo, no las unidades físicas de las ofertas de prueba. No se copian a R2 ni se declaran autorizaciones o licencias no obtenidas. Los enlaces dependen de la disponibilidad del proveedor.

Las ofertas declaran local ficticio, precio, stock y condición simulados. Herramientas/materiales y consumibles se etiquetan nuevos; las demás piezas de desarmaduría, usadas. Son datos para probar búsqueda, comparación y cotizaciones, sin disponibilidad real para compra o retiro.

## Carga, conservación y reanudación

```sh
npm --prefix functions run build
node functions/scripts/seed-catalog-expansion-200.mjs --firebase-cli-auth
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/seed-catalog-expansion-200.mjs --firebase-cli-auth --apply
```

Se crean marcas de fabricante ausentes, dos modelos vehiculares (Scorpio y XUV500) y tres familias automotrices. La marca Mahindra conserva su uso vehicular y amplía el uso a fabricante. No se modifica su nombre ni se eliminan usos previos. La carga no requiere cambios de esquema ni una migración nueva.

El importador verifica identidades y genera un recibo privado con datos previos, documentos planeados y progreso en `~/.local/share/cotizapp/backups/catalog-expansion-200-*.json` (0600). Procesa primero las referencias y después bloques de 20 maestros con sus 40 ofertas. **Cada bloque es atómico**; si se interrumpe, los bloques completados permanecen y una nueva ejecución omite sus IDs. No sobrescribe productos ni precios editados anteriormente.

Las escrituras normalizadas utilizan el codec existente. La invalidación de caché ocurre una vez por bloque para reducir viajes a Cloud SQL y conserva las revisiones de catálogo y ofertas. Se valida de nuevo que locales y propietarios sigan siendo sintéticos y activos al escribir ofertas. Un fallo revierte el bloque completo.

Validación de código: **198 pruebas de backend aprobadas**, incluidas persistencia de los 200 maestros/400 ofertas, galerías, compatibilidades, usos de marca, idempotencia, conservación de ediciones, invalidación de caché, rechazo de IDs ajenos y reversión de bloques inválidos.

## Aplicación comprobada

La carga quedó aplicada a `cotizapp-d71c8`: **621 registros nuevos** (200 maestros, 400 ofertas y 21 referencias) y ampliación del uso de Mahindra a fabricante, conservando su uso vehicular. Se comprobó la conservación íntegra de los 930 maestros anteriores de SQL, incluidos cuatro inactivos, y de las 3.558 ofertas públicas anteriores. Las otras marcas previas conservan sus datos.

Una desconexión interrumpió la primera ejecución después de 80 productos. La reanudación omitió esos 80 maestros y sus 160 ofertas y completó los 120 productos restantes. La preparación posterior devuelve cero creaciones y cero usos de marca pendientes.

SQL confirma 100 aplicaciones vehiculares normalizadas en maestros, 244 relaciones de imágenes y ninguna declaración vehicular duplicada en ofertas. Las ofertas heredan la compatibilidad de sus maestros. La API pública confirmó los filtros por vehículo, años dentro/fuera de rango y local para KUV100, Scorpio, XUV500, Accent y Rio.

Catálogo público final: **1.126 productos y 3.958 ofertas activas**; 16 modelos vehiculares disponibles. Se comprobaron también las galerías y fichas, filtros de fabricante y comparación de precios de los nuevos productos. Hosting y API se desplegaron desde una copia aislada del código publicado con esta tarea; se verificó la conservación de SQL, R2, los locales piloto y los enlaces a secretos del servidor. El smoke posterior al despliegue pasó: catálogo, consistencia de ofertas, HTML, canonical, JSON-LD, rutas privadas no indexables y respuestas 404 reales.

## Referencias individuales

Los años que aparecen abajo son los cargados en la semilla. La evidencia del intervalo está en el manifiesto y en la ficha pública; todos permanecen sujetos a verificación.

| Grupo | Producto | Referencia del proveedor | Fotos | Fuente |
| --- | --- | --- | --- | --- |
| Repuestos | Volante motor Mahindra KUV100 2016–2023 | 0312CAW00290N | 1 | [Ficha](https://allmotor.cl/repuestos-motor-mahindra-kuv100-chile/0312caw00290n-volante-motor-kuv-100-mahindra-4064) |
| Repuestos | Vidrio espejo izquierdo Mahindra KUV100 2016–2023 | 0109BAZ00301N | 1 | [Ficha](https://allmotor.cl/carroceria-interior-mahindra-kuv100-chile/0109baz00301n-vidrio-espejo-izquierdo-kuv-100-mahindra-4041) |
| Repuestos | Vidrio espejo derecho Mahindra KUV100 2016–2023 | 0109BAZ00291N | 1 | [Ficha](https://allmotor.cl/carroceria-interior-mahindra-kuv100-chile/0109baz00291n-vidrio-espejo-derecho-kuv-100-mahindra-4042) |
| Repuestos | Valvula escape (usa 6) Mahindra KUV100 2016–2023 | 0310DAW00021N | 1 | [Ficha](https://allmotor.cl/repuestos-motor-mahindra-kuv100-chile/0310daw00021n-valvula-escape-usa-6-kuv-100-mahindra-4055) |
| Repuestos | Valvula admision (usa 6) Mahindra KUV100 2016–2023 | 0310DAW00011N | 1 | [Ficha](https://allmotor.cl/repuestos-motor-mahindra-kuv100-chile/0310daw00011n-valvula-admision-usa-6-kuv-100-mahindra-4054) |
| Repuestos | Tubo salida de agua Mahindra KUV100 2016–2023 | 0304DAW00080N | 1 | [Ficha](https://allmotor.cl/repuestos-motor-mahindra-kuv100-chile/0304daw00080n-tubo-salida-de-agua-kuv-100-mahindra-4082) |
| Repuestos | Termostato Mahindra KUV100 2016–2023 | 0304EAW00161N | 1 | [Ficha](https://allmotor.cl/repuestos-motor-mahindra-kuv100-chile/0304eaw00161n-termostato-kuv-100-mahindra-4081) |
| Repuestos | Terminal de direccion izq-der Mahindra KUV100 2016–2023 | S1101A010011N | 1 | [Ficha](https://allmotor.cl/direccion-suspension-frenos-mahindra-kuv100-chile/s1101a010011n-terminal-de-direccion-izq-der-kuv-100-mahindra-4127) |
| Repuestos | Terminal axial izq-der Mahindra KUV100 2016–2023 | 1101AAA03241N | 1 | [Ficha](https://allmotor.cl/direccion-suspension-frenos-mahindra-kuv100-chile/1101aaa03241n-terminal-axial-izq-der-kuv-100-mahindra-4126) |
| Repuestos | Tensor correa Mahindra KUV100 2016–2023 | 0306GAW00022N | 1 | [Ficha](https://allmotor.cl/repuestos-motor-mahindra-kuv100-chile/0306gaw00022n-tensor-automatico-kuv-100-mahindra-4077) |
| Repuestos | Tapa salida de agua Mahindra KUV100 2016–2023 | 0304DAW00050N | 1 | [Ficha](https://allmotor.cl/repuestos-motor-mahindra-kuv100-chile/0304daw00050n-tapa-salida-de-agua-kuv-100-mahindra-4084) |
| Repuestos | Tapa entrada de agua Mahindra KUV100 2016–2023 | 0304DAW00030N | 1 | [Ficha](https://allmotor.cl/repuestos-motor-mahindra-kuv100-chile/0304daw00030n-tapa-entrada-de-agua-kuv-100-mahindra-4083) |
| Repuestos | Tapa deposito auxiliar Mahindra KUV100 2016–2023 | 0304AAW00031N | 1 | [Ficha](https://allmotor.cl/carroceria-interior-mahindra-kuv100-chile/0304aaw00031n-tapa-deposito-auxiliar-kuv-100-mahindra-4205) |
| Repuestos | Switch presion de aceite lado flitro Mahindra KUV100 2016–2023 | 0302AAU00190N | 1 | [Ficha](https://allmotor.cl/electronica-encendido-mahindra-kuv100-chile/0302aau00190n-switch-presion-de-aceite-lado-flitro-kuv-100-mahindra-4088) |
| Repuestos | Switch presion de aceite Mahindra KUV100 2016–2023 | 0303DAW00011N | 1 | [Ficha](https://allmotor.cl/electronica-encendido-mahindra-kuv100-chile/0303daw00011n-switch-presion-de-aceite-kuv-100-mahindra-4087) |
| Repuestos | Soporte de motor izquierdo Mahindra KUV100 2016–2023 | 0203AAR16401N | 1 | [Ficha](https://allmotor.cl/repuestos-motor-mahindra-kuv100-chile/0203aar16401n-soporte-de-motor-izquierdo-kuv-100-mahindra-4043) |
| Repuestos | Soporte de motor derecho Mahindra KUV100 2016–2023 | 0203AAR16391N | 1 | [Ficha](https://allmotor.cl/repuestos-motor-mahindra-kuv100-chile/0203aar16391n-soporte-de-motor-derecho-kuv-100-mahindra-4044) |
| Repuestos | Soporte de motor derecho Mahindra KUV100 2016–2023 | 0203AAR17811N | 1 | [Ficha](https://allmotor.cl/repuestos-mahindra-kuv100-chile/0203aar17811n-soporte-de-motor-derecho-kuv-100-mahindra-4158) |
| Repuestos | Soporte de motor central Mahindra KUV100 2016–2023 | 0203CAR00011N | 1 | [Ficha](https://allmotor.cl/repuestos-mahindra-kuv100-chile/0203car00011n-soporte-de-motor-central-kuv-100-mahindra-4045) |
| Repuestos | Sensor temperatura refrigerante Mahindra KUV100 2016–2023 | 0315CAW00021N | 1 | [Ficha](https://allmotor.cl/electronica-encendido-mahindra-kuv100-chile/0315caw00021n-sensor-temperatura-refrigerante-kuv-100-mahindra-4094) |
| Repuestos | Sensor pedal de embrague Mahindra KUV100 2016–2023 | 0802EAA00191N | 1 | [Ficha](https://allmotor.cl/electronica-encendido-mahindra-kuv100-chile/0802eaa00191n-sensor-pedal-de-embrague-kuv-100-mahindra-4095) |
| Repuestos | Sensor map Mahindra KUV100 2016–2023 | 0315CAW00061N | 1 | [Ficha](https://allmotor.cl/electronica-encendido-mahindra-kuv100-chile/0315caw00061n-sensor-map-kuv-100-mahindra-4092) |
| Repuestos | Sensor de velocidad trasero izquierdo derecho Mahindra KUV100 2016–2023 | 0609AAA00081N | 1 | [Ficha](https://allmotor.cl/electronica-encendido-mahindra-kuv100-chile/0609aaa00081n-sensor-de-velocidad-trasero-izquierdo-derecho-kuv-100-mahindra-4097) |
| Repuestos | Sensor de velocidad Mahindra KUV100 2016–2023 | 0315CAW00031N | 1 | [Ficha](https://allmotor.cl/electronica-encendido-mahindra-kuv100-chile/0315caw00031n-sensor-de-velocidad-kuv-100-mahindra-4089) |
| Repuestos | Sensor de oxigeno (usa 2) Mahindra KUV100 2016–2023 | 0315CAW00072N | 1 | [Ficha](https://allmotor.cl/electronica-encendido-mahindra-kuv100-chile/0315caw00072n-sensor-de-oxigeno-usa-2-kuv-100-mahindra-4093) |
| Repuestos | Sensor de golpe Mahindra KUV100 2016–2023 | 0315CAW00041N | 1 | [Ficha](https://allmotor.cl/electronica-encendido-mahindra-kuv100-chile/0315caw00041n-sensor-de-golpe-kuv-100-mahindra-4090) |
| Repuestos | Seguro valvulas Mahindra KUV100 2016–2023 | 0310BAW00042N | 1 | [Ficha](https://allmotor.cl/repuestos-motor-mahindra-kuv100-chile/0310baw00042n-seguro-valvulas-kuv100-mahindra-4499) |
| Repuestos | Rotula 2 ranuras 41.7 Mahindra KUV100 2016–2023 | 0401BAA11051N | 1 | [Ficha](https://allmotor.cl/direccion-suspension-frenos-mahindra-kuv100-chile/0401baa11051n-rotula-2-ranuras-417-kuv-100-mahindra-4118) |
| Repuestos | Rotula 1 ranura 41.5 Mahindra KUV100 2016–2023 | 0401BAA11041N | 1 | [Ficha](https://allmotor.cl/direccion-suspension-frenos-mahindra-kuv100-chile/0401baa11041n-rotula-1-ranura-415-kuv-100-mahindra-4117) |
| Repuestos | Rodamiento maza izq-der Mahindra KUV100 2016–2023 | 0401DAA02771N | 1 | [Ficha](https://allmotor.cl/direccion-suspension-frenos-mahindra-kuv100-chile/0401daa02771n-rodamiento-maza-izq-der-kuv-100-mahindra-4112) |
| Repuestos | Juego Empaquetadura Motor Hyundai Accent 1994–2005 | H50073P | 1 | [Ficha](https://www.fitalia.cl/products/juego-empaquetadura-motor-hyudai-accent-94-051-3-12v) |
| Repuestos | Cable Bujia Kia Rio 2010–2023 | 30123P | 1 | [Ficha](https://www.fitalia.cl/products/cable-bujia-para-hyundai-gran-i10-kia-rio-4-largo-n-1) |
| Repuestos | Filtro Petroleo Bosch Mahindra Scorpio 2010–2023 | M60415-BOSCH | 1 | [Ficha](https://www.fitalia.cl/products/filtro-petroleo-scorpio-motor-2-2) |
| Repuestos | Kit Piñon Satelite - Planetario Mahindra XUV500 2010–2023 | M110415 | 1 | [Ficha](https://www.fitalia.cl/products/kit-pinon-satelite-planetario-mahindra-xuv-500) |
| Repuestos | Bomba Aceite Hyundai Accent 2006–2010 | H20698KOR | 1 | [Ficha](https://www.fitalia.cl/products/bomba-aceite-para-hyundai-new-accent-diesel) |
| Repuestos | Juego Bujias Kia Rio 2011–2017 | 20929-MOBIS | 1 | [Ficha](https://www.fitalia.cl/products/juego-bujias-hyundai-kia-elantra-cerato-accent-rb-rio-iridium) |
| Repuestos | Filtro Aceite Mahindra Scorpio 2010–2023 | M60420 | 1 | [Ficha](https://www.fitalia.cl/products/filtro-de-aceite-mahindra-scorpio-2-2) |
| Repuestos | Bomba Deposito Limpia Parabrisas Mahindra XUV500 2010–2023 | M20712-ALT | 1 | [Ficha](https://www.fitalia.cl/products/bomba-deposito-limpia-parabrisas-mahindra-xuv-500) |
| Repuestos | Rodamiento Rda Delantera Hyundai Accent 2000–2021 | H190702KOR | 1 | [Ficha](https://www.fitalia.cl/products/rodamiento-rda-delantera-hyundai-kia-accent-morning-rio-jb-i10-gran-i10) |
| Repuestos | Kit Embrague Kia Rio 2006–2011 | H110416P-SECO | 1 | [Ficha](https://www.fitalia.cl/products/kit-embrague-hyundai-new-accent-rb-1-6-rio-jb-3-4-5-elatra-cerato-3pcs) |
| Repuestos | Filtro Aire Mahindra Scorpio 2010–2023 | M60405 | 1 | [Ficha](https://www.fitalia.cl/products/filtro-aire-mahindra) |
| Repuestos | Filtro Aire Mahindra XUV500 2010–2023 | M60412 | 1 | [Ficha](https://www.fitalia.cl/products/filtro-aire-mahindra-xuv-500) |
| Repuestos | Filtro Aceite Hyundai Accent 2014–2023 | H60501-ALT | 1 | [Ficha](https://www.fitalia.cl/products/filtro-aceite-hyundai-kia-accent-rb-1-4-i10-gran-i10-morning-soluto) |
| Repuestos | Kit Embrague Kia Rio 2018–2021 | H110426P-VALE | 1 | [Ficha](https://www.fitalia.cl/products/kit-embrague-hyundai-kia-acc-rb-1-4-13-20-rio-1-4-18-21-6-vel-3pcs) |
| Repuestos | Rotulo Inferior Mahindra Scorpio 2010–2023 | M190700-ALT | 1 | [Ficha](https://www.fitalia.cl/products/rotulo-inferior-mahindra-pick-up-scorpio-2-2-2-5-2-6) |
| Repuestos | Juego Bieleta Barra Estabilizadora Delantera Mahindra XUV500 2010–2023 | M20413-ALT | 1 | [Ficha](https://www.fitalia.cl/products/juego-bieleta-barra-estabilizadora-delantera-mahindra-xuv-500) |
| Repuestos | Taquie Valvula Hidraulico Hyundai Accent 2000–2010 | H210041P | 1 | [Ficha](https://www.fitalia.cl/products/taquie-valvula-hidraulico-hyundai-kia-accent-getz-rio-jb-elantra-cerato) |
| Repuestos | Kit Embrague Kia Rio 2010–2023 | H110414P-VALE | 1 | [Ficha](https://www.fitalia.cl/products/kit-embrague-para-hyundai-kia-new-acc-rb-rio-jb-3-4-5-elantra-cerato-getz) |
| Repuestos | Reten Cigueñal Trasero Mahindra Scorpio 2010–2023 | M190290 | 1 | [Ficha](https://www.fitalia.cl/products/reten-ciguenal-trasero-mahindra-pick-up-scorpio-2-2) |
| Repuestos | Amortiguador Trasero Mahindra XUV500 2010–2023 | M10607-ALT | 1 | [Ficha](https://www.fitalia.cl/products/amortiguador-trasero-mahindra-xuv-500) |
| Repuestos | Taquie Valvula Hyundai Accent 2010–2023 | H210039P-INA | 1 | [Ficha](https://www.fitalia.cl/products/taquie-valvula-hyundai-kia-frontier-porter-h1-acc-rb-1-4-i10) |
| Repuestos | Kit Embrague Kia Rio 2012–2018 | H110391P-VALE | 1 | [Ficha](https://www.fitalia.cl/products/kit-embrague-para-hyundai-kia-mornin-1-2-gran-i10-1-2-rio-1-2) |
| Repuestos | Porta Corona Trasera Mahindra Scorpio 2010–2023 | M170520-ORI | 1 | [Ficha](https://www.fitalia.cl/products/porta-corona-trasera-mahindra) |
| Repuestos | Soporte Motor Trasero Mahindra XUV500 2010–2023 | M200606 | 2 | [Ficha](https://www.fitalia.cl/products/soporte-motor-trasero-mahindra-xuv-500) |
| Repuestos | Kit Distribucion Hyundai Accent 2006–2011 | HA006KOR | 1 | [Ficha](https://www.fitalia.cl/products/kit-dist-new-accen-prim-rio-jb-elan-cera-get-105d) |
| Repuestos | Filtro Aceite Kia Rio 2011–2017 | H60430-MOBIS | 1 | [Ficha](https://www.fitalia.cl/products/filtro-aceite-para-hyundai-kia-accent-rio-elantra-cerato) |
| Repuestos | Cremallera Mahindra Scorpio 2010–2023 | M30220-ALT | 1 | [Ficha](https://www.fitalia.cl/products/cremallera-mahindra-pick-up-scorpio-2-2) |
| Repuestos | Farol Neblinero Izquierdo Mahindra XUV500 2010–2023 | M60026 | 2 | [Ficha](https://www.fitalia.cl/products/farol-neblinero-izquierdo-mahindra-xuv-501) |
| Repuestos | Filtro Aceite Hyundai Accent 2014–2023 | H60560-MOBIS | 1 | [Ficha](https://www.fitalia.cl/products/filtro-aceite-para-hyundai-kia-accent-rb-1-4-i10-gran-i10-morning-solut0) |
| Repuestos | Balancin Admision Escape Mahindra Scorpio 2010–2023 | M20000-ORI | 1 | [Ficha](https://www.fitalia.cl/products/balancin-admision-escape-mahindra-pickup-scorpio-genio-xuv) |
| Repuestos | Farol Neblinero Izquierdo Mahindra XUV500 2010–2023 | M60008 | 2 | [Ficha](https://www.fitalia.cl/products/farol-neblinero-izquierdo-mahindra-xuv-500) |
| Repuestos | Juego Bujia Hyundai Accent 2011–2024 | 20924-MOBIS | 1 | [Ficha](https://www.fitalia.cl/products/juego-bujia-para-hyundai-accent-rb-elantra-11-17) |
| Repuestos | Juego Metal Axial Std Mahindra Scorpio 2010–2023 | M130201-ALT | 1 | [Ficha](https://www.fitalia.cl/products/juego-metal-axial-std-mahindra-pick-up-2-2-scorpio-2-2) |
| Repuestos | Farol Neblinero Derecho Mahindra XUV500 2010–2023 | M60007 | 2 | [Ficha](https://www.fitalia.cl/products/farol-neblinero-derecho-mahindra-xuv-500) |
| Repuestos | Juego Bujia Rosca Chica Hyundai Accent 1995–2010 | H20860-MOBIS | 1 | [Ficha](https://www.fitalia.cl/products/juego-bujia-rosca-chica-para-hyundai-accent-excel-elantra) |
| Repuestos | Rotula Superior Mahindra Scorpio 2010–2023 | M190705-ALT | 1 | [Ficha](https://www.fitalia.cl/products/rotula-superior-mahindra-pick-up-2-2-scorpio-2-2) |
| Repuestos | Electroventilador Radiador Mahindra XUV500 2010–2023 | M10003 | 2 | [Ficha](https://www.fitalia.cl/products/electroventilador-radiador-mahindra-xuv-500) |
| Repuestos | Bomba Agua Hyundai Accent 2011–2014 | H20649KOR | 1 | [Ficha](https://www.fitalia.cl/products/bomba-agua-para-hyundai-accent-elantra) |
| Repuestos | Amortiguador Trasero Mahindra Scorpio 2010–2023 | M10635-ALT | 2 | [Ficha](https://www.fitalia.cl/products/amortiguador-trasero-mahindra-scorpio-2-2-2-5) |
| Repuestos | Mensula Parachoque Trasero Mahindra XUV500 2010–2023 | M130320 | 1 | [Ficha](https://www.fitalia.cl/products/mensula-parachoque-trasero-mahindra-xuv-500) |
| Repuestos | Bobina Encendido Hyundai Accent 2010–2023 | H20719-MOBIS | 1 | [Ficha](https://www.fitalia.cl/products/bobina-encendido-accent-rb) |
| Repuestos | Manguera Inferior Radiador Mahindra Scorpio 2010–2023 | M130020-ALT | 1 | [Ficha](https://www.fitalia.cl/products/manguera-inferior-radiador-mahindra-scorpio-2-5) |
| Repuestos | Manguera Succion Filtro Aire Mahindra XUV500 2010–2023 | M130031 | 1 | [Ficha](https://www.fitalia.cl/products/manguera-succion-filtro-aire-mahindra-xuv-502) |
| Repuestos | Turbo Hyundai Accent 2012–2017 | H210863CHN | 1 | [Ficha](https://www.fitalia.cl/products/turbo-hyundai-accent-rb-1-6-2012-al-2017) |
| Repuestos | Cremallera Alza Vidrio Manual Trasera Izquierda Mahindra Scorpio 2010–2023 | M30666 | 1 | [Ficha](https://www.fitalia.cl/products/cremallera-alza-vidrio-manual-trasera-izquierda-mahindra-scorpio-2-5) |
| Repuestos | Manguera Succion Filtro Aire Mahindra XUV500 2010–2023 | M130029 | 1 | [Ficha](https://www.fitalia.cl/products/manguera-succion-filtro-aire-mahindra-xuv-501) |
| Repuestos | Turbo Hyundai Accent 2005–2009 | H210826CHN | 1 | [Ficha](https://www.fitalia.cl/products/turbo-hyundai-accent-prime-2005-al-2009) |
| Repuestos | Cañeria Inyector Nª4 Mahindra Scorpio 2010–2023 | M30123 | 1 | [Ficha](https://www.fitalia.cl/products/caneria-inyector-nª4-mahindra-scorpio-2-5) |
| Repuestos | Manguera Succion Filtro Aire Mahindra XUV500 2010–2023 | M130028 | 1 | [Ficha](https://www.fitalia.cl/products/manguera-succion-filtro-aire-mahindra-xuv-500) |
| Repuestos | Cañeria Inyector Nª2 Mahindra Scorpio 2010–2023 | M30122 | 1 | [Ficha](https://www.fitalia.cl/products/caneria-inyector-nª2-mahindra-scorpio-2-5) |
| Repuestos | Interruptor Nivelacion Luces Delantera Mahindra XUV500 2010–2023 | M90239 | 1 | [Ficha](https://www.fitalia.cl/products/interruptor-nivelacion-luces-delantera-mahindra-xuv-500-todas) |
| Repuestos | Juego Terminal Interior - Exterior Mahindra Scorpio 2010–2023 | M210305-ALT | 1 | [Ficha](https://www.fitalia.cl/products/juego-terminal-interior-exterior-mahindra-pickup) |
| Repuestos | Eje Secundario 2 Caja Cambio Solo Mahindra XUV500 2010–2023 | M50182 | 1 | [Ficha](https://www.fitalia.cl/products/eje-secundario-2-caja-cambio-solo-mahindra-xuv-500) |
| Repuestos | Tensor Correa Bomba Agua Mahindra Scorpio 2010–2023 | M210205 | 1 | [Ficha](https://www.fitalia.cl/products/tensor-correa-bomba-agua-mahindra-pick-up-scorpio-2-2) |
| Repuestos | Deposito Limpia Parabrisas Trasero Mahindra XUV500 2010–2023 | M30237 | 1 | [Ficha](https://www.fitalia.cl/products/deposito-limpia-parabrisas-trasero-mahindra-xuv-500) |
| Repuestos | Tensor con Alternador Mahindra Scorpio 2010–2023 | M210200 | 1 | [Ficha](https://www.fitalia.cl/products/tensor-con-alternador-mahindra-pick-up-scorpio-2-2) |
| Repuestos | Deposito Liquido de Freno Mahindra XUV500 2010–2023 | M40241 | 1 | [Ficha](https://www.fitalia.cl/products/deposito-liquido-de-freno-mahindra-xuv500) |
| Repuestos | Sensor Riel Inyeccion Mahindra Scorpio 2010–2023 | M200115P-BOSCH | 1 | [Ficha](https://www.fitalia.cl/products/sensor-riel-inyeccion-mahindra-pick-up-scorpio-2-2-bosch) |
| Repuestos | Barra Estabilizadora Delantera Mahindra XUV500 2010–2023 | M20172 | 1 | [Ficha](https://www.fitalia.cl/products/barra-estabilizadora-delantera-mahindra-xuv-500-todas) |
| Repuestos | Rodamiento Piñon Ataque Exterior Mahindra Scorpio 2010–2023 | M190660 | 1 | [Ficha](https://www.fitalia.cl/products/rodamiento-pinon-ataque-exterior-mahindra-pick-up-scorpio-2-2) |
| Repuestos | Juego Pastillas Freno Delantera Mahindra XUV500 2010–2023 | M170002-BOSCH | 1 | [Ficha](https://www.fitalia.cl/products/juego-pastillas-freno-delantera-mahindra-xuv-500-bosch) |
| Repuestos | Juego Reten Valvula Mahindra Scorpio 2010–2023 | M190200P | 1 | [Ficha](https://www.fitalia.cl/products/juego-reten-valvula-mahindra-pick-up-scorpio-2-2) |
| Repuestos | Inyector Mahindra XUV500 2010–2023 | M90310P-BOSCH | 1 | [Ficha](https://www.fitalia.cl/products/inyector-mahindra-pick-up-scorpio-xuv-500-genio-ev-bosch) |
| Repuestos | Juego Pistones Std Mahindra Scorpio 2010–2023 | M170412 | 1 | [Ficha](https://www.fitalia.cl/products/juego-pistones-std-mahindra-pick-up-scorpio-2-2) |
| Repuestos | Bandeja Delantero Inferior Derecho Mahindra XUV500 2010–2023 | M20101 | 1 | [Ficha](https://www.fitalia.cl/products/bandeja-delantero-inferior-derecho-mahindra-xuv500) |
| Repuestos | Piñon y Corona Mahindra Scorpio 2010–2023 | M170180 | 1 | [Ficha](https://www.fitalia.cl/products/pinon-y-corona-mahindra-pick-up-scorpio-2-2) |
| Repuestos | Bandeja Delantero Inferior Izquierdo Mahindra XUV500 2010–2023 | M20102 | 1 | [Ficha](https://www.fitalia.cl/products/bandeja-delantero-inferior-izquierdo-mahindra-xuv500) |
| Repuestos | Juego Perno Culata Mahindra Scorpio 2010–2023 | M170210 | 1 | [Ficha](https://www.fitalia.cl/products/juego-perno-culata-mahindra-pick-up-scorpio-2-2) |
| Repuestos | Brazo Limpia Parabrisa Izquierdo Mahindra XUV500 2010–2023 | M20840 | 1 | [Ficha](https://www.fitalia.cl/products/brazo-limpiaparabrisa-izquierdo-mahindra-xuv-500) |
| Repuestos | Modulo Vacio Egr Mahindra Scorpio 2010–2023 | M130400 | 1 | [Ficha](https://www.fitalia.cl/products/modulo-vacio-egr-mahindra-pick-up-scorpio-xuv-500-genio-original) |
| Herramientas/construcción | Makita Taladro Atornillador 13mm. 2 Baterias 3ah + Cargador - Dhp487rfx4-1 | 1052321 | 2 | [Ficha](https://dab.cl/products/makita-taladro-atornillador-percutor-18v-dhp487rfx4) |
| Herramientas/construcción | Esmeril Angular Bosch 9 Gws 2200-230 Vulcano 2200w Tc | 1051620 | 2 | [Ficha](https://dab.cl/products/esmeril-bosch-gws-2200-230-vulcano-2200w-tc) |
| Herramientas/construcción | Einhell Taladro Impacto Inalambrico 18V 4514305 TP-CD 18/80 Li-i BL - Solo | 1051189 | 2 | [Ficha](https://dab.cl/products/einhell-taladro-impacto-inalambrico-18v-4514305-tp-cd-18-80-li-i-bl-solo) |
| Herramientas/construcción | Stanley Llave Stilson 24" 87626 | 1043109 | 1 | [Ficha](https://dab.cl/products/stanley-llave-stilson-24p-87626-1) |
| Herramientas/construcción | Bahco Llave Cadena 4 / 370-4 | 1049849 | 2 | [Ficha](https://dab.cl/products/bahco-llave-cadena-4-370-4-1) |
| Herramientas/construcción | Tecle De Arrastre 4,0 Ton Truper | 1040407 | 1 | [Ficha](https://dab.cl/products/tecle-de-arrastre-4-0-ton-truper-1) |
| Herramientas/construcción | Sikaceram-110 Extra Saco De 25 Kg (Sobre Ceram) | 1051442 | 1 | [Ficha](https://dab.cl/products/sikaceram-110-extra-25kg) |
| Herramientas/construcción | Agorex Tapagotera Cartucho 440Ml (22702031) | 1048129 | 1 | [Ficha](https://dab.cl/products/agorex-tapagotera-cartucho-440ml-22702031) |
| Herramientas/construcción | Espuma Poliuretano 750Ml * Soudal | 1011076 | 2 | [Ficha](https://dab.cl/products/espuma-poliuretano-750ml-soudal) |
| Herramientas/construcción | 3M Silicona Sellador 550 Poliuret 600Ml Gris | 1044326 | 1 | [Ficha](https://dab.cl/products/3m-silicona-sellador-550-poliuret-600ml-gris-1) |
| Herramientas/construcción | Loctite Sb Ultra 20Gr.2818299 | 1050391 | 2 | [Ficha](https://dab.cl/products/loctite-sb-ultra-20gr-2818299) |
| Herramientas/construcción | Harden Set 23Pcs Llaves Punta Corona 540106 | 1047155 | 1 | [Ficha](https://dab.cl/products/harden-set-23pcs-llaves-punta-corona-540106-1) |
| Herramientas/construcción | Disco Lijador 115Mm N60 Flap Disc Norton | 1012883 | 1 | [Ficha](https://dab.cl/products/disco-lijador-115mm-n60-flap-disc-norton-1) |
| Herramientas/construcción | Irimo Juego Llave Dado 1/2" 58 Pz 129-58-4 | 1040767 | 1 | [Ficha](https://dab.cl/products/irimo-juego-llave-dado-1-slash-2p-58-pz-129-58-4-1) |
| Herramientas/construcción | Ceresita Esmalte Cereluxe Gris Perla 1Gl | 1039804 | 1 | [Ficha](https://dab.cl/products/ceresita-esmalte-cereluxe-gris-perla-1gl-1) |
| Herramientas/construcción | Chilcorrofin Vitrolux 63 Vitrificador 1/4 Gl | 1010138 | 1 | [Ficha](https://dab.cl/products/vitrolux-63-vitrificador-1-4-gl) |
| Herramientas/construcción | Sipa Water Proof Acr. Incoloro 1Gl | 1039848 | 1 | [Ficha](https://dab.cl/products/sipa-water-proof-acr-incoloro-1gl-1) |
| Herramientas/construcción | Klingspor Rueda Fibra Gr/150 Ncs600 60X50X6 258942 | 1049700 | 1 | [Ficha](https://dab.cl/products/klingspor-rueda-fibra-gr-150-ncs600-60x50x6-258942-1) |
| Herramientas/construcción | Kwb Huincha De Medir 10 Mts - 060810 | 1052043 | 2 | [Ficha](https://dab.cl/products/kwb-huincha-medir-10m-060810) |
| Herramientas/construcción | Tesa Moll 9 Mm X 6,0 Mt 5559 Pvc Café | 1015667 | 1 | [Ficha](https://dab.cl/products/tesa-moll-9-mm-x-6-0-mt-5559-pvc-cafe-1) |
| Herramientas/construcción | Rust-Oleum Spray Uc2X Rojo Manzana Brillante 340Gr 262151 | 1041581 | 1 | [Ficha](https://dab.cl/products/rust-oleum-spray-uc2x-rojo-manz-bri-340gr-262151) |
| Herramientas/construcción | Broca Cemento Makita 8mm D-0529 | 1016606 | 1 | [Ficha](https://dab.cl/products/makita-broca-cemento-8mm-d-0529-1) |
| Herramientas/construcción | Bosch Sierra Sable Gsa 120/1200w | 1016884 | 2 | [Ficha](https://dab.cl/products/bosch-sierra-sable-gsa-120-1200w) |
| Herramientas/construcción | Einhell Caja De Herramientas Con Ruedas 4540014 E-case | 1050060 | 2 | [Ficha](https://dab.cl/products/einhell-caja-c-ruedas-p-herramientas-y-acc-4540014-e-case-l-with-wheels-1) |
| Herramientas/construcción | Stanley Clavadora 3 En 1 Tr 250 | 1040599 | 2 | [Ficha](https://dab.cl/products/stanley-clavadora-3-en-1-tr-250-1) |
| Herramientas/construcción | Bahco Tijera Pasto P59-25-F | 1015626 | 2 | [Ficha](https://dab.cl/products/bahco-tijera-pasto-p59-25-f-1) |
| Herramientas/construcción | Truper Remachadora Pop Trupper C/Fuelle 4 Boqui | 1014761 | 1 | [Ficha](https://dab.cl/products/remachadora-pop-trupper-c-slash-fuelle-4-boqui-1) |
| Herramientas/construcción | Sika Sikafill Elasticidad 3 Kg | 1042811 | 2 | [Ficha](https://dab.cl/products/sika-sikafill-elasticidad-3-kg-1) |
| Herramientas/construcción | Agorex Adhesivo Transparente 750cc | 1011202 | 2 | [Ficha](https://dab.cl/products/agorex-transp-750cc-henkel-1) |
| Herramientas/construcción | Silicona Soudaflex Soudal 137745 | 1043764 | 1 | [Ficha](https://dab.cl/products/silicona-soudaflex-soudal-137745-1) |
| Herramientas/construcción | 3m Sellador Poliuretano Pu 550 600ml Blanco | 1044327 | 1 | [Ficha](https://dab.cl/products/3m-silicona-sellador-550-poliuret-600ml-blanco-1) |
| Herramientas/construcción | Harden Serrucho Carpintero Rp 18" 631018 | 1043619 | 1 | [Ficha](https://dab.cl/products/harden-serrucho-carpintero-rp-18p-631018-1) |
| Herramientas/construcción | Disco Lijador 115Mm N 80 Flap Disc Norton | 1012881 | 1 | [Ficha](https://dab.cl/products/disco-lijador-115mm-n-80-flap-disc-norton-1) |
| Herramientas/construcción | Irimo Juego Llave Allen 48-9-H | 1041545 | 1 | [Ficha](https://dab.cl/products/irimo-juego-llave-allen-48-9-h-1) |
| Herramientas/construcción | Ceresita Esmalte Cereluxe Azul Electrico 1Gl | 1039794 | 1 | [Ficha](https://dab.cl/products/ceresita-esmalte-cereluxe-azul-electrico-1gl-1) |
| Herramientas/construcción | Pasta Piscina Pp-77 Gris Agua 7 Kg Chilcorrofin | 1010146 | 2 | [Ficha](https://dab.cl/products/pasta-piscina-gris-agua-7-kg-chilc-1) |
| Herramientas/construcción | Pintura Piscina Sipa Celeste 1gl | 1042155 | 2 | [Ficha](https://dab.cl/products/sipa-piscina-celeste-1gl) |
| Herramientas/construcción | Klingspor Grata Copa Bt600Z Trenz. 65Mm / M14 358335 | 1048344 | 1 | [Ficha](https://dab.cl/products/klingspor-grata-copa-bt600z-trenz-65mm-slash-m14-358335-1) |
| Herramientas/construcción | Kwb Hoja Sierra Sable Bimetal 2 Un. C/grueso 152mm - 571095 | 1051884 | 1 | [Ficha](https://dab.cl/products/kwb-hoja-sierra-sable-bimetal-2-un-c-grueso-152mm-571095) |
| Herramientas/construcción | Rust-Oleum Spray Mp Negro Mate 340Gr 272088 | 1041608 | 1 | [Ficha](https://dab.cl/products/rust-oleum-spray-mp-negro-mate-340gr-272088) |
| Herramientas/construcción | Makita Esmeril Angular 4 1/2´ 2 Baterias 3ah + Cargador - Dga455rf-1 | 1052320 | 1 | [Ficha](https://dab.cl/products/makita-esmeril-angular-18v-dga455rf1-2-baterias) |
| Herramientas/construcción | Einhell Atornillador Inalambrico 3.6V 4510503 Tc-Sd 3,6 Li-Ion Kit | 1047798 | 2 | [Ficha](https://dab.cl/products/einhell-atornillador-inalambrico-3-6v-4510503-1) |
| Herramientas/construcción | Stanley Juego Atornillador 10 Pz 60-100 60-010 | 1011700 | 1 | [Ficha](https://dab.cl/products/stanley-juego-atornillador-10-pz-60-100-60-010-1) |
| Herramientas/construcción | Bahco Serrucho Podar 36Cm 340-6T | 1015030 | 2 | [Ficha](https://dab.cl/products/bahco-serrucho-podar-36cm-340-6t-1) |
| Herramientas/construcción | Huincha Medir 5 Mts Truper Impac 145 | 1013483 | 2 | [Ficha](https://dab.cl/products/huincha-medir-5-mts-truper-impac-145-1) |
| Herramientas/construcción | Sika Igol Denso Tarro 3 Kgs | 1011346 | 2 | [Ficha](https://dab.cl/products/sika-igol-denso-tarro-3-kgs-1) |
| Herramientas/construcción | Agorex Silicona Ft101 Blanco 300Ml | 1047216 | 1 | [Ficha](https://dab.cl/products/agorex-silic-ft101-blanco-300ml) |
| Herramientas/construcción | Sellador Poliuretano 600Ml Soudal Blanco | 1046290 | 1 | [Ficha](https://dab.cl/products/sellador-poliuretano-600ml-soudal-blanco-1) |
| Herramientas/construcción | Harden Nivel 400Mm Profesional 580534 | 1049364 | 2 | [Ficha](https://dab.cl/products/harden-nivel-400mm-profesional-580534-1) |
| Herramientas/construcción | Disco Cortar Metal 7´ A30T Norton (Classic A302) | 1037311 | 1 | [Ficha](https://dab.cl/products/disco-cortar-metal-7p-a30t-norton-classic-a302-1) |
| Herramientas/construcción | Ceresita Esmalte Sintetico Base Agua� Cereluxe Ultra Blanco | 1043196 | 1 | [Ficha](https://dab.cl/products/ceresita-esm-sint-b-agua-cereluxe-ultra-blanco-1) |
| Herramientas/construcción | Pasta Piscina Pp-77 Celeste 2 Kg Chilcorrofin | 1010147 | 2 | [Ficha](https://dab.cl/products/pasta-piscina-celeste-2-kg-chilc-1) |
| Herramientas/construcción | Sipa Esmalte Al Agua Semibrillo Blanco Tineta | 1039397 | 1 | [Ficha](https://dab.cl/products/sipa-esmalte-al-agua-semibrillo-blanco-tineta-1) |
| Herramientas/construcción | Klingspor Disco Corte A346Extra 230X1,9X22 Plano 340952 | 1048337 | 1 | [Ficha](https://dab.cl/products/klingspor-disco-corte-a346extra-230x1-9x22-plano-340952) |
| Herramientas/construcción | Kwb Disco Diamentado Segmentado 115X22 Mm 49796170 | 1048267 | 1 | [Ficha](https://dab.cl/products/kwb-disco-diam-segment-115x22-mm-49796170-1) |
| Herramientas/construcción | Rust-Oleum Spray Mp Metalico Aluminio 340Gr 272117 | 1042828 | 1 | [Ficha](https://dab.cl/products/rust-oleum-spray-mp-metalico-alumin-340gr-272117) |
| Herramientas/construcción | Makita Kit Taladro Percutor Inalambrico 13mm 18v Dhp486rte | 1051770 | 2 | [Ficha](https://dab.cl/products/makita-kit-taladro-percutor-inalambrico-13mm-18v-dhp486rte) |
| Herramientas/construcción | Einhell Taladro +Atornillador Impacto +2 Baterias +1 Cargador | 1046340 | 1 | [Ficha](https://dab.cl/products/einhell-taladro-ator-impac-2b-1c-1) |
| Herramientas/construcción | Bahco Martillo Carpintero Mango Fibra 16 Oz 428F-16 | 1051307 | 1 | [Ficha](https://dab.cl/products/bahco-martillo-carpintero-mango-fibra-16-oz-428f-16) |
| Herramientas/construcción | Huincha Medir 10 Mts Truper Fh-10M | 1013509 | 1 | [Ficha](https://dab.cl/products/huincha-medir-10-mts-truper-fh-10m-1) |
| Herramientas/construcción | Agorex Silicona Ft101 Gris 300Ml | 1047215 | 2 | [Ficha](https://dab.cl/products/agorex-silic-ft101-gris-300ml) |
| Herramientas/construcción | Harden Manguera Tipo Espiral 10Mts P/Compresor | 1050720 | 1 | [Ficha](https://dab.cl/products/harden-manguera-tipo-espiral-10mts-p-compresor) |
| Herramientas/construcción | Ceresita Aerosol Esm Brillante Negro | 1042324 | 1 | [Ficha](https://dab.cl/products/ceresita-aerosol-esm-brillante-negro-1) |
| Herramientas/construcción | Chilcorrofin 46 Verde Reja 1/4 | 1045094 | 1 | [Ficha](https://dab.cl/products/chilcorrofin-46-verde-reja-1-slash-4-1) |
| Herramientas/construcción | Sipa Latex Extracubriente Blanco Tineta | 1039387 | 1 | [Ficha](https://dab.cl/products/sipa-latex-extracubriente-blanco-tineta-1) |
| Herramientas/construcción | Klingspor Disco Lija Lamina 115X22.23 Gr 80 Flap | 1035172 | 1 | [Ficha](https://dab.cl/products/klingspor-disco-lija-lamina-115x22-23-gr-80-flap-1) |
| Herramientas/construcción | Rust-Oleum Spray Uc2X Transparente Satinado 340Gr 262170 | 1042825 | 1 | [Ficha](https://dab.cl/products/rust-oleum-spray-uc2x-transp-satin-340gr-262170-1) |
| Herramientas/construcción | Makita Hidrolavadora /presion 220v Hw101 | 1051712 | 2 | [Ficha](https://dab.cl/products/makita-hidrolavadora-hw101) |
| Herramientas/construcción | Einhell Taladro Percutor 1010W 4259825 Tc-Id 1000 E | 1045481 | 2 | [Ficha](https://dab.cl/products/einhell-taladro-percusion-1010w-4259825-1) |
| Herramientas/construcción | Bahco Martillo Carp.M/Fibra 20 Oz 428-20 | 1040043 | 2 | [Ficha](https://dab.cl/products/bahco-martillo-carp-m-slash-fibra-20-oz-428-20-1) |
| Herramientas/construcción | Serrucho Podar Truper 14" 18172 | 1043802 | 1 | [Ficha](https://dab.cl/products/serrucho-podar-truper-14p-18172-1) |
| Herramientas/construcción | Agorex Adhesivo Vinilico 1/4 Galon | 1011248 | 1 | [Ficha](https://dab.cl/products/agorex-vinilico-1-slash-4-galon-1) |
| Herramientas/construcción | Harden Juego Llave Dado 46P 1/4" 510346 | 1044372 | 1 | [Ficha](https://dab.cl/products/harden-juego-llave-dado-46p-1-slash-4p-510346-1) |
| Herramientas/construcción | Ceresita Aerosol Esm Brillante Naranja | 1043258 | 1 | [Ficha](https://dab.cl/products/ceresita-aerosol-esm-brillante-naranja-1) |
| Herramientas/construcción | Chilcorrofin Pintura Piscina Super Caucho Azul Tahiti Gl | 1010171 | 2 | [Ficha](https://dab.cl/products/pintura-piscina-super-caucho-azul-tahiti-gl-1) |
| Herramientas/construcción | Rust-Oleum Spray Uc2X Lila Satinado 340Gr 262201 | 1042409 | 1 | [Ficha](https://dab.cl/products/rust-oleum-spray-uc2x-lila-satin-340gr-262201) |
| Herramientas/construcción | Sierra Ingleteadora Telescopica 10 Makita 1450w Ls1110f | 1051710 | 2 | [Ficha](https://dab.cl/products/makita-sierra-ingleteadora-10-1450w-tel-ls111of) |
| Herramientas/construcción | Einhell Kit Hidropack 650W 4173190 Gc-Ww 6538 | 1045415 | 2 | [Ficha](https://dab.cl/products/einhell-kit-hidropack-650w-4173190-1) |
| Herramientas/construcción | Bahco Lima Redonda 10" C/Mango 1-230-10-2-2 | 1045526 | 2 | [Ficha](https://dab.cl/products/bahco-lima-redonda-10-c-mango-1-230-10-2-2) |
| Herramientas/construcción | Rastrillo Hojas Pvc Truper 26 Dientes | 1045300 | 1 | [Ficha](https://dab.cl/products/rastrillo-hojas-pvc-truper-26-dientes) |
| Herramientas/construcción | Harden Tijera Podar 8" 20cm - 630401 | 1051017 | 2 | [Ficha](https://dab.cl/products/harden-tijera-podar-8-pulgadas-20cm-630401) |
| Herramientas/construcción | Ceresita Aerosol Esm Brillante Gris | 1043257 | 1 | [Ficha](https://dab.cl/products/ceresita-aerosol-esm-brillante-gris-1) |
| Herramientas/construcción | Chilcorrofin Plastipiscinaina 33 Azul Tahiti Gl | 1040735 | 2 | [Ficha](https://dab.cl/products/pintura-piscina-plastipiscinaina-33-azul-tahiti-gl-1) |
| Herramientas/construcción | Rust-Oleum Spray Uc2X Verde Limon Brillante 340Gr 262162 | 1042399 | 1 | [Ficha](https://dab.cl/products/rust-oleum-spray-uc2x-verde-limon-bri-340gr-262162) |
| Herramientas/construcción | Makita Bateria 18v 50ah 197282-4 | 1051709 | 1 | [Ficha](https://dab.cl/products/makita-bateria-18v-50ah-197282-4) |
| Herramientas/construcción | Einhell Sierra De Banco 10 1800W Extendible 4340515 Tc-Ts 2225 U | 1045092 | 2 | [Ficha](https://dab.cl/products/einhell-sierra-de-banco-10-1800w-extendible-4340515-1) |
| Herramientas/construcción | Bahco Hoja (P160 ) R160A | 1015567 | 1 | [Ficha](https://dab.cl/products/bahco-hoja-p160-r160a-1) |
| Herramientas/construcción | Harden Llave Torque 1/2" 10-110Nm 538111 | 1044375 | 2 | [Ficha](https://dab.cl/products/harden-llave-torque-1-slash-2p-10-110nm-538111-1) |
| Herramientas/construcción | Ceresita Calorkote Aluminio 1/4 Gl. Solvente | 1040476 | 1 | [Ficha](https://dab.cl/products/calorkote-aluminio-1-slash-4-gl-solvente-1) |
| Herramientas/construcción | Rust-Oleum Alta Temperatura Negro Mate 322633 | 1048160 | 1 | [Ficha](https://dab.cl/products/rust-sp-brochable-alta-temperatura-negro-mate-322633) |
| Herramientas/construcción | Broca Madera Larga Makita 100 X 315mm D-07179 | 1051669 | 1 | [Ficha](https://dab.cl/products/broca-madera-larga-makita-100-x-315mm-d-07179) |
| Herramientas/construcción | Einhell Herramienta Multiproprosito Tipo Dremel 4419169 Tc-Mg 135 E | 1043766 | 2 | [Ficha](https://dab.cl/products/einhell-herram-multiprop-tipo-dremel-4419169-1) |
| Herramientas/construcción | Bahco Serrucho Para Molduras 14" 300-14-F15/16Hp | 1047102 | 2 | [Ficha](https://dab.cl/products/bahco-serrucho-para-molduras-14p-300-14-f15-slash-16hp-1) |
| Herramientas/construcción | Harden Juego Llave Dado 32P 1/2" 510432 | 1044370 | 1 | [Ficha](https://dab.cl/products/harden-juego-llave-dado-32p-1-slash-2p-510432-1) |
| Herramientas/construcción | Ceresita Aerosol Esm Brillante Verde Esmeralda | 1043259 | 1 | [Ficha](https://dab.cl/products/ceresita-aerosol-esm-brillante-verde-esmeralda-1) |
| Herramientas/construcción | Rust-Oleum Zinsser Eliminador de Hongo y Moho Gl 322363 | 1050606 | 2 | [Ficha](https://dab.cl/products/rust-oleum-zinsser-mold-killing-primer-gl-322363-e-hon) |
| Herramientas/construcción | Broca Madera Makita 50 X 85mm D-07048 | 1051654 | 1 | [Ficha](https://dab.cl/products/broca-madera-makita-50-x-85mm-d-07048) |
| Herramientas/construcción | Einhell Rotomartillo Inalambrico 18V. 4514265 TP-HD 18/26 Li BL - Solo | 1051143 | 2 | [Ficha](https://dab.cl/products/einhell-rotomartillo-inalambrico-18v-4514265-tp-hd-18-26-li-bl-solo) |
| Herramientas/construcción | Bahco Martillo Ergo 20 Oz 529-20-L | 1047103 | 1 | [Ficha](https://dab.cl/products/bahco-martillo-ergo-20-oz-529-20-l-1) |
| Herramientas/construcción | Broca Sds Plus Makita 6 X 210 Mm D-00072 | 1051578 | 1 | [Ficha](https://dab.cl/products/makita-broca-sds-plus-6-x-210-mm-d-00072) |
