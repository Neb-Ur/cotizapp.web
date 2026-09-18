# CotizApp

CotizApp es un comparador y optimizador de compras de materiales para construcción. El MVP permite a maestros y contratistas buscar productos, comparar precios entre ferreterías, armar una cotización y calcular cuánto pueden ahorrar comprando cada material en la alternativa más conveniente.

## Arquitectura MVP

El proyecto ya no depende de un backend Spring Boot ni de un servidor Node persistente.

- Angular 17: interfaz web.
- Firebase Authentication: registro, login, sesión y recuperación de contraseña.
- Cloud Firestore: usuarios, ferreterías, catálogo maestro, ofertas y cotizaciones.
- Cloud Functions for Firebase (2nd gen): única capa de API y lógica protegida.
- Firebase Hosting: frontend y rewrite de `/api/**` hacia la Function `api`.

El navegador no accede directamente a Firestore. Las reglas incluidas niegan lecturas y escrituras de cliente; toda operación de negocio pasa por Cloud Functions.

## Modelo comercial del MVP

El MVP no incluye suscripciones, Webpay ni pagos automáticos.

- Los maestros usan el comparador, las cotizaciones, el historial y el optimizador sin límites por plan.
- Las ferreterías pueden registrarse y preparar su catálogo.
- Una ferretería nueva queda con estado `pendiente`.
- El pago/acuerdo comercial se coordina manualmente fuera de CotizApp, por ejemplo mediante transferencia y comprobante.
- Administración cambia la cuenta a `activo` cuando corresponde.
- Solo las ferreterías con cuenta `activo` participan en el comparador y sus precios pueden ser usados por el optimizador.
- Una cuenta bloqueada o pendiente puede conservar sus datos y catálogo, pero no aparece en resultados públicos.

No existen planes Básico, Pro o Premium en la experiencia del MVP.

## Desarrollo

Instala dependencias del frontend y de Functions:

```bash
npm install
npm --prefix functions install
```

Para Angular:

```bash
npm start
```

Cuando Angular se ejecuta fuera de Firebase Hosting, puedes definir `window.__FIREBASE_CONFIG__` antes del bootstrap o usar Hosting Emulator. En Firebase Hosting la aplicación obtiene automáticamente la configuración web desde `/__/firebase/init.json`.

Para compilar Functions:

```bash
npm run functions:build
```

Para emuladores:

```bash
npm run functions:serve
```

## Deploy

```bash
npm run deploy
```

Firebase Hosting reescribe `/api/**` hacia la Function HTTP `api` desplegada en `southamerica-west1`.

## Colecciones Firestore

El MVP usa principalmente:

- `usuarios`
- `ferreterias`
- `categorias`
- `subcategorias`
- `familias`
- `definicionesAtributoFamilia`
- `productosMaestro`
- `atributosProductoMaestro`
- `productosFerreteria`
- `proyectos`
- `solicitudesCreacionProducto`

## Flujo de catalogo de ferreterias

Para reducir friccion operativa, el flujo principal del MVP es:

1. CotizApp realiza la carga inicial del catalogo por la ferreteria desde Admin.
2. La ferreteria entra a **Mantener catalogo** y actualiza principalmente precio y stock.
3. Para cambios masivos puede subir un archivo Excel (`.xlsx`, `.xls`) o CSV.
4. La importacion intenta primero reconocer productos ya cargados por SKU, codigo de barras o nombre y actualiza precio/stock.
5. Si un producto aun no esta en la tienda, intenta vincularlo al catalogo maestro.
6. Si no existe en el catalogo maestro, queda como solicitud de revision.
7. La ferreteria tambien puede agregar productos individualmente desde el catalogo maestro.

El formato recomendado para archivos es:

```csv
nombre,sku,precio,stock,codigo_barras
Cemento Melon 25kg,CEM-25,5490,80,7800000000000
```

El importador acepta encabezados equivalentes comunes (por ejemplo `producto`, `codigo`, `precio venta`, `existencia` o `EAN`).

## Alcance final del MVP

### Maestro

- Registro, login y recuperacion de clave.
- Busqueda por nombre, categoria, subcategoria y familia.
- Comparacion de precio y stock entre ferreterias activas.
- Creacion, edicion, guardado e historial simple de cotizaciones.
- Optimizacion por menor precio combinado.
- Comparacion contra comprar todo en una sola ferreteria.
- Calculo de ahorro.
- Exportacion PDF.
- Perfil minimo.

### Ferreteria

- Registro y activacion manual por administracion.
- Mantencion de precio, stock y publicacion.
- Busqueda dentro del catalogo propio.
- Fecha de ultima actualizacion.
- Actualizacion masiva Excel/CSV.
- Incorporacion individual desde catalogo maestro.
- Solicitud de productos faltantes.
- Eliminacion de productos.
- Perfil basico.

### Administracion

- Gestion de ferreterias y estado de activacion.
- Carga inicial del catalogo por una ferreteria.
- Catalogo maestro.
- Taxonomia.
- Resolucion de solicitudes de productos.
- Gestion basica de usuarios.

### Fuera del MVP

No forman parte del MVP: planes, suscripciones, pagos automaticos, estados aceptada/rechazada de cotizacion, distancia/cercania, calculadora de cobertura, metricas avanzadas, CTR, analytics, rutas, chat, marketplace con pago e integraciones ERP.

## Objetivo del MVP

Validar que un maestro encuentra valor en tener precios comparables de materiales en un solo lugar y en saber donde gastar menos para una cotizacion completa, y que las ferreterias estan dispuestas a mantener precio y stock para participar en esa comparacion.
