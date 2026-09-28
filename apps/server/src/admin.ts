import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db/client.js";
import { projects, projectTokens } from "./db/schema.js";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function insertTokenPair(projectId: string) {
  const widget = generateToken();
  const access = generateToken();

  await db.insert(projectTokens).values([
    { projectId, kind: "widget", tokenHash: hashToken(widget), tokenPlain: widget },
    { projectId, kind: "access", tokenHash: hashToken(access), tokenPlain: access },
  ]);

  return { widgetToken: widget, accessToken: access };
}

export async function createProjectWithTokens(name: string, slugArg?: string) {
  const slug = slugArg ? slugify(slugArg) : slugify(name);
  const [project] = await db.insert(projects).values({ name, slug }).returning();
  const tokens = await insertTokenPair(project.id);
  return { project, ...tokens };
}

export async function regenerateTokensForProject(slug: string) {
  const [project] = await db.select().from(projects).where(eq(projects.slug, slug));
  if (!project) throw new Error("Projeto não encontrado");

  await db
    .update(projectTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(projectTokens.projectId, project.id), isNull(projectTokens.revokedAt)));

  const tokens = await insertTokenPair(project.id);
  return { project, ...tokens };
}

export async function getActiveTokensForProject(slug: string) {
  const [project] = await db.select().from(projects).where(eq(projects.slug, slug));
  if (!project) return null;

  const rows = await db
    .select()
    .from(projectTokens)
    .where(and(eq(projectTokens.projectId, project.id), isNull(projectTokens.revokedAt)));

  const widgetToken = rows.find((r) => r.kind === "widget")?.tokenPlain ?? null;
  const accessToken = rows.find((r) => r.kind === "access")?.tokenPlain ?? null;
  return { project, widgetToken, accessToken };
}

export async function resolveProjectByAccessToken(token: string) {
  const hash = hashToken(token);
  const [row] = await db
    .select()
    .from(projectTokens)
    .where(and(eq(projectTokens.tokenHash, hash), isNull(projectTokens.revokedAt)));
  if (!row || row.kind !== "access") return null;

  const [project] = await db.select().from(projects).where(eq(projects.id, row.projectId));
  return project ?? null;
}

export function isValidAdminToken(candidate: string | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
