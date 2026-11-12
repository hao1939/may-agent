import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { loadProjectReadModel } from "../core/tasks/app-task-runtime-state.js";

export function normalizeProjectPathForCompare(path: string): string {
  const normalized = path
    .trim()
    .replace(/^\/app\/agents\/shared\/projects\//, "projects/")
    .replace(/^\/app\/shared\/projects\//, "projects/")
    .replace(/^agents\/shared\/projects\//, "projects/")
    .replace(/^shared\/projects\//, "projects/")
    .replace(/^\/app\/projects\//, "projects/")
    .replace(/^\.?\//, "")
    .replace(/^agents\//, "")
    .replace(/\/project\.md$/, "")
    .replace(/\/$/, "");
  const projectsIdx = normalized.indexOf("projects/");
  return projectsIdx >= 0 ? normalized.slice(projectsIdx) : normalized;
}

export function projectPathIdentity(path: string) {
  const parts = normalizeProjectPathForCompare(path).split("/");
  const shared = parts[0] === "projects";
  const name = (shared ? (parts[1] ?? "") : (parts.at(-1) ?? "")).replace(/\.md$/, "");
  const legacyOwner = shared ? "shared" : parts[1];
  const agent = path
    .replace(/^\/app\//, "")
    .replace(/^\.\//, "")
    .match(/^(?:agents\/)?([^/]+)\/workspace\/projects\//)?.[1];
  const owner = agent ?? legacyOwner;
  const projectId = `${owner}/${name}`;
  return { name, owner, legacyOwner, projectId, projectIds: [...new Set([projectId, `${legacyOwner}/${name}`])] };
}

function parseProjectSource(content: string): Record<string, unknown> | null {
  return content.trim().startsWith("{") ? JSON.parse(content) as Record<string, unknown> : null;
}

// Preserve the exact old target, including the Markdown owner boundary bug.
// Session reads may expand aliases; controls always retain this one identity.
function legacyProjectIdentity(path: string, content: string, source: Record<string, unknown> | null) {
  const fallback = projectPathIdentity(path);
  const name = source && typeof source.id === "string" && source.id.trim() ? source.id.trim() : fallback.name;
  const oldOwner = content
    .match(/^---\s*\n[\s\S]*?\nowner:\s*([^\n]+)\n[\s\S]*?\n---/m)?.[1]
    .trim()
    .replace(/^["']|["']$/g, "");
  const owner = source
    ? typeof source.owner === "string" && source.owner.trim()
      ? source.owner.trim()
      : fallback.legacyOwner
    : oldOwner || fallback.legacyOwner;
  return { name, owner, projectId: `${owner}/${name}` };
}

/** Controls need source identity, without posture reads or strict display parsing. */
export function readProjectIngressIdentity(path: string, filePath: string) {
  const content = readFileSync(filePath, "utf8");
  let source: Record<string, unknown> | null = null;
  try { source = parseProjectSource(content); }
  catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  return legacyProjectIdentity(path, content, source);
}

/** Read-only HTTP metadata. Source identity stays separate from mutable posture. */
export function readProjectMetadata(path: string, filePath: string) {
  const fallback = projectPathIdentity(path);
  const content = readFileSync(filePath, "utf8");
  const source = parseProjectSource(content);
  const legacyIdentity = legacyProjectIdentity(path, content, source);
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const frontmatter: Record<string, string> = {};
  for (const line of match?.[1].split(/\r?\n/) ?? []) {
    const field = line.match(/^([a-z_][a-z0-9_-]*):\s*(.+?)\s*$/i);
    if (field) frontmatter[field[1].toLowerCase()] = field[2];
  }
  const shared = !/workspace\/projects\//.test(path);
  const body = match ? content.slice(match[0].length) : content;
  const data: Record<string, unknown> = source ? loadProjectReadModel(dirname(filePath), source) : frontmatter;
  const field = (key: string): string | null => {
    const value = data[key];
    if (value !== undefined && value !== null) return String(value);
    if (shared) return null;
    const title = key[0].toUpperCase() + key.slice(1);
    return content.match(new RegExp(`^\\*\\*${title}\\*\\*:\\s*(.+)$`, "m"))?.[1].trim() ?? null;
  };
  const { name } = legacyIdentity;
  const owner = source
    ? typeof source.owner === "string" && source.owner.trim()
      ? source.owner.trim()
      : fallback.owner
    : field("owner") || fallback.owner;
  if (source) Object.assign(data, { id: name, owner });
  const projectId = `${owner}/${name}`;
  const formatErrors: string[] = [];
  if (!source && shared) {
    if (!match) formatErrors.push("missing YAML frontmatter");
    for (const key of ["id", "owner", "status"]) {
      if (!frontmatter[key]) formatErrors.push(`missing frontmatter field: ${key}`);
    }
    if (body.match(/^\s*\*\*(Owner|Status):?\*\*:?\s*/im)) formatErrors.push("metadata duplicated as bold body field");
  }
  return {
    content,
    body,
    data,
    frontmatter,
    field,
    name,
    owner,
    projectId,
    projectIds: [...new Set([projectId, legacyIdentity.projectId])],
    formatErrors,
    isJson: source !== null,
  };
}
