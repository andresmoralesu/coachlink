import type { ReadyResponse } from "@coachlink/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { Database } from "../database.js";

export interface ReadyRoutesOptions {
  database: Pick<Database, "ping">;
  timeoutMs: number;
}

/**
 * Readiness: comprueba que la base de datos responde. A diferencia de /health,
 * esta ruta SÍ la consulta (ADR-0004), por eso la usa el humo posterior al
 * despliegue y no Render de forma continua.
 */
export const readyRoutes: FastifyPluginAsync<ReadyRoutesOptions> = async (app, options) => {
  app.get("/ready", async (request, reply) => {
    try {
      await withTimeout(options.database.ping(), options.timeoutMs);
      const body: ReadyResponse = { status: "ready" };
      return body;
    } catch (error) {
      // El detalle va al log, nunca a la respuesta: puede incluir host o usuario.
      request.log.error({ err: error }, "la base de datos no está disponible");
      const body: ReadyResponse = { status: "unavailable" };
      return reply.code(503).send(body);
    }
  });
};

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout de ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
