import type { FastifyInstance } from "fastify";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { projects, projectTokens, recordings } from "../db/schema.js";
import {
  createProjectWithTokens,
  getActiveTokensForProject,
  isValidAdminToken,
  regenerateTokensForProject,
} from "../admin.js";

function requireAdmin(req: { headers: Record<string, unknown> }): boolean {
  const header = req.headers.authorization;
  const token = typeof header === "string" ? header.replace(/^Bearer\s+/i, "") : undefined;
  return isValidAdminToken(token);
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    if (!requireAdmin(req)) {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.get("/api/v1/admin/projects", async () => {
    const rows = await db.select().from(projects).orderBy(projects.createdAt);

    const tokenRows = await db
      .select({ projectId: projectTokens.projectId, tokenPlain: projectTokens.tokenPlain })
      .from(projectTokens)
      .where(and(eq(projectTokens.kind, "access"), isNull(projectTokens.revokedAt)));
    const tokenByProject = new Map(tokenRows.map((t) => [t.projectId, t.tokenPlain]));

    const countRows = await db
      .select({ projectId: recordings.projectId, count: sql<number>`count(*)::int` })
      .from(recordings)
      .groupBy(recordings.projectId);
    const countByProject = new Map(countRows.map((c) => [c.projectId, c.count]));

    return {
      projects: rows.map((p) => ({
        ...p,
        accessToken: tokenByProject.get(p.id) ?? null,
        recordingsCount: countByProject.get(p.id) ?? 0,
      })),
    };
  });

  app.post("/api/v1/admin/projects", async (req, reply) => {
    const body = req.body as { name?: string };
    if (!body?.name?.trim()) {
      return reply.code(400).send({ error: "name é obrigatório" });
    }
    const result = await createProjectWithTokens(body.name.trim());
    return result;
  });

  app.delete("/api/v1/admin/projects/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const [project] = await db.select().from(projects).where(eq(projects.slug, slug));
    if (!project) return reply.code(404).send({ error: "not_found" });
    await db.delete(projects).where(eq(projects.id, project.id));
    return { ok: true };
  });

  app.get("/api/v1/admin/projects/:slug/config", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const result = await getActiveTokensForProject(slug);
    if (!result) return reply.code(404).send({ error: "not_found" });
    return result;
  });

  app.post("/api/v1/admin/projects/:slug/regenerate-tokens", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    try {
      const result = await regenerateTokensForProject(slug);
      return result;
    } catch {
      return reply.code(404).send({ error: "not_found" });
    }
  });
}
