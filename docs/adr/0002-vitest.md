# ADR-0002: Test runner — Vitest

- Estado: propuesto
- Fecha: 2026-11-18

**Decisión: usar Vitest para pruebas unitarias y de integración**; las pruebas E2E con Playwright se deciden en un ADR aparte.

**Contexto.** Hay lógica con reglas propias que hay que probar a fondo: la rotación semanal de variaciones, la validación de la salida de la IA y la sincronización. El proyecto usa TypeScript estricto y módulos ESM, y el desarrollador ya domina Playwright, así que lo que falta es un runner rápido para la capa de lógica.

**Decisión.** Vitest, con TypeScript y ESM funcionando sin transformadores adicionales y una API casi idéntica a la de Jest.

**Alternativas descartadas.**

- **Jest:** el más extendido y con mucha documentación. Se descarta porque Vitest ya funciona con TypeScript y ESM sin configuración adicional (verificado en el esqueleto, con 6 tests en el CI); no se evaluó a fondo la configuración actual de Jest.
- **`node:test` (runner nativo de Node):** cero dependencias, pero con menos herramientas de mocking, cobertura y modo watch listas para usar.

**Consecuencias.**

- Configuración mínima y ciclo de feedback rápido.
- Migrar a Jest, si hiciera falta, es sencillo por la API compatible.
- Ecosistema más joven: algún paquete de mocking asumirá Jest.
- Tendrás dos runners (Vitest y Playwright), cada uno con su propósito.
- Vitest transpila sin comprobar tipos: los errores de tipos los detecta `pnpm typecheck` en el CI, no los tests.

**Qué me haría cambiar de opinión.**

- La suite supera 60 segundos en el CI, o un test intermitente se atribuye al runner (umbral inicial).
- Heredas o integras código que ya depende de Jest.
- Necesitas una función que solo ofrece Jest.

**Verificación.**

Hecha el 2026-11-23: `vitest run` ejecuta 6 tests en TypeScript y ESM, en local y en el CI (Node 24), sin configuración adicional y en cerca de 1,2 s.

Pendiente (fase 3): los tests de la función de rotación semanal, escritos primero en rojo. Éxito: `vitest run` termina en menos de 10 s con 30 tests unitarios, y el CI publica el reporte de cobertura (umbral inicial a decidir).
