# Clasificación comercial de productos — 16 de octubre de 2026

Cada maestro guarda `ambitoComercial` con tres valores: `ferreteria`, `desarmaduria` o `ambos`. El admin puede elegirlo al crear o editar su ficha. Es independiente de la categoría del producto: una herramienta compartida puede pertenecer a una categoría de herramientas y estar habilitada para los dos rubros. Las tiendas de repuestos utilizan el ámbito de desarmaduría.

## Aplicación

- El selector privado usa `GET /ferreterias/:storeId/productos-disponibles`, con autenticación y comprobación del propietario. El servidor obtiene el tipo del local desde la base de datos y filtra antes de calcular paginación y totales. Ignora el rubro enviado por el navegador.
- Los filtros de categorías proceden de los productos elegibles, incluyendo las categorías con productos compartidos. Cada fila identifica su clasificación.
- El catálogo propio excluye las ofertas de otro ámbito. Los registros antiguos permanecen conservados y accesibles para revisión administrativa.
- El alta directa de ofertas, sus actualizaciones por el propietario, las solicitudes aprobadas y la importación CSV respetan la clasificación del maestro. El propietario no puede asignarla mediante el cuerpo de una oferta.
- Las ofertas públicas también respetan la relación entre producto y local. La caché pública cambia de política para retirar resultados anteriores.
- Una sesión de local sin `ferreteriaId` falla explícitamente; no se sustituye por una búsqueda de todo el catálogo.

## Persistencia y datos existentes

El campo se registra en el contrato de persistencia y se guarda en `products.api_payload`. El adaptador SQL valida los tres valores, conserva el campo en actualizaciones posteriores y asigna un valor compatible a maestros antiguos o creados por scripts sin el campo. No se requiere una tabla nueva.

`functions/scripts/classify-product-business-scope.mjs` permite revisar el plan y aplicar únicamente campos todavía ausentes, con respaldo privado previo y una transacción. No sobrescribe clasificaciones editadas por el admin y comprueba que categoría y familia no hayan cambiado durante la preparación. Invalida las cachés estática y de ofertas.

La carga inicial clasificó 1.130 fichas: 920 de ferretería, 174 de desarmaduría y 36 compartidas. Los repuestos automotrices se clasificaron como desarmaduría; las familias de llaves/alicates/destornilladores y organización de herramientas como ambos; el resto como ferretería. No se borraron productos, ofertas ni fotos.

## Validación

282 pruebas de frontend y 223 de backend aprobadas, más compilación de producción. Cubren el ámbito compartido, independencia de categoría, restricciones por propietario, sesiones incompletas, clasificación inválida, imposibilidad de falsificarla desde una oferta y persistencia SQL durante otras ediciones.
