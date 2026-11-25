import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const baseEnv = { DATABASE_URL: "postgresql://usuario:clave@localhost:5432/coachlink" };

describe("loadConfig", () => {
  it("usa valores por defecto razonables con el entorno mínimo", () => {
    expect(loadConfig(baseEnv)).toEqual({
      nodeEnv: "development",
      port: 3000,
      host: "0.0.0.0",
      logLevel: "info",
      databaseUrl: baseEnv.DATABASE_URL,
      version: "dev",
    });
  });

  it("no arranca sin DATABASE_URL", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("rechaza una DATABASE_URL que no es de Postgres", () => {
    expect(() => loadConfig({ DATABASE_URL: "mysql://usuario:clave@localhost/db" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("no revela el valor de DATABASE_URL en el mensaje de error", () => {
    const attempt = () => loadConfig({ DATABASE_URL: "clave-secreta-123" });

    expect(attempt).toThrow(/DATABASE_URL/);
    expect(attempt).not.toThrow(/clave-secreta-123/);
  });

  it("falla de inmediato y nombra la variable inválida", () => {
    expect(() => loadConfig({ ...baseEnv, PORT: "no-es-un-numero" })).toThrow(/PORT/);
    expect(() => loadConfig({ ...baseEnv, LOG_LEVEL: "ruidoso" })).toThrow(/LOG_LEVEL/);
  });

  it("rechaza puertos fuera de rango", () => {
    expect(() => loadConfig({ ...baseEnv, PORT: "70000" })).toThrow(/PORT/);
  });

  it("prefiere RENDER_GIT_COMMIT sobre GIT_SHA para la versión", () => {
    expect(
      loadConfig({ ...baseEnv, RENDER_GIT_COMMIT: "render1", GIT_SHA: "local1" }).version,
    ).toBe("render1");
    expect(loadConfig({ ...baseEnv, GIT_SHA: "local1" }).version).toBe("local1");
  });
});
