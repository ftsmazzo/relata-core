type RecordingRow = typeof import("./db/schema.js").recordings.$inferSelect;
type TranscriptRow = typeof import("./db/schema.js").transcripts.$inferSelect;
type BriefingRow = typeof import("./db/schema.js").briefings.$inferSelect;
type ChunkRow = typeof import("./db/schema.js").transcriptChunks.$inferSelect;

export function serializeRecording(
  row: RecordingRow,
  transcript: TranscriptRow | undefined,
  briefing: BriefingRow | undefined,
  chunks: ChunkRow[] = [],
) {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    status: row.status,
    source: row.source,
    durationSeconds: row.durationSeconds,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    transcriptText: transcript?.text ?? null,
    briefingDraft: briefing?.draftText ?? null,
    briefingFinal: briefing?.finalText ?? null,
    briefingStatus: briefing?.status ?? null,
    finalizedAt: briefing?.finalizedAt?.toISOString() ?? null,
    chunks: chunks
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map((c) => ({ id: c.id, index: c.chunkIndex, status: c.status, text: c.text })),
  };
}
