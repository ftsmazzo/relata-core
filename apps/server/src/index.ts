import Fastify from "fastify";
import cors from "@fastify/cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import * as Sentry from "@sentry/node";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./db/client.js";
import { eq, inArray } from "drizzle-orm";
import { recordings } from "./db/schema.js";
import { adminRoutes } from "./routes/admin.js";
import { recordingsRoutes } from "./routes/recordings.js";
import { eventsRoutes } from "./routes/events.js";
import { whoamiRoutes } from "./routes/whoami.js";
import { mcpRoutes } from "./routes/mcp.js";
import { processRecording } from "./worker/process.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
}

async function main() {
  const app = Fastify({ logger: true, bodyLimit: 300 * 1024 * 1024 });

  await app.register(cors, { origin: true });

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    if (process.env.SENTRY_DSN) Sentry.captureException(err);
    const e = err as { statusCode?: number; message: string };
    const status = e.statusCode ?? 500;
    reply.code(status).send({ error: status === 500 ? "internal_error" : e.message });
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(adminRoutes);
  await app.register(recordingsRoutes);
  await app.register(eventsRoutes);
  await app.register(whoamiRoutes);
  await app.register(mcpRoutes);

  const dashboardDir = path.join(__dirname, "../public/dashboard");
  if (fs.existsSync(dashboardDir)) {
    const indexHtml = fs.readFileSync(path.join(dashboardDir, "index.html"));
    app.get("/*", async (req, reply) => {
      const url = req.url.split("?")[0];
      const filePath = path.join(dashboardDir, url);
      if (!filePath.startsWith(dashboardDir)) {
        reply.code(400).send();
        return;
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        reply.type(guessType(filePath)).send(fs.readFileSync(filePath));
        return;
      }
      reply.type("text/html").send(indexHtml);
    });
  }

  try {
    await migrate(db, { migrationsFolder: path.join(__dirname, "../src/db/migrations") });
    app.log.info("migrations aplicadas");
  } catch (err) {
    app.log.error({ err }, "falha ao rodar migrations");
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });

  try {
    await resumeStuckRecordings(app);
  } catch (err) {
    app.log.error({ err }, "falha ao retomar gravações pendentes");
  }
}

function guessType(filePath: string): string {
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".json") || filePath.endsWith(".webmanifest")) return "application/manifest+json";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

async function resumeStuckRecordings(app: ReturnType<typeof Fastify>) {
  const stuck = await db
    .select()
    .from(recordings)
    .where(
      inArray(recordings.status, ["uploaded", "transcribing", "transcribed", "generating_briefing"]),
    );
  for (const row of stuck) {
    app.log.info({ recordingId: row.id }, "retomando processamento pendente");
    processRecording(row.id).catch((err) => app.log.error({ err, recordingId: row.id }, "falha ao retomar"));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
