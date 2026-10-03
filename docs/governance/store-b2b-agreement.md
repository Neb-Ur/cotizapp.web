# Contrato B2B con ferreterías

## Alcance implementado

El contrato comercial es independiente de los términos generales y se exige a cada ferretería antes de crear, actualizar o publicar datos de catálogo. La versión canónica y sus cláusulas están en `functions/src/lib/legal.ts`.

La aceptación registra:

- versión, fecha efectiva y huella SHA-256 del documento;
- identidad de CotizApp y de la ferretería;
- sucursal y domicilio informados;
- nombre, RUT, cargo y correo del firmante;
- declaración de facultades de representación;
- compromiso específico sobre exactitud de precio, IVA y stock;
- fecha y hora, cuenta autenticada, agente de usuario e IP transformada mediante hash con sal.

Una suspensión o término administrativo despublica las ofertas de la ferretería. Una nueva versión del contrato requiere una nueva aceptación porque el control compara versión y huella.

## Variables que deben reemplazarse antes de producción

Configurar en el entorno de Functions:

| Variable | Contenido |
|---|---|
| `COTIZAPP_LEGAL_NAME` | razón social constituida |
| `COTIZAPP_TAX_ID` | RUT real de la sociedad |
| `COTIZAPP_LEGAL_ADDRESS` | domicilio legal |
| `COTIZAPP_LEGAL_REPRESENTATIVE` | representante legal vigente |
| `COTIZAPP_LEGAL_EMAIL` | correo contractual monitoreado |
| `AGREEMENT_EVIDENCE_SALT` | secreto aleatorio exclusivo del ambiente |

No desplegar producción con `AGREEMENT_EVIDENCE_SALT=replace-in-production` ni con la identidad legal mock.

## Operación

1. Una ferretería sin contrato vigente es dirigida a `/cuenta/contrato-ferreteria`.
2. El backend rechaza escrituras de catálogo con HTTP 428 y código `STORE_AGREEMENT_REQUIRED`, incluso si se evita el guard del frontend.
3. El administrador puede consultar `GET /admin/store-agreements`.
4. El administrador puede suspender o terminar mediante `PATCH /admin/store-agreements/:id`, indicando estado y motivo. La operación despublica todas las ofertas relacionadas y queda en la bitácora administrativa existente.
5. Al eliminar la cuenta se terminan y minimizan los contratos; no se conserva RUT/nombre del firmante ni evidencia técnica. El remanente mercantil se marca con fecha de eliminación esperada a cinco años, sujeto a revisión jurídica y `legalHold`.

## Pendientes organizacionales

- Validación final del texto por abogado chileno con los datos reales y el modelo comercial definitivo.
- Definir correo y procedimiento de notificación de suspensión, reclamos y término.
- Confirmar el plazo de conservación según prescripción, obligaciones tributarias y riesgo contractual aplicables al negocio real.
- Si se necesita mayor fuerza probatoria, integrar firma electrónica avanzada o un proveedor de firma con sellado de tiempo.
