# ADR-0001: Framework HTTP — Fastify

- Estado: propuesto
- Fecha: 2026-11-18

**Decisión: usar Fastify sobre Node + TypeScript strict** (con `noUncheckedIndexedAccess` activado), usando los esquemas como fuente única de validación y de tipos.

**Contexto.** La API necesita validar entradas y, sobre todo, la salida de la IA, que no es confiable y debe pasar por un esquema antes de guardarse. También necesita tipado de punta a punta y logs estructurados para depurar la sincronización offline. El desarrollador es uno solo y quiere dominar los fundamentos (ciclo de petición, plugins, hooks) antes que apoyarse en abstracciones.

**Decisión.** Fastify con validación por esquema con Zod, decidido al construir el esqueleto, con los esquemas en `packages/contracts` (ADR-0005), y logs con pino, que viene incluido. `noUncheckedIndexedAccess` hace que `arr[i]` sea `T | undefined`, lo que obliga a manejar listas vacías de ejercicios. Runtime: Node 24, fijado en `engines`, `@types/node` y el CI. Se descartó Node 22 porque ya está en Maintenance LTS y su fin de vida es el 30 de abril de 2027; Node 26 entra en LTS en octubre de 2026 y se reevaluará en 2027, cuando tenga más historial. Verificado el 2026-11-23: estado en [nodejs.org](https://nodejs.org/en/about/previous-releases) y fechas de fin de vida en [NodeSource](https://nodesource.com/blog/nodejs-versions-lts-eol-outdated-release-risks), una fuente secundaria, así que confirma las fechas en el calendario oficial antes de aceptar el ADR.

**Alternativas descartadas.**

- **Express:** ecosistema enorme, pero sin validación ni tipado nativos. Habría que ensamblar framework, validador y logger, y ese trabajo no aporta al dominio.
- **NestJS:** modelo de módulos e inyección de dependencias, muy demandado en empresas. Se descarta _por ahora_, y no por una falla técnica: añade capas (decoradores, DI) a un proyecto de un solo desarrollador que primero quiere entender lo que hay debajo.

**Consecuencias.**

- Esquema único para validar y tipar, y logs estructurados sin dependencias extra.
- Ecosistema menor que Express: algún plugin tendrás que escribirlo tú.
- Fastify no impone estructura de carpetas; hará falta un ADR corto de organización por plugins.
- Queda pendiente aprender NestJS, que pesa en el mercado laboral.
- Fastify valida de forma nativa con JSON Schema; con Zod hace falta un type provider de terceros. Antes de usarlo en la primera ruta con validación, comprueba que su versión es compatible con Fastify 5 y Zod 4.

**Qué me haría cambiar de opinión.**

- Al revisar 10 ofertas objetivo de backend o full-stack en Node, 5 o más piden NestJS: lo aprendería en un proyecto aparte, sin migrar este.
- En el spike, los tipos del handler no se derivan del esquema y toca duplicarlos a mano.
- Un plugin crítico (auth, rate limiting) no tiene mantenimiento activo.

**Verificación.**

Hecha el 2026-11-23: `GET /health` responde con un cuerpo tipado por el contrato de `packages/contracts`, y cambiar el contrato rompe la compilación de la API.

Pendiente:

- Fases 1 y 2: `POST /workouts` con validación por esquema. Éxito: un body inválido devuelve 400 con el error del esquema, sin código de validación escrito a mano, y el tipo del handler sale del esquema sin `as`.
- Comprobar la compatibilidad del type provider de Zod (ver consecuencias).
