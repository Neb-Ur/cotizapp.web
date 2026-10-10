# Lista de materiales antes del registro

El recorrido principal es buscar materiales, armar una lista y guardar la cotización.

- Inicio y catálogo muestran cómo continuar. En la ficha, el visitante elige cantidad y ferretería y agrega el producto sin autenticarse.
- `/lista` permite revisar importes estimados, cambiar cantidades, quitar materiales y seguir buscando. El menú y los pasos permiten volver a la lista.
- La lista se guarda en el navegador, sin datos de identidad. No reserva stock ni congela precios. Si el almacenamiento no está disponible se informa al usuario.
- El registro y el inicio de sesión aparecen al preparar la cotización. El retorno es `/dashboard/maestro/cotizaciones/nuevo?usarLista=1`, protegido por los controles existentes de autenticación, aceptación legal y rol maestro.
- El editor recupera cantidades e identificadores de producto y oferta, recalcula con los datos actuales y permite guardar. El precio local estimado no se transmite como precio autorizado.
- La lista se vacía después de una creación exitosa, únicamente si no cambió desde que se importó. Los errores conservan el borrador y la lista. La cotización guardada conserva su vigencia habitual de 10 días.
- Los maestros pueden seguir agregando directamente a cotizaciones existentes desde una sección desplegable en la ficha.

La lista pertenece al navegador. No se sincroniza entre dispositivos y conviene guardar la cotización para conservarla en la cuenta.
