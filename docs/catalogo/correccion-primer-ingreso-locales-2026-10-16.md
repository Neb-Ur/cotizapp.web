# Corrección del primer ingreso de locales — 16 de octubre de 2026

## Problema reproducido

Al abrir términos en una pestaña nueva, la pestaña del panel podía perder la sesión y conservar el formulario visible. El login y el registro elegían explícitamente `browserLocalPersistence`, mientras que `getAuth()` inicializaba las pestañas nuevas con IndexedDB como primera preferencia. El SDK migraba el usuario desde localStorage y retiraba la clave que la pestaña original observaba, provocando su desconexión.

La reproducción en Chrome aislado confirmó la pérdida de sesión antes del cambio. La implementación instalada del SDK se revisó para contrastar su migración de persistencia. La aceptación reciente del usuario de Norte estaba registrada; no se volvió a registrar ni se modificó para comprobar la corrección.

## Cambios

- La inicialización de Auth utiliza la misma preferencia local que login y registro, mantiene la persistencia de sesión y conserva IndexedDB como alternativa para sesiones anteriores. La instancia se comparte mediante una única promesa por aplicación.
- Salir de la vista no equivale a rechazar los documentos ni cierra automáticamente la sesión. El botón de rechazo continúa cerrándola explícitamente. Los permisos del servidor siguen exigiendo las aceptaciones correspondientes.
- Una respuesta perdida de guardado se contrasta con el estado actual del servidor. Si ya se guardó, se actualiza la sesión sin reenviar las declaraciones.
- Si falla la actualización de sesión posterior, el formulario informa que las aceptaciones están guardadas y ofrece «Continuar». Las casillas quedan bloqueadas y el reintento solo actualiza la sesión.
- Si no se puede confirmar el guardado, se conservan las casillas. Un conflicto de versiones carga los documentos actuales y exige marcarlas nuevamente. Un cambio de cuenta impide reutilizar las declaraciones anteriores.

## Validación

279 pruebas de frontend y cinco pruebas de backend de onboarding aprobadas, más compilación de producción. Playwright abrió términos en una segunda pestaña móvil, volvió a la original y comprobó la recuperación ante una falla de actualización de sesión y una respuesta de guardado perdida. Las solicitudes de aceptación se interceptaron; el servidor de previsualización rechazaba además cualquier escritura al backend. No se enviaron nuevas declaraciones legales ni correos de verificación.

Las pestañas que conservan el JavaScript anterior deben recargarse y, si ya perdieron la sesión, volver a iniciar sesión.
