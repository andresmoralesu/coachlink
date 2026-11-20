# ADR-0002: Test runner — Vitest

- Estado: propuesto
- Fecha: 2026-11-18

**Decisión: usar Vitest para pruebas unitarias y de integración**; las pruebas E2E con Playwright se deciden en un ADR aparte.

**Contexto.** Hay lógica con reglas propias que hay que probar a fondo: la rotación semanal de variaciones, la validación de la salida de la IA y la sincronización. El proyecto usa TypeScript estricto y módulos ESM, y el desarrollador ya domina Playwright, así que lo que falta es un runner rápido para la capa de lógica.

**Decisión.** Vitest, con TypeScript y ESM funcionando sin transformadores adicionales y una API casi idéntica a la de Jest.

**Alternativas descartadas.**

- **Jest:** el más extendido y con mucha documentación. Se descarta porque, según mi conocimiento, TypeScript y ESM requieren configuración extra; verifica el estado actual antes de aceptar este ADR.
- **`node:test` (runner nativo de Node):** cero dependencias, pero con menos herramientas de mocking, cobertura y modo watch listas para usar.

**Consecuencias.**

- Configuración mínima y ciclo de feedback rápido.
- Migrar a Jest, si hiciera falta, es sencillo por la API compatible.
- Ecosistema más joven: algún paquete de mocking asumirá Jest.
- Tendrás dos runners (Vitest y Playwright), cada uno con su propósito.

**Qué me haría cambiar de opinión.**

- Vitest resulta inestable o lento en CI con la suite real.
- Heredas o integras código que ya depende de Jest.
- Necesitas una función que solo ofrece Jest.

**Verificación.** Escribir primero, en rojo, los tests de la función de rotación semanal y luego hacerlos pasar. Éxito: `vitest run` termina en menos de 10 s en local con 30 tests unitarios, y CI publica el reporte de cobertura (umbral inicial a decidir).
