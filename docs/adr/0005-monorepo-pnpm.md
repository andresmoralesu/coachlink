# ADR-0005: Monorepo con pnpm workspaces

- Estado: propuesto
- Fecha: 2026-11-18

**Decisión: un solo repositorio con tres paquetes (`api`, `web` y `contracts`), gestionado con pnpm workspaces.**

**Contexto.** El proyecto tiene una API, un cliente web y un paquete de contratos compartidos con los esquemas y tipos que ambos usan. El mismo esquema que valida las peticiones en Fastify (ADR-0001) sirve para validar la salida de la IA y para que cliente y servidor coincidan en lo que se sincroniza. Es un solo desarrollador, así que coordinar versiones entre repos separados costaría más de lo que aporta.

**Decisión.** Monorepo con pnpm workspaces. La decisión de fondo es el monorepo; pnpm es la herramienta que lo implementa.

**Alternativas descartadas.**

- **npm workspaces:** ya lo conoces, pero instala más lento y es más permisivo con dependencias no declaradas, que se pueden importar sin estar en el `package.json` del paquete.
- **Yarn:** misma categoría que npm y pnpm; no se evaluó a fondo porque pnpm ya cubría el aislamiento de dependencias.
- **Varios repositorios:** obliga a publicar y versionar `contracts` entre repos; con un solo desarrollador es fricción sin beneficio.

**Consecuencias.**

- Instalaciones rápidas y error inmediato si importas algo que no declaraste.
- Un cambio en `contracts` se ve en `api` y `web` dentro del mismo PR.
- pnpm es menos común que npm en algunos equipos.
- La API se despliega con Docker (ADR-0004): el contexto de build debe ser la raíz del repo para poder copiar `contracts` junto a `api`.

**Qué me haría cambiar de opinión.**

- Construir la imagen de `api` desde la raíz tarda más de 5 minutos en el CI o la imagen pesa más de 500 MB sin poder reducirla.
- El CI supera los 5 minutos por tareas repetidas entre paquetes: se evalúa Turborepo o Nx (con tres paquetes, `pnpm -r` basta).
- `web` y `api` necesitan ciclos de release independientes.

**Verificación.**

Hecha el 2026-11-23:

- Cambiar un campo en `contracts` rompe el typecheck de `api` (probado en local con un campo `uptime` obligatorio).
- Importar `fastify` desde `contracts`, que no lo declara, falla con `TS2307` en `pnpm typecheck`.

Pendiente:

- Fase 0: `docker build` desde la raíz produce la imagen de `api` y arranca (criterio C4 de la spec 001).
- Cuando exista `web`: el mismo cambio de contrato rompe también su typecheck en el CI.