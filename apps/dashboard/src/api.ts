export interface RecordingChunk {
  id: string;
  index: number;
  status: "pending" | "done" | "failed";
  text: string | null;
}

export interface Recording {
  id: string;
  projectId: string;
  title: string | null;
  status: string;
  source: "live" | "upload";
  durationSeconds: number | null;
  errorMessage: string | null;
  createdAt: string;
  expiresAt: string | null;
  transcriptText: string | null;
  briefingDraft: string | null;
  briefingFinal: string | null;
  briefingStatus: "draft" | "finalized" | null;
  finalizedAt: string | null;
  chunks?: RecordingChunk[];
}

function getToken(): string {
  return new URLSearchParams(location.search).get("t") ?? "";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${getToken()}`,
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body) headers["content-type"] = "application/json";

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export function whoami() {
  return apiFetch<{ name: string; slug: string }>("/api/v1/whoami");
}

export function listRecordings() {
  return apiFetch<{ recordings: Recording[] }>("/api/v1/recordings");
}

export function getRecording(id: string) {
  return apiFetch<Recording>(`/api/v1/recordings/${id}`);
}

export function createRecording(input: {
  source: "live" | "upload";
  title?: string;
  audioBase64: string;
  mimeType: string;
}) {
  return apiFetch<Recording>("/api/v1/recordings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Pequeno de propósito: em produção, um pedaço de 4MB sozinho já levou mais
// de 60s numa conexão de upload lenta e foi cortado pelo timeout do proxy
// (confirmado nos logs — "aborted"/ECONNRESET bem nos 60.0s). 512KB dá
// margem confortável mesmo numa conexão bem ruim.
const UPLOAD_CHUNK_BYTES = 512 * 1024;
// Testado com uma conexão bem lenta simulada (~16KB/s efetivo): um pedaço de
// 512KB levou 43.7s e ainda assim terminou certo. 25s cortaria isso no meio
// sem necessidade. 50s dá margem real pra conexão ruim, ainda ficando abaixo
// do corte duro de 60s do proxy.
const CHUNK_TIMEOUT_MS = 50_000;
const MAX_ATTEMPTS_PER_CHUNK = 4;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function apiFetchWithTimeout<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await apiFetch<T>(path, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sobe o áudio em pedaços pequenos, cada um numa requisição própria com
 * timeout curto e retry — evita que uma requisição grande (ou lenta demais)
 * estoure o timeout do proxy reverso em conexões de upload ruins (era o que
 * causava "Falha ao enviar áudio" em áudios de dezenas de MB).
 */
export async function createRecordingChunked(
  input: { source: "live" | "upload"; title?: string; mimeType: string; blob: Blob },
  onProgress?: (sentBytes: number, totalBytes: number) => void,
): Promise<Recording> {
  const created = await apiFetch<Recording>("/api/v1/recordings", {
    method: "POST",
    body: JSON.stringify({ source: input.source, title: input.title, mimeType: input.mimeType }),
  });

  const total = input.blob.size;
  let sent = 0;
  let index = 0;
  for (let offset = 0; offset < total; offset += UPLOAD_CHUNK_BYTES) {
    const slice = input.blob.slice(offset, offset + UPLOAD_CHUNK_BYTES);
    const dataBase64 = await blobToBase64(slice);

    let lastError: unknown;
    let ok = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_CHUNK && !ok; attempt++) {
      try {
        await apiFetchWithTimeout(
          `/api/v1/recordings/${created.id}/audio-chunk`,
          { method: "POST", body: JSON.stringify({ index, dataBase64 }) },
          CHUNK_TIMEOUT_MS,
        );
        ok = true;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS_PER_CHUNK) await sleep(1000 * attempt);
      }
    }
    if (!ok) {
      throw lastError instanceof Error
        ? lastError
        : new Error(`Falha ao enviar o pedaço ${index} do áudio.`);
    }

    index += 1;
    sent += slice.size;
    onProgress?.(sent, total);
  }

  return apiFetch<Recording>(`/api/v1/recordings/${created.id}/complete-upload`, { method: "POST" });
}

export function deleteRecording(id: string) {
  return apiFetch<{ ok: true }>(`/api/v1/recordings/${id}`, { method: "DELETE" });
}

export function updateBriefingDraft(id: string, text: string) {
  return apiFetch<Recording>(`/api/v1/recordings/${id}/briefing`, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  });
}

export function finalizeRecording(id: string) {
  return apiFetch<Recording>(`/api/v1/recordings/${id}/finalize`, { method: "POST" });
}

export function retryRecording(id: string, stage?: "transcription" | "briefing") {
  return apiFetch<{ ok: true }>(`/api/v1/recordings/${id}/retry`, {
    method: "POST",
    body: JSON.stringify({ stage }),
  });
}
