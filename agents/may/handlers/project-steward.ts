/**
 * project-steward — read-only project health discovery.
 *
 * This handler does not dispatch work and does not edit project files. It
 * turns deterministic project/document/task issues into normal events and
 * metrics so heartbeat, metric alerts, and the closed-loop steward can route
 * them through the existing repair path.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CronEntry, HandlerContext, HandlerModule, TriggerEvent } from "@may-agent/sdk";
import { parseProjectMeta, parseProjectTasks, planProjectTasks } from "@may-agent/sdk";
import { scanAllProjects, type ProjectInfo } from "../../../shared/lib/project-health.ts";

type FindingSeverity = "P0" | "P1" | "P2" | "P3";

interface ProjectFinding {
  code: "invalid_format" | "task_parser_error" | "owner_judgment_needed" | "missing_owner_workflow";
  severity: FindingSeverity;
  message: string;
  evidence: Record<string, unknown>;
}

interface ProjectStewardReport {
  projectId: string;
  projectPath: string;
  status: string;
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
    id: "project.missing-owner-workflow-count",
    name: "Active projects missing owner workflow",
    owner: "may",
    type: "health" as const,
    target: 0,
    threshold: 0,
    unit: "count",
    alertOp: ">" as const,
    priority: "P1" as const,
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

function expectedOwnerWorkflowPath(project: ProjectInfo): string | null {
  if ((project.workflow || "project") !== "project") return null;
  const slug = project.relPath.split("/").pop();
  if (!slug) return null;
  return resolve(dirname(project.projectFile), "workflows", `${slug}-iteration.ts`);
}

export function analyzeProject(project: ProjectInfo): ProjectStewardReport {
  const parsed = parseProjectTasks(project.content);
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

  if (project.status === "active" && parsed.tasks.length > 0 && parsed.errors.length === 0) {
    const plan = planProjectTasks(parsed.tasks, { maxConcurrent: maxConcurrent(project.content) });
    const maxAttempts = maxTaskAttempts(project.content);
    const repeated = plan.dispatchable.find((task) => task.attempts >= maxAttempts);

    if (repeated) {
      findings.push({
        code: "owner_judgment_needed",
        severity: "P2",
        message: `Task ${repeated.id} reached ${repeated.attempts}/${maxAttempts} attempts; owner should replan, split, drop, or escalate.`,
        evidence: { taskId: repeated.id, attempts: repeated.attempts, maxTaskAttempts: maxAttempts },
      });
    } else if (plan.allDone) {
      findings.push({
        code: "owner_judgment_needed",
        severity: "P2",
        message: "All project tasks are done; owner should replan the next phase or close the project.",
        evidence: { taskCount: parsed.tasks.length },
      });
    }
  }

  const expectedWorkflow = expectedOwnerWorkflowPath(project);
  if (
    project.status === "active"
    && expectedWorkflow
    && !existsSync(expectedWorkflow)
    && !project.formatErrors?.length
    && parsed.errors.length === 0
  ) {
    const needsOwnerLoop = parsed.tasks.length === 0
      || findings.some((finding) => finding.code === "owner_judgment_needed");
    if (needsOwnerLoop) {
      findings.push({
        code: "missing_owner_workflow",
        severity: "P1",
        message: `Active project needs the owner loop, but workflow: project has no ${project.relPath.split("/").pop()}-iteration.ts implementation.`,
        evidence: {
          workflow: project.workflow || "project",
          expectedWorkflow,
          taskCount: parsed.tasks.length,
        },
      });
    }
  }

  return {
    projectId: projectIdFor(project),
    projectPath: project.relPath,
    status: project.status,
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

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const projectsRoot = ctx.sdk.paths.projects ?? resolve(ctx.sdk.paths.root, "projects");

  return async (event?: TriggerEvent) => {
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

    const projects = scanAllProjects({ projectsRoot });
    if (projects.length === 0) {
      ctx.sdk.emit("handler.skipped", {
        handler: "project-steward",
        reason: "no projects found",
        projectsRoot,
        eventType: event?.type ?? "timer.tick",
      });
      return;
    }

    ctx.sdk.metrics.defineMany(METRICS);

    const reports = projects.map(analyzeProject);
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const report = reports[i];
      ctx.sdk.emit("project.health.checked", {
        projectId: report.projectId,
        projectPath: report.projectPath,
        status: report.status,
        taskCounts: report.taskCounts,
        findingCount: report.findings.length,
        projectMtime: safeMtime(project.projectFile),
      }, {
        owner: "may",
        source: "project-steward",
        urgency: "low",
      });

      for (const finding of report.findings) emitFinding(ctx, project, report, finding);
    }

    const findingCount = reports.reduce((sum, report) => sum + report.findings.length, 0);
    const invalidFormatCount = reports.filter((report) => report.findings.some((f) => f.code === "invalid_format")).length;
    const taskParserErrorCount = reports.filter((report) => report.findings.some((f) => f.code === "task_parser_error")).length;
    const ownerJudgmentNeededCount = reports.filter((report) => report.findings.some((f) => f.code === "owner_judgment_needed")).length;
    const missingOwnerWorkflowCount = reports.filter((report) => report.findings.some((f) => f.code === "missing_owner_workflow")).length;
    const note = JSON.stringify({
      trigger: event?.type ?? "timer.tick",
      projects: reports.length,
      findings: reports
        .filter((report) => report.findings.length > 0)
        .map((report) => ({
          projectId: report.projectId,
          codes: report.findings.map((finding) => finding.code),
        })),
    });

    recordMetric(ctx, "project.health.finding-count", findingCount, now, note, reports.length);
    recordMetric(ctx, "project.invalid-format-count", invalidFormatCount, now, note, reports.length);
    recordMetric(ctx, "project.task-parser-error-count", taskParserErrorCount, now, note, reports.length);
    recordMetric(ctx, "project.owner-judgment-needed-count", ownerJudgmentNeededCount, now, note, reports.length);
    recordMetric(ctx, "project.missing-owner-workflow-count", missingOwnerWorkflowCount, now, note, reports.length);
    for (const metric of METRICS) ctx.sdk.metrics.evaluate(metric.id);

    ctx.sdk.log("info", `[project-steward] checked ${projects.length} project(s), findings=${findingCount}`);
  };
};
