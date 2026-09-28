import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  finalizeRecording,
  getRecording,
  retryRecording,
  updateBriefingDraft,
  type Recording,
} from "../api.js";
import Mark from "../components/Mark.js";

const STATUS_LABEL: Record<string, string> = {
  recording: "Gravando",
  uploaded: "Na fila",
  transcribing: "Transcrevendo",
  transcribed: "Transcrito",
  generating_briefing: "Gerando briefing",
  ready: "Pronto pra revisar",
  error: "Erro",
};

const PROGRESS_STEPS = ["uploaded", "transcribing", "transcribed", "generating_briefing", "ready"];

export default function RecordingDetail() {
  const { slug, id } = useParams();
  const location = useLocation();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");

  function load() {
    if (!id) return;
    getRecording(id)
      .then((r) => {
        setRecording(r);
        setDraft(r.briefingDraft ?? "");
      })
      .catch(() => setError("Falha ao carregar gravação."));
  }

  useEffect(load, [id]);

  useEffect(() => {
    if (!recording) return;
    if (["ready", "error"].includes(recording.status) && recording.briefingStatus === "finalized") return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [recording?.status, recording?.briefingStatus]);

  if (!recording) return <div className="empty-state">{error || "Carregando…"}</div>;

  const stepIndex = PROGRESS_STEPS.indexOf(recording.status);
  const progressPct =
    recording.status === "error" ? 100 : Math.max(0, ((stepIndex + 1) / PROGRESS_STEPS.length) * 100);

  async function handleSaveDraft() {
    if (!id) return;
    setSaving(true);
    try {
      await updateBriefingDraft(id, draft);
    } catch {
      setError("Falha ao salvar edição.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    if (!id) return;
    setFinalizing(true);
    try {
      await handleSaveDraft();
      const updated = await finalizeRecording(id);
      setRecording(updated);
    } catch {
      setError("Falha ao finalizar.");
    } finally {
      setFinalizing(false);
    }
  }

  async function handleRetry(stage?: "transcription" | "briefing") {
    if (!id) return;
    await retryRecording(id, stage);
    load();
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
        <span className="project-name">{slug}</span>
      </div>

      <div className="page">
        <Link to={`/p/${slug}?t=${t}`} className="hint">
          &larr; Voltar
        </Link>

        <div className="card" style={{ marginTop: 14 }}>
          <span className={`tag tag-${recording.status}`}>{STATUS_LABEL[recording.status] ?? recording.status}</span>
          <h1 style={{ marginTop: 10 }}>{recording.title ?? new Date(recording.createdAt).toLocaleString("pt-BR")}</h1>

          {recording.status !== "ready" && recording.status !== "error" && (
            <div style={{ marginTop: 14 }}>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="hint" style={{ marginTop: 6 }}>
                {STATUS_LABEL[recording.status]}… isso continua em segundo plano mesmo se você sair
                dessa página.
              </p>
            </div>
          )}

          {recording.status === "error" && (
            <div className="card" style={{ background: "rgba(240,97,107,0.08)", borderColor: "var(--danger)" }}>
              <p className="error-text">{recording.errorMessage ?? "Falha no processamento."}</p>
              <button onClick={() => handleRetry()}>Tentar novamente</button>
            </div>
          )}

          {recording.chunks?.some((c) => c.status === "failed") && (
            <p className="hint">
              Alguns trechos do áudio falharam na transcrição.{" "}
              <a href="#" onClick={(e) => (e.preventDefault(), handleRetry())}>
                Tentar de novo só esses trechos
              </a>
              .
            </p>
          )}
        </div>

        {recording.transcriptText && (
          <details className="card">
            <summary className="hint">Transcrição completa (não editável)</summary>
            <p style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{recording.transcriptText}</p>
          </details>
        )}

        {recording.briefingDraft !== null && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Briefing técnico estruturado</h2>
            {recording.briefingStatus === "finalized" ? (
              <p style={{ whiteSpace: "pre-wrap" }}>{recording.briefingFinal}</p>
            ) : (
              <>
                <textarea
                  rows={16}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Revise e complete o texto gerado antes de finalizar…"
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={handleSaveDraft} disabled={saving}>
                    {saving ? "Salvando…" : "Salvar rascunho"}
                  </button>
                  <button onClick={handleFinalize} disabled={finalizing || !draft.trim()}>
                    {finalizing ? "Finalizando…" : "Finalizar"}
                  </button>
                  <button
                    style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text)" }}
                    onClick={() => handleRetry("briefing")}
                  >
                    Gerar de novo
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {recording.briefingStatus === "finalized" && (
          <p className="hint">
            Finalizado em {recording.finalizedAt && new Date(recording.finalizedAt).toLocaleString("pt-BR")}. Já
            disponível pro Cursor puxar via MCP.
          </p>
        )}
      </div>
    </div>
  );
}
