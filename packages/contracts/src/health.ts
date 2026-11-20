import { z } from "zod";

/**
 * Contrato de GET /health.
 * `version` es el SHA del commit desplegado: permite comprobar qué versión
 * está en producción y verificar un rollback.
 */
export const HealthResponse = z.object({
  status: z.literal("ok"),
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof HealthResponse>;
