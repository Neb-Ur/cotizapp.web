# Endpoints Backend (`/api`)

## Auth
- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/me`
- `PATCH /auth/me`
- `POST /auth/logout`

## Admin
- `GET /admin/usuarios`
- `PATCH /admin/usuarios/:usuarioId`
- `GET /admin/metricas`

## Taxonomia
- `GET /categorias`
- `GET /subcategorias?categoriaId=`
- `GET /familias?subcategoriaId=`
- `GET /familias/:familiaId/atributos-definicion`
- `POST /familias/:familiaId/atributos-definicion`
- `PATCH /familias/:familiaId/atributos-definicion/:definicionId`

## Catalogo Maestro
- `GET /productos-maestro?query=&categoriaId=&subcategoriaId=&familiaId=`
- `GET /productos-maestro/:productoMaestroId`
- `POST /productos-maestro`
- `PATCH /productos-maestro/:productoMaestroId`
- `PUT /productos-maestro/:productoMaestroId/atributos`
- `GET /productos-maestro/:productoMaestroId/variantes`
- `POST /productos-maestro/:productoMaestroId/variantes`
- `PATCH /variantes-maestras/:varianteMaestraId`
- `PUT /variantes-maestras/:varianteMaestraId/atributos`

## Catalogo Ferreteria
- `GET /ferreterias/:ferreteriaId/catalogo`
- `POST /ferreterias/:ferreteriaId/catalogo`
- `PATCH /ferreterias/:ferreteriaId/catalogo/:productoFerreteriaId`
- `DELETE /ferreterias/:ferreteriaId/catalogo/:productoFerreteriaId`
- `GET /ferreterias/:ferreteriaId/catalogo/:productoFerreteriaId/variantes`
- `POST /ferreterias/:ferreteriaId/catalogo/:productoFerreteriaId/variantes`
- `PATCH /ferreterias/:ferreteriaId/catalogo/variantes/:varianteFerreteriaId`
- `DELETE /ferreterias/:ferreteriaId/catalogo/variantes/:varianteFerreteriaId`

## Solicitudes / Importacion
- `POST /ferreterias/:ferreteriaId/solicitudes-creacion-producto`
- `GET /solicitudes-validacion-catalogo?estado=&tipo=&ferreteriaId=`
- `POST /solicitudes-validacion-catalogo/:solicitudId/resolver`
- `POST /ferreterias/:ferreteriaId/importaciones-catalogo`
- `GET /importaciones-catalogo?ferreteriaId=`

## Busqueda / Detalle
- `GET /busqueda?query=&categoriaId=&subcategoriaId=&familiaId=&sort=`
- `GET /productos/opciones?categoriaId=&subcategoriaId=&familiaId=`
- `GET /familias/:familiaId/productos?search=`
- `GET /productos/populares?search=&limit=`
- `GET /productos/detalle?producto=`
- `GET /ofertas/mejor?producto=`

## Proyectos / Cotizaciones
- `GET /maestros/:maestroId/proyectos`
- `POST /maestros/:maestroId/proyectos`
- `GET /maestros/:maestroId/proyectos/:proyectoId`
- `PUT /maestros/:maestroId/proyectos/:proyectoId`
- `PATCH /maestros/:maestroId/proyectos/:proyectoId/estado`
- `DELETE /maestros/:maestroId/proyectos/:proyectoId`
- `POST /maestros/:maestroId/proyectos/:proyectoId/items`
- `POST /cotizaciones/build`
- `POST /cotizaciones/estrategias`
- `GET /maestros/:maestroId/cotizaciones-items`
- `POST /maestros/:maestroId/cotizaciones-items`

## Metricas / Planes
- `GET /maestros/:maestroId/resumen`
- `GET /ferreterias/:ferreteriaId/resumen`
- `GET /ferreterias/:ferreteriaId/metricas-mvp`
- `GET /ferreterias/:ferreteriaId/metricas`
- `GET /planes/maestro/:codigo/capacidades`
- `GET /planes/ferreteria/:codigo/capacidades`
- `GET /maestros/:maestroId/capacidad-cotizaciones?plan=`
- `GET /ferreterias/:ferreteriaId/capacidad-catalogo?plan=`

## Utilitario
- `GET /health`
