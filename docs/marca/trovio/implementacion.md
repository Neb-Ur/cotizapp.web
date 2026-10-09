# Trovio · Logo y marca

Se implementó la propuesta 01 elegida: una T redondeada con lupa naranja. La paleta conserva azul `#0F2D4A`, naranja `#FF7A00`, gris claro `#F3F5F8`, gris de texto `#6B7280` y casi negro `#111827`.

## Archivos

- `src/assets/trovio-mark.svg`: icono de aplicación sobre cuadrado azul redondeado.
- `src/assets/trovio-logo.svg`: logo horizontal para fondo claro, con letras convertidas a trazados y punto de la i naranja.
- `src/assets/trovio-logo-dark.svg`: versión para fondo azul.
- `src/assets/trovio-icon-192.png` y `trovio-icon-512.png`: iconos PNG.
- `src/favicon.ico`: icono del navegador en 16, 32 y 48 píxeles.

El monograma y la lupa son geometría vectorial. Las letras del logo horizontal usan Manrope de peso 800, convertido a trazados. La licencia está en [Manrope-OFL.txt](Manrope-OFL.txt). Los SVG pueden usarse sin instalar fuentes ni herramientas de generación.

La exploración original, sus seis opciones y el prompt quedan conservados en [propuestas-logo-01.json](propuestas-logo-01.json).

## Aplicación

La marca se actualizó en cabecera, navegación móvil, pie, login y registro, paneles, ayudas, privacidad, metadatos SEO, PDF y mensajes de WhatsApp. El PDF dibuja el icono como vector y mantiene los códigos de verificación.

Los códigos nuevos usan `TRV-`; se siguen aceptando los anteriores `FND-`. Los nombres de las cuatro ferreterías ficticias se cambiaron a Trovio conservando IDs, productos y precios. Los documentos y códigos históricos conservan la identidad con la que fueron emitidos.

La URL pública sigue siendo `https://cotizapp-d71c8.web.app`. Los nombres técnicos del proyecto, esquema PostgreSQL, secretos R2, claves de sesión y contratos firmados se conservan para mantener la compatibilidad y su evidencia histórica. Los recursos anteriores del icono sirven la nueva T para enlaces existentes.

## Correos

Los contenidos y previews de la aplicación usan Trovio. Firebase aceptó y verificó `senderDisplayName: Trovio` en sus cuatro plantillas de autenticación. Su API bloqueó la modificación de los asuntos y cuerpos, por lo que estos campos conservaron sus plantillas protegidas con `%APP_NAME%`.

Las versiones HTML listas para el editor de Firebase están en [correos](correos/); no contienen direcciones ni enlaces de prueba en los archivos `.firebase.html`. La copia previa de configuración se guardó únicamente en `tmp/email-previews/trovio`, fuera de Git.

Firebase explica la sustitución de `%APP_NAME%` en su [documentación de autenticación](https://firebase.google.com/docs/auth/faq-and-troubleshooting).
