# Datos demo y reales

La variable del backend `DEMO` acepta exclusivamente `true` o `false`. El valor predeterminado es **false** y la configuración local queda en **false**, preparada para empezar con negocio real vacío. Configura el valor en `functions/.env` antes de desplegar Functions; [functions/.env.example](../functions/.env.example) contiene el ejemplo. Cambiar la variable en producción requiere desplegar de nuevo Functions.

```dotenv
DEMO=false
```

- `DEMO=true`: las visitas y las cuentas de negocio usan los datos demo históricos.
- `DEMO=false`: las visitas y las cuentas de negocio usan datos reales. Al iniciar, no se copian maestros, ferreterías, ofertas ni cotizaciones demo a este entorno.
- El administrador es una misma cuenta en ambos entornos. En su panel, el botón **Demo** activado muestra demo; desactivado muestra real. La preferencia es por administrador y navegador. Cambiarla recarga la aplicación y descarta listas y solicitudes del entorno anterior. No cambia el entorno de otros usuarios ni la variable del servidor.

## Qué se comparte

Categorías, subcategorías, familias, definiciones de atributos, productos del catálogo maestro y sus atributos. Las ciudades y comunas existentes siguen siendo catálogos comunes. Las modificaciones administrativas al catálogo central afectan a ambos entornos.

El catálogo de productos es una referencia común, no una lista de ofertas reales. En la vista real, las fichas del seed histórico se presentan como plantillas genéricas: se sustituyen las marcas simuladas y la descripción de pruebas, conservando IDs, categorías e imágenes referenciales. No se generan precios, stock ni ferreterías reales. Las fichas editadas posteriormente con contenido real conservan sus datos.

Firebase Auth y los perfiles de `usuarios` se mantienen en la misma base. Los perfiles de maestros y ferreterías tienen `dataMode: demo|real`; los perfiles históricos sin ese campo pertenecen a demo. Se filtran las listas y se rechaza el acceso autenticado al entorno contrario. Los administradores se reconocen por su rol verificado y son compartidos. Las cuentas Firebase deshabilitadas continúan deshabilitadas: este cambio no reactiva credenciales.

## Qué se separa

Ferreterías, ofertas, proyectos/cotizaciones, solicitudes de productos, contratos, historial de precios, contactos, consentimientos/evidencias, reclamos, solicitudes de privacidad, registros operativos, métricas y caché público.

| Datos | Demo histórico | Real |
|---|---|---|
| Ferreterías | `ferreterias` | `real_ferreterias` |
| Ofertas | `productosFerreteria` | `real_productosFerreteria` |
| Cotizaciones | `proyectos` | `real_proyectos` |
| Caché público | `cachePublico` | `real_cachePublico` |
| Otros registros de negocio | Nombre existente | Nombre con prefijo `real_` |

No se borran ni migran registros históricos. Las colecciones reales se crean al registrar datos reales. Solo el administrador puede enviar `X-Data-Mode: demo|real`; el servidor verifica token, revocación, rol, estado y MFA cuando corresponde. La selección se mantiene por solicitud, incluso ante solicitudes concurrentes. Las respuestas a selecciones administrativas no se almacenan en cachés públicos. Las cachés de servidor, navegador y los borradores están separados por entorno.

Demo muestra un aviso visible y sus fichas/API tienen protección noindex. Las ofertas demo pueden mostrarse sin un contrato comercial real, manteniendo comprobaciones de actividad y stock. En real se conservan los requisitos de contrato, activación y vigencia: una oferta demo nunca satisface esos requisitos en real.

## Validación y despliegue

Validación aprobada: **55 pruebas frontend y 43 backend**, compilación de producción con nueve rutas prerenderizadas y contratos de API existentes. Persisten las tres advertencias previas de presupuesto CSS. Incluye aislamiento de lectura/escritura, registros nuevos, autenticación, administrador compartido, caché y solicitudes concurrentes. Prueba en Chrome con datos simulados: entorno público real vacío, demo con ofertas, acceso del mismo administrador y botón Demo en ambos sentidos sin pérdida de sesión.

Desplegar frontend, Functions y los triggers de caché nuevos conjuntamente. No se ha desplegado esta entrega ni se han escrito datos de negocio en producción. La variable solo decide qué datos usar; no ejecuta el seed ni crea usuarios demo automáticamente. El script de seed conserva sus controles explícitos de proyecto y escribe perfiles de negocio con `dataMode: demo`.
