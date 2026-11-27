import { type ColumnType, type Generated, Kysely, PostgresDialect } from "kysely";
import type { Pool } from "pg";

export interface WorkoutLogsTable {
  id: string;
  client_id: string;
  device_op_id: string;
  exercise: string;
  reps: number;
  weight_kg: ColumnType<string, number, number>;
  performed_at: Date;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface Database {
  workout_logs: WorkoutLogsTable;
}

export function createDb(pool: Pool): Kysely<Database> {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
