import { type Insertable, type Kysely, type Selectable, sql } from "kysely";
import type { Database, WorkoutLogsTable } from "./db.js";

export type NewWorkoutLog = Insertable<WorkoutLogsTable>;
export type WorkoutLog = Selectable<WorkoutLogsTable>;

export interface Cursor {
  updatedAt: string;
  id: string;
}

const cursorColumn = sql<string>`updated_at::text`.as("updated_at_cursor");

export async function insertWorkoutLog(
  db: Kysely<Database>,
  input: NewWorkoutLog,
): Promise<WorkoutLog> {
  const inserted = await db
    .insertInto("workout_logs")
    .values(input)
    .onConflict((oc) => oc.columns(["client_id", "device_op_id"]).doNothing())
    .returningAll()
    .executeTakeFirst();
  if (inserted) return inserted;
  return db
    .selectFrom("workout_logs")
    .selectAll()
    .where("client_id", "=", input.client_id)
    .where("device_op_id", "=", input.device_op_id)
    .executeTakeFirstOrThrow();
}

export async function pullChanges(
  db: Kysely<Database>,
  clientId: string,
  cursor: Cursor | null,
  limit: number,
): Promise<{ changes: WorkoutLog[]; next: Cursor | null }> {
  let query = db
    .selectFrom("workout_logs")
    .selectAll()
    .select(cursorColumn)
    .where("client_id", "=", clientId);
  if (cursor) {
    query = query.where(
      sql<boolean>`(updated_at, id) > (${cursor.updatedAt}::timestamptz, ${cursor.id}::uuid)`,
    );
  }
  const rows = await query.orderBy("updated_at").orderBy("id").limit(limit).execute();
  const last = rows[rows.length - 1];
  return {
    changes: rows,
    next: last ? { updatedAt: last.updated_at_cursor, id: last.id } : cursor,
  };
}

export async function softDeleteWorkoutLog(
  db: Kysely<Database>,
  clientId: string,
  deviceOpId: string,
): Promise<WorkoutLog | undefined> {
  return db
    .updateTable("workout_logs")
    .set({ deleted_at: sql<Date>`now()`, updated_at: sql<Date>`now()` })
    .where("client_id", "=", clientId)
    .where("device_op_id", "=", deviceOpId)
    .where("deleted_at", "is", null)
    .returningAll()
    .executeTakeFirst();
}
