import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const workoutLogs = pgTable(
  "workout_logs",
  {
    id: uuid("id").primaryKey(),
    clientId: uuid("client_id").notNull(),
    deviceOpId: uuid("device_op_id").notNull(),
    exercise: text("exercise").notNull(),
    reps: integer("reps").notNull(),
    weightKg: numeric("weight_kg", { precision: 6, scale: 2 }).notNull(),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.clientId, t.deviceOpId),
    index("workout_logs_sync_idx").on(t.clientId, t.updatedAt, t.id),
    check("workout_logs_reps_check", sql`${t.reps} > 0`),
    check("workout_logs_weight_check", sql`${t.weightKg} >= 0`),
  ],
);
