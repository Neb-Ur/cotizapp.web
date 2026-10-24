# Conectar Search Console con Codex

El MCP `trovio-search-console` ya está registrado y habilitado en la configuración global de Codex. La instalación local vive en `/Users/rabenavidess/.codex/mcp/google-search-console/`, fuera del repositorio y del sitio web.

Se instaló `@ni-c/google-search-console-mcp@0.3.0` con versiones bloqueadas por `package-lock.json`, sin scripts de instalación. El lanzador expone exclusivamente siete herramientas de lectura: `list_sites`, `get_site`, `list_sitemaps`, `get_sitemap`, `query_search_analytics`, `inspect_url` e `inspect_urls`. Permite únicamente `sc-domain:trovio.cl` y `https://trovio.cl/`. No expone envíos de sitemaps, borrados, verificación de propiedad ni la Indexing API.

## Pasos manuales en Google

1. Con la cuenta que administra el proyecto de Trovio, abre [Google Search Console API](https://console.cloud.google.com/apis/library/searchconsole.googleapis.com?project=cotizapp-d71c8) y pulsa **Habilitar** si aún no lo está.
2. Abre [Clientes de Google Auth Platform](https://console.cloud.google.com/auth/clients?project=cotizapp-d71c8). Crea un cliente OAuth de tipo **Aplicación de escritorio**, llamado `Codex Search Console local`. Descarga su JSON en **Descargas**, conservando el nombre `client_secret…json` que entrega Google.
3. Si Google solicita configurar la plataforma de autorización, completa nombre y correo de contacto. Para una cuenta personal, el público es **Externo**. Si la aplicación está en pruebas, añade la cuenta que tiene acceso a Search Console como usuario de prueba en [Público](https://console.cloud.google.com/auth/audience?project=cotizapp-d71c8). Si ya hay configuración OAuth para Trovio, reutilízala sin sustituirla. El único permiso solicitado por el comando es `https://www.googleapis.com/auth/webmasters.readonly`.
4. Ejecuta en Terminal:

   ```sh
   /Users/rabenavidess/.codex/mcp/google-search-console/autorizar.command
   ```

   Se abrirá Google. Elige la cuenta con acceso a la propiedad de Trovio y concede la lectura de Search Console. No necesitas pegar contraseñas, códigos ni tokens en el chat. El comando tiene una espera máxima de diez minutos y confirma la propiedad antes de guardar credenciales.
5. Reinicia Codex o la extensión y abre una conversación nueva para que cargue el servidor. Pide: «Usa trovio-search-console para listar mi propiedad y revisar la portada y /productos/tapon-sanitario».

El comando busca automáticamente el JSON más reciente de un cliente de escritorio del proyecto `cotizapp-d71c8` en Descargas. También se puede proporcionar una ruta explícita:

```sh
/Users/rabenavidess/.codex/mcp/google-search-console/autorizar.command '/ruta/al/cliente.json'
```

## Estado y comprobaciones

El arranque MCP, la lista exacta de herramientas, sus anotaciones de solo lectura y el rechazo de propiedades ajenas ya se comprobaron localmente. La consulta autenticada a Google queda pendiente de los pasos anteriores. No se modificó la sesión ni el proyecto activo de gcloud.

Tras autorizar, este comando comprueba también la conexión real:

```sh
/Users/rabenavidess/.nvm/versions/node/v22.18.0/bin/node /Users/rabenavidess/.codex/mcp/google-search-console/verify.mjs --live
```

Los archivos `client.json` y `credentials.json` se guardan con permisos `0600` dentro de una carpeta `0700`. La autorización usa PKCE, un estado aleatorio y callback HTTP limitado a `127.0.0.1`. No utiliza ni sobrescribe las credenciales predeterminadas de gcloud. Los tokens permiten lectura de las propiedades de esa cuenta; el lanzador restringe las operaciones a las dos propiedades de Trovio. No subir esos archivos a Git ni compartirlos por chat.

La inspección informa del último estado conocido por Google, no prueba la página en vivo ni solicita indexación. Las inspecciones por lotes consumen una llamada de Google por URL. Los informes periódicos requieren ejecutar una tarea por separado; la instalación del MCP no activa ningún proceso de auditoría automática.

## Referencias

- [MCP en Codex](https://learn.chatgpt.com/docs/extend/mcp)
- [Servidor instalado y configuración de solo lectura](https://github.com/ni-c/google-search-console-mcp)
- [OAuth para aplicaciones de escritorio](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Permisos de Search Console](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing)
