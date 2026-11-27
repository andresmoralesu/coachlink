import type { Pool } from "pg";

interface WorkoutLogRow {
  id: string;
  client_id: string;
  device_op_id: string;
  exercise: string;
  reps: number;
  weight_kg: string;
  performed_at: Date;
  updated_at: Date;
  updated_at_cursor: string;
  deleted_at: Date | null;
}

export interface WorkoutLog {
  id: string;
  clientId: string;
  deviceOpId: string;
  exercise: string;
  reps: number;
  weightKg: string;
  performedAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface NewWorkoutLog {
  id: string;
  clientId: string;
  deviceOpId: string;
  exercise: string;
  reps: number;
  weightKg: number;
  performedAt: Date;
}

export interface Cursor {
  updatedAt: string;
  id: string;
}

const COLUMNS = `id, client_id, device_op_id, exercise, reps, weight_kg,
  performed_at, updated_at, updated_at::text AS updated_at_cursor, deleted_at`;

function toWorkoutLog(row: WorkoutLogRow): WorkoutLog {
  return {
    id: row.id,
    clientId: row.client_id,
    deviceOpId: row.device_op_id,
    exercise: row.exercise,
    reps: row.reps,
    weightKg: row.weight_kg,
    performedAt: row.performed_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export async function insertWorkoutLog(pool: Pool, input: NewWorkoutLog): Promise<WorkoutLog> {
  const inserted = await pool.query<WorkoutLogRow>(
    `INSERT INTO workout_logs
       (id, client_id, device_op_id, exercise, reps, weight_kg, performed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (client_id, device_op_id) DO NOTHING
     RETURNING ${COLUMNS}`,
    [
      input.id,
      input.clientId,
      input.deviceOpId,
      input.exercise,
      input.reps,
      input.weightKg,
      input.performedAt,
    ],
  );
  const existing =
    inserted.rows[0] ??
    (
      await pool.query<WorkoutLogRow>(
        `SELECT ${COLUMNS} FROM workout_logs
         WHERE client_id = $1 AND device_op_id = $2`,
        [input.clientId, input.deviceOpId],
      )
    ).rows[0];
  if (!existing) {
    throw new Error("no se pudo insertar ni encontrar la operación");
  }
  return toWorkoutLog(existing);
}

export async function pullChanges(
  pool: Pool,
  clientId: string,
  cursor: Cursor | null,
  limit: number,
): Promise<{ changes: WorkoutLog[]; next: Cursor | null }> {
  const result = await pool.query<WorkoutLogRow>(
    `SELECT ${COLUMNS} FROM workout_logs
     WHERE client_id = $1
       AND ($2::timestamptz IS NULL
            OR (updated_at, id) > ($2::timestamptz, $3::uuid))
     ORDER BY updated_at, id
     LIMIT $4`,
    [clientId, cursor?.updatedAt ?? null, cursor?.id ?? null, limit],
  );
  const last = result.rows[result.rows.length - 1];
  return {
    changes: result.rows.map(toWorkoutLog),
    next: last ? { updatedAt: last.updated_at_cursor, id: last.id } : cursor,
  };
}

export async function softDeleteWorkoutLog(
  pool: Pool,
  clientId: string,
  deviceOpId: string,
): Promise<WorkoutLog | null> {
  const result = await pool.query<WorkoutLogRow>(
    `UPDATE workout_logs SET deleted_at = now(), updated_at = now()
     WHERE client_id = $1 AND device_op_id = $2 AND deleted_at IS NULL
     RETURNING ${COLUMNS}`,
    [clientId, deviceOpId],
  );
  const row = result.rows[0];
  return row ? toWorkoutLog(row) : null;
}
