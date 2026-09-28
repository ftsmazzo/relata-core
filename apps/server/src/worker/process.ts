import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { recordings, transcriptChunks, transcripts, briefings, events } from "../db/schema.js";
import {
  probeDurationSeconds,
  readAudioBuffer,
  recordingDir,
  splitIntoChunks,
} from "../lib/audio.js";
import { generateStructuredBriefing, transcribeAudioChunk } from "../lib/openrouter.js";
import path from "node:path";

const MAX_ATTEMPTS = 3;

type RecordingStatus = typeof recordings.$inferSelect["status"];

async function emitEvent(projectId: string, recordingId: string, type: string, payload: unknown = {}) {
  await db.insert(events).values({ projectId, recordingId, type, payload });
}

async function setStatus(recordingId: string, status: RecordingStatus, errorMessage?: string) {
  await db
    .update(recordings)
    .set({ status, errorMessage: errorMessage ?? null })
    .where(eq(recordings.id, recordingId));
}

export async function processRecording(recordingId: string) {
  const [recording] = await db.select().from(recordings).where(eq(recordings.id, recordingId));
  if (!recording) return;

  try {
    await setStatus(recordingId, "transcribing");
    await emitEvent(recording.projectId, recordingId, "status_changed", { status: "transcribing" });

    const duration = await probeDurationSeconds(recording.audioPath);
    if (duration) {
      await db.update(recordings).set({ durationSeconds: duration }).where(eq(recordings.id, recordingId));
    }

    const chunkPaths = await splitIntoChunks(recording.audioPath, recordingId);
    const chunkRows = await db
      .insert(transcriptChunks)
      .values(chunkPaths.map((_, index) => ({ recordingId, chunkIndex: index })))
      .returning();

    for (let i = 0; i < chunkPaths.length; i++) {
      await transcribeChunkWithRetry(recording.projectId, recordingId, chunkRows[i].id, chunkPaths[i]);
    }

    await assembleTranscriptAndGenerateBriefing(recordingId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(recordingId, "error", message);
    await emitEvent(recording.projectId, recordingId, "status_changed", { status: "error", message });
  }
}

async function transcribeChunkWithRetry(
  projectId: string,
  recordingId: string,
  chunkId: string,
  chunkPath: string,
) {
  const [row] = await db.select().from(recordings).where(eq(recordings.id, recordingId));
  const mimeType = row?.mimeType ?? "audio/mpeg";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const buffer = await readAudioBuffer(chunkPath);
      const text = await transcribeAudioChunk(buffer, "audio/mpeg");
      await db
        .update(transcriptChunks)
        .set({ status: "done", text, attempts: attempt })
        .where(eq(transcriptChunks.id, chunkId));
      await emitEvent(projectId, recordingId, "chunk_done", { chunkId });
      return;
    } catch (err) {
      await db
        .update(transcriptChunks)
        .set({ attempts: attempt })
        .where(eq(transcriptChunks.id, chunkId));
      if (attempt === MAX_ATTEMPTS) {
        await db
          .update(transcriptChunks)
          .set({ status: "failed" })
          .where(eq(transcriptChunks.id, chunkId));
      }
    }
  }
}

export async function assembleTranscriptAndGenerateBriefing(recordingId: string) {
  const [recording] = await db.select().from(recordings).where(eq(recordings.id, recordingId));
  if (!recording) return;

  const chunks = await db
    .select()
    .from(transcriptChunks)
    .where(eq(transcriptChunks.recordingId, recordingId));

  const ordered = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
  const fullText = ordered
    .map((c) => c.text)
    .filter((t): t is string => Boolean(t))
    .join("\n\n");

  await db
    .insert(transcripts)
    .values({ recordingId, text: fullText })
    .onConflictDoUpdate({ target: transcripts.recordingId, set: { text: fullText } });

  await setStatus(recordingId, "transcribed");
  await emitEvent(recording.projectId, recordingId, "status_changed", { status: "transcribed" });

  await generateBriefingForRecording(recordingId);
}

export async function retryFailedChunks(recordingId: string) {
  const [recording] = await db.select().from(recordings).where(eq(recordings.id, recordingId));
  if (!recording) return;

  const failed = await db
    .select()
    .from(transcriptChunks)
    .where(and(eq(transcriptChunks.recordingId, recordingId), eq(transcriptChunks.status, "failed")));

  if (failed.length === 0) {
    await assembleTranscriptAndGenerateBriefing(recordingId);
    return;
  }

  await setStatus(recordingId, "transcribing");
  await emitEvent(recording.projectId, recordingId, "status_changed", { status: "transcribing" });

  for (const chunk of failed) {
    const chunkPath = path.join(recordingDir(recordingId), "chunks", `chunk-${String(chunk.chunkIndex).padStart(3, "0")}.mp3`);
    await transcribeChunkWithRetry(recording.projectId, recordingId, chunk.id, chunkPath);
  }

  await assembleTranscriptAndGenerateBriefing(recordingId);
}

export async function generateBriefingForRecording(recordingId: string) {
  const [recording] = await db.select().from(recordings).where(eq(recordings.id, recordingId));
  if (!recording) return;

  const [transcript] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.recordingId, recordingId));
  if (!transcript) throw new Error("Transcrição ainda não disponível");

  await setStatus(recordingId, "generating_briefing");
  await emitEvent(recording.projectId, recordingId, "status_changed", { status: "generating_briefing" });

  const generated = await generateStructuredBriefing(transcript.text);

  await db
    .insert(briefings)
    .values({ recordingId, generatedText: generated, draftText: generated, status: "draft" })
    .onConflictDoUpdate({
      target: briefings.recordingId,
      set: { generatedText: generated, draftText: generated },
    });

  await setStatus(recordingId, "ready");
  await emitEvent(recording.projectId, recordingId, "briefing_ready", {});
}
