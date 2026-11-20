import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("usa valores por defecto razonables con un entorno vacío", () => {
    expect(loadConfig({})).toEqual({
      nodeEnv: "development",
      port: 3000,
      host: "0.0.0.0",
      logLevel: "info",
      version: "dev",
    });
  });

  it("falla de inmediato y nombra la variable inválida", () => {
    expect(() => loadConfig({ PORT: "no-es-un-numero" })).toThrow(/PORT/);
    expect(() => loadConfig({ LOG_LEVEL: "ruidoso" })).toThrow(/LOG_LEVEL/);
  });

  it("rechaza puertos fuera de rango", () => {
    expect(() => loadConfig({ PORT: "70000" })).toThrow(/PORT/);
  });

  it("prefiere RENDER_GIT_COMMIT sobre GIT_SHA para la versión", () => {
    expect(loadConfig({ RENDER_GIT_COMMIT: "render1", GIT_SHA: "local1" }).version).toBe("render1");
    expect(loadConfig({ GIT_SHA: "local1" }).version).toBe("local1");
  });
});
