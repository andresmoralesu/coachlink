import { sql } from "kysely";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "../src/spike/db.js";
import { createMigrator } from "../src/spike/migrator.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("workout_logs con Kysely", () => {
  const db = createDb(new pg.Pool({ connectionString: databaseUrl, max: 3 }));

  afterAll(async () => {
    await db.destroy();
  });

  it("la migración se puede aplicar dos veces y revertir", async () => {
    const migrator = createMigrator(db);
    expect((await migrator.migrateToLatest()).error).toBeUndefined();
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
