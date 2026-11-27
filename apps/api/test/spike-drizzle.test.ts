import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Cursor,
  insertWorkoutLog,
  pullChanges,
  softDeleteWorkoutLog,
} from "../src/spike/workout-logs.js";

const databaseUrl = process.env.DATABASE_URL;
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

function newLog(clientId: string) {
  return {
    id: randomUUID(),
    clientId,
    deviceOpId: randomUUID(),
    exercise: "sentadilla",
    reps: 8,
    weightKg: "80",
    performedAt: new Date("2026-11-27T10:00:00Z"),
  };
}

describe.skipIf(!databaseUrl)("workout_logs con Drizzle", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 3 });
  const db = drizzle({ client: pool });

  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("reintentar la misma operación no duplica la fila", async () => {
    const clientId = randomUUID();
    const input = newLog(clientId);
    const first = await insertWorkoutLog(db, input);
    const retry = await insertWorkoutLog(db, { ...input, id: randomUUID() });
    expect(retry.id).toBe(first.id);
    const { changes } = await pullChanges(db, clientId, null, 10);
    expect(changes).toHaveLength(1);
  });

  it("pagina sin duplicados ni pérdidas, incluso con la misma marca de tiempo", async () => {
    const clientId = randomUUID();
    await insertWorkoutLog(db, newLog(clientId));
    await insertWorkoutLog(db, newLog(clientId));
    await db.execute(sql`INSERT INTO workout_logs
        (id, client_id, device_op_id, exercise, reps, weight_kg, performed_at)
      SELECT gen_random_uuid(), ${clientId}::uuid, gen_random_uuid(), 'press', 5, 40, now()
      FROM generate_series(1, 3)`);
    const seen: string[] = [];
    let cursor: Cursor | null = null;
    for (let i = 0; i < 10; i++) {
      const page = await pullChanges(db, clientId, cursor, 2);
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
    await insertWorkoutLog(db, input);
    const { next } = await pullChanges(db, clientId, null, 10);
    await softDeleteWorkoutLog(db, clientId, input.deviceOpId);
    const { changes } = await pullChanges(db, clientId, next, 10);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.deletedAt).not.toBeNull();
  });

  it("la migración se puede aplicar dos veces; revertir exige SQL manual", async () => {
    await migrate(db, { migrationsFolder });
    await migrate(db, { migrationsFolder });
    // Drizzle no tiene "down": se borra la tabla y su registro a mano.
    await db.execute(sql`DROP TABLE IF EXISTS workout_logs`);
    await db.execute(sql`DELETE FROM drizzle."__drizzle_migrations"`);
    const gone = await db.execute<{ t: string | null }>(
      sql`SELECT to_regclass('workout_logs')::text AS t`,
    );
    expect(gone.rows[0]?.t).toBeNull();
    await migrate(db, { migrationsFolder });
    const back = await db.execute<{ t: string | null }>(
      sql`SELECT to_regclass('workout_logs')::text AS t`,
    );
    expect(back.rows[0]?.t).not.toBeNull();
  });
});
