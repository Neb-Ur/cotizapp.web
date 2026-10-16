# Revisión del catálogo de locales y desarmadurías — 15 de octubre de 2026

El panel compartido de locales permite administrar las ofertas de una desarmaduría sobre los productos maestros existentes. Se verificaron los flujos de alta, lectura, edición y eliminación; se corrigieron tres errores del panel.

## Comprobaciones

| Operación | Evidencia automatizada |
| --- | --- |
| Agregar producto del maestro | Formulario real y servicio de datos; POST del servidor sobre PostgreSQL aislado. |
| Consultar catálogo propio | GET del servidor; conserva nombre, fotografía y compatibilidad del maestro. |
| Editar | Precio, stock cero, condición física y condiciones comerciales persistidas en SQL. |
| Ocultar / republicar | La oferta oculta desaparece de las filas públicas; al republicar vuelve con su precio actualizado. |
| Eliminar | Elimina únicamente la oferta del local, conserva historial y permite agregar nuevamente el maestro. |
| Permisos | Otro propietario no puede consultar, modificar ni eliminar el catálogo del local. |
| Duplicados | Un segundo vínculo del mismo maestro y local devuelve conflicto. |
| Repuesto automotriz | Radiador Mahindra KUV100 2016–2019, condición usada y rango del maestro conservados tras editar. |

El recorrido del formulario usa los componentes reales del panel, onboarding, modales y servicio de datos, con la frontera HTTP simulada. Las rutas del servidor se ejecutan con el adaptador SQL real sobre PGlite; no se alteraron registros de producción para realizar estas pruebas. Estas comprobaciones no equivalen a iniciar sesión con una cuenta de propietario en producción.

La suite existente cubre además importación de Excel/CSV, resolución administrativa de solicitudes de productos nuevos y asociaciones vehiculares. La nueva prueba integrada se concentra en el alta individual, edición y eliminación.

## Errores corregidos

1. Las respuestas de búsquedas anteriores podían reemplazar los resultados de una consulta más reciente. Ahora solo se acepta la respuesta de la búsqueda vigente y se limpia la paginación si falla.
2. La confirmación de eliminación permitía repetir la petición o cerrar el diálogo mientras seguía pendiente. Ahora bloquea la repetición y el cierre, muestra el estado de eliminación y presenta el error dentro del diálogo para reintentar.
3. La edición admitía una cantidad de medida negativa o no finita. Ahora exige una cantidad positiva cuando se informa este dato.

## Alcance actual del catálogo de una desarmaduría

- El propietario administra precio, stock, condición, vigencia, condiciones de oferta y publicación.
- Nombre, fotos, ficha técnica y compatibilidad de años pertenecen al producto maestro y se administran desde el panel administrativo. Si la pieza no existe, el local envía una solicitud para revisión.
- Eliminar una oferta no elimina la ficha maestra ni las ofertas de otros locales.
- Existe una oferta por combinación local/producto maestro. Todavía no se pueden mantener dos publicaciones independientes del mismo maestro en el mismo local, por ejemplo una pieza nueva y otra usada con fotos y precios distintos.
- Las declaraciones vehiculares adicionales del vendedor siguen sujetas a la habilitación gradual existente. Las variantes automotrices con compatibilidad en el maestro conservan ese rango; no necesitan activar esa edición adicional.

## Validación de la revisión

- 265 pruebas de frontend aprobadas, incluido el recorrido completo del formulario y tres regresiones reproducidas antes de aplicar las correcciones.
- 205 pruebas de backend aprobadas, incluida la nueva prueba de rutas CRUD con PostgreSQL aislado para ferretería y desarmaduría.
- Compilación de producción aprobada. Persisten las advertencias previas de presupuestos CSS y del entorno de pruebas.
