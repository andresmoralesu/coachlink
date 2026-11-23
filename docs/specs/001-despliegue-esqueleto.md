# Spec 001: Despliegue del esqueleto (fase 0)

- Estado: borrador
- Fecha: 2026-11-23
- ADRs relacionados: ADR-0004 (hosting), ADR-0005 (monorepo)

## Problema y objetivo

El esqueleto de la API solo corre en local. Hasta que esté desplegado no sabemos si el hosting elegido en el ADR-0004 se comporta como dice. El objetivo es una API en producción (Render + Neon, plan gratuito) que solo se despliega si el CI pasa, que detecta despliegues rotos y a la que se puede volver atrás.

## Fuera de alcance

Dominio de negocio, autenticación, migraciones reales, cliente, dominio propio, métricas y logs avanzados (fase 5).

## Criterios de aceptación

| ID | Criterio (observable, sí o no) | Cómo se verifica |
| --- | --- | --- |
| C1 | `/health` responde 200 con `status: ok` y `version` igual al SHA desplegado, sin consultar la base | Test existente + `curl` a producción comparando con el SHA del commit |
| C2 | `/ready` responde 200 con la base alcanzable y 503 si no lo está | Test con base simulada que falla + prueba manual en producción |
| C3 | La app no arranca sin `DATABASE_URL` | Test unitario de la configuración |
| C4 | La imagen Docker construye y responde en `/health` en local | `docker build` + `docker run` + `curl` |
| C5 | Un commit con un test roto no se despliega | ADR-0004, prueba 2 |
| C6 | Una versión que falla al arrancar no reemplaza a la anterior | ADR-0004, prueba 3 |
| C7 | Con `DATABASE_URL` mala la versión queda en vivo y la prueba posterior falla y avisa | ADR-0004, prueba 4 |
| C8 | El rollback desde Render restaura la versión anterior en menos de 5 minutos | ADR-0004, prueba 5, con el tiempo anotado |
| C9 | La prueba posterior no se bloquea con Render ni da un falso verde | ADR-0004, prueba 6 |
| C10 | Tras 20 minutos sin tráfico, el tiempo de la primera respuesta queda medido y anotado; se anota también si el servicio se apagó | `curl` cronometrado + eventos del panel de Render |
| C11 | Costo $0 tras una semana en producción | Panel de facturación de Render y Neon |

## Diseño mínimo

PR → CI (`verify`) → Render despliega si pasa → un workflow aparte (`workflow_run`, solo en `main`) sondea `/health` hasta que `version` coincida con el SHA y luego llama a `/ready`. La URL de producción va como variable del repositorio. Los detalles y umbrales están en el ADR-0004.

## Riesgos y preguntas abiertas

- Posible bloqueo entre Render y el workflow aparte (se comprueba en C9).
- El plan gratuito podría no permitir el rollback (ADR-0004, prueba 5).
- Si los health checks mantienen despierto el servicio, cambian el diseño del cliente y el umbral de pasar a pago (se comprueba en C10).

## Registro de verificación

Pendiente.