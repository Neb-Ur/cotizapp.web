# Ajustes de flujos Findi

- El detalle del catálogo maestro se abre antes de descargar sus datos. Muestra carga y descarta respuestas antiguas si se abre otro producto.
- El editor agrupa identidad, taxonomía, descripción y atributos; logística e imágenes quedan desplegables. Guarda sin abandonar la ficha.
- Los guardados muestran un estado inmediato durante la operación completa y evitan envíos duplicados. Las métricas en segundo plano no activan este estado.
- La búsqueda mantiene su índice local y comprueba cambios al iniciar una nueva interacción. La API invalida el catálogo antes de confirmar modificaciones; una revisión compartida invalida las fichas en todas las instancias. Cambiar precios no invalida las fichas estáticas.
- Las fichas guardadas en el navegador se invalidan cuando cambia la versión del índice, incluidas modificaciones de atributos.
- Admin puede agregar o actualizar una oferta individual desde el detalle de una ferretería: producto maestro, precio con IVA, stock, SKU y publicación. Se conserva la validación del contrato vigente.
- Las solicitudes de acceso se realizan por WhatsApp; el admin conserva Mensajes de contacto.
- Cada categoría tiene un icono semántico de PrimeIcons. Se guarda en `categorias.icono`; la taxonomía permite cambiarlo dentro de una lista de iconos admitidos.
- Contraseñas: mínimo 6 y máximo 128 caracteres, manteniendo mayúscula, minúscula, número y símbolo. La configuración del proyecto Firebase también tiene mínimo 6. Las ayudas no se pintan como errores y la validación roja desaparece cuando el campo es válido.
- El maestro usa el header público, con cotizaciones y perfil; no tiene un dashboard separado ni un buscador exclusivo. Se mantienen las URL antiguas para preservar enlaces. Login y registro conservan el destino previo.
- La cotización muestra datos y resumen en dos columnas en escritorio y una en móvil. Los modales conservan las etiquetas y sus indicadores en la misma línea.

Validación: pruebas del frontend y backend, y flujos en navegador en escritorio y móvil, con sesiones y escrituras simuladas para no modificar cuentas ni productos reales.
