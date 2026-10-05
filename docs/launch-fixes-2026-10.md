# Correcciones de lanzamiento

Los precios ingresados por las ferreterías son importes finales con IVA incluido. CotizApp no fija precios ni suma IVA. Cotización, comparación y PDF usan el mismo optimizador puro, compartido por frontend y API.

## Cambios

- Se guardan los identificadores de producto, oferta y ferretería elegidos. Una oferta desaparecida o una estrategia de tienda sin stock queda incompleta, sin sustitución silenciosa.
- Se acumulan las cantidades repetidas y se reserva stock por oferta antes de calcular totales. El historial declara incompletitud y los precios se actualizan al consultar.
- Búsqueda, fichas y sitemap usan el mismo constructor de catálogo. La caché se invalida por política/contrato, cambios y un máximo de un minuto. Un catálogo sin ofertas es válido. Las fichas maestras existen aunque no haya ofertas vigentes.
- HTML inicial de fichas con nombre, ofertas, canonical, Open Graph y JSON-LD; páginas inexistentes responden HTTP 404. Cuentas privadas no se indexan. Fragmentos del footer corregidos.
- Métricas agregadas de ofertas vistas y selección de tienda, sin identificadores de visitantes ni geolocalización. Panel para el propietario. No representan ventas ni visitas únicas.
- Estados de errores de red y productos inexistentes separados. Compartir cancelado no anuncia éxito. Exportación y compartir usan el mismo PDF.
- Límite de proyectos transaccional, agregados de ítems transaccionales, consulta por dueño y una sola lectura de ofertas para el listado.
- Angular/PrimeNG 21, SheetJS 0.20.3 oficial; Vitest sustituye Karma. Dependencias instaladas con lockfiles. Firebase CLI fijada y hosting usa el artefacto validado.
- Piloto identificado y datos legales ficticios retirados. FAQ deja de prometer planes inexistentes. El contrato exige precio final con IVA incluido.

## Verificación

41 pruebas frontend, 15 pruebas backend, build de producción y npm audit en ambos paquetes. El smoke de producción prueba catálogo → ficha API → HTML inicial, canonical/JSON-LD, 404 de producto/ruta desconocida y noindex de cuenta.

## Requisitos de operación que requieren datos reales

- Completar identidad del operador y canales de contacto verificados. Los datos provisionales no son una identidad legal real.
- Incorporar catálogos, precios, stock y coordenadas confirmados por ferreterías reales. Nunca se aceptan contratos en nombre de terceros ni se fabrican ofertas.
- Aceptar el contrato vigente: los cambios de identidad/cláusulas cambian su hash e invalidan las aceptaciones anteriores para publicación.
- Probar el recorrido autenticado completo con cuentas controladas de maestro y dos ferreterías; compartir nativo en Android/iOS y permisos de ubicación en dispositivos reales.
- Confirmar MFA administrativo, única cuenta administradora conservada, backups, alertas y presupuesto en Firebase. El límite general de solicitudes sigue siendo por instancia.
- Medir Core Web Vitals desde usuarios reales. Queda deuda de tamaño en los estilos de los paneles y búsqueda local sobre el catálogo completo: conviene pasar a consultas/paginación del servidor al crecer.

No se habilitan pagos ni se inventan condiciones comerciales. El lanzamiento comercial depende de los datos reales y del piloto acompañado.
