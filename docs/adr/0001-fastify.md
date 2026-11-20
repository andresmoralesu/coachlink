# ADR-0001: Framework HTTP — Fastify

- Estado: propuesto
- Fecha: 2026-11-18

**Decisión: usar Fastify sobre Node + TypeScript strict** (con `noUncheckedIndexedAccess` activado), usando los esquemas como fuente única de validación y de tipos.

**Contexto.** La API necesita validar entradas y, sobre todo, la salida de la IA, que no es confiable y debe pasar por un esquema antes de guardarse. También necesita tipado de punta a punta y logs estructurados para depurar la sincronización offline. El desarrollador es uno solo y quiere dominar los fundamentos (ciclo de petición, plugins, hooks) antes que apoyarse en abstracciones.

**Decisión.** Fastify con validación por esquema (TypeBox o Zod, a decidir en un ADR menor) y logs con pino, que viene incluido. `noUncheckedIndexedAccess` hace que `arr[i]` sea `T | undefined`, lo que obliga a manejar listas vacías de ejercicios. Runtime: la versión LTS vigente de Node; por verificar, porque según mi información Node 22 deja de recibir soporte en abril de 2027 y conviene comparar con la LTS activa antes de fijarla.

**Alternativas descartadas.**

- **Express:** ecosistema enorme, pero sin validación ni tipado nativos. Habría que ensamblar framework, validador y logger, y ese trabajo no aporta al dominio.
- **NestJS:** modelo de módulos e inyección de dependencias, muy demandado en empresas. Se descarta _por ahora_, y no por una falla técnica: añade capas (decoradores, DI) a un proyecto de un solo desarrollador que primero quiere entender lo que hay debajo.

**Consecuencias.**

- Esquema único para validar y tipar, y logs estructurados sin dependencias extra.
- Ecosistema menor que Express: algún plugin tendrás que escribirlo tú.
- Fastify no impone estructura de carpetas; hará falta un ADR corto de organización por plugins.
- Queda pendiente aprender NestJS, que pesa en el mercado laboral.

**Qué me haría cambiar de opinión.**

- Las ofertas a las que apuntas piden NestJS de forma repetida: lo aprendería en un proyecto aparte o migraría la capa HTTP.
- En el spike, los tipos del handler no se derivan del esquema y toca duplicarlos a mano.
- Un plugin crítico (auth, rate limiting) no tiene mantenimiento activo.

**Verificación.** Construir `GET /health` y `POST /workouts` con validación por esquema, un test en Vitest y CI en verde con `strict` activado. Éxito: un body inválido devuelve 400 con el error del esquema, sin código de validación escrito a mano, y el tipo del handler sale del esquema sin usar `as`.
