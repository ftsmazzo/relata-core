import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  clearAdminToken,
  createProject,
  deleteProject,
  getAdminToken,
  listProjects,
  setAdminToken,
  type Project,
} from "../adminApi.js";
import Mark from "../components/Mark.js";

export default function AdminProjects() {
  const [authed, setAuthed] = useState(!!getAdminToken());
  const [tokenInput, setTokenInput] = useState("");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function load() {
    setError("");
    listProjects()
      .then((r) => setProjects(r.projects))
      .catch(() => setError("Falha ao carregar projetos — confira o token de admin."));
  }

  useEffect(() => {
    if (authed) load();
  }, [authed]);

  if (!authed) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="brand">
            <span className="mark">
              <Mark size={14} />
            </span>
            Relata
          </div>
          <input
            type="password"
            placeholder="Token de admin"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tokenInput && (setAdminToken(tokenInput), setAuthed(true))}
          />
          <button
            onClick={() => {
              setAdminToken(tokenInput);
              setAuthed(true);
            }}
            disabled={!tokenInput}
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createProject(newName.trim());
      setNewName("");
      setShowCreate(false);
      load();
    } catch {
      setError("Falha ao criar projeto.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(slug: string) {
    await deleteProject(slug);
    setConfirmDelete(null);
    load();
  }

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="brand">
          <span className="mark">
            <Mark size={14} />
          </span>
          Relata
        </div>
        <button
          style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text)" }}
          onClick={() => {
            clearAdminToken();
            setAuthed(false);
          }}
        >
          Sair
        </button>
      </div>

      <div className="page" style={{ flex: 1 }}>
        <div className="stat-grid">
          <div className="card">
            <div className="hint">Projetos</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{projects?.length ?? "—"}</div>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h1 style={{ margin: 0 }}>Projetos</h1>
          <button onClick={() => setShowCreate((v) => !v)}>{showCreate ? "Cancelar" : "Novo projeto"}</button>
        </div>

        {showCreate && (
          <div className="card">
            <input
              placeholder="Nome do projeto/cliente"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div style={{ marginTop: 10 }}>
              <button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? "Criando…" : "Criar"}
              </button>
            </div>
          </div>
        )}

        {projects === null && <div className="empty-state">Carregando…</div>}
        {projects?.length === 0 && <div className="empty-state">Nenhum projeto ainda.</div>}

        {projects?.map((p) => (
          <div key={p.id} className="project-card">
            <div>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div className="hint">{p.slug}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link to={`/admin/p/${p.slug}/config`}>
                <button style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text)" }}>
                  Configurações
                </button>
              </Link>
              {confirmDelete === p.slug ? (
                <>
                  <button style={{ background: "var(--danger)", color: "#fff" }} onClick={() => handleDelete(p.slug)}>
                    Confirmar
                  </button>
                  <button
                    style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text)" }}
                    onClick={() => setConfirmDelete(null)}
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--danger)" }}
                  onClick={() => setConfirmDelete(p.slug)}
                >
                  Excluir
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
