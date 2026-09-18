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

## Objetivo del MVP

Validar que un maestro encuentra valor en tener los precios de materiales en un solo lugar y en saber dónde gastar menos para una cotización completa.
