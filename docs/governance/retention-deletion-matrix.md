# Matriz de conservación y eliminación

Los plazos son política interna inicial y deben ser validados por asesoría jurídica/tributaria. Un `legalHold` documentado puede suspender eliminación solo para la información estrictamente necesaria.

| Colección / dato | Evento inicial | Plazo activo | Acción | Backup |
|---|---|---:|---|---|
| `usuarios` / Firebase Auth | cierre o solicitud válida | inmediato tras validación | eliminar cuenta, perfil y relaciones según flujo de privacidad | expira con ciclo del backup; registrar fecha esperada |
| `proyectos` y datos de cliente | última actividad o cierre de cuenta | 36 meses de inactividad, con aviso previo | eliminar o anonimizar; eliminación inmediata cuando proceda | mismo ciclo |
| `productosFerreteria`, precios y stock | despublicación | 24 meses | eliminar oferta inactiva; conservar agregado anónimo si se justifica | mismo ciclo |
| `historialPrecios` | creación/cambio/eliminación de oferta | 24 meses, salvo controversia documentada | eliminar con la cuenta/ferretería o al vencer; anonimizar solo si mantiene utilidad estadística | mismo ciclo |
| `productosMaestro` y taxonomía | retiro | mientras sean necesarios; revisión anual | despublicar y luego eliminar si no hay referencias | mismo ciclo |
| datos de ferretería | término contractual | 24 meses para cierre/controversias | eliminar contacto privado; ficha pública se despublica al término | mismo ciclo |
| `contratosFerreteria` | término contractual o cierre de cuenta | 5 años como política inicial, sujeto a validación jurídica | minimizar de inmediato los datos del firmante al eliminar la cuenta; conservar versión, huella, partes empresariales y estado; eliminar al vencer si no existe `legalHold` | mismo ciclo, con acceso restringido |
| `denunciasPropiedadIntelectual` | resolución definitiva | 5 años como política inicial, sujeto a validación jurídica | minimizar contacto al cerrar cuenta; conservar evidencia y decisión solo mientras sea necesaria para reclamaciones; eliminar al vencer si no existe `legalHold` | mismo ciclo, con acceso restringido |
| `solicitudesContacto` / producto | cierre | 24 meses | eliminar | mismo ciclo |
| `registrosConsentimiento` | término de finalidad/cuenta | mientras se requiera acreditar + plazo de acciones aplicable | minimizar o separar bajo `legalHold`; no reutilizar | mismo ciclo |
| `solicitudesDerechos` | cierre | 36 meses | anonimizar/eliminar salvo reclamación | mismo ciclo |
| `comprobantesEliminacion` | emisión | 36 meses | eliminar; no debe permitir reidentificación | mismo ciclo |
| `bitacoraAdministrativa` | evento | 12 meses | eliminar automáticamente o mediante revisión mensual | máximo del backup |
| `registroIncidentesSeguridad` | cierre | 5 años | eliminar o anonimizar tras revisión legal | máximo del backup |
| `evidenciasGobiernoDatos` | creación | 5 años | eliminar tras revisión legal | máximo del backup |
| cache público | expiración/reemplazo | hasta nueva versión | sobrescribir/eliminar | no restaurar cache obsoleta |

## Procedimiento mensual

1. Exportar recuentos por colección, identificar vencidos y `legalHold`.
2. Validar dependencias antes de borrar y aprobar con doble control (`{{DATA_OWNER}}` + `{{PRIVACY_OWNER}}`).
3. Ejecutar por lotes, registrar conteos y errores como `revision_controles`.
4. Confirmar que buscadores/cache no conservan copias y calcular la fecha de expiración en backups.
5. Muestrear registros eliminados sin volver a exponer datos personales.

No se ha añadido un borrado automático general: hacerlo sin validar obligaciones y dependencias podría destruir cotizaciones válidas. La automatización se habilita solo después de aprobar esta matriz.
