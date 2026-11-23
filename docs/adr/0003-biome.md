# ADR-0003: Lint y formato — Biome

- Estado: propuesto
- Fecha: 2026-11-18

**Decisión: usar Biome como única herramienta de lint y formato**, con un solo archivo `biome.json`.

**Contexto.** Un solo desarrollador, CI en GitHub Actions y ningún motivo para mantener tres paquetes de configuración. La preocupación técnica real es el backend asíncrono: una promesa sin `await` en un handler falla en silencio, así que el linter debe poder detectarlo.

**Decisión.** Biome para lint y formato en un solo comando, ejecutado en local y en CI.

**Alternativas descartadas.**

- **ESLint + Prettier + typescript-eslint:** más reglas, reglas basadas en tipos muy maduras y es lo que encontrarás en la mayoría de equipos. Se descarta por el coste de configuración (tres piezas que pueden entrar en conflicto) en un proyecto de una persona.

**Consecuencias.**

- Un binario, un archivo de configuración y ejecución rápida en CI.
- Menos reglas y plugins que ESLint.
- Las reglas que dependen de tipos pueden ser más limitadas; verifica el estado actual en la documentación de Biome.
- Pierdes práctica con ESLint, habitual en equipos reales.

**Qué me haría cambiar de opinión.**

- Biome no detecta promesas sin `await` (o la regla sigue inestable) en tus casos reales.
- Necesitas un plugin que solo existe para ESLint.

**Verificación.** Introducir a propósito una promesa sin `await` en un handler. Éxito: el CI rechaza el cambio por esa regla, y `biome check` sobre el repo termina en menos de 2 s en local.

Verificado el 2026-11-23: una llamada a una función `async` sin `await` en el handler de `/health` hace fallar `pnpm lint` y el check `verify` del PR por `lint/nursery/noFloatingPromises`; `biome check` revisa 19 archivos en unos 230 ms. Como la regla está en `nursery`, repite este ejercicio cada vez que subas la versión de Biome.

Actualización 2026-11-23: `docs/` queda fuera de Biome porque el formateo de tablas Markdown ensancha las líneas y ensucia el historial.