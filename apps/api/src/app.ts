// prueba de disparo de despliegue
import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.js";
import type { Database } from "./database.js";
import { healthRoutes } from "./routes/health.js";
import { readyRoutes } from "./routes/ready.js";

export type AppOptions = Pick<Config, "logLevel" | "version"> & {
  database: Pick<Database, "ping">;
  /** Tiempo máximo de la consulta de /ready. Neon puede tardar unos segundos en despertar. */
  readyTimeoutMs?: number;
};

/**
 * Construye la app sin abrir ningún puerto: así los tests usan `app.inject`
 * y server.ts decide cuándo y dónde escuchar.
 */
export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: { level: options.logLevel } });
  app.register(healthRoutes, { version: options.version });
  app.register(readyRoutes, {
    database: options.database,
    timeoutMs: options.readyTimeoutMs ?? 5_000,
  });
  return app;
}
