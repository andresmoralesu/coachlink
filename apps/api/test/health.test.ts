import { HealthResponse } from "@coachlink/contracts";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /health", () => {
  const app = buildApp({ logLevel: "silent", version: "abc1234" });
  afterAll(() => app.close());

  it("responde 200 con status ok y la versión desplegada", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(HealthResponse.parse(response.json())).toEqual({ status: "ok", version: "otra" });
  });

  it("responde 404 en rutas que no existen", async () => {
    const response = await app.inject({ method: "GET", url: "/no-existe" });

    expect(response.statusCode).toBe(404);
  });
});
