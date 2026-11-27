CREATE TABLE "workout_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"device_op_id" uuid NOT NULL,
	"exercise" text NOT NULL,
	"reps" integer NOT NULL,
	"weight_kg" numeric(6, 2) NOT NULL,
	"performed_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "workout_logs_client_id_device_op_id_unique" UNIQUE("client_id","device_op_id"),
	CONSTRAINT "workout_logs_reps_check" CHECK ("workout_logs"."reps" > 0),
	CONSTRAINT "workout_logs_weight_check" CHECK ("workout_logs"."weight_kg" >= 0)
);
--> statement-breakpoint
CREATE INDEX "workout_logs_sync_idx" ON "workout_logs" USING btree ("client_id","updated_at","id");