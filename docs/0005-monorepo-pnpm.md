# ADR-0005: Monorepo con pnpm workspaces

- Estado: propuesto
- Fecha: 2026-11-18

**Decisión: un solo repositorio con tres paquetes (`api`, `web` y `contracts`), gestionado con pnpm workspaces.**

**Contexto.** El proyecto tiene una API, un cliente web y un paquete de contratos compartidos con los esquemas y tipos que ambos usan. El mismo esquema que valida las peticiones en Fastify (ADR-0001) sirve para validar la salida de la IA y para que cliente y servidor coincidan en lo que se sincroniza. Es un solo desarrollador, así que coordinar versiones entre repos separados costaría más de lo que aporta.

**Decisión.** Monorepo con pnpm workspaces. La decisión de fondo es el monorepo; pnpm es la herramienta que lo implementa.

**Alternativas descartadas.**

- **npm workspaces:** ya lo conoces, pero instala más lento y es más permisivo con dependencias no declaradas, que se pueden importar sin estar en el `package.json` del paquete.
- **Yarn:** sin ventaja clara para este caso.
- **Varios repositorios:** obliga a publicar y versionar `contracts` entre repos; con un solo desarrollador es fricción sin beneficio.

**Consecuencias.**

- Instalaciones rápidas y error inmediato si importas algo que no declaraste.
- Un cambio en `contracts` se ve en `api` y `web` dentro del mismo PR.
- pnpm es menos común que npm en algunos equipos.
- Desplegar la API desde un monorepo en Render exige indicar el directorio y el comando de build; compruébalo en su documentación.

**Qué me haría cambiar de opinión.**

- Render (o el hosting elegido) no soporta pnpm bien.
- `web` y `api` necesitan ciclos de release independientes.

**Verificación.** Que `api` importe un tipo desde `contracts`. Éxito: cambiar un campo en `contracts` rompe el chequeo de tipos de `api` y `web` en CI, importar una dependencia no declarada falla, y Render construye `api` con pnpm desde la raíz del repo.
