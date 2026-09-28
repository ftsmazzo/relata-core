import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { briefings, recordings, transcripts } from "../db/schema.js";

interface ProjectCtx {
  id: string;
  name: string;
  slug: string;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function buildMcpServer(project: ProjectCtx): McpServer {
  const server = new McpServer({ name: "relata-core", version: "0.1.0" });

  server.registerTool(
    "list_ready_briefings",
    {
      title: "Listar briefings prontos",
      description:
        "Lista os registros de reunião (relata-core) deste projeto cujo briefing técnico já foi finalizado pelo time e está pronto pra uso.",
      inputSchema: {},
    },
    async () => {
      const rows = await db
        .select({ recording: recordings, briefing: briefings })
        .from(recordings)
        .innerJoin(briefings, eq(briefings.recordingId, recordings.id))
        .where(and(eq(recordings.projectId, project.id), eq(briefings.status, "finalized")))
        .orderBy(desc(recordings.createdAt))
        .limit(20);

      if (rows.length === 0) {
        return textResult("Nenhum briefing finalizado ainda para este projeto.");
      }

      const list = rows
        .map(
          (r) =>
            `- id: ${r.recording.id} | título: ${r.recording.title ?? "(sem título)"} | finalizado em: ${r.briefing.finalizedAt?.toISOString()}`,
        )
        .join("\n");
      return textResult(list);
    },
  );

  server.registerTool(
    "get_briefing",
    {
      title: "Obter briefing técnico",
      description: "Retorna o texto técnico estruturado (briefing) finalizado de uma gravação específica.",
      inputSchema: { recordingId: z.string().describe("ID da gravação") },
    },
    async ({ recordingId }) => {
      const [row] = await db
        .select()
        .from(briefings)
        .where(eq(briefings.recordingId, recordingId));
      if (!row) return textResult("Briefing não encontrado.");
      return textResult(row.finalText ?? row.draftText ?? "Briefing ainda não gerado.");
    },
  );

  server.registerTool(
    "get_transcript",
    {
      title: "Obter transcrição completa",
      description: "Retorna a transcrição completa (texto cru) de uma gravação específica.",
      inputSchema: { recordingId: z.string().describe("ID da gravação") },
    },
    async ({ recordingId }) => {
      const [row] = await db
        .select()
        .from(transcripts)
        .where(eq(transcripts.recordingId, recordingId));
      if (!row) return textResult("Transcrição ainda não disponível.");
      return textResult(row.text);
    },
  );

  return server;
}
