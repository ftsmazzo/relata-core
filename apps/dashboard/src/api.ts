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
