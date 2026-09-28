import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MIN_CHUNK_BYTES = 2000;

const STORAGE_ROOT = process.env.AUDIO_STORAGE_DIR ?? "/app/data/audio";
const CHUNK_SECONDS = Number(process.env.AUDIO_CHUNK_SECONDS ?? 600);

function extFromMime(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  return "mp3";
}

export function recordingDir(recordingId: string): string {
  return path.join(STORAGE_ROOT, recordingId);
}

export async function saveOriginalAudio(
  recordingId: string,
  audioBase64: string,
  mimeType: string,
): Promise<string> {
  const dir = recordingDir(recordingId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `original.${extFromMime(mimeType)}`);
  await writeFile(filePath, Buffer.from(audioBase64, "base64"));
  return filePath;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg saiu com código ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

export async function splitIntoChunks(originalPath: string, recordingId: string): Promise<string[]> {
  const dir = path.join(recordingDir(recordingId), "chunks");
  await mkdir(dir, { recursive: true });
  const pattern = path.join(dir, "chunk-%03d.mp3");

  await runFfmpeg([
    "-y",
    "-i",
    originalPath,
    "-f",
    "segment",
    "-segment_time",
    String(CHUNK_SECONDS),
    "-c:a",
    "libmp3lame",
    "-ar",
    "16000",
    "-ac",
    "1",
    pattern,
  ]);

  const files = (await readdir(dir)).filter((f) => f.startsWith("chunk-")).sort();
  const paths = files.map((f) => path.join(dir, f));

  const sized = await Promise.all(
    paths.map(async (p) => ({ path: p, size: (await stat(p)).size })),
  );
  const meaningful = sized.filter((f) => f.size >= MIN_CHUNK_BYTES).map((f) => f.path);
  return meaningful.length > 0 ? meaningful : paths;
}

export async function readAudioBuffer(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

export async function probeDurationSeconds(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("close", () => {
      const value = Number.parseFloat(out.trim());
      resolve(Number.isFinite(value) ? Math.round(value) : null);
    });
    proc.on("error", () => resolve(null));
  });
}
