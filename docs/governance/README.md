# Gobierno de datos de CotizApp

Versión: 1.0 · Vigencia interna: 2026-10-03 · Revisión: trimestral y ante cambios materiales.

Este directorio es el sistema interno de gobierno de datos. No reemplaza una revisión jurídica ni convierte por sí solo a CotizApp en un modelo certificado. El responsable debe sustituir las variables provisorias de `LEGAL_IDENTITY`, aprobar estos documentos, asignar responsables y conservar evidencia en **Panel Admin > Gobierno de datos**.

## Responsables variables

- Responsable: `{{LEGAL_NAME}}`, RUT `{{TAX_ID}}`.
- Máxima autoridad: `{{LEGAL_REPRESENTATIVE}}`.
- Responsable operativo de privacidad: `{{PRIVACY_OWNER}}` / `{{PRIVACY_EMAIL}}`.
- Responsable de seguridad e incidentes: `{{SECURITY_OWNER}}` / `{{SECURITY_EMAIL}}`.
- Delegado de protección de datos: `{{DPO_NAME_OR_NOT_APPOINTED}}`.
- Canal de escalamiento: `{{INCIDENT_PHONE_AND_EMAIL}}`.

## Controles y evidencia

| Control | Documento | Evidencia mínima | Frecuencia |
|---|---|---|---|
| Inventario de tratamientos | `processing-inventory.md` | revisión fechada y aprobada | trimestral/cambio |
| Conservación y eliminación | `retention-deletion-matrix.md` | ejecución y excepciones | mensual |
| Encargados y transferencias | `processors-and-transfers.md` | DPA, versión, región, subencargados | semestral/cambio |
| Confidencialidad y accesos | `access-and-confidentiality.md` | compromisos y revisión IAM | alta/baja + trimestral |
| Backups y recuperación | `backup-recovery-runbook.md` | resultado de restauración | trimestral |
| Incidentes | `incident-response-plan.md` | expediente completo | por incidente |
| Controles y EIPD | `controls-and-dpia.md` | revisión/EIPD aprobada | trimestral/antes de alto riesgo |

## Controles implementados en la aplicación

- Toda ruta `/admin/governance/*` exige sesión y rol `admin`; MFA puede hacerse obligatorio con `REQUIRE_ADMIN_MFA=true`.
- Cada acceso administrativo autorizado crea una entrada persistente en `bitacoraAdministrativa`, sin cuerpo, token ni query string.
- Los incidentes se registran en `registroIncidentesSeguridad`.
- Revisiones, pruebas de restauración, EIPD, encargados, accesos y confidencialidad se registran en `evidenciasGobiernoDatos`.
- Firestore directo desde el cliente permanece denegado; el acceso se realiza por API autenticada.

## Bloqueos de producción

No declarar estos controles como operativos hasta adjuntar evidencia:

1. Aceptación/archivo de los términos de tratamiento de Google/Firebase y análisis firmado de transferencias.
2. Backup programado en el proyecto productivo y primera restauración exitosa a una base aislada.
3. `REQUIRE_ADMIN_MFA=true` y MFA enrolado para cada administrador.
4. Compromisos de confidencialidad firmados por toda persona con acceso.
5. Identidad legal real y responsables reemplazando los valores mock.

Base normativa: Ley N.º 21.719, especialmente principios del artículo 3, seguridad y vulneraciones de los artículos 14 quinquies y 14 sexies, EIPD del artículo 15 ter, transferencias de los artículos 27 a 29 y prevención de los artículos 48 a 51.
