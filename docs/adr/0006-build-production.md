# ADR-0006: Build de producción: compilar con tsc a JavaScript

- **Estado:** propuesto
- **Fecha:** 2026-11-24

## Contexto

La spec 001 despliega el esqueleto en Render con un `Dockerfile`. Hoy la API se ejecuta con `tsx` (`start: tsx src/server.ts`) y el paquete `contracts` exporta TypeScript directamente (`exports: ./src/index.ts`). Eso funciona en desarrollo, pero obliga a que la imagen de producción instale `devDependencies` y compile al vuelo cada arranque.

Se midió una línea base construyendo la imagen con `tsx` (Docker Desktop 4.100.1 sobre WSL2, caché caliente, `node:24-slim`, pnpm 10.28.0):

| Medida | Línea base `tsx` | Piso `node:24-slim` |
|---|---|---|
| Imagen en disco (DISK USAGE) | 850 MB | 333 MB |
| Imagen comprimida (CONTENT SIZE) | 211 MB | 83.7 MB |
| `docker run` hasta que `/health` responde (mediana de 3) | 1469 ms (2313, 1408, 1469) | n/a |

Son medidas locales. En Render serán distintas, por eso las comparaciones de este ADR son relativas y se repiten en la misma máquina.

## Decisión

Se compila con `tsc` a JavaScript ESM y en producción se ejecuta con `node`, sin `tsx`.

- `module` y `moduleResolution` pasan a `NodeNext` tanto para el build como para el typecheck. Los imports relativos llevan extensión `.js`.
- `contracts` declara `exports` con la condición `types` apuntando a `src` y `default` apuntando a `dist`, y publica solo `dist` (`files: ["dist"]`). `api` también usa `files: ["dist"]`.
- Las dependencias de runtime van en `dependencies`. `tsx` queda solo en `devDependencies`.
- `start` pasa a `node --enable-source-maps dist/server.js`. El build es `pnpm -r build`.
- La imagen se arma con `pnpm deploy --filter @coachlink/api --prod`. En pnpm 10 esto requiere `inject-workspace-packages=true` (o `--legacy`); se comprueba que `dist` de `contracts` entra en el paquete desplegado.
- Cómo resuelve `dev` los contratos (condición `development` o build en modo watch) se decide al implementar, dentro del límite de tiempo de abajo.

Imagen base: `node:24-slim`, la misma versión mayor que el CI (ADR-0001).

## Alternativas consideradas

- **Seguir con `tsx` en producción.** Es la línea base medida. Es lo más simple, pero arrastra `devDependencies` y compilación al arrancar.
- **Empaquetar con un bundler (esbuild/tsup).** Reduce más la imagen y evita los `.js` en los imports, pero añade una herramienta y una configuración más, y los errores quedan menos cerca de lo que `tsc` ya valida. Es el plan de respaldo.
- **Ejecutar TypeScript directamente con type stripping de Node.** Descartada por ahora: es reciente, no se evaluó en workspaces y no cubre todas las construcciones de TypeScript.
- **Compilar a CommonJS.** Descartada: el proyecto es ESM (`"type": "module"`) y mantener un solo sistema de módulos evita mezclar formatos.

## Consecuencias

**Positivas:** la imagen de producción no incluye `tsx` ni las herramientas de desarrollo, el arranque no compila y el código que se ejecuta es el que `tsc` verificó.

**Negativas:** hay un paso de build; todos los imports relativos llevan `.js`; el flujo de desarrollo con `contracts` es más delicado; sin bundler, `node_modules` sigue en la imagen.

**Límite de tiempo:** si resolver `contracts`, `exports` y el flujo de `dev` supera 3 horas de trabajo, se abandona B y se adopta el bundler, registrándolo en un ADR nuevo.

## Verificación

Cada punto se ejecuta tras implementar B y se compara con la línea base de arriba:

1. `pnpm -r build` termina sin errores y existen `apps/api/dist/server.js` y `packages/contracts/dist/index.js` (`test -f` sobre ambos).
2. `pnpm typecheck` pasa con `NodeNext`.
3. Tamaño: medido como DISK USAGE de `docker images coachlink-api:prod`, la imagen pesa menos que 850 MB. Si no, se reevalúa B.
4. Arranque: `docker run` hasta `/health` con mediana de 3 corridas ≤ 2469 ms (línea base + 1 s) y ≤ 5 s. Si no, se reevalúa B.
5. La imagen no contiene `tsx`: `docker run --rm --entrypoint sh coachlink-api:prod -c 'test ! -e /app/node_modules/.bin/tsx'` (ajustar la ruta al diseño final).
6. Source maps: un error provocado a propósito muestra en el stack trace rutas `.ts`.
7. CI: un paso del workflow construye la imagen, la levanta y comprueba que `/health` responde; el CI falla si no.

## Seguimiento

- ADR-0005: añadir la frase sobre cómo se copian los `contracts` a la imagen, cuando se defina el método.
- Criterio C4 de la spec 001 queda cubierto por los puntos 3, 4 y 7.