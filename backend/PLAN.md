# Plan de Implementacion Backend

1. Modelos/entidades de BD en codigo
- Archivo: `src/models/entities.ts`
- Definidos todos los modelos del ERD en interfaces y tipos.

2. Script SQL para crear la BD (ejecutar despues)
- Archivo: `scripts/sql/001_init_schema.sql`
- Incluye tablas, llaves foraneas, checks e indices.

3. DTOs request/response reutilizables
- Carpeta: `src/contracts/`
- DTOs por dominio y DTO comun para respuestas/paginacion/errores.

4. Controladores y endpoints
- Carpeta: `src/routes/`
- Endpoints implementados por modulo (auth, admin, taxonomia, catalogos, solicitudes, busqueda, proyectos/cotizaciones, metricas, planes).

5. Bootstrap de API
- Archivo: `src/index.ts`
- Express + CORS + JSON + logger + router general.
