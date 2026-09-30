import { renderPopulation } from "./task-population-evidence.js";
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
export const SYSTEMIC_TASK_RUBRIC_VERSION = "task-obligation-v2";
export const ONGOING_TASK_RUBRIC_VERSION = "task-obligation-v1";
export const METRIC_RUBRIC_VERSION = "metric-observation-v1";
export const SUPPORTED_TASK_RUBRIC_VERSIONS = new Set([
  TASK_OUTCOME_RUBRIC_VERSION,
  ONGOING_TASK_RUBRIC_VERSION,
  SYSTEMIC_TASK_RUBRIC_VERSION,
]);

export type AssessmentPurpose = "outcome" | "ongoing" | "metric";

export type TaskReportEntry = {
  appId: string;
  reviewer: string;
  taskId?: string;
  metricId?: string;
  evidenceHash: string;
  executionId: string;
  disposition: string;
  createdAt: number;
  purpose: AssessmentPurpose;
  rubricVersion: string;
  sourceRevision: string;
  validityIdentity: string;
  validity: Record<string, unknown> | null;
  snapshot: Record<string, unknown> | null;
  freshness: Record<string, unknown> | null;
  coverage: "bounded-single-task-snapshot" | "bounded-metric-observation";
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
  taskId?: string;
  metricId?: string;
  evidenceHash: string;
  executionId: string;
  reviewer?: string;
  rubricVersion?: string;
  validityIdentity?: string;
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
function representableTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function purposeMatchesRubric(
  purpose: string,
  rubricVersion: string,
): purpose is AssessmentPurpose {
  return (
    (purpose === "metric" && rubricVersion === METRIC_RUBRIC_VERSION) ||
    (purpose === "outcome" && rubricVersion === TASK_OUTCOME_RUBRIC_VERSION) ||
    (purpose === "ongoing" &&
      [ONGOING_TASK_RUBRIC_VERSION, SYSTEMIC_TASK_RUBRIC_VERSION].includes(
        rubricVersion,
      ))
  );
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
  rubricVersion = TASK_OUTCOME_RUBRIC_VERSION,
  validityIdentity = "",
  reviewer = "evaluator",
): { jsonPath: string; markdownPath: string; publicationPath: string } {
  if (!SUPPORTED_TASK_RUBRIC_VERSIONS.has(rubricVersion))
    throw new Error(`Unsupported Task assessment rubric: ${rubricVersion}`);
  const validitySuffix = validityIdentity
    ? `-${createHash("sha256").update(validityIdentity).digest("hex").slice(0, 12)}`
    : "";
  // Preserve every existing Sol path byte-for-byte; only alternate reviewers
  // receive a namespaced report tree.
  const reviewerParts = reviewer === "evaluator" ? [] : [safe(reviewer)];
  const base = join(
    "task-outcomes",
    ...reviewerParts,
    safe(appId),
    rubricVersion,
    `${safe(taskId)}-${evidenceHash.slice(0, 16)}${validitySuffix}`,
  );
  return {
    jsonPath: `${base}.json`,
    markdownPath: `${base}.md`,
    publicationPath: `${base}.published.json`,
  };
}

export function metricEvidenceHash(evidence: unknown): string {
  return createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
}

export function metricReportPaths(
  appId: string,
  metricId: string,
  evidenceHash: string,
  reviewer = "evaluator",
) {
  const identity = createHash("sha256")
    .update(`${appId}\0${metricId}`)
    .digest("hex")
    .slice(0, 16);
  const base = join(
    "metric-observations",
    safe(reviewer),
    safe(appId),
    METRIC_RUBRIC_VERSION,
    `${safe(metricId)}-${identity}-${evidenceHash}`,
  );
  return {
    jsonPath: `${base}.json`,
    markdownPath: `${base}.md`,
    publicationPath: `${base}.published.json`,
  };
}

function publicationPaths(
  marker: Pick<
    PublicationMarker,
    | "appId"
    | "taskId"
    | "metricId"
    | "evidenceHash"
    | "rubricVersion"
    | "validityIdentity"
    | "reviewer"
  >,
) {
  if (marker.metricId) {
    if (
      marker.taskId ||
      marker.rubricVersion !== METRIC_RUBRIC_VERSION ||
      marker.validityIdentity
    )
      throw new Error(
        "Metric publication requires an exact metric subject and rubric",
      );
    return metricReportPaths(
      marker.appId,
      marker.metricId,
      marker.evidenceHash,
      marker.reviewer,
    );
  }
  if (!marker.taskId) throw new Error("Publication subject is missing");
  return taskReportPaths(
    marker.appId,
    marker.taskId,
    marker.evidenceHash,
    marker.rubricVersion,
    marker.validityIdentity,
    marker.reviewer,
  );
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
  const metricId = text(subject.metricId);
  const evidenceHash = text(subject.evidenceHash);
  const rubricVersion = text(report.rubricVersion);
  const sourceRevision = text(report.sourceRevision);
  const assessment = object(report.assessment);
  const purpose =
    text(assessment.purpose) ||
    (rubricVersion === TASK_OUTCOME_RUBRIC_VERSION ? "outcome" : "");
  const validity = object(assessment.validity);
  const snapshot = object(report.snapshot);
  const freshness = object(report.freshness);
  const freshnessStatus = text(freshness.status);
  if (
    Object.keys(snapshot).length &&
    (text(snapshot.evidenceHash) !== evidenceHash ||
      (!metricId &&
        (!Number.isSafeInteger(Number(snapshot.generation)) ||
          Number(snapshot.generation) < 1)) ||
      (assessment.validityIdentity !== undefined &&
        text(snapshot.validityIdentity) !== text(assessment.validityIdentity)))
  )
    return null;
  if (
    Object.keys(freshness).length &&
    (!["current", "stale", "unavailable"].includes(freshnessStatus) ||
      !representableTimestamp(freshness.checkedAt) ||
      freshness.checkedAt < 0)
  )
    return null;
  const disposition = text(judgment.disposition);
  const summary = text(judgment.summary);
  const responsibility = text(judgment.responsibility);
  const delivery = text(judgment.delivery);
  const executionId = text(evaluator.executionId);
  const reviewer = text(evaluator.reviewer);
  const configuredModel = text(evaluator.configuredModel);
  const observedModel = text(evaluator.observedModel) || "unknown:not-exposed";
  const reviewerLines = reviewer
    ? `- Reviewer: \`${reviewer}\`\n- Configured model: \`${configuredModel || "unknown"}\`\n- Observed model: \`${observedModel}\`\n`
    : "";
  const createdAt = Number(report.createdAt);
  if (
    !appId ||
    (!taskId && !metricId) ||
    (Boolean(taskId) && Boolean(metricId)) ||
    !evidenceHash ||
    !(metricId
      ? rubricVersion === METRIC_RUBRIC_VERSION
      : SUPPORTED_TASK_RUBRIC_VERSIONS.has(rubricVersion)) ||
    !purposeMatchesRubric(purpose, rubricVersion) ||
    !sourceRevision ||
    !["assessed", "insufficient-evidence"].includes(disposition) ||
    !summary ||
    !responsibility ||
    !delivery ||
    !executionId ||
    !representableTimestamp(createdAt)
  )
    return null;
  const findings = strings(judgment.findings).slice(0, 12);
  const verification = strings(judgment.verification).slice(0, 12);
  if (metricId) {
    const evidence = object(report.evidence);
    if (
      purpose !== "metric" ||
      metricEvidenceHash(evidence) !== evidenceHash ||
      text(evidence.metricId) !== metricId ||
      text(object(evidence.metric).project) !== appId
    )
      return null;
    return `# Evaluation report\n\n- Metric: \`${appId}/${metricId}\`\n- Evidence: \`${evidenceHash}\`\n- Purpose: metric\n- Rubric: \`${rubricVersion}\`\n- Source revision: \`${sourceRevision}\`\n${reviewerLines}- Disposition: \`${disposition}\`\n- Created: \`${new Date(createdAt).toISOString()}\`\n- Evaluator execution: \`${executionId}\`\n\n## Summary\n\n${summary}\n\n## Recorded comparison\n\n\`\`\`json\n${JSON.stringify({ end: evidence.end, freshness: evidence.freshness, latest: evidence.latest, comparison: evidence.comparison }, null, 2)}\n\`\`\`\n\nMetric changes do not establish cause or fulfillment of individual requests.\n\n## Responsibility\n\n${responsibility}\n\n## Findings\n\n${findings.map((item) => `- ${item}`).join("\n") || "- None."}\n\n## Verification and delivery\n\n${verification.map((item) => `- ${item}`).join("\n") || "- No verification cited."}\n- Delivery: ${delivery}\n`;
  }
  if (
    rubricVersion === TASK_OUTCOME_RUBRIC_VERSION &&
    !Object.keys(assessment).length &&
    !Object.keys(snapshot).length &&
    !Object.keys(freshness).length
  )
    return `# Evaluation report\n\n- Subject: \`${appId}/${taskId}\`\n- Evidence: \`${evidenceHash}\`\n- Rubric: \`${rubricVersion}\`\n- Source revision: \`${sourceRevision}\`\n${reviewerLines}- Disposition: \`${disposition}\`\n- Created: \`${new Date(createdAt).toISOString()}\`\n- Evaluator execution: \`${executionId}\`\n- Cost: unknown\n\n## Summary\n\n${summary}\n\n## Responsibility\n\n${responsibility}\n\n## Findings\n\n${findings.map((item) => `- ${item}`).join("\n") || "- None."}\n\n## Verification and delivery\n\n${verification.map((item) => `- ${item}`).join("\n") || "- No verification cited."}\n- Delivery: ${delivery}\n`;
  const populationMarkdown = renderPopulation(
    object(object(report.evidence).population),
  );
  const validityLines =
    purpose === "ongoing"
      ? `- Validity phase: \`${text(validity.phase) || "unknown"}\`\n- Due boundary: \`${representableTimestamp(validity.dueAt) ? new Date(validity.dueAt).toISOString() : "unavailable"}\`\n`
      : "";
  const freshnessLines = Object.keys(freshness).length
    ? `- Snapshot generation: \`${Number(snapshot.generation)}\`\n- Snapshot freshness at check: \`${freshnessStatus}\`\n- Freshness checked: \`${new Date(Number(freshness.checkedAt)).toISOString()}\`\n`
    : "";
  return `# Evaluation report\n\n- Subject: \`${appId}/${taskId}\`\n- Evidence: \`${evidenceHash}\`\n- Purpose: \`${purpose}\`\n- Rubric: \`${rubricVersion}\`\n- Source revision: \`${sourceRevision}\`\n${validityLines}${freshnessLines}${reviewerLines}- Disposition: \`${disposition}\`\n- Created: \`${new Date(createdAt).toISOString()}\`\n- Evaluator execution: \`${executionId}\`\n- Cost: unknown\n\n## Summary\n\n${summary}\n\n${populationMarkdown}## Responsibility\n\n${responsibility}\n\n## Findings\n\n${findings.map((item) => `- ${item}`).join("\n") || "- None."}\n\n## Verification and delivery\n\n${verification.map((item) => `- ${item}`).join("\n") || "- No verification cited."}\n- Delivery: ${delivery}\n`;
}

export function markTaskReportPublished(
  root: string,
  marker: Omit<PublicationMarker, "version" | "accepted">,
): void {
  const expected = publicationPaths(marker);
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
    const metricId = text(marker.metricId);
    const evidenceHash = text(marker.evidenceHash);
    const executionId = text(marker.executionId);
    const reviewer = text(marker.reviewer) || "evaluator";
    const markerRubric =
      text(marker.rubricVersion) || TASK_OUTCOME_RUBRIC_VERSION;
    const markerValidityIdentity = text(marker.validityIdentity);
    const expected = publicationPaths({
      appId,
      taskId,
      metricId,
      evidenceHash,
      rubricVersion: markerRubric,
      validityIdentity: markerValidityIdentity,
      reviewer,
    });
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
    const rubricVersion = text(payload.rubricVersion);
    const assessment = object(payload.assessment);
    const purpose =
      text(assessment.purpose) ||
      (rubricVersion === TASK_OUTCOME_RUBRIC_VERSION ? "outcome" : "");
    if (
      text(subject.appId) !== appId ||
      text(subject.taskId) !== taskId ||
      text(subject.metricId) !== metricId ||
      text(subject.evidenceHash) !== evidenceHash ||
      rubricVersion !== markerRubric ||
      text(assessment.validityIdentity) !== markerValidityIdentity ||
      !purposeMatchesRubric(purpose, rubricVersion) ||
      text(evaluator.executionId) !== executionId ||
      (text(evaluator.reviewer) || "evaluator") !== reviewer ||
      disposition !== text(object(payload.judgment).disposition) ||
      !["assessed", "insufficient-evidence"].includes(disposition) ||
      !expectedMarkdown ||
      readFileSync(absoluteMarkdownPath, "utf8") !== expectedMarkdown
    )
      return null;
    return {
      appId,
      reviewer,
      ...(metricId ? { metricId } : { taskId }),
      evidenceHash,
      executionId,
      disposition,
      createdAt: Number(payload.createdAt),
      purpose: purpose as AssessmentPurpose,
      rubricVersion,
      sourceRevision: text(payload.sourceRevision),
      validityIdentity: markerValidityIdentity,
      validity: Object.keys(object(assessment.validity)).length
        ? object(assessment.validity)
        : null,
      snapshot: Object.keys(object(payload.snapshot)).length
        ? object(payload.snapshot)
        : null,
      freshness: Object.keys(object(payload.freshness)).length
        ? object(payload.freshness)
        : null,
      coverage: metricId
        ? "bounded-metric-observation"
        : "bounded-single-task-snapshot",
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

function compareRecentReports(a: TaskReportEntry, b: TaskReportEntry): number {
  return b.createdAt - a.createdAt || a.jsonPath.localeCompare(b.jsonPath);
}

export function listTaskReports(root: string, limit = 50): TaskReportEntry[] {
  const bases = [
    join(root, "task-outcomes"),
    join(root, "metric-observations"),
  ].filter(existsSync);
  if (!bases.length) return [];
  const bounded = Math.max(1, Math.min(100, Math.trunc(limit)));
  // Publication markers do not carry report time and there is no complete,
  // paginated report index. Traverse the existing store completely, while
  // retaining only the requested top K validated publications in memory.
  const entries: TaskReportEntry[] = [];
  const pending = [...bases];
  while (pending.length) {
    const directory = pending.shift()!;
    for (const file of readdirSync(directory).sort()) {
      const absolute = join(directory, file);
      if (statSync(absolute).isDirectory()) {
        pending.push(absolute);
        continue;
      }
      if (!file.endsWith(".published.json")) continue;
      const entry = publishedEntry(root, absolute);
      if (!entry) continue;
      entries.push(entry);
      entries.sort(compareRecentReports);
      if (entries.length > bounded) entries.pop();
    }
  }
  return entries;
}

export function isPublishedTaskReportPath(root: string, path: string): boolean {
  return readPublishedTaskReport(root, path) !== null;
}

/** Exact reference reads must not depend on the bounded recent-report listing. */
export function readPublishedTaskReport(
  root: string,
  path: string,
): TaskReportEntry | null {
  if (!/\.(?:json|md)$/.test(path) || path.endsWith(".published.json"))
    return null;
  try {
    const markerPath = resolveTaskReportPath(
      root,
      path.replace(/\.(?:json|md)$/, ".published.json"),
    );
    const entry = publishedEntry(root, markerPath);
    return entry && (entry.jsonPath === path || entry.markdownPath === path)
      ? entry
      : null;
  } catch {
    return null;
  }
}
