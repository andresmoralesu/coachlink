import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { workoutLogs } from "./schema.js";

export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type NewWorkoutLog = typeof workoutLogs.$inferInsert;

export interface Cursor {
  updatedAt: string;
  id: string;
}

export async function insertWorkoutLog(
  db: NodePgDatabase,
  input: NewWorkoutLog,
): Promise<WorkoutLog> {
  const [inserted] = await db
    .insert(workoutLogs)
    .values(input)
    .onConflictDoNothing({
      target: [workoutLogs.clientId, workoutLogs.deviceOpId],
    })
    .returning();
  if (inserted) return inserted;
  const [existing] = await db
    .select()
    .from(workoutLogs)
    .where(
      and(eq(workoutLogs.clientId, input.clientId), eq(workoutLogs.deviceOpId, input.deviceOpId)),
    );
  if (!existing) {
    throw new Error("no se pudo insertar ni encontrar la operación");
  }
  return existing;
}

export async function pullChanges(
  db: NodePgDatabase,
  clientId: string,
  cursor: Cursor | null,
  limit: number,
): Promise<{ changes: WorkoutLog[]; next: Cursor | null }> {
  const rows = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.clientId, clientId),
        cursor
          ? sql`(${workoutLogs.updatedAt}, ${workoutLogs.id}) > (${cursor.updatedAt}::timestamptz, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(asc(workoutLogs.updatedAt), asc(workoutLogs.id))
    .limit(limit);
  const last = rows[rows.length - 1];
  return {
    changes: rows,
    next: last ? { updatedAt: last.updatedAt, id: last.id } : cursor,
  };
}

export async function softDeleteWorkoutLog(
  db: NodePgDatabase,
  clientId: string,
  deviceOpId: string,
): Promise<WorkoutLog | undefined> {
  const [row] = await db
    .update(workoutLogs)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      and(
        eq(workoutLogs.clientId, clientId),
        eq(workoutLogs.deviceOpId, deviceOpId),
        isNull(workoutLogs.deletedAt),
      ),
    )
    .returning();
  return row;
}
