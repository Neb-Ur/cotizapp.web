# Cotizaciones sin cuenta

El visitante puede crear una cotización, seleccionar ofertas, agregar cantidades y consultar o editar su detalle sin autenticarse. Se elimina el recorrido de “Mi lista”.

- La ficha de producto vuelve a mostrar el selector y el botón de crear cotización. “Ver cotización” abre el detalle.
- `/cotizaciones` muestra las cotizaciones de este navegador; `/cotizaciones/nueva` permite crear una y `/cotizaciones/local/:projectId` abre su detalle. No permiten leer cotizaciones privadas de cuentas.
- Las cotizaciones del visitante se conservan en el almacenamiento local. No se sincronizan entre dispositivos y no constituyen una reserva de stock ni una confirmación de precios. Si no es posible guardar en el navegador, se informa.
- El detalle consulta el catálogo y las ofertas públicas para mostrar comparación, cantidades y totales. No requiere una cuenta para navegar, crear o editar.
- “Descargar PDF” conserva la cotización y lleva al inicio de sesión, con acceso al registro. El enlace para volver abre el detalle público de la cotización, sin pasar por una ruta protegida. El retorno usa la ruta protegida habitual del maestro con `cotizacionLocal` y `descargar=1`.
- Después de autenticar y cumplir los controles legales y de rol existentes, el editor recupera la cotización, consulta precios actuales, la guarda en la cuenta y continúa la descarga con sus precios registrados, vigencia y código oficial. La vigencia de 10 días comienza con esa creación en la cuenta.
- Un error de guardado, incluido el límite de cotizaciones, conserva la cotización local y evita la descarga. La cotización local se retira únicamente después del guardado exitoso en la cuenta.
- Descargar, compartir PDF y enviar por WhatsApp mantienen el requisito de una sesión de maestro. Los documentos se generan a partir de la cotización guardada.

La antigua ruta `/lista` redirige a `/cotizaciones` para evitar enlaces rotos.

Los despliegues mantienen un manifiesto de archivos con versiones anteriores para pestañas abiertas. Los errores de carga de una ruta permiten recuperar la versión actual una sola vez, conservando los datos del navegador. La portada y los documentos HTML se revalidan para recibir la versión vigente.
