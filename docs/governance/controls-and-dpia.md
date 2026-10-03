# Evaluación periódica de controles y EIPD

## Revisión trimestral

Registrar como `revision_controles`: autenticación/MFA; roles y cuentas inactivas; reglas y APIs; dependencias/vulnerabilidades; secretos; logs y alertas; conservación; derechos; proveedores/transferencias; backups/restauración; incidentes; capacitación/confidencialidad; contenido público de ferreterías, productos y precios. Cada hallazgo lleva dueño, plazo, riesgo y evidencia de cierre.

Registrar separadamente revisiones de accesos, encargados, confidencialidad y pruebas de recuperación. Un resultado `no_conforme` no equivale a cumplimiento: debe abrir una acción correctiva rastreable.

## Umbral para evaluación de impacto (EIPD)

Debe completarse **antes** de iniciar un tratamiento probablemente de alto riesgo y siempre ante evaluación automatizada con efectos significativos, tratamiento masivo/gran escala, monitoreo sistemático de zona pública o datos sensibles en las hipótesis legales. En CotizApp requieren screening especial: ubicación precisa persistente; escala creciente de direcciones de obras/clientes; scoring/perfilado; combinación de catálogos con comerciantes individuales; nueva analítica o publicidad.

## Plantilla EIPD

1. Nombre, dueño, fecha, versión, aprobación y estado (`propuesto/aprobado/rechazado`).
2. Descripción de datos, titulares, fuentes, flujo, sistemas, proveedores, países, destinatarios y conservación.
3. Finalidad y base jurídica por operación.
4. Necesidad/proporcionalidad: minimización, alternativas menos invasivas, exactitud y transparencia.
5. Derechos: acceso, corrección, supresión, oposición, bloqueo, portabilidad e intervención humana.
6. Riesgos por amenaza y titular: probabilidad, impacto y nivel inherente.
7. Medidas técnicas/organizativas, responsable, fecha y riesgo residual.
8. Consulta a titulares/experto/DPO cuando corresponda.
9. Decisión: no iniciar si el riesgo residual no es aceptable; consultar a la Agencia cuando proceda.
10. Fecha de revisión y gatillos de reapertura.

Registrar la aprobación como `evaluacion_impacto` y enlazar el documento restringido; el panel no debe contener secretos ni datos personales de muestra.
