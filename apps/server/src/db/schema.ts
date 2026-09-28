import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectTokens = pgTable("project_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["widget", "access"] }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  tokenPlain: text("token_plain"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recordings = pgTable("recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title"),
  status: text("status", {
    enum: [
      "recording",
      "uploading",
      "uploaded",
      "transcribing",
      "transcribed",
      "generating_briefing",
      "ready",
      "error",
    ],
  })
    .notNull()
    .default("uploaded"),
  source: text("source", { enum: ["live", "upload"] }).notNull(),
  audioPath: text("audio_path").notNull(),
  mimeType: text("mime_type").notNull(),
  durationSeconds: integer("duration_seconds"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const transcriptChunks = pgTable("transcript_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordingId: uuid("recording_id")
    .notNull()
    .references(() => recordings.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  status: text("status", { enum: ["pending", "done", "failed"] })
    .notNull()
    .default("pending"),
  text: text("text"),
  attempts: integer("attempts").notNull().default(0),
});

export const transcripts = pgTable("transcripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordingId: uuid("recording_id")
    .notNull()
    .unique()
    .references(() => recordings.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const briefings = pgTable("briefings", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordingId: uuid("recording_id")
    .notNull()
    .unique()
    .references(() => recordings.id, { onDelete: "cascade" }),
  generatedText: text("generated_text"),
  draftText: text("draft_text"),
  finalText: text("final_text"),
  status: text("status", { enum: ["draft", "finalized"] }).notNull().default("draft"),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  recordingId: uuid("recording_id").references(() => recordings.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
