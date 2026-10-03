# Copias de seguridad cifradas y recuperación

Estado inicial: **requiere activación y evidencia en el proyecto productivo**. Google cifra el contenido en reposo por defecto, pero eso no sustituye configurar backups ni probarlos.

## Objetivos

- RPO objetivo: 24 horas. RTO objetivo: 8 horas. Validar con `{{BUSINESS_OWNER}}`.
- Backup diario de Firestore; retención inicial 14 semanas (máximo documentado para backup programado), sujeto a la matriz y costos.
- Restauración siempre a una base nueva y aislada; nunca sobrescribir producción durante una prueba.

## Activación por administrador cloud

1. Confirmar facturación, región/base y asignar solo `roles/datastore.backupSchedulesAdmin` al operador.
2. Crear backup diario desde Disaster Recovery de Firestore o con `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14w`.
3. Verificar con `gcloud firestore backups schedules list --database='(default)'` y guardar salida/captura en repositorio restringido.
4. Revisar cifrado por defecto. Si el análisis exige CMEK, definir KMS, separación de funciones, rotación y recuperación de llave antes de migrar.

## Prueba trimestral

1. Seleccionar backup, documentar ID/fecha y autorizar la prueba.
2. Restaurar a `cotizapp-restore-{{YYYYMMDD}}`, aislada y sin tráfico público.
3. Verificar conteos, muestras de relaciones, permisos, catálogo, cotizaciones y hashes/consistencia definidos.
4. Medir RPO/RTO, eliminar el entorno de prueba de forma controlada y registrar resultado como `prueba_recuperacion`.
5. Abrir acción correctiva si el resultado no es conforme.

La eliminación de la base origen no elimina automáticamente sus backups; una supresión debe informar el plazo esperado de desaparición de copias y evitar reintroducir los datos al restaurar.

Referencia: [Backups programados y restauración de Firestore](https://cloud.google.com/firestore/docs/backups) y [cifrado por defecto de Google Cloud](https://cloud.google.com/docs/security/encryption/default-encryption).
