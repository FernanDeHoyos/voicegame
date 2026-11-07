import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { cleanupExpiredRooms, createApp } from "./app.js";
import { createR2Storage } from "./storage.js";

const { Pool } = pg;
const directory = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8787);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL es obligatorio para iniciar el servicio de salas.",
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.PGSSLMODE === "require"
      ? { rejectUnauthorized: false }
      : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
const storage = createR2Storage({
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
});

const origins = (process.env.WEB_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

async function start() {
  await pool.query(await readFile(join(directory, "schema.sql"), "utf8"));
  const app = createApp({ pool, storage, allowedOrigins: origins });
  const server = createServer(app);

  const cleanupTimer = setInterval(() => {
    cleanupExpiredRooms(pool, storage).catch((error) => {
      console.error("Expired room cleanup task failed:", error);
    });
  }, 60 * 1000);
  cleanupTimer.unref();
  await cleanupExpiredRooms(pool, storage);

  server.listen(port, "0.0.0.0", () => {
    console.info(`VoiceGame room service listening on port ${port}.`);
  });

  async function shutdown(signal) {
    console.info(`Received ${signal}; shutting down room service.`);
    clearInterval(cleanupTimer);
    server.close(async (error) => {
      if (error) {
        console.error("HTTP server shutdown failed:", error);
        process.exitCode = 1;
      }
      try {
        await pool.end();
      } catch (poolError) {
        console.error("Database shutdown failed:", poolError);
        process.exitCode = 1;
      }
    });
  }

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

start().catch(async (error) => {
  console.error("VoiceGame room service failed to start:", error);
  await pool.end().catch((poolError) => {
    console.error("Database shutdown failed:", poolError);
  });
  process.exitCode = 1;
});
