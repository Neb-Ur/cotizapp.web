# Equipo de calidad de Trovio

Los perfiles reutilizables viven en `.codex/agents/*.toml`. Se pueden solicitar por nombre a Codex. Su configuración sigue la [documentación oficial de subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents). No fijan modelo ni amplían permisos; heredan los de la sesión. La concurrencia depende del entorno: crear nueve perfiles no significa ejecutar nueve procesos simultáneos.

| Agente | Responsabilidad |
| --- | --- |
| `orquestador` | Divide tareas, asigna archivos, integra resultados y coordina entrega. |
| `qa_usuario` | Invitado/maestro: catálogo, cotizaciones, proyectos y presupuestos. |
| `qa_admin` | Usuarios, activaciones, catálogo maestro, taxonomía y solicitudes. |
| `qa_ferreteria` | Onboarding, ofertas, importación, fotos y operación de tienda. |
| `seguridad` | Auth, roles, propiedad, privacidad, entradas y dependencias. |
| `backend_datos` | API, dominio, cachés e integridad Firestore/PostgreSQL. |
| `frontend_integracion` | Rutas, sesión, formularios, errores, SSR y navegador. |
| `revisor` | Revisión independiente del diff integrado. |
| `release` | Preflight, configuración, CI/CD y verificación de producción. |

## Cómo pedir una revisión

> Usa orquestador y los agentes del proyecto para revisar [alcance]. Reproduce bugs con fixtures locales, corrige los confirmados, revisa el diff y completa validaciones, commit, push y despliegue conforme AGENTS.md. Reporta cobertura y bloqueos.

El orquestador distribuye primero los perfiles de negocio y después las revisiones transversales, en tandas según los slots disponibles. Un mismo agente activo puede recibir otra especialidad al finalizar su primera tarea. Cada archivo tiene un responsable durante la edición. Instalaciones, builds compartidos y suites completas se centralizan. No se crean agentes sin una tarea concreta.

## Evidencia exigida

Cada hallazgo debe incluir identificador, perfil, severidad, pasos/datos de reproducción, resultado esperado y observado, archivos afectados, corrección y validación. El cierre distingue pruebas automatizadas, inspección de código y pruebas reales de navegador. Una suite verde no demuestra que se probó cada interacción.

Las cuentas, ofertas y cotizaciones de prueba se crean únicamente en fixtures o entornos locales aislados. En producción se usan lecturas y solicitudes rechazadas sin efectos. No se guardan secretos ni datos personales en reportes o commits. Las migraciones históricas permanecen intactas.

## Criterio de entrega

1. Reproducir y corregir los fallos confirmados del alcance.
2. Ejecutar regresiones focalizadas y `npm run preflight:production`.
3. Revisar el diff, las dependencias de producción y cualquier riesgo pendiente.
4. Hacer commit/push a `origin/main` y seguir el despliegue existente, evitando otro despliegue concurrente.
5. Verificar producción con `node scripts/smoke-production.mjs`, revisión activa y bundles de frontend.
6. Publicar un informe con resultados y limitaciones; nunca afirmar que no existen errores posibles.

Los agentes no son procesos permanentes: trabajan durante una ejecución de Codex. Estos archivos conservan sus instrucciones para próximas sesiones.
