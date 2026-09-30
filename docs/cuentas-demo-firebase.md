# Cuentas demo de Firebase

Estas cuentas son datos ficticios para probar CotizApp en el proyecto Firebase `cotizapp-d71c8`. El seed crea o actualiza Firebase Authentication, marca los correos como verificados y guarda los perfiles relacionados en Firestore.

> No usar estas credenciales con información real. Antes de una salida comercial se deben eliminar las cuentas demo o cambiar todas sus contraseñas.

## Accesos generales

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@demo.cl` | `123456` |
| Maestro | `maestro@demo.cl` | `123456` |

## Ferreterías

| # | Ferretería | Comuna | Correo | Contraseña |
| ---: | --- | --- | --- | --- |
| 1 | Ferretería Demo Santiago Centro | Santiago | `ferreteria01@demo.cl` | `123456` |
| 2 | Ferretería Demo Maipú | Maipú | `ferreteria02@demo.cl` | `123456` |
| 3 | Ferretería Demo La Florida | La Florida | `ferreteria03@demo.cl` | `123456` |
| 4 | Ferretería Demo Ñuñoa | Ñuñoa | `ferreteria04@demo.cl` | `123456` |
| 5 | Ferretería Demo Providencia | Providencia | `ferreteria05@demo.cl` | `123456` |
| 6 | Ferretería Demo Las Condes | Las Condes | `ferreteria06@demo.cl` | `123456` |
| 7 | Ferretería Demo Peñalolén | Peñalolén | `ferreteria07@demo.cl` | `123456` |
| 8 | Ferretería Demo Puente Alto | Puente Alto | `ferreteria08@demo.cl` | `123456` |
| 9 | Ferretería Demo San Miguel | San Miguel | `ferreteria09@demo.cl` | `123456` |
| 10 | Ferretería Demo La Cisterna | La Cisterna | `ferreteria10@demo.cl` | `123456` |
| 11 | Ferretería Demo Quilicura | Quilicura | `ferreteria11@demo.cl` | `123456` |
| 12 | Ferretería Demo Huechuraba | Huechuraba | `ferreteria12@demo.cl` | `123456` |
| 13 | Ferretería Demo Recoleta | Recoleta | `ferreteria13@demo.cl` | `123456` |
| 14 | Ferretería Demo Independencia | Independencia | `ferreteria14@demo.cl` | `123456` |
| 15 | Ferretería Demo Pudahuel | Pudahuel | `ferreteria15@demo.cl` | `123456` |
| 16 | Ferretería Demo Cerrillos | Cerrillos | `ferreteria16@demo.cl` | `123456` |
| 17 | Ferretería Demo Estación Central | Estación Central | `ferreteria17@demo.cl` | `123456` |
| 18 | Ferretería Demo Macul | Macul | `ferreteria18@demo.cl` | `123456` |
| 19 | Ferretería Demo La Reina | La Reina | `ferreteria19@demo.cl` | `123456` |
| 20 | Ferretería Demo San Bernardo | San Bernardo | `ferreteria20@demo.cl` | `123456` |

## Datos creados

- 22 usuarios de Firebase Authentication: 20 ferreterías, 1 administrador y 1 maestro.
- 20 perfiles de ferretería vinculados por UID a Firebase Authentication.
- 60 productos maestros distribuidos en 6 categorías.
- 1.200 publicaciones de producto, con precio, stock y SKU distintos por ferretería.
- Perfiles de usuario, categorías, subcategorías y familias en Firestore.

## Ejecutar nuevamente

El proceso es idempotente: conserva los UID existentes, restablece las contraseñas demo y actualiza los documentos por ID.

Con credenciales ADC de una cuenta de servicio autorizada:

```bash
FIREBASE_PROJECT_ID=cotizapp-d71c8 DEMO_PASSWORD=123456 npm run seed:firebase
```

En GitHub Actions, un commit cuyo mensaje contenga `[seed-firestore]` ejecuta automáticamente este seed usando la cuenta de servicio configurada en los secretos del repositorio.
