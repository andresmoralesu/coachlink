import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { Pool } from "pg";

export type Direction = "up" | "down";

export function parseMigration(sql: string): { up: string; down: string } {
  const parts = sql.split(/^-- down\s*$/m);
  const up = parts[0]?.replace(/^-- up\s*$/m, "").trim();
  const down = parts[1]?.trim();
  if (!up || !down) {
    throw new Error("la migración necesita las secciones '-- up' y '-- down'");
  }
  return { up, down };
}

export async function runMigration(pool: Pool, file: string, direction: Direction): Promise<void> {
  const { up, down } = parseMigration(await readFile(file, "utf8"));
  const name = basename(file);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
    const isApplied = applied.rowCount === 1;
    if (direction === "up" && !isApplied) {
      await client.query(up);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
    } else if (direction === "down" && isApplied) {
      await client.query(down);
      await client.query("DELETE FROM schema_migrations WHERE name = $1", [name]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
