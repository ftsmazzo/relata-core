export interface Project {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface ProjectConfig {
  project: Project;
  widgetToken: string | null;
  accessToken: string | null;
}

const TOKEN_KEY = "relata_admin_token";

export function getAdminToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}
export function setAdminToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${getAdminToken()}`,
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body) headers["content-type"] = "application/json";

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export function listProjects() {
  return adminFetch<{ projects: Project[] }>("/api/v1/admin/projects");
}

export function createProject(name: string) {
  return adminFetch<{ project: Project; widgetToken: string; accessToken: string }>(
    "/api/v1/admin/projects",
    { method: "POST", body: JSON.stringify({ name }) },
  );
}

export function deleteProject(slug: string) {
  return adminFetch<{ ok: true }>(`/api/v1/admin/projects/${slug}`, { method: "DELETE" });
}

export function getProjectConfig(slug: string) {
  return adminFetch<ProjectConfig>(`/api/v1/admin/projects/${slug}/config`);
}

export function regenerateTokens(slug: string) {
  return adminFetch<{ project: Project; widgetToken: string; accessToken: string }>(
    `/api/v1/admin/projects/${slug}/regenerate-tokens`,
    { method: "POST" },
  );
}
