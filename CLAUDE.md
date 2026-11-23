# coachlink

Plataforma de entrenadores y clientes para registrar entrenamientos, offline-first. La IA propone variaciones semanales como borrador que solo ve el entrenador; él las aprueba y publica.

## Comandos

- `pnpm install`: instala dependencias (Node 24, pnpm 10.28).
- `pnpm dev`: levanta la API en local.
- `pnpm check`: typecheck, lint y tests. Ejecútalo siempre antes de `git push`.

## Reglas del repositorio

- `main` está protegida: todo cambio va por PR con `verify` en verde y squash merge. Nunca push directo.
- Ramas `tipo/descripcion` (`feat/`, `fix/`, `docs/`, `chore/`, `test/`); commits convencionales en español.
- El CI no usa filtros de rutas (ADR-0004 y ADR-0005): un check omitido cuenta como pasado.
- `docs/` está fuera de Biome. Los archivos van con saltos de línea LF y sin BOM.

## Arquitectura

- Los tipos compartidos viven solo en `packages/contracts`; la API los usa para tipar sus respuestas.
- `buildApp` no escucha en un puerto; los tests usan `app.inject`.
- `/health` no consulta la base de datos, para que Neon pueda escalar a cero; `/ready` sí (ADR-0004).
- La configuración se valida con Zod en `config.ts` y falla al arrancar si es inválida.
- Vocabulario: módulos de dominio, casos de uso y adaptadores.
- Privacidad: ningún dato personal va al LLM, y los borradores de IA nunca se devuelven a los clientes.

## Documentación

- Decisión técnica nueva: un ADR en `docs/adr/`. Los ADR aceptados no se editan; se añade uno nuevo que los reemplace.
- Trabajo nuevo con criterios de éxito: una spec en `docs/specs/`, a partir de `_plantilla.md`.
- Precios, límites y versiones se verifican con su fuente y se anotan con fecha; no se escriben de memoria.

## Idioma

Identificadores de código en inglés; documentación, commits y mensajes de error en español.
