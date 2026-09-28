import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveProjectByAccessToken } from "../admin.js";

declare module "fastify" {
  interface FastifyRequest {
    project?: { id: string; name: string; slug: string };
  }
}

export async function requireProjectAccess(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  const token = typeof header === "string" ? header.replace(/^Bearer\s+/i, "") : undefined;
  if (!token) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }
  const project = await resolveProjectByAccessToken(token);
  if (!project) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }
  req.project = project;
}
