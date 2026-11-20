# ADR-0004: Hosting — Render (API) + Neon (Postgres), ambos en plan gratuito

- Estado: propuesto (pasa a aceptado cuando estén anotados los tiempos de la verificación de la fase 0)
- Fecha: 2026-11-20 (reemplaza la propuesta del 2026-11-18, que elegía Render de pago)
- Evidencia: sección "Evidencia" al final de este archivo (precios y límites con fecha; se actualiza sin tocar la decisión)

**Decisión: la API corre en un servicio web gratuito de Render (con Docker) y Postgres en el plan gratuito de Neon, con ambos en la misma región (Ohio o Virginia). El auto-deploy de Render se configura en "After CI Checks Pass", de modo que el CI manda sobre el hosting. Se pasa a un plan de pago cuando se cumpla uno de los umbrales de "qué me haría cambiar de opinión".**

**Contexto.** Proyecto personal sin ingresos: mientras se desarrolla, el costo debe ser lo más cercano a $0. La versión anterior de este ADR descartaba el plan gratuito con la premisa "la API no puede dormirse". Esa premisa era demasiado fuerte: el cliente es offline-first, guarda las operaciones en una cola local y sincroniza en segundo plano con reintentos, así que un arranque en frío es tolerable si el cliente se diseña para ello, y diseñarlo así es parte de lo que el proyecto quiere demostrar. Lo que sí hay que cuidar son los costos ocultos del plan gratuito, que están en las consecuencias. Los números de este ADR (15 minutos, 6 horas, 100 CU-hours, 1 GB, precios) salen de la sección Evidencia al final de este archivo, consultada el 2026-11-19 y el 2026-11-20; cambian seguido, así que reconfirma antes de aceptar.

**Decisión.** Render gratis para la API y Neon gratis para Postgres, con la API en Docker para mantener la portabilidad y las dos piezas en regiones equivalentes (Ohio con us-east-2, o Virginia con us-east-1; verifica el mapeo de Virginia).

**Despliegue: quién manda.** El auto-deploy de Render queda en After CI Checks Pass: despliega solo si pasan los checks de GitHub Actions, así que el CI manda. Dos cuidados: un commit sin checks no se despliega (es lo esperado), y como un check omitido cuenta como pasado, el workflow que ejecuta los tests no debe saltarse por filtros de rutas del monorepo (ADR-0005). La alternativa, el deploy hook desde Actions, da más control y fija el orden de forma explícita; se adopta si el orden de la prueba posterior al deploy resulta enredado (ver abajo).

**Prueba posterior al deploy: orden y carrera.** Con auto-deploy, quien despliega es Render después de que termina el CI, no Actions, así que la prueba no puede asumir el orden. El diseño es este:

1. `/health` devuelve un campo `version` con el SHA del commit (Render lo expone en `RENDER_GIT_COMMIT`) y no consulta la base de datos.
2. Un workflow aparte, disparado al terminar el CI en `main` (por ejemplo con `workflow_run`), sondea `/health` hasta que `version` coincida con el SHA del commit, con un tiempo máximo generoso (umbral inicial de 15 minutos, que cubre build, arranque y posible despertar del servicio gratuito).
3. Solo entonces llama a `/ready`, que sí consulta la base.
4. Si el tiempo máximo se agota, la versión nueva no llegó a producción (por ejemplo, porque falló su health check) y el workflow falla.

Sin el sondeo del paso 2, la prueba consultaría la versión anterior, que está sana, y daría un falso verde. Además hay un riesgo de bloqueo: si Render contara ese workflow entre los checks que espera, Render esperaría al workflow y el workflow esperaría a Render. No lo verifiqué; la prueba 6 de la fase 0 lo comprueba, y si resulta enredado ese es el motivo para pasar al deploy hook.

**Alternativas descartadas.**

- **Render de pago desde el primer día** (servicio Starter y Postgres Basic-256mb, unos $13 al mes según Render): evita el arranque en frío, pero cuesta antes de tener usuarios. Queda reservado para los umbrales.
- **Postgres gratuito de Render:** expira a los 30 días.
- **Deploy hook desde GitHub Actions desde el inicio:** más control, pero más piezas que mantener antes de necesitarlas.
- **Webhooks de Render (`deploy_ended`) para disparar la prueba:** existen, pero una fuente de terceros indica que exigen un plan de pago de Render; no lo verifiqué y el sondeo del paso 2 no los necesita.
- **Fly.io:** no tiene plan gratuito y su Postgres administrado empieza en $38 al mes; tiene región en São Paulo, igual que Neon, y sería el camino si la latencia desde Colombia llega a ser el problema.
- **Railway:** no la reevalué; sigue siendo una opción barata, con backups y recuperación por comprobar.

**Consecuencias.**

- Costo $0 de API y base de datos durante el desarrollo.
- La primera petición tras 15 min de inactividad tarda cerca de 1 minuto. El cliente debe tolerarlo: timeouts mayores a 90 s o un aviso de "despertar" al abrir la app, reintentos con backoff y la cola de operaciones intacta.
- **El health check de la API no debe consultar la base de datos.** Render lo llama cada pocos segundos; si tocara Neon, el cómputo nunca escalaría a cero y los 100 CU-hours se agotarían antes de fin de mes (con 0.25 CU serían unas 400 horas de las ~730 del mes; el tamaño mínimo de CU es un supuesto mío).
- **Ese diseño tiene un punto ciego:** un deploy con `DATABASE_URL` mala o con una migración rota responde 200 en `/health`, pasa el health check y sale a producción roto. La mitigación es la prueba posterior al deploy sobre `/ready` descrita arriba (poco frecuente, así que no mantiene despierta a Neon); si falla, GitHub te notifica y haces rollback.
- **El orden de esa prueba no es obvio:** necesita el sondeo por `version` para no dar un falso verde, y vivir en un workflow aparte para no bloquearse con Render. El bloqueo es una hipótesis sin verificar.
- **El rollback de código no revierte el esquema de la base.** Con datos reales, las migraciones deben ser compatibles hacia atrás (patrón expand/contract: añadir, migrar y solo después quitar). Es una dependencia del ADR de base de datos y ORM. Además, un rollback hecho desde el panel de Render desactiva el auto-deploy: hay que reactivarlo después.
- **Restauración limitada:** Neon gratis conserva 6 horas de historial y 1 snapshot manual. Una migración mala que descubras al día siguiente no se restaura con instant restore: toma el snapshot (o un `pg_dump`) antes de cada migración riesgosa.
- Una demo pública que tarda cerca de 1 minuto en responder da mala impresión a quien la revise: la pantalla inicial debe mostrar un estado de "despertando el servidor".
- Si se agota un límite mensual de Neon, el cómputo se suspende hasta el mes siguiente.
- El servicio gratuito de Render no admite dominio propio, y son dos proveedores: dos paneles y latencia entre ellos si las regiones no coinciden.

**Qué me haría cambiar de opinión.**

- Pasar la API a Render de pago (~$7 al mes): el día que compartas la URL de la demo en procesos de selección, o cuando midas más de 2 % de sincronizaciones fallidas en una semana atribuibles al arranque en frío (umbral inicial a ajustar). La medición sale del cliente: registra cada intento de sincronización con su resultado y motivo (timeout, 5xx, sin red) y lo envía en la siguiente sincronización exitosa, y la API lo agrega. Sin esa medición el umbral no es aplicable.
- Pasar Neon a pago ($0.106 por CU-hora y $0.35 por GB-mes): al acercarte a 100 CU-hours o a 1 GB en un mes, o cuando entren usuarios reales con datos de entrenamiento y 6 horas de restauración sean insuficientes (Launch llega a 7 días, con el historial a $0.20 por GB-mes).
- Mover la API a Fly.io: si la latencia medida desde Colombia es inaceptable.
- Cambiar al deploy hook desde Actions: si la prueba 6 muestra que el workflow aparte bloquea a Render, o si necesitas encadenar la prueba posterior al deploy con un rollback automático.

**Verificación (fase 0: esqueleto desplegado con rollback).**

1. Desplegar un `Dockerfile` en Render gratis con la base en Neon, con auto-deploy en After CI Checks Pass, un `/health` que devuelva `version` y no consulte la base, y un `/ready` que sí la consulte.
2. Probar la compuerta: empujar un commit con un test roto. Éxito: Render no despliega.
3. Publicar a propósito una versión rota (500 en `/health`). Éxito: el health check impide que salga, la versión anterior sigue sirviendo y la prueba posterior agota su tiempo máximo y falla.
4. Segundo escenario: una versión con `/health` en 200 pero `DATABASE_URL` inválida. Éxito: pasa el health check y queda en vivo (esto documenta el límite del mecanismo), y la prueba posterior sondea hasta que `version` coincide, llama a `/ready`, falla y GitHub te notifica.
5. Hacer rollback desde la página Events. Éxito: la versión anterior vuelve en menos de 5 minutos (umbral inicial), con el tiempo anotado aquí, y reactivas el auto-deploy. Si el plan gratuito no permite el rollback, paga un solo mes de Starter solo para esta prueba.
6. Comprobar que la prueba posterior no se bloquea ni da un falso verde. Éxito: con el workflow aparte, Render despliega mientras corre y no queda esperándolo; y con un commit de arranque lento, la prueba espera a que `version` coincida antes de llamar a `/ready`.

**Verificación diferida** (queda registrada y no bloquea la aceptación).

| Prueba | Fase | Requiere |
| --- | --- | --- |
| Migración aditiva (una columna nueva) y rollback de la API a la versión anterior; éxito: la versión anterior funciona con el esquema nuevo | Fase 1 | Migraciones reales |
| Arranque en frío tras 20 minutos sin tráfico; éxito: tiempo anotado y el cliente sincroniza sin perder operaciones | Fase 5 | Cliente con cola de sincronización |
| 24 horas con el health check activo; éxito: el cómputo de Neon consume menos de 3.3 CU-hours al día (100 entre 30) y los eventos de arranque y apagado del servicio en el panel de Render muestran si los health checks lo mantienen despierto (confirma que el panel registra el apagado) | Fase 5 | Operación con logs y métricas |
| Restauración de prueba en Neon: snapshot manual e instant restore a un punto de las últimas 6 horas; éxito: los datos vuelven al estado esperado, con el tiempo anotado | Fase 5 | Datos que restaurar |

## Evidencia

Consultado el 2026-11-19 y el 2026-11-20. Los precios y límites cambian en meses: esta sección se actualiza (con nueva fecha) sin tocar la decisión.

| Tema | Dato | Fuente |
| --- | --- | --- |
| Render, servicio web gratuito | Se apaga a los 15 min sin tráfico y tarda cerca de 1 min en arrancar; 750 horas gratis al mes por workspace | [Render](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses) |
| Render, Postgres gratuito | Expira a los 30 días y tiene 14 días de gracia antes de borrarse, por eso no se usa. Si incluye backups no lo verifiqué | [Render](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses) |
| Render, costo de pago | Un servicio Starter siempre activo más un Postgres Basic-256mb en workspace Hobby costaba unos $13 al mes. Starter ~$7 y Basic-256mb ~$6 vienen de fuentes secundarias | [Render](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses), [Kuberns (secundaria)](https://kuberns.com/blogs/render-pricing/) |
| Render, health checks | Los web services pueden usar health checks HTTP; si un deploy falla su health check, la versión anterior sigue sirviendo | [Render, health checks](https://render.com/docs/health-checks), [Render, uptime](https://render.com/docs/uptime-best-practices) |
| Render, auto-deploy | La opción After CI Checks Pass espera los checks del commit (detecta GitHub Actions) y no despliega si no hay ningún check o si alguno falla. Un check omitido (skipped) o neutral cuenta como pasado | [Render, deploys](https://render.com/docs/deploys) |
| Render, deploy hooks | Alternativa: desactivar el auto-deploy y disparar el despliegue desde GitHub Actions con una URL secreta | [Render, deploy hooks](https://render.com/docs/deploy-hooks) |
| Render, versión desplegada | La variable `RENDER_GIT_COMMIT` contiene el SHA del commit del servicio o deploy y está disponible en runtime | [Render, variables de entorno](https://render.com/docs/environment-variables) |
| Render, webhooks | Existe el evento `deploy_ended` con un campo `status` (succeeded, failed o canceled). Una fuente de terceros dice que crear webhooks exige ser admin y plan Professional o superior; no está verificado en la documentación oficial | [Render, webhooks](https://render.com/docs/webhooks), [Render, changelog](https://render.com/changelog/webhooks-for-completed-actions-now-include-the-actions-result), [Spike (terceros)](https://docs.spike.sh/integrations-guideline/integrate-spike-with-render) |
| Render, rollback | Se hace desde la página Events del servicio con el botón Rollback; hecho desde el panel desactiva el auto-deploy del servicio. Las páginas que revisé no mencionan restricciones para el plan gratuito, pero tampoco lo confirman | [Render, rollbacks](https://render.com/docs/rollbacks) |
| Neon, plan gratuito | Sin expiración y sin tarjeta; 1 GB de almacenamiento y 100 CU-hours de cómputo al mes por proyecto | [Neon](https://neon.com/faqs/free-plan-limits-and-quotas) |
| Neon, escala a cero | En el plan gratuito se suspende a los 5 min de inactividad y no se puede desactivar; despierta en unos cientos de milisegundos | [Neon, precios](https://neon.com/pricing), [Neon, guía](https://neon.com/guides/neon-vs-supabase-free-plan) |
| Neon, al agotar un límite | El cómputo se suspende hasta el siguiente mes. Esa página aún muestra 0.5 GB, una cifra antigua: confirma el límite actual en tu cuenta | [Neon](https://neon.com/2024-plan-updates) |
| Neon, restauración | Ventana de restauración de 6 horas en el plan gratuito (tope de 1 GB de historial) y 1 snapshot manual; el plan Launch llega a 7 días. Hay páginas antiguas con 1 día o 7 días | [Neon, ventana de historial](https://neon.com/docs/postgres/backup-restore/history-window), [Neon, snapshots](https://neon.com/faqs/postgres-tools-point-in-time-recovery) |
| Neon, plan de pago (Launch) | $0.106 por CU-hora y $0.35 por GB-mes; el historial de restauración cuesta $0.20 por GB-mes | [Neon, FAQ](https://neon.com/faqs/best-free-low-cost-managed-postgres-services), [Neon, ventana de historial](https://neon.com/docs/postgres/backup-restore/history-window) |
| Regiones | Render: Oregon, Ohio, Virginia, Frankfurt y Singapur. Neon incluye us-east-1 (Virginia), us-east-2 (Ohio) y también São Paulo | [Render, regiones](https://render.com/docs/regions), [Neon, regiones](https://neon.com/docs/introduction/regions) |
| Fly.io | Sin plan gratuito; Postgres administrado desde $38 al mes (incluye alta disponibilidad, backups y pooling); hay región en São Paulo | [Fly.io, precios](https://fly.io/pricing.md) |
