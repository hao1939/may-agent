import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

export const TASK_OUTCOME_RUBRIC_VERSION = "task-outcome-v2";

export type TaskReportEntry = {
  appId: string;
  taskId: string;
  evidenceHash: string;
  executionId: string;
  disposition: string;
  createdAt: number;
  coverage: "bounded-single-task-snapshot";
  jsonPath: string;
  markdownPath: string;
  absoluteJsonPath: string;
  absoluteMarkdownPath: string;
  jsonBytes: number;
  markdownBytes: number;
  jsonSha256: string;
  markdownSha256: string;
};

type PublicationMarker = {
  version: 1;
  accepted: true;
  appId: string;
  taskId: string;
  evidenceHash: string;
  executionId: string;
  jsonPath: string;
  markdownPath: string;
  jsonSha256: string;
  markdownSha256: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
function safe(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 120);
}

export function configuredTaskReportRoot(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = text(env.EVALUATION_REPORT_ROOT);
  if (explicit) return resolve(explicit);
  return resolve(
    text(env.MAY_PERSIST_DIR) || "/app/.state",
    "evaluation",
    "reports",
  );
}

export function taskReportPaths(
  appId: string,
  taskId: string,
  evidenceHash: string,
): { jsonPath: string; markdownPath: string; publicationPath: string } {
  const base = join(
    "task-outcomes",
    safe(appId),
    TASK_OUTCOME_RUBRIC_VERSION,
    `${safe(taskId)}-${evidenceHash.slice(0, 16)}`,
  );
  return {
    jsonPath: `${base}.json`,
    markdownPath: `${base}.md`,
    publicationPath: `${base}.published.json`,
  };
}

export function resolveTaskReportPath(
  root: string,
  relativePath: string,
): string {
  if (!relativePath || isAbsolute(relativePath))
    throw new Error("Report path must be relative");
  const absolute = resolve(root, relativePath);
  const boundary = `${resolve(root)}${sep}`;
  if (!absolute.startsWith(boundary))
    throw new Error("Report path escapes configured root");
  return absolute;
}

export function hashReport(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function writeImmutable(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== content)
      throw new Error(`Immutable report collision at ${path}`);
    return;
  }
  writeFileSync(path, content, { flag: "wx" });
}

export function renderTaskReportMarkdown(payload: unknown): string | null {
  const report = object(payload);
  const subject = object(report.subject);
  const evaluator = object(report.evaluator);
  const judgment = object(report.judgment);
  const appId = text(subject.appId);
  const taskId = text(subject.taskId);
  const evidenceHash = text(subject.evidenceHash);
  const rubricVersion = text(report.rubricVersion);
  const sourceRevision = text(report.sourceRevision);
  const disposition = text(judgment.disposition);
  const summary = text(judgment.summary);
  const responsibility = text(judgment.responsibility);
  const delivery = text(judgment.delivery);
  const executionId = text(evaluator.executionId);
  const createdAt = Number(report.createdAt);
  if (
    !appId ||
    !taskId ||
    !evidenceHash ||
    rubricVersion !== TASK_OUTCOME_RUBRIC_VERSION ||
    !sourceRevision ||
    !["assessed", "insufficient-evidence"].includes(disposition) ||
    !summary ||
    !responsibility ||
    !delivery ||
    !executionId ||
    !Number.isFinite(createdAt)
  )
    return null;
  const findings = strings(judgment.findings).slice(0, 12);
  const verification = strings(judgment.verification).slice(0, 12);
  return `# Evaluation report\n\n- Subject: \`${appId}/${taskId}\`\n- Evidence: \`${evidenceHash}\`\n- Rubric: \`${rubricVersion}\`\n- Source revision: \`${sourceRevision}\`\n- Disposition: \`${disposition}\`\n- Created: \`${new Date(createdAt).toISOString()}\`\n- Evaluator execution: \`${executionId}\`\n- Cost: unknown\n\n## Summary\n\n${summary}\n\n## Responsibility\n\n${responsibility}\n\n## Findings\n\n${findings.map((item) => `- ${item}`).join("\n") || "- None."}\n\n## Verification and delivery\n\n${verification.map((item) => `- ${item}`).join("\n") || "- No verification cited."}\n- Delivery: ${delivery}\n`;
}

export function markTaskReportPublished(
  root: string,
  marker: Omit<PublicationMarker, "version" | "accepted">,
): void {
  const expected = taskReportPaths(
    marker.appId,
    marker.taskId,
    marker.evidenceHash,
  );
  if (
    marker.jsonPath !== expected.jsonPath ||
    marker.markdownPath !== expected.markdownPath
  )
    throw new Error("Publication marker paths do not match report identity");
  writeImmutable(
    resolveTaskReportPath(root, expected.publicationPath),
    `${JSON.stringify({ version: 1, accepted: true, ...marker }, null, 2)}\n`,
  );
}

function publishedEntry(
  root: string,
  markerPath: string,
): TaskReportEntry | null {
  try {
    const marker = object(JSON.parse(readFileSync(markerPath, "utf8")));
    if (marker.version !== 1 || marker.accepted !== true) return null;
    const appId = text(marker.appId);
    const taskId = text(marker.taskId);
    const evidenceHash = text(marker.evidenceHash);
    const executionId = text(marker.executionId);
    const expected = taskReportPaths(appId, taskId, evidenceHash);
    if (
      text(marker.jsonPath) !== expected.jsonPath ||
      text(marker.markdownPath) !== expected.markdownPath ||
      resolveTaskReportPath(root, expected.publicationPath) !== markerPath ||
      !executionId
    )
      return null;
    const absoluteJsonPath = resolveTaskReportPath(root, expected.jsonPath);
    const absoluteMarkdownPath = resolveTaskReportPath(
      root,
      expected.markdownPath,
    );
    const jsonSha256 = hashReport(absoluteJsonPath);
    const markdownSha256 = hashReport(absoluteMarkdownPath);
    if (
      jsonSha256 !== text(marker.jsonSha256) ||
      markdownSha256 !== text(marker.markdownSha256)
    )
      return null;
    const payload = object(JSON.parse(readFileSync(absoluteJsonPath, "utf8")));
    const subject = object(payload.subject);
    const evaluator = object(payload.evaluator);
    const expectedMarkdown = renderTaskReportMarkdown(payload);
    const disposition = text(payload.disposition);
    if (
      text(subject.appId) !== appId ||
      text(subject.taskId) !== taskId ||
      text(subject.evidenceHash) !== evidenceHash ||
      text(evaluator.executionId) !== executionId ||
      disposition !== text(object(payload.judgment).disposition) ||
      !["assessed", "insufficient-evidence"].includes(disposition) ||
      !expectedMarkdown ||
      readFileSync(absoluteMarkdownPath, "utf8") !== expectedMarkdown
    )
      return null;
    return {
      appId,
      taskId,
      evidenceHash,
      executionId,
      disposition,
      createdAt: Number(payload.createdAt),
      coverage: "bounded-single-task-snapshot",
      jsonPath: expected.jsonPath,
      markdownPath: expected.markdownPath,
      absoluteJsonPath,
      absoluteMarkdownPath,
      jsonBytes: statSync(absoluteJsonPath).size,
      markdownBytes: statSync(absoluteMarkdownPath).size,
      jsonSha256,
      markdownSha256,
    };
  } catch {
    return null;
  }
}

export function listTaskReports(root: string, limit = 50): TaskReportEntry[] {
  const base = join(root, "task-outcomes");
  if (!existsSync(base)) return [];
  const bounded = Math.max(1, Math.min(100, Math.trunc(limit)));
  const entries: TaskReportEntry[] = [];
  const pending = [base];
  let scanned = 0;
  while (pending.length && scanned < 500) {
    const directory = pending.shift()!;
    for (const file of readdirSync(directory).sort()) {
      const absolute = join(directory, file);
      if (statSync(absolute).isDirectory()) {
        pending.push(absolute);
        continue;
      }
      if (!file.endsWith(".published.json") || scanned++ >= 500) continue;
      const entry = publishedEntry(root, absolute);
      if (entry) entries.push(entry);
    }
  }
  return entries.sort((a, b) => b.createdAt - a.createdAt).slice(0, bounded);
}

export function isPublishedTaskReportPath(root: string, path: string): boolean {
  return readPublishedTaskReport(root, path) !== null;
}

/** Exact reference reads must not depend on the bounded recent-report listing. */
export function readPublishedTaskReport(root: string, path: string): TaskReportEntry | null {
  if (!/\.(?:json|md)$/.test(path) || path.endsWith(".published.json")) return null;
  try {
    const markerPath = resolveTaskReportPath(root, path.replace(/\.(?:json|md)$/, ".published.json"));
    const entry = publishedEntry(root, markerPath);
    return entry && (entry.jsonPath === path || entry.markdownPath === path) ? entry : null;
  } catch {
    return null;
  }
}
