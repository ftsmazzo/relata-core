import { z } from "zod";

export const RecordingStatus = z.enum([
  "recording",
  "uploading",
  "uploaded",
  "transcribing",
  "transcribed",
  "generating_briefing",
  "ready",
  "error",
]);
export type RecordingStatus = z.infer<typeof RecordingStatus>;

export const RecordingSource = z.enum(["live", "upload"]);
export type RecordingSource = z.infer<typeof RecordingSource>;

export const BriefingStatus = z.enum(["draft", "finalized"]);
export type BriefingStatus = z.infer<typeof BriefingStatus>;

export const CreateRecordingInput = z.object({
  source: RecordingSource,
  title: z.string().max(200).optional(),
  audioBase64: z.string(),
  mimeType: z.string(),
});
export type CreateRecordingInput = z.infer<typeof CreateRecordingInput>;

export const TranscriptChunk = z.object({
  id: z.string(),
  index: z.number().int(),
  status: z.enum(["pending", "done", "failed"]),
  text: z.string().nullable(),
});
export type TranscriptChunk = z.infer<typeof TranscriptChunk>;

export const Recording = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string().nullable(),
  status: RecordingStatus,
  source: RecordingSource,
  durationSeconds: z.number().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  transcriptText: z.string().nullable(),
  briefingDraft: z.string().nullable(),
  briefingFinal: z.string().nullable(),
  briefingStatus: BriefingStatus.nullable(),
  finalizedAt: z.string().nullable(),
  chunks: z.array(TranscriptChunk).optional(),
});
export type Recording = z.infer<typeof Recording>;

export const UpdateBriefingInput = z.object({
  text: z.string(),
});
export type UpdateBriefingInput = z.infer<typeof UpdateBriefingInput>;

export const RecordingEventType = z.enum([
  "status_changed",
  "chunk_done",
  "briefing_ready",
  "recording_finalized",
]);
export type RecordingEventType = z.infer<typeof RecordingEventType>;
