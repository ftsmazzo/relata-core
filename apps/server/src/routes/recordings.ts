import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { briefings, recordings, transcriptChunks, transcripts } from "../db/schema.js";
import { requireProjectAccess } from "../lib/auth.js";
import { serializeRecording } from "../serialize.js";
import { assembleUploadedChunks, saveOriginalAudio, saveUploadChunk } from "../lib/audio.js";
import { generateBriefingForRecording, processRecording, retryFailedChunks } from "../worker/process.js";

const RETENTION_DAYS = Number(process.env.AUDIO_RETENTION_DAYS ?? 60);

async function loadFull(recordingId: string) {
  const [recording] = await db.select().from(recordings).where(eq(recordings.id, recordingId));
  if (!recording) return null;
  const [transcript] = await db.select().from(transcripts).where(eq(transcripts.recordingId, recordingId));
  const [briefing] = await db.select().from(briefings).where(eq(briefings.recordingId, recordingId));
  const chunks = await db.select().from(transcriptChunks).where(eq(transcriptChunks.recordingId, recordingId));
  return serializeRecording(recording, transcript, briefing, chunks);
}

export async function recordingsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireProjectAccess);

  // Cria o registro. `audioBase64` é opcional: se vier, sobe tudo numa tacada só
  // (ok pra áudios curtos); se não vier, o cliente sobe em pedaços via
  // /audio-chunk + /complete-upload, evitando que uma requisição única muito
  // grande estoure o timeout do proxy em conexões lentas.
  app.post("/api/v1/recordings", async (req, reply) => {
    const body = req.body as {
      source?: "live" | "upload";
      title?: string;
      audioBase64?: string;
      mimeType?: string;
    };
    if (!body?.mimeType || !body.source) {
      return reply.code(400).send({ error: "source e mimeType são obrigatórios" });
    }

    const expiresAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const [row] = await db
      .insert(recordings)
      .values({
        projectId: req.project!.id,
        title: body.title ?? null,
        source: body.source,
        status: body.audioBase64 ? "uploaded" : "uploading",
        audioPath: "",
        mimeType: body.mimeType,
        expiresAt,
      })
      .returning();

    if (body.audioBase64) {
      const audioPath = await saveOriginalAudio(row.id, body.audioBase64, body.mimeType);
      await db.update(recordings).set({ audioPath }).where(eq(recordings.id, row.id));

      processRecording(row.id).catch((err) => {
        req.log.error({ err, recordingId: row.id }, "falha ao processar gravação");
      });
    }

    const full = await loadFull(row.id);
    return reply.code(201).send(full);
  });

  app.post("/api/v1/recordings/:id/audio-chunk", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { index?: number; dataBase64?: string };
    if (typeof body?.index !== "number" || !body.dataBase64) {
      return reply.code(400).send({ error: "index e dataBase64 são obrigatórios" });
    }

    const [recording] = await db.select().from(recordings).where(eq(recordings.id, id));
    if (!recording || recording.projectId !== req.project!.id) return reply.code(404).send({ error: "not_found" });
    if (recording.status !== "uploading") return reply.code(409).send({ error: "upload_not_in_progress" });

    await saveUploadChunk(id, body.index, body.dataBase64);
    return { ok: true };
  });

  app.post("/api/v1/recordings/:id/complete-upload", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [recording] = await db.select().from(recordings).where(eq(recordings.id, id));
    if (!recording || recording.projectId !== req.project!.id) return reply.code(404).send({ error: "not_found" });
    if (recording.status !== "uploading") return reply.code(409).send({ error: "upload_not_in_progress" });

    const audioPath = await assembleUploadedChunks(id, recording.mimeType);
    await db.update(recordings).set({ audioPath, status: "uploaded" }).where(eq(recordings.id, id));

    processRecording(id).catch((err) => {
      req.log.error({ err, recordingId: id }, "falha ao processar gravação");
    });

    const full = await loadFull(id);
    return full;
  });

  app.get("/api/v1/recordings", async (req) => {
    const rows = await db
      .select()
      .from(recordings)
      .where(eq(recordings.projectId, req.project!.id))
      .orderBy(desc(recordings.createdAt));
    return { recordings: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
  });

  app.get("/api/v1/recordings/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const full = await loadFull(id);
    if (!full || full.projectId !== req.project!.id) return reply.code(404).send({ error: "not_found" });
    return full;
  });

  app.patch("/api/v1/recordings/:id/briefing", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { text?: string };
    if (typeof body?.text !== "string") return reply.code(400).send({ error: "text é obrigatório" });

    const [recording] = await db.select().from(recordings).where(eq(recordings.id, id));
    if (!recording || recording.projectId !== req.project!.id) return reply.code(404).send({ error: "not_found" });

    await db
      .update(briefings)
      .set({ draftText: body.text })
      .where(eq(briefings.recordingId, id));

    const full = await loadFull(id);
    return full;
  });

  app.post("/api/v1/recordings/:id/finalize", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [recording] = await db.select().from(recordings).where(eq(recordings.id, id));
    if (!recording || recording.projectId !== req.project!.id) return reply.code(404).send({ error: "not_found" });

    const [briefing] = await db.select().from(briefings).where(eq(briefings.recordingId, id));
    if (!briefing?.draftText) return reply.code(409).send({ error: "briefing_not_ready" });

    await db
      .update(briefings)
      .set({ status: "finalized", finalText: briefing.draftText, finalizedAt: new Date() })
      .where(eq(briefings.recordingId, id));

    const full = await loadFull(id);
    return full;
  });

  app.delete("/api/v1/recordings/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [recording] = await db.select().from(recordings).where(eq(recordings.id, id));
    if (!recording || recording.projectId !== req.project!.id) return reply.code(404).send({ error: "not_found" });

    await db.delete(recordings).where(eq(recordings.id, id));
    return { ok: true };
  });

  app.post("/api/v1/recordings/:id/retry", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body as { stage?: "transcription" | "briefing" }) ?? {};
    const [recording] = await db.select().from(recordings).where(eq(recordings.id, id));
    if (!recording || recording.projectId !== req.project!.id) return reply.code(404).send({ error: "not_found" });

    const action =
      body.stage === "briefing" ? generateBriefingForRecording(id) : retryFailedChunks(id);

    action.catch((err) => req.log.error({ err, recordingId: id }, "falha ao reprocessar"));
    return { ok: true };
  });
}
