const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY não configurada");
  return key;
}

function formatFromMime(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  return "mp3";
}

export async function transcribeAudioChunk(
  audio: Buffer,
  mimeType: string,
): Promise<string> {
  const model = process.env.WHISPER_MODEL ?? "openai/whisper-large-v3";
  const res = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input_audio: {
        data: audio.toString("base64"),
        format: formatFromMime(mimeType),
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Falha na transcrição (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { text?: string };
  return json.text ?? "";
}

const BRIEFING_SYSTEM_PROMPT = `Você recebe a transcrição de uma reunião com um cliente de uma agência de desenvolvimento de software/dados.
Gere um texto técnico estruturado, em português, pronto pra um desenvolvedor ou uma IA de codificação (Cursor/Claude Code) agir em cima dele. Estruture como:

## Contexto
## Demandas identificadas (lista objetiva, uma por item)
## Detalhes técnicos mencionados (se houver)
## Pontos em aberto / a confirmar com o cliente

Seja objetivo, não invente informação que não está na transcrição, e não repita a transcrição literalmente.`;

export async function generateStructuredBriefing(transcriptText: string): Promise<string> {
  const model = process.env.BRIEFING_MODEL ?? "anthropic/claude-sonnet-4.5";
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: BRIEFING_SYSTEM_PROMPT },
        { role: "user", content: transcriptText },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Falha na geração do briefing (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}
