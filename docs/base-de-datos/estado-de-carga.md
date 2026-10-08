# Estado de carga de la base de datos Findi

Carga aplicada y verificada el **8 de octubre de 2026** en `cotizapp-d71c8-database`.

El catálogo existente está completo: 856 productos, 18 categorías, 80 subcategorías, 101 familias, 8 marcas, 26 modelos comerciales documentados, 1.085 definiciones de atributos, 818 opciones y 1.047 valores de atributos. Se conservaron IDs, fichas, marcas reales y derechos de contenido. Se conciliaron los datos de las 28 colecciones de origen contra PostgreSQL, sin alterar los datos del usuario.

## Referencias añadidas

- Chile: 1 país, 16 regiones, 56 provincias y 346 comunas, con códigos CUT y jerarquía completa.
- Ciudades: las 17 opciones existentes de los formularios y sus 122 asociaciones con comunas. Son agrupaciones de la aplicación; **no representan un inventario oficial de todas las ciudades ni límites urbanos**.
- Ubicaciones: 3 cuentas enlazadas a su comuna/región y a su agrupación de ciudad cuando el dato existe. La ferretería actual no tiene ubicación declarada en su ficha; no se copió automáticamente la dirección privada de su dueño.
- Búsqueda: 856 documentos SQL derivados del catálogo activo, con la misma normalización de acentos y unidades que el buscador actual.
- SEO: 983 rutas canónicas de productos, categorías, familias y marcas que tienen productos, usando las funciones SEO actuales y sus reglas de duplicados.
- Documentos legales: términos 1.1, privacidad 1.2 y acuerdo de ferretería 1.1. Se conservaron los textos vigentes de la aplicación; no se inventaron aceptaciones ni se reescribieron consentimientos históricos.

La división territorial procede de [SUBDERE, Códigos Únicos Territoriales](https://www.subdere.gov.cl/documentacion/c%C3%B3digos-%C3%BAnicos-territoriales-actualizados-al-06-de-septiembre-2018), archivo `CUT_2018_v04.xls`. El JSON público guarda URL, versión, fecha de consulta y SHA-256 del archivo original. [La Mapoteca de la BCN](https://www.bcn.cl/siit/mapoteca/) confirma el total de 16 regiones, 56 provincias y 346 comunas. Se conserva la grafía oficial CUT «Paiguano», con alias del formulario «Paihuano», ambos para el código 04105; [SUBDERE explica ambas denominaciones](https://www.subdere.cl/taxonomy/term/1719).

## Qué significa una tabla vacía

Una tabla de actividad vacía no indica una carga faltante. No existen ofertas ni precios de ferreterías, imágenes autorizadas, reclamos, importaciones históricas o solicitudes de privacidad en el origen. Las 2 cotizaciones existentes todavía no tienen líneas, por lo que tampoco hay productos más cotizados. Estos datos se generan con acciones reales. Las preferencias entre dispositivos, eventos pendientes y tablas temporales de conciliación no se rellenaron con registros ficticios.

Las agrupaciones de ciudades, los índices y las rutas son referencias o derivados. Las referencias territoriales de cuentas/ferreterías se mantienen automáticamente con triggers al cambiar sus campos. El buscador y SEO públicos siguen usando sus servicios actuales; estos índices SQL se pueden reconstruir mediante la carga de referencia. No se modificaron la interfaz ni la base activa: `USE_SQL_DATABASE=false` sigue vigente.

## Repetir y verificar

Con credenciales administrativas de Google Cloud, desde la raíz del repositorio:

```sh
CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/seed-sql-reference-data.mjs --apply
node functions/scripts/verify-sql-reference-data.mjs
node functions/scripts/verify-sql-connect-inspection.mjs
node functions/scripts/audit-sql-data.mjs
```

El proceso de carga usa una transacción, se revierte completo si hay una inconsistencia y hace upsert de referencias. Conserva un respaldo previo en `tmp/sql-migration/` con permisos 0600; contiene datos privados, está fuera de Git y debe seguir la política de conservación. Para ejecutar usando una sesión vigente del CLI local se puede añadir `--firebase-cli-auth`. El proceso no acepta una base sin conciliar y no fabrica productos, precios, usuarios ni historial.

Se comprobaron la cobertura de búsqueda y SEO de todos los productos activos, las relaciones territoriales, la sincronización de ubicación mediante cambios revertidos, los textos legales y las 60 consultas administrativas. Las consultas anónimas fueron rechazadas con HTTP 403. El esquema sigue protegido por RLS y por las autorizaciones de la API.

## Conteos por tabla

Los siguientes conteos son una instantánea; cachés, auditoría y actividad pueden variar. Hay 57 tablas en `findi`, 2 temporales en `findi_migration` y el registro SQL en `public`.

| Tabla | Filas |
| --- | ---: |
| `findi.account_deletion_jobs` | 0 |
| `findi.account_locations` | 3 |
| `findi.account_preferences` | 0 |
| `findi.admin_audit_logs` | 43 |
| `findi.attribute_definitions` | 1085 |
| `findi.attribute_options` | 818 |
| `findi.brands` | 8 |
| `findi.catalog_revisions` | 2 |
| `findi.catalog_search_documents` | 856 |
| `findi.categories` | 18 |
| `findi.cities` | 17 |
| `findi.city_communes` | 122 |
| `findi.communes` | 346 |
| `findi.consent_events` | 12 |
| `findi.contact_messages` | 1 |
| `findi.content_rights` | 856 |
| `findi.countries` | 1 |
| `findi.database_migration_state` | 1 |
| `findi.deletion_receipts` | 0 |
| `findi.families` | 101 |
| `findi.governance_evidence` | 0 |
| `findi.import_batches` | 0 |
| `findi.import_rows` | 0 |
| `findi.ip_report_events` | 0 |
| `findi.ip_reports` | 0 |
| `findi.job_runs` | 0 |
| `findi.legal_documents` | 3 |
| `findi.marketing_suppressions` | 0 |
| `findi.media_assets` | 0 |
| `findi.offer_history` | 0 |
| `findi.offers` | 0 |
| `findi.outbox_events` | 0 |
| `findi.price_reports` | 0 |
| `findi.privacy_requests` | 0 |
| `findi.product_attributes` | 1047 |
| `findi.product_content_rights` | 856 |
| `findi.product_features` | 0 |
| `findi.product_media` | 0 |
| `findi.product_models` | 26 |
| `findi.product_requests` | 0 |
| `findi.products` | 856 |
| `findi.provinces` | 56 |
| `findi.public_cache_artifacts` | 30 |
| `findi.quotation_items` | 0 |
| `findi.quotations` | 2 |
| `findi.regions` | 16 |
| `findi.security_incidents` | 0 |
| `findi.seo_routes` | 983 |
| `findi.source_replication_versions` | 3323 |
| `findi.store_agreements` | 0 |
| `findi.store_daily_analytics` | 1 |
| `findi.store_daily_top_products` | 0 |
| `findi.store_event_counters` | 0 |
| `findi.store_locations` | 0 |
| `findi.stores` | 1 |
| `findi.subcategories` | 80 |
| `findi.users` | 3 |
| `findi_migration.issues` | 0 |
| `findi_migration.source_documents` | 0 |
| `public.findi_schema_migrations` | 9 |
