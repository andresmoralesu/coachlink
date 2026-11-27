import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../src/spike/db.js";
import { createMigrator } from "../src/spike/migrator.js";
import {
  type Cursor,
  insertWorkoutLog,
  pullChanges,
  softDeleteWorkoutLog,
} from "../src/spike/workout-logs.js";

const databaseUrl = process.env.DATABASE_URL;

function newLog(clientId: string) {
  return {
    id: randomUUID(),
    client_id: clientId,
    device_op_id: randomUUID(),
    exercise: "sentadilla",
    reps: 8,
    weight_kg: 80,
    performed_at: new Date("2026-11-27T10:00:00Z"),
  };
}

describe.skipIf(!databaseUrl)("workout_logs con Kysely", () => {
  const db = createDb(new pg.Pool({ connectionString: databaseUrl, max: 3 }));

  beforeAll(async () => {
    const result = await createMigrator(db).migrateToLatest();
    expect(result.error).toBeUndefined();
  });

  afterAll(async () => {
    await db.destroy();
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
    await sql`INSERT INTO workout_logs
        (id, client_id, device_op_id, exercise, reps, weight_kg, performed_at)
      SELECT gen_random_uuid(), ${clientId}::uuid, gen_random_uuid(), 'press', 5, 40, now()
      FROM generate_series(1, 3)`.execute(db);
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
    await softDeleteWorkoutLog(db, clientId, input.device_op_id);
    const { changes } = await pullChanges(db, clientId, next, 10);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.deleted_at).not.toBeNull();
  });

  it("la migración se puede aplicar dos veces y revertir", async () => {
    const migrator = createMigrator(db);
    expect((await migrator.migrateToLatest()).error).toBeUndefined();
    expect((await migrator.migrateDown()).error).toBeUndefined();
    const gone = await sql<{
      t: string | null;
    }>`SELECT to_regclass('workout_logs')::text AS t`.execute(db);
    expect(gone.rows[0]?.t).toBeNull();
    expect((await migrator.migrateToLatest()).error).toBeUndefined();
    const back = await sql<{
      t: string | null;
    }>`SELECT to_regclass('workout_logs')::text AS t`.execute(db);
    expect(back.rows[0]?.t).not.toBeNull();
  });
});
