import type { FastifyInstance } from "fastify";
import { requireProjectAccess } from "../lib/auth.js";

export async function whoamiRoutes(app: FastifyInstance) {
  app.get("/api/v1/whoami", { preHandler: requireProjectAccess }, async (req) => {
    return { name: req.project!.name, slug: req.project!.slug };
  });
}
