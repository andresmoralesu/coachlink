import type { HealthResponse } from "@coachlink/contracts";
import type { FastifyPluginAsync } from "fastify";

/**
 * Liveness: responde si el proceso está vivo. NO consulta la base de datos
 * a propósito (ADR-0004): Render lo llama muy seguido y mantendría despierto
 * a Neon. La comprobación de dependencias irá en /ready.
 */
export const healthRoutes: FastifyPluginAsync<{ version: string }> = async (app, options) => {
  async function ping(): Promise<void> {}
  app.get("/health", async () => {
    // Tipado con el contrato: si cambia el esquema en contracts, esto deja de compilar.
    const body: HealthResponse = { status: "ok", version: options.version };
    ping();
    return body;
  });
};
