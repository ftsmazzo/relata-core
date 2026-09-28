import type { FastifyInstance } from "fastify";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { resolveProjectByAccessToken } from "../admin.js";
import { buildMcpServer } from "../mcp/tools.js";

export async function mcpRoutes(app: FastifyInstance) {
  app.post("/mcp", async (req, reply) => {
    const header = req.headers.authorization;
    const token = typeof header === "string" ? header.replace(/^Bearer\s+/i, "") : undefined;
    const project = token ? await resolveProjectByAccessToken(token) : null;
    if (!project) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }

    const server = buildMcpServer(project);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    reply.raw.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req.raw, reply.raw, req.body);
  });
}
