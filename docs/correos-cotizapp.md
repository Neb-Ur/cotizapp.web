# Correos Findi

## Envío existente y estado aplicado

Firebase Authentication envía los cuatro tipos de correo existentes: recuperación de contraseña, verificación de dirección, reversión de cambio de correo y reversión de un segundo factor añadido. No existe otro proveedor de correo ni envío de notificaciones comerciales en el código.

El 4 de octubre de 2026 se configuró y verificó en `cotizapp-d71c8`:

- Idioma predeterminado: español (`es`).
- Nombre del remitente de los cuatro tipos: `Findi`.
- Se conserva el transporte de Firebase, los remitentes existentes y los enlaces de acción seguros.

**La personalización de los asuntos y del cuerpo HTML no quedó aplicada.** El proyecto responde `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED` al modificar esos campos; algunos cuerpos protegidos devuelven éxito pero conservan el contenido predeterminado. La lectura posterior confirma que los cuatro mensajes conservan los asuntos y cuerpos estándar en español. Se necesita resolver la restricción del proyecto con Firebase o disponer de un proveedor SMTP autorizado para completar la personalización. No se enviaron correos de prueba ni se habilitó un proveedor nuevo.

El frontend también establece `auth.languageCode = 'es'` antes de utilizar Firebase. Este cambio del código requiere despliegue; la configuración de idioma y remitente anterior ya está activa en Firebase.

## Diseño preparado

La plantilla compartida está en [email-template.ts](../functions/src/lib/email-template.ts). Usa encabezado azul oscuro, marca Findi, fondo gris neutro, botón naranja, instrucciones de seguridad y enlaces de contacto, privacidad y términos. El ancho es fluido, con un máximo de 600 px. Emplea tablas y estilos en línea, sin imágenes remotas ni fuentes externas, y dispone de versión de texto plano.

Los cuatro mensajes conservan los marcadores de Firebase (`%LINK%`, `%EMAIL%`, `%NEW_EMAIL%`, `%SECOND_FACTOR%`) y explican el propósito exacto de cada enlace. No se cambia el controlador de acciones ni se generan enlaces o códigos reales durante la previsualización.

## Previsualizar y volver a configurar

```bash
npm run emails:preview
```

Genera cuatro archivos HTML y cuatro archivos de texto en `tmp/email-previews`, con direcciones ilustrativas. También genera cuatro archivos `*.firebase.html` listos para pegar en el editor de mensajes de Firebase: conservan los marcadores reales y contienen únicamente el fragmento del cuerpo. Para recuperación de contraseña, usa `resetPasswordTemplate.firebase.html`. La generación no requiere credenciales y no envía correos.

```bash
FIREBASE_PROJECT_ID=cotizapp-d71c8 npm run emails:configure -- --firebase-cli-auth
```

Sin `--apply`, el script solo inspecciona la configuración y presenta los cambios propuestos. Para aplicar exige `CONFIRM_PROJECT_ID` idéntico a `FIREBASE_PROJECT_ID` y `EMAIL_TEMPLATE_BACKUP_PATH` apuntando a un archivo nuevo. El respaldo contiene únicamente las plantillas y el idioma, sin credenciales SMTP. Las modificaciones usan máscaras de campos específicas para preservar las demás opciones del proyecto.

Si Firebase bloquea algún campo, el script aplica los campos permitidos, verifica la lectura posterior, informa `status: partial` y termina con código 2. No declara éxito completo si el HTML no se conserva.

Validación local: 69 pruebas frontend y 49 backend aprobadas. Incluye idioma, normalización del destinatario, verificación solo para la cuenta autenticada, prevención de reenvíos a direcciones ya verificadas, escape de contenido y conservación de los enlaces de acción. Las cuatro previsualizaciones se comprobaron estructuralmente; no se pudo hacer revisión visual en navegador porque la sesión no tenía un navegador disponible.

Referencias: [campos de configuración de Identity Platform](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config) y [personalización de correos en Firebase](https://support.google.com/firebase/answer/7000714?hl=es).

## Cambio de marca a Findi · 7 de octubre de 2026

Las cuatro plantillas locales y sus previsualizaciones usan Findi y la paleta nueva. Se verificó en Firebase el remitente Findi en los cuatro tipos de correo. Firebase bloqueó la modificación del asunto y cuerpo mediante la API en los cuatro tipos; la actualización del diseño en producción requiere las opciones que permita la consola de Authentication o un servicio de envío personalizado. Los cuerpos locales `tmp/email-previews/*.firebase.html` conservan los tokens reales y están preparados para el editor. La configuración anterior se conserva en una copia privada, excluida del repositorio.
