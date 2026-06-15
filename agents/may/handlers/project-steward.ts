/**
 * project-steward — read-only project health discovery.
 *
 * This handler does not dispatch work and does not edit project files. It
 * turns deterministic project/document/task issues into normal events and
 * metrics so heartbeat, metric alerts, and the closed-loop steward can route
 * them through the existing repair path.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CronEntry, EventEnvelope, HandlerContext, HandlerModule } from "@may-agent/sdk";
import { parseProjectMeta, parseProjectTasks, planProjectTasks } from "@may-agent/sdk";
import { scanAllProjects, type ProjectInfo } from "../../../shared/lib/project-health.ts";

type FindingSeverity = "P0" | "P1" | "P2" | "P3";
type ProjectPolicy = "stable-watch" | "aggressive-push" | "standard";

interface ProjectFinding {
  code:
    | "invalid_format"
    | "task_parser_error"
    | "owner_judgment_needed"
    | "watch_signal_unavailable"
    | "ops_alert_chain_needs_judgment";
  severity: FindingSeverity;
  message: string;
  evidence: Record<string, unknown>;
}

interface ProjectStewardReport {
  projectId: string;
  projectPath: string;
  status: string;
  projectPolicy: ProjectPolicy;
  taskCounts: {
    total: number;
    ready: number;
    running: number;
    done: number;
    pending: number;
  };
  findings: ProjectFinding[];
}

const METRICS = [
  {
    id: "project.health.finding-count",
    name: "Project health findings",
    owner: "may",
    type: "health" as const,
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">" as const,
    priority: "P1" as const,
  },
  {
    id: "project.invalid-format-count",
    name: "Invalid project.md format",
    owner: "may",
    type: "health" as const,
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">" as const,
    priority: "P1" as const,
  },
  {
    id: "project.task-parser-error-count",
    name: "Project task parser errors",
    owner: "may",
    type: "health" as const,
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">" as const,
    priority: "P1" as const,
  },
  {
    id: "project.owner-judgment-needed-count",
    name: "Project tasks needing owner judgment",
    owner: "may",
    type: "health" as const,
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">" as const,
    priority: "P2" as const,
  },
  {
    id: "project.owner-incomplete-count",
    name: "Active projects with no open work",
    owner: "may",
    type: "health" as const,
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">" as const,
    priority: "P2" as const,
  },
];

function projectIdFor(project: ProjectInfo): string {
  return `${project.owner}/${project.relPath.split("/").pop()}`;
}

function maxTaskAttempts(content: string): number {
  const meta = parseProjectMeta(content);
  const parsed = Number.parseInt(meta.max_task_attempts ?? "2", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}

function maxConcurrent(content: string): number {
  const meta = parseProjectMeta(content);
  const parsed = Number.parseInt(meta.max_concurrent ?? "3", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

function projectPolicy(content: string): ProjectPolicy {
  const meta = parseProjectMeta(content);
  const raw = (meta.project_policy ?? meta.policy ?? "").trim().toLowerCase();
  if (raw === "stable-watch" || raw === "aggressive-push") return raw;
  return "standard";
}

export function analyzeProject(project: ProjectInfo): ProjectStewardReport {
  const parsed = parseProjectTasks(project.content);
  const policy = projectPolicy(project.content);
  const meta = parseProjectMeta(project.content);
  const isProjectApp = meta.type === "project-app";
  const taskCounts = {
    total: parsed.tasks.length,
    ready: parsed.tasks.filter((task) => task.status === "ready").length,
    running: parsed.tasks.filter((task) => task.status === "running").length,
    done: parsed.tasks.filter((task) => task.status === "done").length,
    pending: parsed.tasks.filter((task) => task.status === "pending").length,
  };
  const findings: ProjectFinding[] = [];

  if (project.formatErrors?.length) {
    findings.push({
      code: "invalid_format",
      severity: "P1",
      message: `Invalid project.md format: ${project.formatErrors.join("; ")}`,
      evidence: { errors: project.formatErrors },
    });
  }

  if (parsed.errors.length > 0) {
    findings.push({
      code: "task_parser_error",
      severity: "P1",
      message: `Invalid ## Tasks section: ${parsed.errors.join("; ")}`,
      evidence: { errors: parsed.errors },
    });
  }

  // Project-apps manage tasks via tasks/tree.json, not inline markdown.
  // Skip task-based findings for them — the inline task count is always 0.
  if (!isProjectApp && project.status === "active" && parsed.tasks.length > 0 && parsed.errors.length === 0) {
    const plan = planProjectTasks(parsed.tasks, { maxConcurrent: maxConcurrent(project.content) });
    const maxAttempts = maxTaskAttempts(project.content);
    const repeated = plan.dispatchable.find((task) => task.attempts >= maxAttempts);

    if (repeated) {
      findings.push({
        code: "owner_judgment_needed",
        severity: "P2",
        message: `Task ${repeated.id} reached ${repeated.attempts}/${maxAttempts} attempts; owner should replan, split, drop, or escalate.`,
        evidence: { taskId: repeated.id, attempts: repeated.attempts, maxTaskAttempts: maxAttempts, projectPolicy: policy },
      });
    } else if (plan.allDone) {
      findings.push({
        code: "owner_judgment_needed",
        severity: "P2",
        message: "All project tasks are done; owner should replan the next phase or close the project.",
        evidence: { taskCount: parsed.tasks.length, projectPolicy: policy, ownerIncomplete: true },
      });
    }
  }

  if (
    !isProjectApp
    && project.status === "active"
    && parsed.tasks.length === 0
    && !project.formatErrors?.length
    && parsed.errors.length === 0
  ) {
    findings.push({
      code: "owner_judgment_needed",
      severity: "P2",
      message: "Active project has no tasks; owner should create the next task slice or close the project.",
      evidence: { taskCount: 0, projectPolicy: policy, ownerIncomplete: true },
    });
  }

  return {
    projectId: projectIdFor(project),
    projectPath: project.relPath,
    status: project.status,
    projectPolicy: policy,
    taskCounts,
    findings,
  };
}

function safeMtime(path: string): number | null {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

function severityUrgency(severity: FindingSeverity): "low" | "normal" | "high" | "immediate" {
  if (severity === "P0") return "immediate";
  if (severity === "P1") return "high";
  if (severity === "P3") return "low";
  return "normal";
}

function emitFinding(ctx: HandlerContext, project: ProjectInfo, report: ProjectStewardReport, finding: ProjectFinding): void {
  ctx.sdk.emit("project.health.finding", {
    projectId: report.projectId,
    projectPath: report.projectPath,
    status: report.status,
    projectPolicy: report.projectPolicy,
    code: finding.code,
    severity: finding.severity,
    message: finding.message,
    evidence: finding.evidence,
  }, {
    owner: project.owner || "may",
    source: "project-steward",
    urgency: severityUrgency(finding.severity),
  });
}

function recordMetric(ctx: HandlerContext, id: string, value: number, now: number, note: string, sampleSize?: number): void {
  ctx.sdk.metrics.record(id, value, { measuredAt: now, measuredBy: "project-steward", note, sampleSize });
}

function metricIdsInText(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(/`([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+)(?:\s*[<>=!].*?)?`/g)) ids.add(match[1]);
  return [...ids];
}

function sectionText(content: string, heading: string): string {
  const lines = content.split("\n");
  const target = heading.trim().toLowerCase();
  const start = lines.findIndex((line) => {
    const match = line.match(/^##\s+(.+?)\s*$/);
    return match?.[1].trim().toLowerCase() === target;
  });
  if (start < 0) return "";
  const collected: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    collected.push(lines[i]);
  }
  return collected.join("\n");
}

function watchMetricIdsInProject(content: string): string[] {
  const meta = parseProjectMeta(content);
  const watchText = [
    meta.resume_condition ?? "",
    meta.wait_reason ?? "",
    sectionText(content, "Watch Conditions"),
  ].join("\n");
  return metricIdsInText(watchText);
}

function projectSlug(project: ProjectInfo): string {
  return project.relPath.split("/").pop() ?? project.relPath;
}

function metricBelongsToProject(row: { id: string; owner?: string | null; project?: string | null }, project: ProjectInfo): boolean {
  const slug = projectSlug(project);
  const projectRefs = new Set([slug, project.relPath, `${project.owner}/${slug}`]);
  if (row.project && projectRefs.has(row.project)) return true;
  return row.id.startsWith(`${project.owner}.`);
}

function addWatchMetricFindings(ctx: HandlerContext, project: ProjectInfo, report: ProjectStewardReport, now: number): void {
  if (project.status !== "waiting") return;
  const ids = watchMetricIdsInProject(project.content);
  if (ids.length === 0) return;

  let rows: Array<{ id: string; status?: string | null; owner?: string | null; project?: string | null; updated_at?: number | null; measure_interval?: number | null }> = [];
  try {
    const db = ctx.sdk.getDb?.();
    if (!db) return;
    const placeholders = ids.map(() => "?").join(",");
    rows = db.prepare(
      `SELECT id, status, owner, project, updated_at, measure_interval
       FROM metrics
       WHERE id IN (${placeholders})`,
    ).all(...ids) as typeof rows;
  } catch {
    return;
  }

  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const unavailable: Array<Record<string, unknown>> = [];
  const staleMsDefault = 6 * 60 * 60 * 1000;
  for (const id of ids) {
    const row = rowsById.get(id);
    if (!row) {
      const prefix = id.split(".")[0];
      if (prefix === project.owner) unavailable.push({ metricId: id, reason: "missing" });
      continue;
    }
    if (!metricBelongsToProject(row, project)) continue;
    if (row.status !== "active") {
      unavailable.push({ metricId: id, status: row.status ?? null, reason: "not_active" });
      continue;
    }
    const updatedAt = typeof row.updated_at === "number" ? row.updated_at : 0;
    const intervalMs = typeof row.measure_interval === "number" && row.measure_interval > 0
      ? row.measure_interval * 3
      : staleMsDefault;
    const staleMs = Math.max(staleMsDefault, intervalMs);
    if (!updatedAt || now - updatedAt > staleMs) {
      unavailable.push({
        metricId: id,
        status: row.status,
        reason: "stale",
        updatedAt: updatedAt || null,
        staleForMs: updatedAt ? now - updatedAt : null,
      });
    }
  }

  if (unavailable.length === 0) return;
  report.findings.push({
    code: "watch_signal_unavailable",
    severity: "P2",
    message: `Waiting project depends on ${unavailable.length} unavailable watch metric(s); owner should repair the watch or revise the wait condition.`,
    evidence: { metrics: unavailable },
  });
}

function latestAlertJudgment(ctx: HandlerContext, metricId: string, alertId: number, createdAt: number): { timestamp: number } | null {
  try {
    const db = ctx.sdk.getDb?.();
    if (!db) return null;
    return db.prepare(
      `SELECT timestamp
       FROM events
       WHERE event_type = 'metric.alert_judged'
         AND timestamp >= ?
         AND json_extract(data, '$.metricId') = ?
         AND (
           json_extract(data, '$.alertId') = ?
           OR json_extract(data, '$.alertId') IS NULL
         )
       ORDER BY timestamp DESC
       LIMIT 1`,
    ).get(createdAt, metricId, alertId) as { timestamp: number } | null;
  } catch {
    return null;
  }
}

function addSystemOperationsAlertFindings(ctx: HandlerContext, project: ProjectInfo, report: ProjectStewardReport, now: number): void {
  if (project.relPath !== "projects/system-operations" || project.status !== "waiting") return;

  let alerts: Array<{ id: number; metric_id: string; created_at: number; priority?: string | null; message?: string | null }> = [];
  try {
    const db = ctx.sdk.getDb?.();
    if (!db) return;
    alerts = db.prepare(
      `SELECT a.id, a.metric_id, a.created_at, COALESCE(m.priority, 'P2') AS priority, a.message
       FROM metric_alerts a
       LEFT JOIN metrics m ON m.id = a.metric_id
       WHERE a.resolved_at IS NULL
       ORDER BY a.created_at DESC
       LIMIT 100`,
    ).all() as typeof alerts;
  } catch {
    return;
  }

  const needsOps = [];
  for (const alert of alerts) {
    if (alert.metric_id.startsWith("project.")) continue;
    const priority = alert.priority ?? "P2";
    if (priority !== "P0" && priority !== "P1") continue;
    const ageMs = now - alert.created_at;
    const judged = latestAlertJudgment(ctx, alert.metric_id, alert.id, alert.created_at);
    if (!judged) {
      const unjudgedGraceMs = priority === "P0" ? 0 : 10 * 60 * 1000;
      if (ageMs >= unjudgedGraceMs) {
        needsOps.push({
          alertId: alert.id,
          metricId: alert.metric_id,
          priority,
          reason: "unjudged",
          ageMs,
          message: alert.message,
        });
      }
      continue;
    }
    const sinceJudgmentMs = now - judged.timestamp;
    if (sinceJudgmentMs > 30 * 60 * 1000) {
      needsOps.push({
        alertId: alert.id,
        metricId: alert.metric_id,
        priority,
        reason: "judgment_stale_without_recovery",
        ageMs,
        lastJudgedAt: judged.timestamp,
        sinceJudgmentMs,
        message: alert.message,
      });
    }
  }

  if (needsOps.length === 0) return;
  report.findings.push({
    code: "ops_alert_chain_needs_judgment",
    severity: needsOps.some((alert) => alert.priority === "P0") ? "P0" : "P1",
    message: `System operations has ${needsOps.length} unresolved P0/P1 alert chain(s) without fresh judgment or recovery.`,
    evidence: { alerts: needsOps },
  });
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const projectsRoot = ctx.sdk.paths.projects ?? resolve(ctx.sdk.paths.root, "projects");

  return async (event?: EventEnvelope) => {
    const now = Date.now();
    if (!existsSync(projectsRoot)) {
      ctx.sdk.emit("handler.skipped", {
        handler: "project-steward",
        reason: "projects root not found",
        projectsRoot,
        eventType: event?.type ?? "timer.tick",
      });
      return;
    }

    ctx.sdk.metrics.defineMany(METRICS);

    const projects = scanAllProjects({ projectsRoot });
    if (projects.length === 0) {
      ctx.sdk.emit("handler.skipped", {
        handler: "project-steward",
        reason: "no projects found",
        projectsRoot,
        eventType: event?.type ?? "timer.tick",
      });
      // Still record zero-value metrics so they don't go stale and cause
      // status-reality-mismatch alerts in metrics-snapshot.
      const note = JSON.stringify({ trigger: event?.type ?? "timer.tick", projects: 0, findings: [] });
      for (const metric of METRICS) {
        recordMetric(ctx, metric.id, 0, now, note, 0);
      }
      for (const metric of METRICS) ctx.sdk.metrics.evaluate(metric.id);
      ctx.sdk.log("info", `[project-steward] no projects found, recorded zero-value metrics`);
      return;
    }

    const reports = projects.map(analyzeProject);
    for (let i = 0; i < projects.length; i++) {
      addWatchMetricFindings(ctx, projects[i], reports[i], now);
      addSystemOperationsAlertFindings(ctx, projects[i], reports[i], now);
    }
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const report = reports[i];
      for (const finding of report.findings) emitFinding(ctx, project, report, finding);
    }

    const findingCount = reports.reduce((sum, report) => sum + report.findings.length, 0);
    const invalidFormatCount = reports.filter((report) => report.findings.some((f) => f.code === "invalid_format")).length;
    const taskParserErrorCount = reports.filter((report) => report.findings.some((f) => f.code === "task_parser_error")).length;
    const ownerJudgmentNeededCount = reports.filter((report) => report.findings.some((f) => f.code === "owner_judgment_needed")).length;
    const ownerIncompleteCount = reports.filter((report) =>
      report.findings.some((f) => f.code === "owner_judgment_needed" && f.evidence.ownerIncomplete === true)
    ).length;
    const note = JSON.stringify({
      trigger: event?.type ?? "timer.tick",
      projects: reports.length,
      findings: reports
        .filter((report) => report.findings.length > 0)
        .map((report) => ({
          projectId: report.projectId,
          projectPath: report.projectPath,
          projectPolicy: report.projectPolicy,
          codes: report.findings.map((finding) => finding.code),
        })),
    });

    recordMetric(ctx, "project.health.finding-count", findingCount, now, note, reports.length);
    recordMetric(ctx, "project.invalid-format-count", invalidFormatCount, now, note, reports.length);
    recordMetric(ctx, "project.task-parser-error-count", taskParserErrorCount, now, note, reports.length);
    recordMetric(ctx, "project.owner-judgment-needed-count", ownerJudgmentNeededCount, now, note, reports.length);
    recordMetric(ctx, "project.owner-incomplete-count", ownerIncompleteCount, now, note, reports.length);
    for (const metric of METRICS) ctx.sdk.metrics.evaluate(metric.id);

    ctx.sdk.log("info", `[project-steward] checked ${projects.length} project(s), findings=${findingCount}`);
  };
};
