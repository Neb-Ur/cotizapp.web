# Auditoría funcional de Trovio — 30 de octubre de 2026

## Equipo y alcance

La sesión principal actuó como orquestador y release. Tres subagentes trabajaron simultáneamente en usuario/maestro/invitado, administración y ferretería. Después asumieron revisiones transversales de autenticación/seguridad, backend/datos y revisión independiente del diff. Los nueve perfiles reutilizables quedan en `.codex/agents`; su uso se describe en [agentes.md](agentes.md).

La revisión combina pruebas automatizadas con fixtures locales, HTTP local, PostgreSQL/PGlite, inspección de código y comprobaciones públicas de producción. No equivale a recorrer cada interacción con usuarios reales. No se crearon cuentas, tiendas ni cotizaciones ficticias en producción ni se enviaron correos de prueba.

## Fallos corregidos

Las severidades expresan impacto funcional potencial, no una clasificación de vulnerabilidades explotadas.

| ID | Severidad | Reproducción y comportamiento anterior | Corrección y evidencia |
| --- | --- | --- | --- |
| USR-01 | Alta | Pedir PDF/compartir como invitado con almacenamiento bloqueado navegaba al login sin persistir el trabajo. | Mantener la página y el presupuesto en memoria, explicar el fallo; regresiones PDF y compartir. |
| USR-02 | Media | Rechazar `updateProject` al cambiar estrategia dejaba la compra visualmente aplicada y una promesa rechazada. | Capturar el fallo, restaurar selección y avisar; regresiones de compra en tienda y combinada. |
| USR-03 | Alta | Vaciar una fila de producto desplazaba precios y locales de las siguientes filas. | Correlacionar las filas con las líneas no vacías del optimizador; prueba con cálculo real. |
| USR-04 | Media | Cambiar estrategias mientras el primer guardado seguía pendiente enviaba escrituras incompatibles. | Serializar mediante `isSaving`, bloquear controles y liberar estado en `finally`; prueba con promesa diferida. |
| USR-05 | Alta | Editar durante un guardado marcaba cambios posteriores como ya persistidos y podía reemplazar el presupuesto editado por una respuesta anterior. | Registrar la huella enviada, conservar las ediciones posteriores como pendientes y evitar navegación/limpieza prematura al crear; tres regresiones con respuestas diferidas y segundo guardado. |
| AUTH-01 | Alta | Una respuesta tardía de edición del perfil restauraba la cuenta después de logout o sobrescribía otra sesión. | Comprobar generación e identidad antes de publicar/persistir; regresiones logout y cambio de cuenta. |
| AUTH-02 | Media | Repetir submit de login o recuperación enviaba solicitudes simultáneas. | Ignorar envíos mientras haya uno pendiente; pruebas de llamada única. |
| AUTH-03 | Baja | Fallar un reenvío de recuperación conservaba el mensaje de éxito anterior. | Limpiar éxito/error antes del nuevo intento; regresión éxito seguido de fallo. |
| FER-01 | Alta | Importar stock `1-2` convertía el valor silenciosamente a cero y lo consideraba válido. | Rechazar números malformados/no finitos; regresión contra el importador original y formatos válidos. |
| FER-02 | Media | Fallar la lectura de un archivo dejaba disponible el CSV anterior para importar. | Limpiar contenido/avisos al iniciar lectura y bloquear importación durante ella; regresiones de archivo y concurrencia. |
| FER-03 | Media | Crear producto admitía envíos concurrentes y cantidades no finitas. | Exclusión de solicitudes y validación numérica; pruebas de concurrencia y valores inválidos. El backend ya era idempotente para productos idénticos: no se afirma duplicación persistida. |
| FER-04 | Media | Crear una solicitud con stock cero lo cambiaba a uno. | Conservar cero; regresión del formulario. |
| ADM-01 | Media | PATCH de usuario aceptaba roles desconocidos, dejando la cuenta sin acceso. | Rechazar con 400 antes de escribir; regresión con conservación de datos. |
| ADM-02 | Media | POST/PATCH aceptaban estados de cuenta fuera del dominio. | Validar `activo`, `pendiente` o `bloqueado` antes de crear identidad o persistir. |
| ADM-03 | Media | Creación administrativa recortaba una contraseña ya validada, cambiando su valor y posible longitud. | Enviar el valor exacto a Firebase; prueba con espacios iniciales/finales. |
| TAX-01 | Alta | Borrar taxonomía con dependencias dejaba referencias huérfanas en Firestore o producía error SQL. | Responder 409 y conservar categoría/subcategoría/familia y dependencias; seis casos locales y verificación PGlite. |
| API-01 | Alta | POST/PATCH de ofertas aceptaban precio negativo o stock malformado y podían reemplazarlos por cero. | Validar precio finito positivo y stock entero seguro no negativo antes de escribir; cinco regresiones, incluidos números como texto y stock cero. |

Las correcciones conservan los contratos de números como texto en la API y el redondeo histórico de la importación. No se agregaron migraciones SQL.

## Seguridad y dependencias

La matriz HTTP local cubre 44 rutas privilegiadas con visitante, maestro y ferretería: 132 solicitudes rechazadas con 401/403. Incluye middleware real, fixtures de tokens/perfiles y comprobación de ausencia de mutaciones. Las pruebas de autenticación también cubren cuenta bloqueada, aceptación legal, sesión reciente, revocación y separación de perfiles. Esto no constituye una prueba de penetración externa completa.

Se actualizaron dependencias compatibles de producción y desarrollo: parsers HTTP, `qs`, `re2js`, herramientas Angular, Vitest/Vite y sus dependencias afectadas. La instalación limpia con `npm ci` y auditorías completas de ambos paquetes forman parte de la validación. No se usó `--force` ni se cambiaron las versiones mayores declaradas.

## Evidencia focalizada

- Usuario y autenticación: 171 pruebas en 26 archivos; 11 regresiones nuevas.
- Ferretería: 41 pruebas frontend y 27 backend focalizadas.
- Backend/datos y revisión independiente: 54 pruebas en siete archivos, incluyendo transacciones/rollback y ciclo HTTP con PostgreSQL local.
- Administración: validación de usuarios/taxonomía, matriz de acceso y caso nuevo de integridad SQL.
- Perfiles de agentes: nueve archivos parseados con `tomllib`; nombres únicos y campos requeridos válidos. Esto no implica que cada perfil se haya iniciado desde una sesión nueva.

Los grupos comparten pruebas: sus cifras no deben sumarse como si fueran casos únicos. El cierre general usa los totales de `preflight:production`.

La validación general `npm run preflight:production` aprobó 12 pruebas de scripts, 402 pruebas frontend en 75 archivos, compilación de producción, cinco comprobaciones SSR y 287 pruebas backend, sin fallos. Después del hallazgo final USR-05 aprobaron 38 pruebas de proyecto-detalle en cinco archivos, incluidas sus tres regresiones nuevas; también se revisó el cambio de manera independiente y se repitieron con éxito la compilación de producción y las cinco comprobaciones SSR. Ambas auditorías completas de dependencias reportaron cero vulnerabilidades y `npm ci` completó una instalación limpia.

## Producción y límites

La comprobación pública inicial aprobó catálogo, detalle, HTML inicial, canonical, JSON-LD, sitemap, rutas retiradas y 404: 956 productos y 3.624 ofertas activas en ese momento.

Se leyó la configuración de la función productiva mediante las credenciales existentes de Firebase y se preservó usando `functions/scripts/lib/server-config.mjs`, con SQL habilitado y las conexiones actuales. La auditoría de solo lectura del registro SQL encontró 23 migraciones aplicadas hasta `024-professional-quotation-limit.sql`, sin diferencias de hash.

El entorno no tiene navegadores conectados. Quedan pendientes recorridos visuales autenticados de los tres perfiles en un navegador real, comportamiento en dispositivos reales y pruebas de carga/recuperación ante fallos externos. Las pruebas de formularios usan componentes Angular y APIs aisladas. No se declara que la aplicación esté libre de todo error posible.

Riesgo operativo pendiente de política: el último administrador puede bloquearse, eliminarse o cambiar su rol. Esta auditoría no alteró unilateralmente esa política.

El despliegue previo de GitHub Actions había fallado por falta de `secretmanager.secrets.get` para su identidad. La verificación final de entrega debe distinguir el estado de CI del despliegue efectivo; no se amplían permisos IAM como parte de estas correcciones.
