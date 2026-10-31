# PostgreSQL en Neon y esquema compacto

Destino autorizado: organización `org-wild-bread-59351932`, proyecto `crimson-credit-77789114`, rama `production`. La API sigue en Firebase Functions; Firebase Authentication mantiene las identidades y R2 conserva los objetos e imágenes.

## Cambios del modelo

La migración nueva `025-compact-schema.sql` se aplica después de los 23 archivos históricos, conservando sus SHA-256 y el registro `public.findi_schema_migrations`.

- Las columnas relacionales son la fuente de los campos mapeados. Se retira `api_payload`; `api_fields` registra presencia/tipo y `api_extra` conserva campos adicionales y formatos históricos que no admiten reconstrucción idéntica. La migración compara cada valor antes de extraerlo y verifica los documentos completos contra los hashes del origen. Preserva los presupuestos, herramientas profesionales, snapshots y precios congelados.
- `offers` se renombra físicamente a `store_products`: productos de cada ferretería con precio, stock y publicación. Los contratos HTTP existentes conservan sus nombres para no romper el frontend.
- Las características simples pasan a `products.features`; las imágenes llevan producto, posición y principal en `media_assets`. Se retiran `product_features` y `product_media`, manteniendo derechos y URLs R2.
- Se retiran los esquemas de inspección/conciliación de la transición y las tablas de estado/réplica Firestore. `app_state` contiene la verificación del nuevo baseline. El arranque compacto comprueba `ready` y nunca repuebla datos desde Firestore.
- Categorías, subcategorías, familias, marcas, atributos, permisos, cotizaciones, contratos y evidencias mantienen sus relaciones y restricciones.

## Alcance de los datos

Se trasladan usuarios, ferreterías, catálogo, taxonomía, atributos, marcas, precios/stock, medios/derechos, referencias territoriales, contratos/aceptaciones y solicitudes abiertas o dependencias operativas necesarias. Los UID y los identificadores existentes se conservan.

Las cotizaciones anteriores, verificaciones, historiales y métricas no se trasladan por decisión del propietario. Sus tablas siguen disponibles para las nuevas operaciones. La fuente de GCP permanece como respaldo de esa información.

## Conexión y secretos

`SQL_PROVIDER=neon`, `SQL_SCHEMA_VARIANT=compact`, `USE_SQL_DATABASE=true` y `SQL_REPLICATION_ENABLED=false` seleccionan el destino. El servidor usa `pg` con un pool reutilizado y una URL pooled, TLS con certificado verificado y credenciales de un rol SQL restringido. No intenta Cloud SQL como fallback ante un fallo Neon.

`DATABASE_URL` es un secreto de Firebase para el runtime. La URL directa `DATABASE_URL_UNPOOLED` del propietario se usa únicamente para migrar, desde `.env.local` ignorado por Git. No publicar ninguna de esas URL, tokens ni los archivos de `tmp/neon-migration`.

`preserveServerConfig` conserva el proveedor y la variante junto con R2 y las demás conexiones sin escribir secretos en los archivos de despliegue. El esquema heredado de GCP continúa admitido para una reversión controlada.

## Procedimiento de migración

1. `neon init -y --agent codex --org-id org-wild-bread-59351932 --project-id crimson-credit-77789114 --branch production --services postgres`, seguido de `neon deploy`. El indicador `--agent codex` evita instalar herramientas ajenas a esta sesión.
2. Crear la rama temporal `migration-validation-20261031`; descargar sus variables a un archivo separado de `.env.local`.
3. Compilar Functions y ejecutar `migrate-to-neon.mjs` con `--apply --branch migration-validation-20261031 --firebase-cli-auth`, `CONFIRM_NEON_PROJECT_ID` y el archivo de entorno de esa rama. El script verifica proyecto/rama/endpoint con Neon antes de copiar. Rechaza destinos ya poblados.
4. Ejecutar `verify-neon-app.mjs` con el entorno restringido generado en `tmp/neon-migration/migration-validation-20261031.runtime.env`. El script exige esa rama en el entorno **y en el manifiesto de la base**, abre HTTP solo en loopback y limpia los recursos que crea.
5. Publicar primero la API compatible con ambos proveedores en GCP. Cada transacción heredada de escritura comparte el bloqueo del registro de corte, sin ocupar otra conexión.
6. Para el corte final, ejecutar el migrador con el entorno Neon de producción y `--apply --branch production --pause-source --firebase-cli-auth`. Exige que la API publicada tenga el guard, espera las transacciones de escritura en curso, pausa nuevos guardados y toma el snapshot final. Si falla la copia, reanuda automáticamente las escrituras del origen.
7. Comparar filas, claves y hashes; aplicar `025`; verificar otra vez los DTO; reconstruir búsqueda/SEO y crear el rol mínimo. Configurar `DATABASE_URL` como secreto y publicar las funciones con los selectores Neon/compact.
8. Verificar estado de la función, conexiones conservadas, catálogo, búsqueda, detalles, URLs canónicas y rechazos de acceso. Retirar la rama temporal y sus credenciales de pruebas cuando termine la comprobación.

El migrador no borra ni transforma tablas de GCP. Tras un corte satisfactorio, deja bloqueadas allí las escrituras de la API para evitar dos fuentes activas. Para abortar antes de publicar Neon, `migrate-to-neon.mjs --apply --branch production --resume-source --firebase-cli-auth` restaura la escritura; requiere el mismo `CONFIRM_NEON_PROJECT_ID`.

Una reversión después de recibir nuevas escrituras en Neon necesita conciliarlas primero; no alternar proveedores directamente perdiendo operaciones nuevas.

## Validación y límites

`npm run preflight:production` cubre tests de scripts, frontend, build, SSR y backend. Hay pruebas PGlite específicas de replay/hash de migraciones, rollback, permisos, copia exacta de numeric/bigint/timestamps, integridad, esquema compacto y pausa/reanudación.

La verificación HTTP local usa PostgreSQL real de Neon para catálogo/búsqueda/detalle, permisos, taxonomía, cotizaciones y cambios de precio/stock. **Solo la verificación del token Firebase se simula en ese script local**; no prueba login real ni emisión/revocación, no crea cuentas Auth y no escribe fixtures en producción.

La primera copia de ensayo conservó 18 usuarios, 5 ferreterías, 957 productos, 3.624 productos de ferretería, 18 categorías, 80 subcategorías y 101 familias. Verificó los hashes de los documentos de API y reconstruyó 856 documentos de búsqueda y 999 rutas SEO. Las cifras finales deben comprobarse de nuevo tras drenar escrituras.

Referencias: [conexión Neon](https://neon.com/docs/connect/choose-connection), [pooling](https://neon.com/docs/connect/connection-pooling) y [TLS de node-postgres](https://node-postgres.com/features/ssl).
