import pg from "pg";

/** Lo mínimo que la app necesita de la base de datos. Los tests lo reemplazan por un doble. */
export interface Database {
  ping(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Crea el acceso a Postgres. El Pool es perezoso: no abre ninguna conexión
 * hasta la primera consulta, así que arrancar la app no despierta a Neon.
 */
export function createDatabase(
  connectionString: string,
  onError: (error: Error) => void,
): Database {
  const pool = new pg.Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
  });
  // Sin este manejador, un cliente inactivo que pierde la conexión emite un
  // "error" sin escucha y tumba todo el proceso. Neon cierra conexiones inactivas.
  pool.on("error", onError);

  return {
    async ping() {
      await pool.query("SELECT 1");
    },
    close: () => pool.end(),
  };
}
