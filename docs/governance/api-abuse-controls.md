# Controles de CORS y abuso de API

Versión 1.0 · 3 de octubre de 2026

## CORS

La API acepta navegadores únicamente desde los dominios Firebase oficiales y los orígenes locales de desarrollo. Cada dominio personalizado debe agregarse explícitamente mediante la variable de entorno `ALLOWED_ORIGINS`, separando varios valores con coma. No se debe usar `*` ni reflejar automáticamente el encabezado `Origin`.

Las solicitudes sin `Origin` se admiten para rewrites del mismo sitio, health checks y clientes servidor-servidor. CORS no reemplaza autenticación ni autorización.

## Límites implementados

- Lecturas generales: 180 solicitudes por minuto y origen de red.
- Escrituras autenticadas generales: 60 por minuto.
- Operaciones de cuenta y privacidad: 20 cada 15 minutos.
- Contacto, denuncias, reclamos de precio y desuscripción: 10 cada 15 minutos.
- Consulta privada de denuncias de propiedad intelectual: 30 cada 15 minutos.
- Cuerpo JSON máximo: 256 KB, además de límites de longitud por campo y honeypots en formularios públicos.

El limitador de aplicación opera por instancia y la función tiene un máximo acotado de instancias. Antes de una campaña o exposición masiva debe complementarse con cuotas de Google Cloud, alertas, Firebase App Check cuando sea compatible y un control distribuido o Cloud Armor si la arquitectura de despliegue lo permite.

## Revisión

Revisar mensualmente respuestas 429, errores 403 de origen, volumen por endpoint y falsos positivos. Un aumento de límites requiere justificación y evidencia en la bitácora de gobierno de datos.
