# DDL de referencia de Findi

Diseño para PostgreSQL 17+. Los archivos 001–004 describen el modelo y sus validaciones. La implementación del servidor añade los archivos 005–007 y herramientas de migración; ver [activación y operación](../../docs/base-de-datos/activacion-postgresql.md).

1. `001-schema.sql`: modelo relacional e integridad.
2. `002-public-views.sql`: proyecciones públicas explícitas.
3. `003-security.sql`: roles/RLS mínimos de referencia; completar funciones/grants por endpoint antes de conectar una aplicación.
4. `004-validation.sql`: casos sintéticos de integridad/permisos dentro de una transacción con ROLLBACK.

5. `005-runtime-compatibility.sql`: compatibilidad de DTOs, control de migración y rol privado del backend. Aplicado por `bootstrap-sql`, después de 001–003; 004 solo se usa en pruebas.

6. `006-sql-connect-inspection.sql`: vistas y permisos limitados para inspección administrativa mediante SQL Connect.
7. `007-complete-console-inspection.sql`: una vista de lectura por cada una de las 52 tablas físicas, incluidas las tablas operativas y de migración.

Ejecutar las validaciones solo en una **base vacía de prueba**, con `psql -v ON_ERROR_STOP=1`, en ese orden. No ejecutar con credenciales de producción.

Modelo, correspondencias y migración: [documentación](../../docs/base-de-datos/diseno-relacional-findi.md).

Diagrama de todas las tablas y columnas: [vista Markdown por áreas](../../docs/base-de-datos/diagrama-completo.md) y [archivo Mermaid independiente](../../docs/base-de-datos/diagrama-completo.mmd).

Las pruebas del backend incluyen PGlite como dependencia de desarrollo. La copia real se concilia con Cloud SQL y el script `verify-sql-runtime.mjs` comprueba el rol del servidor, las restricciones y las consultas de la API en PostgreSQL.
