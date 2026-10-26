# Herramientas profesionales de Trovio

Implementado el 25 de octubre de 2026.

- Las cuentas de maestro pueden guardar hasta 50 cotizaciones. Sin cuenta se conserva una cotización en el navegador.
- En Perfil y dentro de cada cotización: agenda privada de hasta 200 clientes, búsqueda, edición y eliminación; presentación profesional con logo, contacto y condiciones habituales.
- Usar cliente o presentación copia los datos a la cotización. Guardar la cotización conserva esa versión; cambiar la agenda no modifica documentos anteriores. La dirección del cliente se distingue de la dirección de obra.
- El PDF incluye la presentación y el contacto aplicados. El logo se convierte a JPEG acotado y el servidor lo vuelve a procesar. Los costos internos solo aparecen si el maestro activa su desglose.
- En una cotización guardada: control privado de compras, jornadas/mano de obra, otros gastos y abonos/pagos. Cada movimiento incluye fecha, cantidad y monto por unidad en CLP. Son registros manuales; no se cobran pagos desde Trovio.
- Se muestran costo real, cobros, saldo pendiente, eventual saldo a favor del cliente, diferencia contra costo presupuestado y flujo de caja. El resultado se presenta como proyectado hasta marcar la obra terminada. El maestro confirma que registró todos los gastos; Trovio no comprueba boletas ni pagos bancarios.
- Los movimientos se guardan por separado del presupuesto, sin regenerar el código de materiales ni cambiar el estado comercial. Las revisiones evitan sobrescribir cambios de otra ventana.
- Calculadoras adicionales: piso flotante/vinílico (cajas), tabiques (planchas por una o dos caras) y radier/losa (m³ según espesor). Se guardan las medidas, descuentos, adicional y referencia dentro del presupuesto y su PDF. Los productos se agregan desde el catálogo confirmando la unidad de venta; el volumen de hormigón no determina dosificación ni diseño estructural.
- Plantillas adicionales para esos tres trabajos. Las partidas son editables, sin precios inventados; deben completarse o quitarse antes de exportar o enviar.
- En Administración > Productos: revisión técnica de presentaciones y rendimientos, con fuente y control de cambios. Pintura y cerámicas precargan los valores revisados; el usuario debe confirmar la correspondencia con la oferta y puede ajustarlos.

## Datos que requieren revisión humana

Un producto genérico no representa una caja o envase de tamaño único. No se inventan litros, m²/caja ni rendimientos: se completan con la ficha del fabricante o la presentación exacta. El panel indica qué productos siguen pendientes. Esto es contenido del catálogo, no una función pendiente de programación.

## Persistencia y privacidad

La agenda y la presentación viven en `users.api_payload.professionalTools`; el presupuesto, sus copias de contacto y cálculos viven en `quotations.api_payload.workBudget`; los movimientos viven en `quotations.api_payload.ledger`. Esos campos no requieren tablas nuevas. La migración `024-professional-quotation-limit.sql` amplía a 50 el cupo predeterminado y las cuentas con el cupo anterior de dos; conserva otros límites personalizados. La exportación y eliminación de cuenta ya abarcan esos registros completos. Los locales solo acceden a la evidencia de materiales permitida por el verificador, nunca a la agenda ni a la contabilidad del maestro.

Las rutas nuevas requieren sesión y rol. Las rutas de maestro validan también el propietario; las de revisión técnica requieren administrador. Agenda y movimientos aplican un número de revisión para rechazar escrituras obsoletas.

## Correcciones de calculadoras y cupos — 25 de octubre de 2026

Al alternar entre piso, tabique y radier se conservan las medidas aún no aplicadas de cada formulario. Cambiar el estado de guardado tampoco restaura valores anteriores. Abrir otro presupuesto carga sus propios cálculos.

Crear y duplicar cotizaciones respeta el cupo de cada cuenta, incluido cero y valores superiores a 50. En PostgreSQL se toma `users.quotation_limit` como autoridad, aunque el JSON del usuario conserve un valor antiguo. El perfil de sesión, el panel y la ficha de producto usan ese mismo cupo; 50 sigue siendo el valor predeterminado para cuentas sin cupo explícito. No se modifican cupos existentes ni migraciones históricas.

## Observaciones y exclusiones del presupuesto

Todas las plantillas comparten campos opcionales de **Observaciones** y **Qué no incluye el presupuesto**, de hasta 3.000 caracteres cada uno. Se conservan al guardar, restaurar borradores y combinar plantillas. El PDF del presupuesto muestra cada sección si tiene contenido, tanto en la versión para el cliente como en la de costos internos. Las cotizaciones anteriores siguen funcionando sin esos campos.
