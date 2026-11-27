import type { Kysely } from "kysely";
import { type MigrationProvider, Migrator } from "kysely/migration";
import type { Database } from "./db.js";
import * as m001 from "./migrations/001-workout-logs.js";

const provider: MigrationProvider = {
  getMigrations: async () => ({ "001_workout_logs": m001 }),
};

export function createMigrator(db: Kysely<Database>): Migrator {
  return new Migrator({ db, provider });
}
