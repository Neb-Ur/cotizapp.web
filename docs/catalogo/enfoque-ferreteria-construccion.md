# Trovio: ferretería y construcción

La aplicación admite materiales y herramientas, con ferreterías como único tipo de local.

Se eliminaron físicamente los componentes, servicios, rutas funcionales, modelos, herramientas de importación, semillas, pruebas específicas e imágenes del antiguo rubro automotriz. No se mantiene una implementación archivada para reactivarla. El código anterior sigue recuperable mediante el historial de Git.

Los únicos tratamientos del rubro retirado en la aplicación son el rechazo de entradas antiguas, la exclusión de cachés anteriores y las respuestas 410/noindex de direcciones retiradas. Esas respuestas no contienen un catálogo. Las fichas de productos inexistentes responden 404. Google puede seguir mostrando enlaces anteriores hasta volver a rastrearlos.

## Eliminación de datos y archivos remotos

[023-hardware-only.sql](../../sql/findi/023-hardware-only.sql) elimina productos, ofertas, locales, taxonomía y marcas exclusivas, referencias en solicitudes, precios históricos, imágenes del catálogo y líneas de cotizaciones del rubro retirado. Conserva las líneas de ferretería de cotizaciones mixtas y elimina verificaciones que contienen productos retirados. También elimina las tablas y columnas específicas y restringe los tipos de negocio en PostgreSQL.

Las migraciones anteriores se conservan porque el instalador comprueba sus hashes. La migración nueva deshace ese esquema: no representa una función disponible ni datos que se conservarán.

El comando de retirada guarda únicamente las claves de imágenes pendientes en un manifiesto local privado. Después del borrado SQL elimina los archivos propios en R2, excluyendo los compartidos con productos conservados. Si falla el almacenamiento, volver a ejecutar el comando reintenta esa limpieza sin repetir la migración. Las fotografías de sitios externos no son archivos propiedad de Trovio y no se pueden borrar en esos sitios.

## Aplicación en producción

La preparación local no borra los datos publicados. Se necesita acceso a Secret Manager, Cloud SQL y R2 del proyecto `cotizapp-d71c8`.

1. Publicar el nuevo backend y Hosting. `/api/health` debe devolver `data.catalogSchema: "hardware-only-v1"`. El comando de retirada comprueba esa compatibilidad antes de borrar tablas.
2. Revisar el alcance remoto:

   ```sh
   node functions/scripts/retire-automotive.mjs
   ```

3. Aplicar la eliminación ya solicitada:

   ```sh
   CONFIRM_PROJECT_ID=cotizapp-d71c8 node functions/scripts/retire-automotive.mjs --apply
   ```

   Puede usarse `--firebase-cli-auth` con una sesión vigente de Firebase CLI que tenga permisos sobre este proyecto. Si se usa ADC, debe corresponder a una cuenta con acceso. El script carga la configuración pública de R2 desde `functions/.env`; las claves privadas se obtienen de Secret Manager.

4. Ejecutar `node scripts/smoke-production.mjs` y revisar el sitemap en Search Console. Cualquier copia histórica de Firestore, exportación o copia de seguridad requiere auditoría por separado; el comando opera sobre la base SQL vigente y los archivos propios referenciados en ella.

No se borra automáticamente la identidad de usuarios: una misma persona puede usar cotizaciones y ferreterías. Se retiran los locales de ese rubro.

## Aplicado en producción el 24 de octubre de 2026

- Hosting y Functions publicados en `cotizapp-d71c8`; `/api/health` confirmó `hardware-only-v1` antes de ejecutar la migración.
- Eliminados 174 productos automotrices, 9 locales y 2 vehículos donantes. Se completó también la limpieza de las imágenes propias en R2.
- Verificación SQL posterior: 0 productos automotrices, 0 locales de ese rubro y 0 tablas de vehículos. Permanecen 956 productos activos y 5 ferreterías.
- Firestore anterior: 0 productos automotrices, 0 locales automotrices y sin categoría automotriz en la comprobación previa.
- Prueba de producción aprobada: 956 productos, 3624 ofertas activas, fichas HTML, canónicas, JSON-LD y respuestas 404 correctas.
- Antiguas colecciones automotrices verificadas con HTTP 410 y noindex; una imagen automotriz retirada de Hosting verificada con HTTP 404.
- Esta publicación no conservó los bundles anteriores de Hosting, para retirar también el código de interfaz del antiguo rubro.
