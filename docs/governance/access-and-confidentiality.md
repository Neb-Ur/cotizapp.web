# Política de accesos, privilegios y confidencialidad

## Accesos

- Mínimo privilegio: `maestro` solo sus proyectos; `ferreteria` solo su local/ofertas; `admin` solo personal autorizado.
- Producción exige `REQUIRE_ADMIN_MFA=true`, cuenta individual, sin credenciales compartidas y revisión trimestral de IAM/Firebase.
- Alta: solicitud del dueño del sistema, aprobación de `{{SECURITY_OWNER}}`, rol y caducidad. Cambio: retirar permisos incompatibles antes de agregar otros. Baja: revocar sesión, cuenta, llaves y accesos el mismo día.
- Service accounts sin llaves descargables cuando sea posible; secretos fuera del repositorio; rotación ante sospecha.
- Acceso de emergencia: cuenta separada, MFA, uso justificado, alerta y revisión posterior en 24 horas.
- La bitácora administrativa se revisa mensualmente y después de incidentes. Está prohibido registrar tokens, contraseñas o cuerpos completos.

## Compromiso de confidencialidad (plantilla)

Yo, `{{PERSON_NAME_AND_ID}}`, en mi función de `{{ROLE}}`, me obligo a tratar datos de CotizApp únicamente según instrucciones autorizadas; mantener secreto durante y después de mi relación; no copiar, descargar ni comunicar información fuera de los sistemas aprobados; usar MFA y proteger credenciales; reportar inmediatamente pérdidas, accesos o errores; devolver/eliminar copias al terminar; y aceptar las medidas internas aplicables por incumplimiento.

- Sistemas/datos autorizados: `{{SCOPE}}`
- Vigencia: `{{START}}` a `{{END_OR_RELATION_END}}`
- Firma persona: `{{SIGNATURE_AND_DATE}}`
- Firma responsable: `{{APPROVER_SIGNATURE_AND_DATE}}`

El documento firmado se conserva en RR.HH./repositorio legal, nunca en el catálogo público. Registrar en el panel solo la existencia, fecha, responsable y enlace con acceso restringido.
