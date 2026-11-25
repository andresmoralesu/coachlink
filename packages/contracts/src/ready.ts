import { z } from "zod";

/**
 * Contrato de GET /ready.
 * `ready` si las dependencias (la base de datos) responden; `unavailable`
 * (con HTTP 503) si no. El cuerpo nunca incluye detalles del error.
 */
export const ReadyResponse = z.object({
  status: z.enum(["ready", "unavailable"]),
});

export type ReadyResponse = z.infer<typeof ReadyResponse>;
