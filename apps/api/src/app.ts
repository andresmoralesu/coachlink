import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.js";
import { healthRoutes } from "./routes/health.js";

export type AppOptions = Pick<Config, "logLevel" | "version">;

/**
 * Construye la app sin abrir ningún puerto: así los tests usan `app.inject`
 * y server.ts decide cuándo y dónde escuchar.
 */
export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: { level: options.logLevel } });
  app.register(healthRoutes, { version: options.version });
  return app;
}
