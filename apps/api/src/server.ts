import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./database.js";

const config = loadConfig();
const database = createDatabase(config.databaseUrl, (error) => {
  app.log.error({ err: error }, "error en el pool de la base de datos");
});
const app = buildApp({ ...config, database });

// Cierre ordenado: Render envía SIGTERM al reemplazar o detener el servicio.
async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "apagando");
  try {
    await app.close();
    await database.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
