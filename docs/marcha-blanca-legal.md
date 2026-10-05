# Marcha blanca: comparador y cotizaciones

Actualizado: 5 de octubre de 2026.

La web no confirma compras, acepta pedidos, reserva productos ni recibe pagos por ellos. Las ventas se concretan directamente con cada ferretería.

## Implementación inicial

- Responsable: Rubén Benavides, persona natural, según la elección del usuario. No se inventaron RUT, domicilio ni correos.
- Contacto público y privacidad: `/contacto`; las solicitudes quedan en el panel privado de administración. El operador debe revisarlas y responder al correo aportado, verificando identidad cuando corresponda. No hay envío automático de respuesta.
- Términos 1.1 y privacidad 1.2, con consentimiento específico y separado de publicidad. Los registros anteriores requieren nueva aceptación; no se convierten retroactivamente en consentimiento.
- Acuerdo de ferreterías 1.1: catálogo autorizado, precios con IVA, stock informado, seguridad y retiro. No autoriza cobros; un futuro cobro exige un acuerdo separado.
- Aclaración de cotización sin compra/pedido/reserva en pantalla y PDF. Se conserva la funcionalidad existente de exportación y datos personales.
- Reglas Firestore deniegan acceso directo. La API conserva roles y controles de propiedad sobre catálogos y cotizaciones.
- Solicitudes de datos: objetivo interno inicial de 2 días corridos. No se presenta un plazo general de 30 días ni una reclamación ante una agencia futura como disponible actualmente. La respuesta debe respetar la normativa vigente según la solicitud.

## Gestión que debe resolver el operador

1. Revisar el panel de contacto y solicitudes de datos; responder y registrar seguimiento. Revisar y retirar datos que dejaron de ser necesarios. Publicar un texto no sustituye esta operación.
2. Confirmar el nombre completo del responsable, su situación tributaria actual, fecha del comienzo del negocio y domicilio/comuna de operación con el contador. Con los antecedentes disponibles no se puede determinar ni tramitar inicio de actividades o patente municipal.
3. Consultar con la municipalidad del domicilio la patente aplicable a la actividad. No hay una exención general por ser una página web, por trabajar desde casa o por llamarla marcha blanca.
4. Si se cobra publicación/visibilidad, confirmar giro, documentos tributarios e IVA aplicable al servicio propio. Este IVA es distinto del IVA ya incluido en productos de las ferreterías. No emitir documentos ni presentar declaraciones sin esa clasificación y datos reales.

## Fuentes oficiales revisadas

- Reglamento de Comercio Electrónico, art. 3: https://www.bcn.cl/leychile/navegar?idNorma=1165504
- Ley 19.628 vigente, arts. 4, 6, 7, 9, 11, 12 y 16: https://www.bcn.cl/leychile/navegar?idNorma=141599
- Inicio de actividades y comienzo del negocio: https://www.sii.cl/destacados/educacion/ciclo_vida_contribuyente/paso_02.html
- Patente municipal, art. 23: https://www.bcn.cl/leychile/Navegar?idNorma=18967
- Servicios de publicidad: https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_5641.htm

Este documento no acredita inicio de actividades, patente ni cumplimiento tributario del operador. La adaptación al régimen que entra en vigencia el 1 de diciembre de 2026 debe revisarse antes de esa fecha.

## Validación técnica

- Frontend: 95 pruebas en 25 archivos, todas aprobadas.
- Backend: 68 pruebas, todas aprobadas; incluyen consentimiento vigente, rechazo de versiones obsoletas y acceso a registros ajenos.
- Compilación de producción Angular: aprobada; conserva avisos de tamaño de estilos de dashboards preexistentes.
- HTML prerenderizado de privacidad, términos y contacto: responsable presente y sin correos provisionales ni marcadores de identidad pendiente.
- Se centralizó la simulación de Firebase de las pruebas para evitar conflictos entre módulos compartidos de Angular. No cambia Firebase en producción.
- No se obtuvo una inspección visual en navegador: este entorno no tiene Chromium local instalado y el navegador disponible bloquea localhost. No se afirma una comprobación visual de las pantallas.
