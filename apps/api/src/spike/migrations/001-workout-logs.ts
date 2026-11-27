import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS workout_logs (
      id uuid PRIMARY KEY,
      client_id uuid NOT NULL,
      device_op_id uuid NOT NULL,
      exercise text NOT NULL,
      reps integer NOT NULL CHECK (reps > 0),
      weight_kg numeric(6,2) NOT NULL CHECK (weight_kg >= 0),
      performed_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      UNIQUE (client_id, device_op_id)
    )`.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS workout_logs_sync_idx
      ON workout_logs (client_id, updated_at, id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS workout_logs`.execute(db);
}
