import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigration } from "../src/spike/migrate.js";
import {
  type Cursor,
  insertWorkoutLog,
  pullChanges,
  softDeleteWorkoutLog,
} from "../src/spike/workout-logs.js";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
  } catch {
    // sin .env: las pruebas con base de datos se omiten
  }
}

const databaseUrl = process.env.DATABASE_URL;
const migrationFile = fileURLToPath(new URL("../migrations/001_workout_logs.sql", import.meta.url));

function newLog(clientId: string) {
  return {
    id: randomUUID(),
    clientId,
    deviceOpId: randomUUID(),
    exercise: "sentadilla",
    reps: 8,
    weightKg: 80,
    performedAt: new Date("2026-11-27T10:00:00Z"),
  };
}

describe.skipIf(!databaseUrl)("workout_logs con pg", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 3 });

  beforeAll(async () => {
    await runMigration(pool, migrationFile, "up");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("reintentar la misma operación no duplica la fila", async () => {
    const clientId = randomUUID();
    const input = newLog(clientId);
    const first = await insertWorkoutLog(pool, input);
    const retry = await insertWorkoutLog(pool, { ...input, id: randomUUID() });
    expect(retry.id).toBe(first.id);
    const { changes } = await pullChanges(pool, clientId, null, 10);
    expect(changes).toHaveLength(1);
  });

  it("pagina sin duplicados ni pérdidas, incluso con la misma marca de tiempo", async () => {
    const clientId = randomUUID();
    await insertWorkoutLog(pool, newLog(clientId));
    await insertWorkoutLog(pool, newLog(clientId));
    await pool.query(
      `INSERT INTO workout_logs
         (id, client_id, device_op_id, exercise, reps, weight_kg, performed_at)
       SELECT gen_random_uuid(), $1::uuid, gen_random_uuid(), 'press', 5, 40, now()
       FROM generate_series(1, 3)`,
      [clientId],
    );
    const seen: string[] = [];
    let cursor: Cursor | null = null;
    for (let i = 0; i < 10; i++) {
      const page = await pullChanges(pool, clientId, cursor, 2);
      if (page.changes.length === 0) break;
      seen.push(...page.changes.map((change) => change.id));
      cursor = page.next;
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it("el borrado lógico aparece en los cambios siguientes", async () => {
    const clientId = randomUUID();
    const input = newLog(clientId);
    await insertWorkoutLog(pool, input);
    const { next } = await pullChanges(pool, clientId, null, 10);
    await softDeleteWorkoutLog(pool, clientId, input.deviceOpId);
    const { changes } = await pullChanges(pool, clientId, next, 10);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.deletedAt).not.toBeNull();
  });

  it("la migración se puede aplicar dos veces y revertir", async () => {
    await runMigration(pool, migrationFile, "up");
    await runMigration(pool, migrationFile, "down");
    const gone = await pool.query("SELECT to_regclass('workout_logs') AS t");
    expect(gone.rows[0]?.t).toBeNull();
    await runMigration(pool, migrationFile, "up");
    const back = await pool.query("SELECT to_regclass('workout_logs') AS t");
    expect(back.rows[0]?.t).not.toBeNull();
  });
});
