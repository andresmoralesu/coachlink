# ADR-0007: Acceso a datos y migraciones — Kysely sobre `pg`, migraciones al arrancar la API

- Estado: propuesto (la elección de Kysely sale del spike y está medida; ejecutar las migraciones al arrancar queda por verificar en la fase 1, ver "Verificación")
- Fecha: 2026-11-27
- Evidencia: `docs/spikes/0007-acceso-a-datos.md` (plan, criterios fijados antes de programar, resultados y conclusión) y las etiquetas `spike-pg`, `spike-kysely` y `spike-drizzle` del repositorio, que conservan el código de cada rama

**Decisión: la API habla con Postgres a través de Kysely, con `pg` como driver. Las migraciones son archivos TypeScript con SQL explícito (`sql` de Kysely), con `up` y `down`, registrados con un `import` estático y aplicados con el Migrator de Kysely. Se ejecutan al arrancar la API, antes de empezar a escuchar: si una migración falla, el proceso sale con error y Render conserva la versión anterior. En producción solo se avanza (nunca se ejecuta `down`); las migraciones son compatibles hacia atrás (expand/contract).**

**Contexto.** La sincronización offline-first es un problema de datos: dos dispositivos pueden modificar lo mismo, un reintento no debe duplicar una operación y lo que llega tarde debe ordenarse bien. Lo que se busca es ver y controlar esas consultas, no que una herramienta las esconda. Hay que elegir con qué se habla a Postgres, cómo se escriben las migraciones y dónde se ejecutan, sabiendo que el Pre-Deploy Command de Render es de pago (ADR-0004). Se hizo un spike con el mismo caso de prueba en tres opciones (tabla `workout_logs`, inserción idempotente y lectura de cambios por cursor), con criterios y regla de decisión fijados antes de programar.

**Resultados del spike (resumen; el detalle y las notas de medición están en el documento del spike).**

| Criterio | `pg` | Kysely | Drizzle |
| --- | --- | --- | --- |
| Líneas de código (nota de legibilidad) | 188 (4) | 128 (4) | 139 (4) |
| Seguridad de tipos | No | No según el criterio escrito (tipo `Database` manual); el builder sí detecta errores de escritura | Sí, también en el `sql` crudo |
| Migración | Cumple (runner propio de 42 líneas) | Cumple (Migrator incluido, `up` y `down`) | Parcial: sin `down`, reversa manual |
| Imagen y arranque | Base (358 MB) | +4 MB, arranque sin diferencia apreciable | +22 MB (no cumple), arranque sin diferencia apreciable |

**Desviación de la regla de decisión.** La regla fijada antes del spike ordenaba los criterios así: legibilidad, tipos, migraciones, y por último CI y peso. Aplicada al pie de la letra habría dado Drizzle: la legibilidad empata (las tres con nota 4) y en el criterio siguiente, tipos, solo Drizzle cumple. Se elige Kysely cambiando el orden de prioridades **después** de ver los resultados, poniendo las migraciones y el SQL directo y sin fricción por encima de la seguridad de tipos. Es una decisión consciente y no el resultado de aplicar la regla; si la regla se hubiera querido distinta, debió escribirse antes.

**Qué se acepta con Kysely.**

- El tipo `Database` se escribe a mano y puede desalinearse de la tabla real. Un renombre de columna en una migración no lo detecta el compilador, sino la prueba contra Postgres real (en el spike falló al ejecutar). Por eso las pruebas de integración contra un Postgres real no son opcionales: se ejecutan en CI con un contenedor.
- El `sql` crudo (por ejemplo, la condición del cursor) no se valida al compilar.
- `numeric` llega como texto desde `pg` (`weight_kg` se declara como `string` al leer); la conversión se decide en el contrato de la API.

**Reglas de datos que salen del spike.**

- **El cursor de sincronización es el par (`updated_at`, `id`)**, no solo `updated_at`: dos filas con la misma marca de tiempo no deben perderse.
- **El cursor viaja como texto de la base de datos (`updated_at::text`), nunca como `Date` de JavaScript.** Postgres guarda microsegundos y `Date` solo milisegundos: con un `Date` el cursor retrocede y la página siguiente repite filas. Ninguna de las tres herramientas lo resuelve sola con `timestamptz` en modo fecha.
- `updated_at` lo fija la base de datos, también en el borrado lógico (`UPDATE ... SET deleted_at = now(), updated_at = now()`), para que el borrado aparezca en los cambios siguientes.
- La inserción idempotente usa `ON CONFLICT (client_id, device_op_id) DO NOTHING` y devuelve la fila existente si no insertó.

**Dónde se ejecutan las migraciones: al arrancar la API.** Alternativas consideradas:

| Opción | Pro | Contra |
| --- | --- | --- |
| **Al arrancar (elegida)** | La fase 0 midió que un deploy que falla al arrancar no toca la versión en marcha, así que una migración rota se comporta como una variable de entorno que falta; no requiere secretos nuevos ni infraestructura | Suma tiempo al arranque; la versión anterior sigue sirviendo contra el esquema nuevo mientras migra (obliga a expand/contract); cada arranque en frío vuelve a comprobar las migraciones |
| Job en GitHub Actions | Separa migrar de arrancar | Requiere la cadena de conexión de producción como secreto de GitHub (la regla del proyecto es dejarla solo en `.env` y en Render) y compite con el deploy de Render, que arranca antes de que termine el CI (On Commit) |
| Manual desde la máquina del autor | Cero infraestructura | Se olvida; no deja rastro de quién migró qué |
| Pre-Deploy Command de Render | Es la forma pensada para esto | De pago (ADR-0004); se reevalúa si se pasa a un plan de pago |

**Alternativas descartadas.**

- **Prisma:** descartada de entrada, sin medirla, por el peso en la imagen y el poco control sobre las consultas de sincronización. No se probó en el spike; si se quisiera reabrir, habría que medirla.
- **Drizzle:** quedó mejor en tipos, pero sin comando de reversa, con +22 MB de imagen, con una versión 1.0 de cambios incompatibles (formato de la carpeta de migraciones, opción `casing` eliminada) todavía no estable en el momento del spike (la versión estable era la 0.45), y con fricción de herramientas: Biome rechaza los JSON que genera y su configuración queda fuera del `tsconfig` de la API. Se descartó por el cambio de prioridades descrito arriba y no por un fallo.
- **`pg` a secas:** válida y la más simple, pero con 188 líneas (runner propio incluido) y sin ninguna protección del compilador. Queda como plan de retirada si Kysely diera problemas.

**Consecuencias.**

- **Migraciones compatibles hacia atrás (expand/contract).** Mientras la versión nueva migra al arrancar, la anterior sigue sirviendo contra el esquema nuevo, y un rollback de código no revierte el esquema (ADR-0004). Una migración se divide en: añadir, migrar datos y desplegar el código que usa lo nuevo, y solo después quitar lo antiguo. Nunca se renombra ni se elimina una columna en el mismo despliegue que deja de usarla.
- **En producción solo se avanza.** El `down` existe para desarrollo y pruebas (el spike lo ejerció); un fallo en producción se corrige con una migración nueva. Antes de una migración riesgosa se toma el snapshot o el `pg_dump` indicado en ADR-0004.
- **Tiempo de arranque.** La migración se suma al arranque de la API. En la fase 0 se midió que Render acepta un arranque de 90 s sin tocar la versión anterior; el límite real de Render no se midió. Las migraciones deben ser rápidas (umbral inicial: menos de 30 s); una migración larga se hace en un paso aparte, fuera del arranque.
- **Cada arranque en frío despierta Neon** para comprobar las migraciones pendientes. Despierta en ~1 s (ADR-0004) y la API necesitaría la base en su primera petición de todos modos, pero suma ese segundo al arranque en frío de ~12.5 s.
- **El `/health` sigue sin consultar la base** (ADR-0004): migrar al arrancar ocurre antes de `listen`, no en el health check.
- **Las migraciones se registran con un `import` estático** y no leyendo la carpeta, para no depender de rutas del sistema de archivos ni de cargar `.ts` desde las pruebas. Cada migración nueva se añade a ese registro.
- **Ruta de importación:** en la versión del spike (Kysely 0.29.9), `Migrator` y `MigrationProvider` se importan de `kysely/migration`; los ejemplos antiguos usan la ruta vieja y el compilador la marca como obsoleta.
- **Deuda de `pg`:** la versión actual (8.23) avisa de que, en la v9, `sslmode=require` cambiará de significado. Antes de actualizar hay que fijar en la cadena de conexión `sslmode=verify-full` (o `uselibpqcompat=true&sslmode=require`).
- **Riesgo abierto, sin resolver aquí:** una fila confirmada tarde con un `updated_at` anterior al cursor de un cliente no aparecería en su siguiente lectura. Se anota para el diseño de la sincronización.

**Qué me haría cambiar de opinión.**

- Pasar a un generador de tipos desde la base (por ejemplo `kysely-codegen`) o a Drizzle: si el tipo `Database` se desalinea de la tabla real y las pruebas de integración no lo detectan al menos una vez, o si Drizzle publica una 1.0 estable con reversa de migraciones.
- Sacar las migraciones del arranque (Pre-Deploy de pago o un paso aparte): si un despliegue falla o se retrasa por una migración, si el arranque con migración supera los 30 s de forma repetida, o si hay más de una instancia de la API.
- Reabrir Prisma: solo si se midiera y el peso y el control de las consultas dejaran de ser un problema.

**Verificación (a cumplir en la fase 1, con la primera migración real; la spec de esa fase la concreta).**

1. Dos arranques simultáneos contra el mismo Postgres: una sola aplica la migración y la otra espera o la omite sin duplicar (se asume que el Migrator toma un bloqueo antes de migrar; está por verificar).
2. Una migración rota hecha a propósito: el proceso sale con error, Render conserva la versión anterior sirviendo y la prueba posterior agota su tiempo máximo y falla (mismo comportamiento que la variable ausente de la fase 0).
3. Pruebas de integración contra un contenedor de Postgres en el job `verify` de CI, con el tiempo que añaden anotado.
4. La prueba diferida de ADR-0004 (migración aditiva y rollback de la API a la versión anterior: la versión anterior funciona con el esquema nuevo).
5. Una migración de renombre en dos pasos (expand/contract) aplicada sin romper la versión anterior.
