import type { FastifyInstance } from "fastify";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { events } from "../db/schema.js";
import { requireProjectAccess } from "../lib/auth.js";

export async function eventsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireProjectAccess);

  app.get("/api/v1/events", async (req) => {
    const query = req.query as { since?: string; wait?: string };
    const waitMs = Math.min(Number(query.wait ?? 20) * 1000, 30000);
    const since = query.since ? new Date(query.since) : new Date(0);

    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      const rows = await db
        .select()
        .from(events)
        .where(and(eq(events.projectId, req.project!.id), gt(events.createdAt, since)))
        .orderBy(asc(events.createdAt))
        .limit(100);

      if (rows.length > 0) {
        return { events: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    return { events: [] };
  });
}
