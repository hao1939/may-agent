/**
 * project-schema — Parsers, validators, and editors for project.md files.
 *
 * Project files have a YAML frontmatter block followed by a Markdown body.
 * These helpers parse and edit the frontmatter without touching the body,
 * and provide convenience operations for the canonical sections (Comments,
 * Discussion) that the project workflow uses.
 *
 * Promoted to @may-agent/sdk so project-scoped workflows can edit their own
 * project.md without importing from shared/lib.
 */

import { existsSync, appendFileSync, writeFileSync } from "node:fs";

// ── Types ────────────────────────────────────────────────────────────────

export type ProjectMeta = Record<string, string>;

const FIELD_TO_META_KEY: Record<string, string> = {
  "Project": "name",
  "Name": "name",
  "Owner": "owner",
  "Status": "status",
  "Type": "type",
  "Priority": "priority",
  "Workflow": "workflow",
  "Iteration": "iteration",
  "Stop Reason": "stop_reason",
  "Resume Condition": "resume_condition",
};

// ── Parsers ──────────────────────────────────────────────────────────────

export function parseProjectMeta(content: string): ProjectMeta {
  const m = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!m) return {};
  const meta: ProjectMeta = {};
  for (const line of m[1].split("\n")) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) continue;
    const rawValue = field[2];
    meta[field[1].toLowerCase()] = decodeScalar(rawValue);
  }
  return meta;
}

/**
 * Decode a YAML-frontmatter scalar value.
 *
 * Supports two forms:
 *   - bare: trimmed, with surrounding single-quotes stripped (legacy).
 *   - double-quoted: JS-style escapes (\n, \t, \\, \"). Used by
 *     formatProjectMeta when values contain newlines or special chars.
 */
function decodeScalar(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    // Double-quoted: decode escapes.
    const inner = trimmed.slice(1, -1);
    return inner.replace(/\\([\\"nrt])/g, (_, ch) => {
      switch (ch) {
        case "n": return "\n";
        case "r": return "\r";
        case "t": return "\t";
        case "\\": return "\\";
        case '"': return '"';
        default: return ch;
      }
    });
  }
  // Legacy bare: strip surrounding single-quotes if present.
  return trimmed.replace(/^'|'$/g, "");
}

/**
 * Encode a value for YAML frontmatter.
 *
 * Bare scalar if value is safe; double-quoted with JS-style escapes
 * otherwise. "Safe" means: no newlines, tabs, leading/trailing whitespace,
 * no surrounding quotes, no `#` (comment), no leading `[{|>&*!%@`` or `'"`,
 * no `: ` (which would split into another field).
 */
function encodeScalar(value: string): string {
  if (value === "") return "";
  const needsQuoting =
    /[\n\r\t"\\]/.test(value) ||
    /^\s|\s$/.test(value) ||
    /^[#&*!%@`>|'"\[\{]/.test(value) ||
    /:\s/.test(value);
  if (!needsQuoting) return value;
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

function stripProjectMeta(content: string): string {
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, "");
}

function formatProjectMeta(meta: ProjectMeta): string {
  const preferred = ["id", "owner", "status", "type", "priority", "workflow", "iteration", "stop_reason", "resume_condition", "resume_after"];
  const keys = [
    ...preferred.filter(key => meta[key] !== undefined && meta[key] !== ""),
    ...Object.keys(meta).filter(key => !preferred.includes(key) && meta[key] !== undefined && meta[key] !== "").sort(),
  ];
  return ["---", ...keys.map(key => `${key}: ${encodeScalar(meta[key])}`), "---", "", ""].join("\n");
}

export function validateProjectFormat(content: string, expectedId?: string): string[] {
  const errors: string[] = [];
  const hasFrontmatter = /^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/.test(content);
  const meta = parseProjectMeta(content);

  if (!hasFrontmatter) {
    errors.push("missing YAML frontmatter");
  }
  for (const key of ["id", "owner", "status"]) {
    if (!meta[key]) errors.push(`missing frontmatter field: ${key}`);
  }
  if (expectedId && meta.id && meta.id !== expectedId) {
    errors.push(`frontmatter id '${meta.id}' does not match directory '${expectedId}'`);
  }
  if (meta.workflow === "master-worker" || meta.workflow === "master-worker-execute") {
    errors.push("projects should not use legacy master-worker workflow; pick a per-project or shared workflow");
  }
  if (/^\s*\*\*(Owner|Status):?\*\*:?\s*/mi.test(stripProjectMeta(content))) {
    errors.push("metadata duplicated as bold body field");
  }

  return errors;
}

// ── Editors ──────────────────────────────────────────────────────────────

/** Update a project metadata field in YAML frontmatter. */
export function updateField(content: string, field: string, value: string): string {
  const metaKey = FIELD_TO_META_KEY[field] ?? field.toLowerCase().replace(/\s+/g, "_");
  const meta = parseProjectMeta(content);
  meta[metaKey] = value;
  return formatProjectMeta(meta) + stripProjectMeta(content).replace(/^\n+/, "");
}

/** Append a comment to the ## Comments section (legacy single-file format). */
export function appendComment(content: string, comment: string): string {
  const now = new Date().toISOString().slice(0, 10);
  const entry = `- [${now}] ${comment}`;

  if (content.includes("## Comments")) {
    return content.replace(/(## Comments\s*\n)/, `$1${entry}\n`);
  }
  return content + `\n## Comments\n${entry}\n`;
}

/**
 * Append a comment to the project's discussion.md in the canonical format:
 *
 *     ### <author> - YYYY-MM-DD
 *     <body>
 *
 * Creates the file with a `# Discussion` header if missing.
 */
export function appendDiscussionComment(
  projectDir: string,
  comment: string,
  author = "system",
): void {
  const date = new Date().toISOString().slice(0, 10);
  const entry = `\n### ${author.trim() || "system"} - ${date}\n${comment.trim()}\n`;
  const discPath = `${projectDir}/discussion.md`;
  if (existsSync(discPath)) appendFileSync(discPath, entry, "utf-8");
  // Seed with `---read @iter0---` so the no-marker code path (which would
  // treat the entire body as unread) never fires on a freshly created file.
  else writeFileSync(discPath, `# Discussion\n\n---read @iter0---\n${entry}`, "utf-8");
}

/**
 * Extract the unread tail of a discussion.md file.
 *
 * Convention: a `---read @iter<N>---` marker line is appended by the project
 * workflow after each iteration; anything after the *last* such marker is
 * unread. If there is no marker yet, everything after the H1 header is unread.
 */
export function unreadDiscussionTail(disc: string): string {
  const lastMarker = disc.lastIndexOf("---read @");
  if (lastMarker >= 0) {
    const afterMarker = disc.indexOf("\n", lastMarker);
    return afterMarker === -1 ? "" : disc.slice(afterMarker + 1).trim();
  }
  const h1 = disc.match(/^#\s+.*$/m);
  if (!h1) return disc.trim();
  const headerEnd = disc.indexOf("\n", (h1.index ?? 0) + h1[0].length - 1);
  return headerEnd === -1 ? "" : disc.slice(headerEnd + 1).trim();
}
