# Estado de CotizApp — 4 de octubre de 2026

> Informe actualizado al código del commit `82b8569` y los cambios locales de búsqueda paginada, con las correcciones posteriores a la auditoría inicial de `8d414a8` y la separación demo/real. Las verificaciones locales y las observaciones históricas de producción se identifican por separado. No se ha desplegado esta entrega.

## Dictamen

**Los hallazgos críticos y los errores principales de la auditoría están corregidos en el código y sus regresiones locales pasan.** La última validación registra **61 pruebas frontend y 50 backend aprobadas**, además de compilación de producción y comprobaciones en Chrome. La funcionalidad existente se conserva en los recorridos revisados; esto no acredita el 100% de los flujos autenticados en producción.

La aplicación incorpora `DEMO=true|false`, con valor predeterminado **false**, para iniciar con negocio real vacío y mantener disponibles los datos demo. El administrador es compartido y puede alternar ambos entornos con el botón **Demo**. El catálogo genérico y los catálogos de referencia se comparten; maestros como usuarios, ferreterías y registros de negocio se separan.

**Antes de abrir comercialmente quedan pendientes el despliegue, la validación autenticada con Firebase, la configuración operativa/legal y la incorporación de ofertas reales autorizadas.** También sigue pendiente mejorar rendimiento móvil y resolver deuda de escalabilidad y SEO. Un catálogo real sin ofertas al iniciar es ahora una condición prevista, no un error de carga.

La auditoría inicial de `https://cotizapp-d71c8.web.app` observó **60 productos maestros demo y cero ofertas activas**. Esa observación es anterior a las correcciones y no constituye una comprobación del estado actual del servicio publicado. No se ha realizado una nueva medición de producción en esta actualización.

Detalle de implementación: [correcciones importantes](fixes-important-2026-10-04.md) y [configuración demo/real](demo-real.md).

## Última validación del código

| Verificación | Resultado |
|---|---|
| Pruebas frontend | 61 aprobadas en 18 archivos |
| Pruebas backend | 50 aprobadas, sin fallos ni pruebas omitidas |
| TypeScript frontend y Functions | Compilación aprobada |
| Compilación Angular de producción | Aprobada; nueve rutas prerenderizadas |
| Presupuesto CSS | Tres advertencias pendientes: admin 20,39 kB, maestro 19,93 kB y ferretería 20,41 kB; límite de aviso 17 kB |
| Contratos de API existentes | Se conservan método, orden, autenticación y middlewares de las rutas revisadas |
| Chrome local, escritorio y móvil | Seis rutas públicas revisadas en ambos tamaños, sin errores JavaScript ni desbordamientos horizontales |
| Regresiones de negocio en navegador | Búsqueda con `q`, selección por ID de sucursal, selección antigua ambigua y error 503 con reintento comprobados |
| Demo/real en navegador | Real vacío, demo con ofertas y mismo administrador alternando en ambos sentidos sin perder sesión; datos simulados |
| Búsqueda paginada | Catálogo controlado de 135 productos, última página, total completo, filtros/orden global y carga de una sola página comprobados |
| Aislamiento de datos | Pruebas de lectura/escritura, perfiles, autorización, caché y solicitudes concurrentes aprobadas |
| Conflictos y formato | Sin archivos sin fusionar; comprobación de diferencias aprobada en la entrega de código |

Las comprobaciones de backend usan dobles de Firestore/Auth en memoria. El navegador se comprobó con la compilación de producción y respuestas controladas; no se crearon cuentas ni registros de negocio en producción.

En la auditoría inicial, `npm audit` informó cero vulnerabilidades conocidas en ambos lockfiles. No se repitió ese análisis en esta actualización documental y no sustituye una revisión de permisos o de lógica de negocio.

## Estado de los hallazgos iniciales

“Corregido” describe el código y las comprobaciones locales; su puesta en servicio depende del despliegue conjunto.

| Prioridad original | Hallazgo | Estado actual |
|---|---|---|
| P0 | Exportar/eliminar registros de terceros por correo no verificado | **Corregido.** Los registros por UID mantienen su asociación; los anónimos por correo requieren que Firebase acredite ese mismo correo verificado. Los fallos de Auth se propagan. La eliminación exige autenticación de los últimos cinco minutos. |
| P1 | Búsqueda desde inicio ignora `q` | **Corregido.** Se aplica y actualiza el parámetro, reiniciando la paginación. |
| P1 | Optimizador mezcla sucursales homónimas | **Corregido.** Selección, optimización y cotizaciones usan IDs. Las selecciones antiguas solo se recuperan si son inequívocas; una selección ambigua no cambia silenciosamente de tienda. |
| P1 | Importación vincula productos por coincidencias aproximadas | **Corregido.** Solo coincidencias exactas e inequívocas permiten vinculación automática; el resto requiere revisión. |
| P1 | Aprobar una solicitud no crea la oferta | **Corregido.** Una transacción crea o reutiliza la oferta y enlaza la solicitud; repetir la aprobación no duplica ni sobrescribe ofertas existentes. |
| P1 | Reponer una oferta mantiene `activo:false` | **Corregido.** Se restaura el estado anterior. Los retiros históricos sin estado guardado mantienen la reposición activa como compatibilidad. |
| P1 | Fallos de carga se muestran como ausencia de datos | **Corregido.** Hay error visible y reintento, sin presentar un fallo como catálogo vacío. |
| P2 | CSV pierde SKU, identificadores y opciones | **Corregido.** Se conservan SKU, código de barras, stock cero y elección de publicación. |
| P2 | Registro sobrescribe perfiles existentes | **Corregido.** Se rechaza el registro repetido sin alterar rol, estado ni datos anteriores. |
| P2 | Borrador compartido entre cuentas | **Corregido.** Claves por UID y entorno; limpieza al salir/eliminar, incluyendo la clave histórica. |
| P2 | Ficha técnica pierde `0` y `false` o muestra IDs | **Corregido.** Valores preservados y etiquetas legibles en el detalle API. |
| P2 | Búsqueda corta el catálogo a 100 productos | **Corregido.** La pantalla solicita páginas al servidor con búsqueda, filtros, ordenamiento y cercanía; recibe el total completo, sin descargar el catálogo entero. Pruebas con 135 productos y respuesta antigua descartada al cambiar la búsqueda. |
| P2 | Duplicados concurrentes y actualización parcial de perfiles | **Corregido.** Vinculación protegida por transacción y coordenadas validadas antes de confirmar el lote. |
| Operativo | Eliminación informa éxito pese a un fallo de Firebase Auth | **Corregido.** Solo se tolera que el usuario ya no exista; otros errores no generan comprobante de éxito. La eliminación entre servicios no es atómica y puede requerir reintento. |

## Separación demo y real

```dotenv
DEMO=false
```

La variable se configura en Functions; admite únicamente `true` o `false`. El frontend consulta `/api/config` antes de iniciar. Si no puede obtener la configuración, muestra un error en lugar de seleccionar un entorno implícitamente.

| Aspecto | Comportamiento |
|---|---|
| `DEMO=true` | Entorno público y cuentas de negocio usan datos demo históricos |
| `DEMO=false` | Entorno real; no copia usuarios de negocio, ferreterías, ofertas ni cotizaciones demo |
| Referencias compartidas | Categorías, subcategorías, familias, productos maestros, atributos, ciudades y comunas |
| Catálogo genérico | Las fichas del seed se presentan como referencias genéricas en real; no generan precios ni stock |
| Identidad | Firebase Auth y `usuarios` compartidos; perfiles de negocio con `dataMode`, históricos sin campo considerados demo |
| Negocio | Colecciones históricas para demo y prefijo `real_` para registros reales |
| Administrador | Misma cuenta en ambos entornos; botón Demo activado selecciona demo y desactivado real |
| Alcance del botón | Preferencia por administrador/navegador; no cambia la variable del servidor ni el entorno de otros usuarios |
| Autorización | Solo admin autorizado puede seleccionar entorno por cabecera; cuentas de negocio no acceden al entorno contrario |
| Caché y borradores | Separados por entorno; respuestas con selección administrativa protegidas frente a caché pública |
| Requisitos comerciales | Real conserva contratos, activación, vigencia y stock; demo admite ofertas sin contrato comercial real |
| SEO demo | Aviso visible y protección noindex para fichas/API demo |

No se borran ni migran los registros históricos. Las colecciones reales se crean al registrar datos reales; la variable no ejecuta el seed ni crea cuentas. Las cuentas Firebase deshabilitadas continúan deshabilitadas. Los cambios administrativos al catálogo central sí afectan a ambos entornos por ser compartido.

## Funcionalidades y límites de validación

| Área | Estado actual |
|---|---|
| Sitio público e información | Navegación comprobada en la muestra de rutas; pendientes operativos del contenido legal |
| Catálogo/comparador | Implementado; búsqueda y paginación de servidor corregidas, aislamiento demo/real comprobado; necesita ofertas reales para validar precios comerciales |
| Registro/login/recuperación | Integración implementada y protección de perfiles corregida; falta recorrido con correo controlado y configuración Firebase real |
| Cotizaciones y optimización | Regresiones aprobadas, sucursales por ID; máximo dos cotizaciones guardadas |
| Historial | Cotizaciones guardadas con precios recalculados; no conserva un presupuesto original inmutable |
| PDF/compartir | Implementado y con pruebas básicas; PDF largo y entrega nativa Android/iOS pendientes |
| Ubicación/cercanía | Implementada; faltan permisos en dispositivos y coordenadas comerciales reales |
| Catálogo ferretería/CSV | Coincidencias y opciones corregidas; falta recuperación/progreso ante límites de importación masiva |
| Solicitudes de productos | Aprobación transaccional con incorporación de oferta y protección frente a duplicados |
| Administración/moderación | Reposición corregida; administrador compartido con selector Demo |
| Métricas ferretería | Vistas/selecciones agregadas; no representan ventas ni visitas únicas y admiten repetición de eventos |
| Privacidad/denuncias | Correcciones de identidad y autenticación reciente comprobadas localmente; pendientes configuración externa y recorrido real |
| Contacto/soporte | Guarda solicitudes para gestión administrativa; sin envío automático de email observado; WhatsApp deshabilitado |
| Pagos, checkout, ERP y chat | Fuera del alcance del MVP; su ausencia no se considera bug |

## SEO

La auditoría inicial de producción comprobó títulos, canonical y H1 de nueve rutas estáticas; `robots.txt`, sitemap de nueve URLs, fichas demo noindex, páginas privadas con cabecera noindex y respuestas 404 para rutas/productos inexistentes. Es evidencia histórica, anterior a esta entrega.

Correcciones locales aplicadas:

- `/auth` redirige a login; `/producto?product=...` redirige a la ficha conservando parámetros y, sin producto, al buscador. Las rutas antiguas tienen protección noindex.
- Las vistas previas de producto usan su imagen, en lugar de la imagen genérica de inicio.
- La selección demo incorpora protección noindex y el catálogo real se mantiene separado.

Pendientes:

1. Alinear HTML inicial y metadatos de login, registro y rutas privadas; la protección noindex no sustituye esa coherencia.
2. Unificar la amplitud de schema/metadatos entre Functions y frontend. Product/AggregateOffer requiere validación con ofertas reales.
3. Definir si los maestros reales sin ofertas deben indexarse: hoy el sitemap deriva productos de ofertas, mientras una ficha sin ofertas puede ser indexable.
4. Incorporar un identificador estable y redirecciones históricas para slugs. Los nombres pueden colisionar o cambiar la URL al renombrarse.
5. Verificar Search Console, cobertura y resultados reales después del despliegue. No se han medido posiciones, backlinks ni Core Web Vitals de usuarios reales.

## Rendimiento y accesibilidad

**La siguiente medición corresponde exclusivamente a la auditoría inicial de producción. No se ha repetido Lighthouse tras las correcciones.** Lighthouse 12.8.2, móvil simulado, inicio, 4 de octubre de 2026:

| Categoría | Puntaje histórico |
|---|---:|
| Rendimiento | 60/100 |
| Accesibilidad | 91/100 |
| Buenas prácticas | 100/100 |
| SEO básico automático | 100/100 |

FCP 1,9 s; LCP 5,5 s; bloqueo total 490 ms; CLS 0,046; tiempo interactivo 8,6 s. Una medición de laboratorio no representa un percentil de usuarios reales.

Quedan pendientes imagen principal adaptada a móvil, fuentes, trabajo de JavaScript al inicio, compresión de API, optimización de los consumidores que aún usan snapshots completos y reducción del CSS de los paneles. No se atribuye una mejora de puntuación a las correcciones sin volver a medir.

Se corrigieron el nombre accesible del botón de búsqueda móvil y el contraste del bloque de beneficios. Sigue pendiente comprobar/corregir el contraste de “Solicitar acceso” y revisar teclado/lector de pantalla en paneles privados. La ausencia de desbordamientos en la muestra no certifica accesibilidad completa.

## Deuda técnica y operación pendientes

| Prioridad | Pendiente | Acción requerida |
|---|---|---|
| Antes de apertura | Despliegue de esta entrega | Publicar frontend, Functions, Hosting y nuevos triggers de caché conjuntamente, con `DEMO=false` para negocio real |
| Antes de apertura | Identidad legal y canales | Completar operador, RUT, domicilio y representante; retirar textos provisionales y verificar buzones atendidos |
| Antes de apertura | Recorrido Firebase real | Probar roles, verificación de correo, recuperación, autenticación reciente, aislamiento y eliminación con cuentas controladas |
| Antes de apertura | Reglas y permisos | Confirmar reglas Firestore desplegadas e IAM; el archivo local niega acceso directo y el despliegue estándar no publica reglas/indexes automáticamente |
| Antes de apertura | MFA administrativo | Verificar `REQUIRE_ADMIN_MFA` y flujo de enrolamiento/desafío antes de exigirlo; no se comprobó la configuración desplegada |
| Antes de apertura | Respaldos y seguimiento | Verificar restauración, alertas, presupuesto, retención y gestión manual de solicitudes; la documentación no acredita ejecución |
| P2 | Importaciones masivas | Controlar ritmo y recuperación ante 429; probar lotes de 100/500 filas con progreso |
| P2 | Escalabilidad de consultas | Optimizar la materialización/lectura del snapshot público en servidor y los listados restantes; evitar consultas de ferreterías por cada perfil. La búsqueda ya pagina hacia el navegador, pero sigue agregando sobre el snapshot en servidor |
| P2 | Rate limit y métricas | El límite es por instancia en memoria; evaluar control distribuido y protección de eventos repetidos según volumen |
| P2 | Rendimiento, accesibilidad y SEO | Resolver los pendientes detallados y volver a medir el servicio desplegado |
| P3 | Documentación general | Actualizar README Angular 17 frente a Angular 21, promesa de cotizaciones ilimitadas frente al límite de dos y referencias antiguas a MockApiService/Karma |

## Orden recomendado

1. Preparar configuración real, identidad legal, canales, permisos y respaldo; desplegar conjuntamente las piezas de esta entrega.
2. Verificar con cuentas controladas el flujo completo de maestro, administrador y dos ferreterías: contratos, activación, carga, modificación, búsqueda, cotización, PDF y privacidad.
3. Comprobar en el entorno desplegado que real inicia vacío, demo conserva sus datos y el administrador alterna sin filtraciones entre entornos.
4. Incorporar ofertas reales autorizadas y contrastar precios/stock antes de abrir comercialmente.
5. Medir nuevamente rendimiento/accesibilidad, comprobar SEO/indexación y priorizar importación masiva y escalabilidad según el volumen esperado.

## Alcance y evidencia

Este documento consolida la auditoría inicial y las validaciones posteriores; su actualización no ejecuta una nueva auditoría de producción. Las pruebas locales cubren los comportamientos señalados y regresiones existentes, sin garantizar todos los flujos, la configuración externa ni carga comercial real.

No se han desplegado estas correcciones ni creado cuentas, aceptado contratos, enviado formularios o alterado datos de negocio en producción. No se verificaron en consola correos, MFA, IAM, respaldos, facturación o retención. Sin ofertas reales no se contrastaron comercialmente precios/stock ni ahorro.

Comandos de validación utilizados: `npm test -- --watch=false`, `npm --prefix functions test`, `npm run build`, `npm --prefix functions run build` y `npx tsc --noEmit -p tsconfig.app.json`.

Evidencias temporales locales:

- Auditoría inicial y Lighthouse histórico: `/tmp/cotizapp-audit/`.
- Últimas pruebas y build: `/tmp/cotizapp-three-findings-frontend.log`, `/tmp/cotizapp-three-findings-backend.log` y `/tmp/cotizapp-three-findings-build.log`.
- Navegador, regresiones y alternancia demo/real: `/tmp/cotizapp-fixes-browser.json`, `/tmp/cotizapp-data-mode-browser.json` y `/tmp/cotizapp-three-findings-browser.json`.

Los archivos de `/tmp` son evidencia temporal y no forman parte del repositorio.
