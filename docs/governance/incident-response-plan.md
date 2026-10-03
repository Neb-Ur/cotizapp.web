# Procedimiento de incidentes y registro de vulneraciones

Dueño: `{{SECURITY_OWNER}}` · Privacidad: `{{PRIVACY_OWNER}}` · Vocería: `{{LEGAL_REPRESENTATIVE}}`.

## Flujo

1. **Detectar y registrar de inmediato:** quién reporta, fecha, sistemas, datos, número aproximado, descripción y evidencia. No borrar logs.
2. **Contener:** revocar sesiones/llaves, aislar componentes, bloquear cambios y preservar evidencia con acceso restringido.
3. **Clasificar:** baja/media/alta/crítica según confidencialidad, integridad, disponibilidad, escala, ubicación, niños, datos sensibles/económicos y posibilidad de daño.
4. **Evaluar obligación:** documentar si existe riesgo razonable para derechos y libertades. Si existe, reportar a la Agencia por el medio más expedito y sin dilación indebida. Para las categorías que exige la ley, evaluar además comunicación individual clara a titulares.
5. **Recuperar:** restaurar servicio/datos, validar integridad y monitorear recurrencia.
6. **Cerrar:** raíz, impacto final, notificaciones, medidas, lecciones, responsable y fechas. Programar verificación de eficacia.

## Severidad operativa

- Crítica: datos sensibles/niños/económicos, credenciales, administración comprometida, indisponibilidad grave o gran escala. Escalamiento inmediato.
- Alta: acceso confirmado a datos personales o pérdida relevante; contención prioritaria.
- Media: exposición limitada o intento con incertidumbre; investigar el mismo día.
- Baja: evento sin acceso confirmado y efecto menor; igualmente registrar y justificar cierre.

## Registro mínimo

El panel conserva naturaleza, efectos, categorías, estimación de titulares, sistemas, medidas y estado. El expediente restringido debe añadir línea de tiempo, evidencia técnica, responsables, raíz, evaluación jurídica, textos y comprobantes de notificación, decisiones y mejoras. Nunca incluir contraseñas o secretos.

No se fija un plazo inventado de 72 horas: la Ley 21.719 usa el estándar “sin dilaciones indebidas”. El equipo debe actuar de inmediato y seguir instrucciones/reglamentos de la Agencia vigentes al momento del incidente.
