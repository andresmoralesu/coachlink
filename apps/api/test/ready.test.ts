import { ReadyResponse } from "@coachlink/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /ready", () => {
  let app: FastifyInstance;

  function crearApp(ping: () => Promise<void>, readyTimeoutMs = 1_000): FastifyInstance {
    app = buildApp({
      logLevel: "silent",
      version: "abc1234",
      database: { ping },
      readyTimeoutMs,
    });
    return app;
  }

  afterEach(() => app.close());

  it("responde 200 y ready cuando la base responde", async () => {
    const response = await crearApp(() => Promise.resolve()).inject({
      method: "GET",
      url: "/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(ReadyResponse.parse(response.json())).toEqual({ status: "ready" });
  });

  it("responde 503 y unavailable cuando la base falla, sin filtrar el error", async () => {
    const response = await crearApp(() =>
      Promise.reject(new Error("password authentication failed for user secreto")),
    ).inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(503);
    expect(ReadyResponse.parse(response.json())).toEqual({ status: "unavailable" });
    expect(response.body).not.toContain("secreto");
  });

  it("responde 503 cuando la base tarda más que el tiempo límite", async () => {
    const response = await crearApp(() => new Promise<void>(() => undefined), 20).inject({
      method: "GET",
      url: "/ready",
    });

    expect(response.statusCode).toBe(503);
  });
});
