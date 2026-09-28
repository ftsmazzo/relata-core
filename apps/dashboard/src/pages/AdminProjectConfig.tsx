import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProjectConfig, regenerateTokens, type ProjectConfig } from "../adminApi.js";
import Mark from "../components/Mark.js";

const origin = () => window.location.origin;

function CopyField({
  label,
  value,
  fieldKey,
  copiedKey,
  onCopy,
  multiline,
}: {
  label: string;
  value: string;
  fieldKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  multiline?: boolean;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{label}</label>
        <button onClick={() => onCopy(value, fieldKey)} style={{ padding: "3px 10px", fontSize: 11.5 }}>
          {copiedKey === fieldKey ? "Copiado ✓" : "Copiar"}
        </button>
      </div>
      <pre style={multiline ? { whiteSpace: "pre-wrap" } : undefined}>{value}</pre>
    </div>
  );
}

export default function AdminProjectConfig() {
  const { slug } = useParams();
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [error, setError] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function load() {
    if (!slug) return;
    setError("");
    getProjectConfig(slug)
      .then(setConfig)
      .catch(() => setError("Falha ao carregar configuração."));
  }

  useEffect(load, [slug]);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  async function handleRegenerate() {
    if (!slug) return;
    setRegenerating(true);
    setError("");
    try {
      const result = await regenerateTokens(slug);
      setConfig({ project: result.project, widgetToken: result.widgetToken, accessToken: result.accessToken });
    } catch {
      setError("Falha ao gerar novo token.");
    } finally {
      setRegenerating(false);
    }
  }

  if (!config) {
    return <div className="empty-state">{error || "Carregando…"}</div>;
  }

  const { accessToken } = config;

  return (
    <div>
      <div className="topbar">
        <a href="/admin" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="mark">
            <Mark size={14} />
          </span>
          Relata
        </a>
        <div className="spacer" />
        <span className="project-name">{slug}</span>
      </div>

      <div className="page">
        <Link to="/admin" className="hint">
          &larr; Todos os projetos
        </Link>
        <h1 style={{ marginTop: 10 }}>Configurações — {config.project.name}</h1>
        <p className="hint" style={{ marginBottom: 20 }}>
          Veja isso sempre que precisar conectar mais uma ferramenta (Cursor, Claude Code) — ver aqui
          não invalida nada que já está conectado.
        </p>

        {error && <p className="error-text">{error}</p>}

        {!accessToken && (
          <div className="card">
            <p>
              Esse projeto foi criado antes dessa tela existir, então o token não ficou salvo de
              forma recuperável — só dá pra gerar um novo (isso desconecta quem já estiver usando
              o token antigo, uma única vez).
            </p>
            <button onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? "Gerando…" : "Gerar token pela primeira vez"}
            </button>
          </div>
        )}

        {accessToken && (
          <div className="created-box">
            <p>
              <strong>1. Link do painel</strong> (mande pro time — grava/sobe áudio e revisa o briefing):
            </p>
            <CopyField
              label="Link"
              value={`${origin()}/p/${config.project.slug}?t=${accessToken}`}
              fieldKey="painel"
              copiedKey={copiedKey}
              onCopy={copy}
            />

            <p>
              <strong>2. Conectar no Claude Code</strong> (terminal, roda uma vez):
            </p>
            <CopyField
              label="Comando"
              value={`claude mcp add --transport http relata-${config.project.slug} ${origin()}/mcp -H "Authorization: Bearer ${accessToken}" -s user`}
              fieldKey="claude-cmd"
              copiedKey={copiedKey}
              onCopy={copy}
            />

            <p>
              <strong>3. Conectar no Cursor</strong> — cole em <code>Settings → MCP → Add new MCP
              server</code>:
            </p>
            <CopyField
              label="Config JSON"
              value={`{\n  "mcpServers": {\n    "relata-${config.project.slug}": {\n      "url": "${origin()}/mcp",\n      "headers": { "Authorization": "Bearer ${accessToken}" }\n    }\n  }\n}`}
              fieldKey="cursor-json"
              copiedKey={copiedKey}
              onCopy={copy}
              multiline
            />
            <p className="hint">
              Depois de conectado, peça pro Cursor rodar a tool <code>list_ready_briefings</code> pra
              ver os briefings finalizados deste projeto.
            </p>
          </div>
        )}

        {accessToken && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--danger)", marginTop: 10 }}
          >
            {regenerating ? "Gerando…" : "Revogar e gerar token novo"}
          </button>
        )}
      </div>
    </div>
  );
}
