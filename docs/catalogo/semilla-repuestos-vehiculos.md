# Semilla automotriz de prueba — 13 de octubre de 2026

Se utilizan las seis marcas y los trece modelos del [catálogo inicial de vehículos](catalogo-vehiculos-inicial.md), junto con los cuatro maestros de repuestos existentes. Se crean dos usuarios SQL de prueba, dos locales ficticios, ocho ofertas y veinticuatro asociaciones de marca/modelo/años. No se crean cuentas de Firebase Authentication ni se inventan contratos firmados.

- Trovio Repuestos (Prueba): tipo `repuestos`, cuatro ofertas.
- Trovio Desarmaduría (Prueba): tipo `desarmaduria`, cuatro ofertas.
- Productos: alternador, amortiguador, filtro de aceite y pastillas de freno.
- Lote: `trovio-auto-seed-2026-10-13`.

Los usuarios, locales y ofertas llevan `esPrueba=true` y `lotePrueba`. Los nombres de locales incluyen «(Prueba)»; las condiciones de cada oferta indican que precios, stock y asociaciones son simulados, no acreditan compatibilidad real y no representan una venta o retiro disponible. Las imágenes de los maestros conservan su aviso de referencia. No se atribuyen estas simulaciones a un vendedor real.

## Un mismo producto y modelo con distintos años

Una oferta puede contener varios intervalos separados para el mismo modelo, sin duplicar el maestro ni la publicación. El alternador de la tienda de repuestos tiene filas Corolla 2008–2012 y 2015–2019. El alternador de la desarmaduría tiene Corolla 2010–2012 y 2015–2016. Los intervalos incluyen sus extremos; un año en el hueco entre intervalos no coincide. No se fusionan en un rango continuo.

| Vehículo seleccionado | Resultado del alternador de prueba |
| --- | --- |
| Toyota Corolla 2010 | Dos locales; desde $55.000 hasta $125.000 |
| Toyota Corolla 2013 | Sin coincidencia |
| Toyota Corolla 2018 | Solo tienda de repuestos; $125.000 |
| Toyota Corolla 2018 + desarmaduría | Sin coincidencia |

Son valores y asociaciones de prueba. Los rangos no describen compatibilidad técnica ni años oficiales de una generación de vehículo. El manifiesto contiene todas las combinaciones para trece modelos y los otros productos.

## Carga y verificación

Manifiesto: `semilla-repuestos-vehiculos.json`. Importador: `functions/scripts/seed-auto-parts.mjs`.

```sh
node functions/scripts/seed-auto-parts.mjs --firebase-cli-auth
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/seed-auto-parts.mjs --firebase-cli-auth --apply
```

La primera instrucción solo prepara y valida. La aplicación exige el ID del proyecto, comprueba maestros/familias y marcas/modelos existentes, conserva un recibo privado y crea los registros ausentes en una transacción. Rechaza colisiones de identidad, modelos desconocidos, intervalos solapados y ofertas duplicadas para un mismo maestro/local. Una segunda ejecución no modifica precios, stock o asociaciones editados posteriormente.

Las relaciones se guardan en `findi.offer_vehicle_applications`; no se modifica el esquema. No se habilitan globalmente escrituras de asociaciones: la semilla se carga por la herramienta de datos y conserva la configuración del piloto. Tampoco se habilitan publicaciones múltiples de piezas para el mismo maestro/local ni se completa el punto 6A de cotizaciones.

Validación: 25 pruebas de semilla y PostgreSQL aprobadas, con persistencia de las 24 filas, conservación del maestro anterior, repetición sin nuevas escrituras y filtrado de precios por modelo/año/local. Comprobaciones públicas de rangos, huecos, localidades y continuidad al abrir el detalle. El catálogo mantiene 860 maestros y aumenta de 3.424 a 3.432 ofertas activas simuladas. Los locales semilla no tienen coordenadas; para verlos en el buscador debe estar desactivado «Cerca de mí».
