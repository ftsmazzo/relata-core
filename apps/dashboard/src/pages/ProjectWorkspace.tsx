import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { createRecordingChunked, deleteRecording, listRecordings, whoami, type Recording } from "../api.js";
import Mark from "../components/Mark.js";

const STATUS_LABEL: Record<string, string> = {
  recording: "Gravando",
  uploading: "Enviando",
  uploaded: "Na fila",
  transcribing: "Transcrevendo",
  transcribed: "Transcrito",
  generating_briefing: "Gerando briefing",
  ready: "Pronto pra revisar",
  error: "Erro",
};

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function ProjectWorkspace() {
  const { slug } = useParams();
  const location = useLocation();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [error, setError] = useState("");

  const [recorderState, setRecorderState] = useState<"idle" | "recording" | "stopped">("idle");
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);

  function load() {
    listRecordings()
      .then((r) => setRecordings(r.recordings))
      .catch(() => setError("Falha ao carregar histórico."));
  }

  useEffect(() => {
    whoami()
      .then((r) => setProjectName(r.name))
      .catch(() => setError("Token inválido ou projeto não encontrado."));
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [slug]);

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(
        "Este navegador não permite gravar áudio aqui (precisa de HTTPS e de um navegador com suporte a gravação). Use o envio de arquivo abaixo.",
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(
          "O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço, permita o Microfone para este site e tente de novo.",
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("Nenhum microfone encontrado neste dispositivo.");
      } else if (name === "NotReadableError") {
        setError("O microfone está em uso por outro app. Feche o outro app e tente de novo.");
      } else {
        setError(`Não foi possível acessar o microfone: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }

    try {
      chunksRef.current = [];
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = preferred.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        recordedBlobRef.current = new Blob(chunksRef.current, { type: recorder.mimeType });
        stream.getTracks().forEach((t) => t.stop());
        setRecorderState("stopped");
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) window.clearInterval(timerRef.current);
        setRecorderState("idle");
        setError("Ocorreu um erro durante a gravação. Tente de novo.");
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setSeconds(0);
      setRecorderState("recording");
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setError(`Não foi possível iniciar a gravação: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function stopRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  async function sendRecording(blob: Blob, source: "live" | "upload", mimeType: string) {
    setUploading(true);
    setUploadPct(0);
    setError("");
    try {
      await createRecordingChunked({ source, mimeType, blob }, (sent, total) => {
        setUploadPct(total > 0 ? Math.round((sent / total) * 100) : 0);
      });
      recordedBlobRef.current = null;
      setRecorderState("idle");
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Falha ao enviar áudio: ${message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadFile(file: File) {
    await sendRecording(file, "upload", file.type || "audio/mpeg");
  }

  const query = new URLSearchParams(location.search);
  const t = query.get("t") ?? "";

  return (
    <div>
      <div className="topbar">
        <span className="brand">
          <span className="mark">
            <Mark size={14} />
          </span>
          Relata
        </span>
        <div className="spacer" />
        <span className="project-name">{projectName ?? slug}</span>
      </div>

      <div className="page">
        {error && <p className="error-text">{error}</p>}

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Nova gravação</h2>

          {recorderState !== "stopped" && (
            <>
              <button
                className={`record-button ${recorderState === "recording" ? "active" : ""}`}
                onClick={recorderState === "recording" ? stopRecording : startRecording}
              >
                {recorderState === "recording" ? "Parar" : "Gravar"}
              </button>
              {recorderState === "recording" && <div className="timer">{formatTimer(seconds)}</div>}
            </>
          )}

          {recorderState === "stopped" && recordedBlobRef.current && (
            <div style={{ textAlign: "center" }}>
              <p>Gravação parada — {formatTimer(seconds)}. Pronta pra enviar.</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button
                  disabled={uploading}
                  onClick={() =>
                    recordedBlobRef.current &&
                    sendRecording(recordedBlobRef.current, "live", recordedBlobRef.current.type || "audio/webm")
                  }
                >
                  {uploading ? "Enviando e transcrevendo…" : "Enviar pra transcrever"}
                </button>
                <button
                  style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text)" }}
                  onClick={() => {
                    recordedBlobRef.current = null;
                    setRecorderState("idle");
                  }}
                >
                  Descartar
                </button>
              </div>
            </div>
          )}

          {uploading && (
            <div style={{ marginTop: 14 }}>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${uploadPct}%` }} />
              </div>
              <p className="hint" style={{ marginTop: 6 }}>
                Enviando… {uploadPct}%
              </p>
            </div>
          )}

          <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <label className="hint">Ou envie um áudio já gravado:</label>
            <input
              type="file"
              accept="audio/*"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])}
            />
          </div>
        </div>

        <h2>Histórico</h2>
        {recordings === null && <div className="empty-state">Carregando…</div>}
        {recordings?.length === 0 && <div className="empty-state">Nenhuma gravação ainda.</div>}
        {recordings?.map((r) => (
          <div key={r.id} className="project-card">
            <Link
              to={`/p/${slug}/r/${r.id}?t=${t}`}
              style={{ textDecoration: "none", color: "inherit", flex: 1 }}
            >
              <div style={{ fontWeight: 600 }}>{r.title ?? new Date(r.createdAt).toLocaleString("pt-BR")}</div>
              <div className="hint">
                {r.durationSeconds ? formatTimer(r.durationSeconds) : "—"} ·{" "}
                {new Date(r.createdAt).toLocaleString("pt-BR")}
              </div>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={`tag tag-${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
              {confirmDeleteId === r.id ? (
                <>
                  <button
                    style={{ background: "var(--danger)", color: "#fff", padding: "3px 10px", fontSize: 12 }}
                    onClick={async () => {
                      await deleteRecording(r.id);
                      setConfirmDeleteId(null);
                      load();
                    }}
                  >
                    Confirmar
                  </button>
                  <button
                    style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text)", padding: "3px 10px", fontSize: 12 }}
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--danger)", padding: "3px 10px", fontSize: 12 }}
                  onClick={() => setConfirmDeleteId(r.id)}
                >
                  Apagar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
