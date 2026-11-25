import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // Cadena de conexión a Postgres (Neon). Es un secreto: nunca va en logs ni en mensajes de error.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // SHA del commit desplegado. Render lo inyecta como RENDER_GIT_COMMIT.
  RENDER_GIT_COMMIT: z.string().min(1).optional(),
  GIT_SHA: z.string().min(1).optional(),
});

export interface Config {
  nodeEnv: "development" | "test" | "production";
  port: number;
  host: string;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  databaseUrl: string;
  version: string;
}

/**
 * Valida las variables de entorno y falla de inmediato (fail fast) con un
 * mensaje claro si alguna es inválida. Sin valores "por si acaso" silenciosos.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Configuración inválida:\n${problems}`);
  }
  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    logLevel: e.LOG_LEVEL,
    databaseUrl: e.DATABASE_URL,
    version: e.RENDER_GIT_COMMIT ?? e.GIT_SHA ?? "dev",
  };
}
