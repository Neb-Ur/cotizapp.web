# Organización del código

## Backend

`functions/src/routes/mvp.routes.ts` compone los routers por dominio en el orden original. Los montajes `/api` y `/` permanecen en `index.ts`; el catálogo público y sus triggers mantienen su caché existente.

- `routes/`: contratos HTTP, validación de entrada y middleware de autenticación/roles por endpoint.
- `services/`: composición del catálogo, optimización de cotizaciones y respuesta del perfil de usuario.
- `repositories/firestore.repository.ts`: lectura, creación, actualización y borrado por lotes de documentos.
- `lib/ownership.ts`: reglas de propiedad de cotizaciones y ferreterías.
- `lib/values.ts`: normalización y cálculos geográficos.
- `lib/collections.ts` y `models/domain.models.ts`: nombres de colecciones y tipos del dominio.

Agregar una ruta al router de su dominio. Las reglas de propiedad y roles siguen siendo obligatorias en cada endpoint protegido. No introducir dependencias desde servicios o repositorios hacia routers.

## Frontend

`ApiClientService` centraliza la URL base, el token Bearer, los parámetros HTTP y la extracción de `data` de las respuestas. `MockApiService` conserva su interfaz pública, cachés y coordinación de flujos para evitar cambios en los componentes consumidores. El nombre histórico se conserva por compatibilidad.

`AuthService` espera la restauración inicial de Firebase antes de resolver los guards y valida el perfil usando un token vigente. Los fallos temporales de red conservan la persistencia y se reintentan; las credenciales rechazadas no habilitan acceso. Firebase conserva la sesión al recargar, con almacenamiento local si se elige «Recordarme» o de sesión si no se elige. Véase la [persistencia de Firebase Auth](https://firebase.google.com/docs/auth/web/auth-state-persistence).

La sesión de la aplicación expira después de 30 minutos sin interacción. Clics, movimiento del puntero, teclado, desplazamiento y toque renuevan el plazo; la última actividad se comparte entre pestañas del mismo usuario. Recargar, enfocar una pestaña o renovar un token no renueva el plazo. La expiración y «Cerrar sesión» borran inmediatamente la sesión local y los borradores privados y ejecutan `signOut`. La expiración dirige al login con una explicación. Este control de inactividad funciona en el cliente; la API mantiene sus propias comprobaciones de token, perfil y permisos.

## Verificación

- `npm --prefix functions test`: compila Functions y comprueba el inventario anterior de rutas (método, ruta, orden y middleware), proximidad y normalización de ítems.
- `npm test -- --watch=false --browsers=ChromeHeadless`: pruebas Angular, incluido el transporte HTTP.
- `npm run build`: build de producción Angular con SSR.

El pipeline ejecuta las pruebas del backend antes de desplegar. Los tests de contratos no acceden a Firestore y no reemplazan una prueba funcional con datos reales.
