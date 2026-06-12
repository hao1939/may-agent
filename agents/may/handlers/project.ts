/**
 * project — Project Health Monitor (thin handler)
 *
 * Core logic lives in shared/lib/project-health.ts.
 * This handler scans projects, diagnoses health, and executes actions:
 *   - dispatch project tasks for active projects
 *   - launch the owner agent when the project itself needs judgment
 *   - reactivate/add-comment for blocked projects
 *   - escalate persistent blockers
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { EventEnvelope, HandlerContext, HandlerModule } from "@may-agent/sdk";
import type { CronEntry } from "@may-agent/sdk";
import {
  parseProjectTasks,
  planProjectTasks,
  parseProjectMeta,
  updateProjectTaskFields,
  type PlannedProjectTask,
} from "@may-agent/sdk";
import type { ProjectInfo, HealthAction } from "../../../shared/lib/project-health.ts";

const PROJECT_RECONCILER_METRICS = [
  {
    id: "project.reconcile.trigger-count",
    name: "Project reconciler runs",
    owner: "may",
    type: "gauge" as const,
    unit: "count",
    priority: "P2" as const,
    description: "One sample per project reconciler run; note identifies event or timer trigger.",
  },
  {
    id: "project.reconcile.launched-count",
    name: "Project reconciler launched actions",
    owner: "may",
    type: "gauge" as const,
    unit: "count",
    priority: "P2" as const,
    description: "How many project tasks or owner loops this reconciler pass launched.",
  },
  {
    id: "project.reconcile.event-latency-ms",
    name: "Project event-to-reconcile latency",
    owner: "may",
    type: "health" as const,
    target: 0,
    threshold: 300_000,
    unit: "ms",
    alertOp: ">" as const,
    priority: "P2" as const,
    description: "Milliseconds from event timestamp to project reconciler handling. Normal event-driven path should be seconds.",
  },
];

async function loadProjectHealth(root: string) {
  const hotLoadPath = resolve(root, "shared/lib/project-health.ts");
  if (!existsSync(hotLoadPath)) {
    return await import("../../../shared/lib/project-health.ts") as typeof import("../../../shared/lib/project-health.ts");
  }

  const moduleUrl = pathToFileURL(hotLoadPath);
  moduleUrl.searchParams.set("t", String(Date.now()));
  return await import(moduleUrl.href) as typeof import("../../../shared/lib/project-health.ts");
}

function normalizeProjectPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value
    .trim()
    .replace(/^agents\//, "")
    .replace(/\/project\.md$/, "")
    .replace(/\/$/, "");
}

function matchesProjectTarget(project: ProjectInfo, target: string | null): boolean {
  if (!target) return true;
  return project.relPath === target || project.projectFile.endsWith(`/${target}/project.md`);
}

function projectIdFor(project: ProjectInfo): string {
  return `${project.owner}/${project.relPath.split("/").pop()}`;
}

function taskSource(taskId: string): string {
  return `project-task:${taskId}`;
}

const OWNER_SOURCE = "project-owner";
const PROJECT_HEALTH_METRIC_IDS = new Set([
  "project.health.finding-count",
  "project.owner-judgment-needed-count",
  "project.owner-incomplete-count",
]);

function taskIdFromSource(source: unknown): string | null {
  if (typeof source !== "string") return null;
  const match = source.match(/^project-task:([^:\s]+)$/);
  return match ? match[1] : null;
}

function taskIdFromProjectTaskPrompt(task: unknown): string | null {
  if (typeof task !== "string") return null;
  const match = task.match(/^Task ID:\s*([^\s]+)\s*$/m);
  return match ? match[1] : null;
}

function projectPathFromProjectId(projectId: string): string | null {
  const slug = projectId.split("/").pop()?.trim();
  return slug ? `projects/${slug}` : null;
}

function projectPathFromProjectRef(projectRef: unknown): string | null {
  if (typeof projectRef !== "string" || !projectRef.trim()) return null;
  const normalized = normalizeProjectPath(projectRef);
  if (!normalized) return null;
  if (normalized.startsWith("projects/")) return normalized;
  return projectPathFromProjectId(normalized) ?? `projects/${normalized}`;
}

function metricIdFromEvent(event: EventEnvelope | undefined): string | null {
  const raw = event?.data?.metricId ?? event?.data?.metric_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function projectTargetsFromMetricSnapshot(ctx: HandlerContext, metricId: string): string[] {
  try {
    const db = ctx.sdk.getDb();
    const rows = db.prepare(
      "SELECT note FROM metric_snapshots WHERE metric_id = ? AND note IS NOT NULL ORDER BY measured_at DESC LIMIT 5",
    ).all(metricId) as Array<{ note?: unknown }>;
    const targets = new Set<string>();
    for (const row of rows) {
      if (typeof row.note !== "string" || !row.note.trim()) continue;
      let note: Record<string, unknown>;
      try {
        note = JSON.parse(row.note) as Record<string, unknown>;
      } catch {
        continue;
      }
      const findings = Array.isArray(note.findings) ? note.findings : [];
      for (const rawFinding of findings) {
        if (!rawFinding || typeof rawFinding !== "object") continue;
        const finding = rawFinding as Record<string, unknown>;
        const explicitPath = normalizeProjectPath(finding.projectPath);
        if (explicitPath) {
          targets.add(explicitPath);
          continue;
        }
        const projectId = typeof finding.projectId === "string" ? finding.projectId : "";
        const path = projectPathFromProjectId(projectId);
        if (path) targets.add(path);
      }
      if (targets.size > 0) break;
    }
    return [...targets];
  } catch {
    return [];
  }
}

function projectTargetFromMetricRow(ctx: HandlerContext, metricId: string): string | null {
  try {
    const db = ctx.sdk.getDb();
    const row = db.prepare("SELECT project FROM metrics WHERE id = ? LIMIT 1").get(metricId) as { project?: unknown } | null;
    return projectPathFromProjectRef(row?.project);
  } catch {
    return null;
  }
}

function projectTargetsFromEvent(ctx: HandlerContext, event: EventEnvelope | undefined): string[] {
  const targets = new Set<string>();
  const directPath = normalizeProjectPath(event?.data?.projectPath) ?? normalizeProjectPath(event?.data?.project);
  if (directPath) targets.add(directPath);

  const projectId = typeof event?.data?.projectId === "string" ? event.data.projectId : "";
  const projectPath = projectPathFromProjectId(projectId);
  if (projectPath) targets.add(projectPath);

  const metricId = metricIdFromEvent(event);
  if (metricId) {
    const metricProjectTarget = projectTargetFromMetricRow(ctx, metricId);
    if (metricProjectTarget) targets.add(metricProjectTarget);
  }
  if (metricId && PROJECT_HEALTH_METRIC_IDS.has(metricId)) {
    for (const target of projectTargetsFromMetricSnapshot(ctx, metricId)) targets.add(target);
  }

  return [...targets];
}

function matchesAnyProjectTarget(project: ProjectInfo, targets: string[]): boolean {
  return targets.length === 0 || targets.some((target) => matchesProjectTarget(project, target));
}

function projectMaxConcurrent(content: string): number {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const raw = match?.[1].match(/^max_concurrent:\s*(\d+)\s*$/m)?.[1];
  const parsed = raw ? Number.parseInt(raw, 10) : 3;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

function projectMaxTaskAttempts(content: string): number {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const raw = match?.[1].match(/^max_task_attempts:\s*(\d+)\s*$/m)?.[1];
  const parsed = raw ? Number.parseInt(raw, 10) : 2;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}

function projectPolicy(content: string): "stable-watch" | "aggressive-push" | "standard" {
  const meta = parseProjectMeta(content);
  const raw = (meta.project_policy ?? meta.policy ?? "").trim().toLowerCase();
  if (raw === "stable-watch" || raw === "aggressive-push") return raw;
  return "standard";
}

function projectPolicyGuidance(policy: ReturnType<typeof projectPolicy>): string[] {
  if (policy === "stable-watch") {
    return [
      "Policy posture: stable-watch.",
      "Use solid evidence before creating new tasks.",
      "When actionable platform signals are absent, set frontmatter `status: waiting` and record the current wait reason.",
      "Prefer small, evidence-backed infrastructure pushes over speculative expansion.",
    ];
  }
  if (policy === "aggressive-push") {
    return [
      "Policy posture: aggressive-push.",
      "Actively inspect current evidence for the next frontier.",
      "When a plausible path remains, create bounded next tasks and keep the project active.",
      "Prefer forward progress through concrete tasks, probes, and verification loops.",
    ];
  }
  return [
    "Policy posture: standard.",
    "Create tasks for actionable work.",
    "When actionable signals are absent, set frontmatter `status: waiting` and record the current wait reason.",
  ];
}

function buildProjectTaskPrompt(project: ProjectInfo, task: PlannedProjectTask): string {
  const deps = task.depends_on.length ? task.depends_on.join(", ") : "none";
  const runner = task.run ?? "agent";
  const lines = [
    "## Project Task",
    `Project: ${project.relPath}`,
    `Task ID: ${task.id}`,
    `Assignee: ${task.assignee}`,
    `Runner: ${runner}`,
    `Dependencies: ${deps}`,
    `Attempt: ${task.attempts + 1}`,
    "",
    "## Goal",
    task.goal,
    "",
    "## Project Context",
    `Read ${project.relPath}/project.md and any files the task explicitly requires.`,
    "Focus on this task only. Do not replan the whole project unless this task cannot proceed.",
    "",
    "## Finish Contract",
    "Use finish({ status: 'success', summary: '...' }) only when this task goal is met.",
    "Use partial when more work on the same task is useful.",
    "Use blocked or failure when owner judgment is needed.",
  ];

  if (task.context_files && task.context_files.length > 0) {
    lines.push("");
    lines.push("## Context Files");
    lines.push("Read these files before acting:");
    for (const f of task.context_files) lines.push(`- ${f}`);
  }

  if (task.success_criteria && task.success_criteria.length > 0) {
    lines.push("");
    lines.push("## Success Criteria");
    for (const c of task.success_criteria) lines.push(`- ${c}`);
  }

  return lines.join("\n");
}

function buildProjectOwnerPrompt(project: ProjectInfo, reason: string): string {
  const policy = projectPolicy(project.content);
  return [
    "## Project Owner Loop",
    `Project: ${project.relPath}`,
    `Owner: ${project.owner}`,
    `Reason: ${reason}`,
    `Policy: ${policy}`,
    "",
    "## Context",
    `Read ${project.relPath}/project.md and related project files before changing state.`,
    "You own the project loop: assess current state, update tasks, replan, close, wait, or escalate.",
    "Use machine-readable frontmatter as the source of truth; treat Current State prose as supporting context.",
    "Use project.md tasks and normal agent/tool actions as the project control surface.",
    ...projectPolicyGuidance(policy),
    "When frontmatter is `active` and all tasks are complete or the task list is empty, plan the next project step.",
    "A successful finish leaves project.md in one of these states: concrete next tasks exist, frontmatter is `waiting` with the current wait reason, frontmatter is terminal, or the project has been escalated.",
    "For discussion comments, inspect the tail after the last `---read @...---` marker. When that tail is fully handled, append a new read marker.",
    "",
    "## Finish Contract",
    "Use finish({ status: 'success', summary: '...' }) after project.md reflects the next correct state.",
  ].join("\n");
}

function finishStatus(result: unknown): string {
  const finish = (result as { finishResult?: { status?: unknown } } | null)?.finishResult;
  return typeof finish?.status === "string" ? finish.status : "";
}

function projectReconcileNote(
  event: EventEnvelope | undefined,
  launched: number,
  actionCount: number,
  targetProject: string | null,
): string {
  return JSON.stringify({
    trigger: event?.type ?? "timer.tick",
    triggerSource: event ? "event" : "timer",
    eventSource: event?.source ?? null,
    projectPath: targetProject,
    actions: actionCount,
    launched,
  });
}

function compactJson(value: unknown, limit = 700): string {
  try {
    const text = JSON.stringify(value);
    return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
  } catch {
    return String(value).slice(0, limit);
  }
}

function projectSignalReason(event: EventEnvelope | undefined): string | null {
  if (!event) return null;
  if (event.type === "project.health.finding") {
    const code = typeof event.data?.code === "string" ? event.data.code : "project health finding";
    const severity = typeof event.data?.severity === "string" ? event.data.severity : "unknown";
    const message = typeof event.data?.message === "string" ? event.data.message : "";
    return `project.health.finding ${code} (${severity}): ${message || compactJson(event.data)}`;
  }
  if (event.type === "project.owner.incomplete") {
    const reason = typeof event.data?.reason === "string" ? event.data.reason : compactJson(event.data);
    return `project.owner.incomplete: ${reason}`;
  }
  if (event.type === "metric.breach" || event.type === "metric.recovered") {
    const metricId = metricIdFromEvent(event) ?? "unknown metric";
    const current = event.data?.current;
    const threshold = event.data?.threshold;
    const target = event.data?.target;
    const message = typeof event.data?.message === "string" ? event.data.message : "";
    return `${event.type} ${metricId}: current=${current ?? "unknown"}, threshold=${threshold ?? "unknown"}, target=${target ?? "unknown"}${message ? `, message=${message}` : ""}`;
  }
  return null;
}

function isProjectSignalEvent(event: EventEnvelope | undefined, targetProjects: string[]): boolean {
  if (!event) return false;
  if (event.type === "project.health.finding" || event.type === "project.owner.incomplete") return true;
  const metricId = metricIdFromEvent(event);
  if (event.type !== "metric.breach" && event.type !== "metric.recovered") return false;
  if (!metricId) return false;
  return PROJECT_HEALTH_METRIC_IDS.has(metricId) || targetProjects.length > 0;
}

function recordProjectReconcileMetrics(
  ctx: HandlerContext,
  event: EventEnvelope | undefined,
  now: number,
  launched: number,
  actionCount: number,
  targetProject: string | null,
): void {
  try {
    ctx.sdk.metrics.defineMany(PROJECT_RECONCILER_METRICS);
    const note = projectReconcileNote(event, launched, actionCount, targetProject);
    ctx.sdk.metrics.record("project.reconcile.trigger-count", 1, {
      measuredAt: now,
      measuredBy: "project-handler",
      note,
      sampleSize: actionCount,
    });
    ctx.sdk.metrics.record("project.reconcile.launched-count", launched, {
      measuredAt: now,
      measuredBy: "project-handler",
      note,
      sampleSize: actionCount,
    });
    if (event && typeof event.timestamp === "number") {
      ctx.sdk.metrics.record("project.reconcile.event-latency-ms", Math.max(0, now - event.timestamp), {
        measuredAt: now,
        measuredBy: "project-handler",
        note,
      });
    }
    for (const metric of PROJECT_RECONCILER_METRICS) ctx.sdk.metrics.evaluate(metric.id);
  } catch (e: any) {
    ctx.sdk.log("info", `[project] Error recording reconciler metrics: ${e?.message ?? String(e)}`);
  }
}

function workflowNameForTask(task: PlannedProjectTask): string | null {
  const run = task.run ?? "agent";
  if (!run.startsWith("workflow:")) return null;
  const workflow = run.slice("workflow:".length).trim();
  return workflow || null;
}

function taskCompletedSuccessfully(task: PlannedProjectTask, result: any): boolean {
  if (result?.status !== "done") return false;
  const status = finishStatus(result);
  return workflowNameForTask(task) ? status !== "failure" && status !== "blocked" : status === "success";
}

function updateTaskFile(projectFile: string, taskId: string, patch: Parameters<typeof updateProjectTaskFields>[2]): void {
  const latest = readFileSync(projectFile, "utf-8");
  writeFileSync(projectFile, updateProjectTaskFields(latest, taskId, patch), "utf-8");
}

function activeProjectTaskIds(ctx: HandlerContext, projectId: string): string[] {
  const ids = new Set<string>();
  for (const status of ["running", "idle"]) {
    const rows = ctx.sdk.query.sessions({ projectId, status, limit: 100 }).rows as Array<{ source?: unknown }>;
    for (const row of rows) {
      const taskId = taskIdFromSource(row.source);
      if (taskId) ids.add(taskId);
    }
  }
  const workflowRows = ctx.sdk.query.workflowRuns({ projectId, status: "running", limit: 100 }).rows as Array<{ task?: unknown }>;
  for (const row of workflowRows) {
    const taskId = taskIdFromProjectTaskPrompt(row.task);
    if (taskId) ids.add(taskId);
  }
  return [...ids];
}

type ProjectAppTaskNode = {
  status?: unknown;
  children?: unknown;
};

type ProjectAppTaskTree = {
  tasks?: unknown;
};

function normalizeTaskChildren(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

function projectAppReadyLeafSummary(project: ProjectInfo): { readyLeafIds: string[]; activeLeafIds: string[] } | null {
  const treePath = resolve(dirname(project.projectFile), "tasks/tree.json");
  if (!existsSync(treePath)) return null;

  let tree: ProjectAppTaskTree;
  try {
    tree = JSON.parse(readFileSync(treePath, "utf-8")) as ProjectAppTaskTree;
  } catch {
    return null;
  }

  if (!tree.tasks || typeof tree.tasks !== "object" || Array.isArray(tree.tasks)) return null;

  const readyLeafIds: string[] = [];
  const activeLeafIds: string[] = [];
  for (const [taskId, rawTask] of Object.entries(tree.tasks as Record<string, ProjectAppTaskNode>)) {
    if (!rawTask || typeof rawTask !== "object" || Array.isArray(rawTask)) continue;
    const children = normalizeTaskChildren(rawTask.children);
    if (children.length > 0) continue;
    const status = typeof rawTask.status === "string" ? rawTask.status : "";
    if (status === "ready") readyLeafIds.push(taskId);
    if (status === "active" || status === "claimed_done") activeLeafIds.push(taskId);
  }

  return {
    readyLeafIds: readyLeafIds.sort(),
    activeLeafIds: activeLeafIds.sort(),
  };
}

function signalReadyProjectAppTasks(
  ctx: HandlerContext,
  project: ProjectInfo,
  projectId: string,
): { handled: boolean; launched: number; reason: string } {
  const summary = projectAppReadyLeafSummary(project);
  if (!summary) return { handled: false, launched: 0, reason: "no app task tree" };
  if (summary.activeLeafIds.length > 0) {
    return { handled: true, launched: 0, reason: "app task leaf already active" };
  }
  if (summary.readyLeafIds.length === 0) {
    return { handled: false, launched: 0, reason: "no ready app task leaves" };
  }

  ctx.sdk.emit("project.tasks.ready", {
    project: project.relPath.split("/").pop() ?? projectId,
    projectId,
    projectPath: project.relPath,
    domainProject: (project.relPath.split("/").pop() ?? "").replace(/\.app$/, ""),
    readyTaskIds: summary.readyLeafIds,
    maxConcurrent: projectMaxConcurrent(project.content),
    requested_by: "project-reconciler",
  });
  return { handled: true, launched: 1, reason: `signaled ${summary.readyLeafIds.length} ready app task(s)` };
}

function dispatchReadyProjectTasks(
  ctx: HandlerContext,
  project: ProjectInfo,
  projectId: string,
  remainingLaunches: number,
): { handled: boolean; launched: number; reason: string } {
  const parsed = parseProjectTasks(project.content);
  if (parsed.tasks.length === 0) return { handled: false, launched: 0, reason: "no tasks" };
  if (parsed.errors.length > 0) {
    emitSkip(ctx, `Skip ${project.relPath} — invalid task section: ${parsed.errors.join("; ")}`, {
      projectId,
      projectPath: project.relPath,
    });
    return { handled: true, launched: 0, reason: "invalid tasks" };
  }

  const plan = planProjectTasks(parsed.tasks, {
    activeTaskIds: activeProjectTaskIds(ctx, projectId),
    maxConcurrent: projectMaxConcurrent(project.content),
  });
  if (plan.running.length > 0 && plan.dispatchable.length === 0) {
    return { handled: true, launched: 0, reason: "task session running" };
  }
  if (plan.dispatchable.length === 0) {
    return { handled: false, launched: 0, reason: plan.allDone ? "all tasks done" : "no ready tasks" };
  }

  const maxTaskAttempts = projectMaxTaskAttempts(project.content);
  const needsOwnerJudgment = plan.dispatchable.find(task => task.attempts >= maxTaskAttempts);
  if (needsOwnerJudgment) {
    return {
      handled: false,
      launched: 0,
      reason: `task ${needsOwnerJudgment.id} reached ${needsOwnerJudgment.attempts}/${maxTaskAttempts} attempts`,
    };
  }

  let launched = 0;
  for (const task of plan.dispatchable.slice(0, remainingLaunches)) {
    const attempts = task.attempts + 1;
    updateTaskFile(project.projectFile, task.id, { status: "running", attempts });
    const source = taskSource(task.id);
    const prompt = buildProjectTaskPrompt(project, task);
    const workflowName = workflowNameForTask(task);
    ctx.sdk.log("info", `[project] Dispatching task ${project.relPath}#${task.id} to ${task.assignee}`);
    ctx.sdk.emit("project.task.dispatched", {
      projectId,
      projectPath: project.relPath,
      taskId: task.id,
      assignee: task.assignee,
      runner: workflowName ? "workflow" : "agent",
      workflow: workflowName,
    });

    const run = workflowName
      ? ctx.sdk.runWorkflow(workflowName, prompt, { source, projectId })
      : ctx.sdk.runAgent(task.assignee, prompt, { source, projectId });

    run
      .then((result: any) => {
        const status = finishStatus(result);
        if (taskCompletedSuccessfully(task, result)) {
          updateTaskFile(project.projectFile, task.id, { status: "done", result: "succeeded" });
        } else {
          updateTaskFile(project.projectFile, task.id, { status: "ready", result: null });
        }
        ctx.sdk.emit("project.task.finished", {
          projectId,
          projectPath: project.relPath,
          taskId: task.id,
          assignee: task.assignee,
          sessionId: result?.sessionId ?? null,
          workflowRunId: result?.runId ?? null,
          status: result?.status ?? "unknown",
          finishStatus: status || null,
        });
      })
      .catch((e: any) => {
        updateTaskFile(project.projectFile, task.id, { status: "ready", result: null });
        ctx.sdk.emit("project.task.finished", {
          projectId,
          projectPath: project.relPath,
          taskId: task.id,
          assignee: task.assignee,
          status: "error",
          error: e?.message?.slice(0, 200) ?? String(e).slice(0, 200),
        });
      });
    launched++;
  }

  return { handled: true, launched, reason: `launched ${launched} task(s)` };
}

function emitSkip(ctx: HandlerContext, reason: string, data: Record<string, unknown> = {}): void {
  ctx.sdk.log("info", `[project] ${reason}`);
  try {
    ctx.sdk.emit("handler.skipped", {
      handler: "project",
      reason,
      ...data,
    });
  } catch { /* best-effort */ }
}

function emitOwnerIncompleteIfNoOpenWork(
  ctx: HandlerContext,
  project: ProjectInfo,
  projectId: string,
  sessionId: string | null,
): boolean {
  const latest = readFileSync(project.projectFile, "utf-8");
  const meta = parseProjectMeta(latest);
  if ((meta.status ?? "").toLowerCase() !== "active") return false;

  const parsed = parseProjectTasks(latest);
  if (parsed.errors.length > 0) return false;

  const plan = planProjectTasks(parsed.tasks, {
    activeTaskIds: activeProjectTaskIds(ctx, projectId),
    maxConcurrent: projectMaxConcurrent(latest),
  });
  const noOpenWork = parsed.tasks.length === 0 || plan.allDone;
  if (!noOpenWork) return false;

  ctx.sdk.emit("project.owner.incomplete", {
    projectId,
    projectPath: project.relPath,
    reason: "owner finished success while project remained active with no open tasks",
    projectPolicy: projectPolicy(latest),
    taskCount: parsed.tasks.length,
    sessionId,
  });
  return true;
}

function launchProjectOwner(
  ctx: HandlerContext,
  project: ProjectInfo,
  projectId: string,
  reason: string,
  ownerLoopsInFlight: Set<string>,
): void {
  if (ownerLoopsInFlight.has(projectId)) {
    emitSkip(ctx, `Skip ${project.relPath} — project owner already running`, {
      projectId,
      projectPath: project.relPath,
    });
    return;
  }

  const prompt = buildProjectOwnerPrompt(project, reason);
  ctx.sdk.log("info", `[project] Launching owner ${project.owner} for ${project.relPath}: ${reason}`);
  ctx.sdk.emit("project.owner.dispatched", {
    projectId,
    projectPath: project.relPath,
    owner: project.owner,
    reason,
  });

  ownerLoopsInFlight.add(projectId);
  let run: Promise<any>;
  try {
    run = ctx.sdk.runAgent(project.owner, prompt, { source: OWNER_SOURCE, projectId });
  } catch (e: any) {
    ownerLoopsInFlight.delete(projectId);
    const message = e.message?.slice(0, 200) ?? String(e).slice(0, 200);
    ctx.sdk.log("info", `[project] ${project.relPath} owner ERROR: ${message}`);
    ctx.sdk.emit("handler.failed", {
      handler: "project",
      agent: ctx.agentName,
      projectId,
      projectPath: project.relPath,
      owner: project.owner,
      error: message,
      durationMs: 0,
    });
    return;
  }

  run
    .then((result: any) => {
      const sessionId = result?.sessionId ?? null;
      if (result?.status === "done" && finishStatus(result) === "success") {
        emitOwnerIncompleteIfNoOpenWork(ctx, project, projectId, sessionId);
      }
      ctx.sdk.emit("project.owner.finished", {
        projectId,
        projectPath: project.relPath,
        owner: project.owner,
        sessionId,
        status: result?.status ?? "unknown",
        finishStatus: finishStatus(result) || null,
      });
    })
    .catch((e: any) => {
      const message = e.message?.slice(0, 200) ?? String(e).slice(0, 200);
      ctx.sdk.log("info", `[project] ${project.relPath} owner ERROR: ${message}`);
      ctx.sdk.emit("handler.failed", {
        handler: "project",
        agent: ctx.agentName,
        projectId,
        projectPath: project.relPath,
        owner: project.owner,
        error: message,
        durationMs: 0,
      });
    })
    .finally(() => {
      ownerLoopsInFlight.delete(projectId);
    });
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const projectsRoot = ctx.sdk.paths.projects ?? resolve(ctx.sdk.paths.root, "projects");
  const stateFile = resolve(ctx.sdk.paths.root, ".state/project-health-state.json");
  const ownerLoopsInFlight = new Set<string>();

  return async (event?: EventEnvelope) => {
    const ph = await loadProjectHealth(ctx.sdk.paths.root);
    const now = Date.now();
    const healthState = ph.readHealthState(stateFile);
    const targetProjects = projectTargetsFromEvent(ctx, event);
    const targetProject = targetProjects[0] ?? null;
    const projectSignal = isProjectSignalEvent(event, targetProjects);

    const projects = ph.scanAllProjects({ projectsRoot });
    if (projects.length === 0) {
      recordProjectReconcileMetrics(ctx, event, now, 0, 0, targetProject);
      emitSkip(ctx, "No projects found.", { eventType: event?.type ?? "timer.tick" });
      return;
    }

    const invalidProjects = projects.filter(p => p.formatErrors?.length);
    if (invalidProjects.length > 0) {
      ctx.sdk.log("info", `[project] ${invalidProjects.length} invalid project file(s): ${invalidProjects.map(p => `${p.relPath} (${p.formatErrors!.join("; ")})`).join(", ")}`);
    }

    // Smart preflight: skip if all projects are blocked/waiting/closed and none have changed
    const hasActionable = projects.some(p => p.status === "active");
    if (!hasActionable && event?.type !== "project.nudge" && event?.type !== "trigger.project" && !projectSignal) {
      const lastScan = healthState.lastFullScan || 0;
      const hasChanges = projects.some(p => {
        try {
          const fs = require("node:fs");
          const projectChanged = fs.statSync(p.projectFile).mtimeMs > lastScan;
          const discussionFile = resolve(dirname(p.projectFile), "discussion.md");
          const discussionChanged = fs.existsSync(discussionFile) && fs.statSync(discussionFile).mtimeMs > lastScan;
          return projectChanged || discussionChanged;
        }
        catch { return false; }
      });
      if (!hasChanges) {
        recordProjectReconcileMetrics(ctx, event, now, 0, 0, targetProject);
        emitSkip(ctx, "Preflight skip: 0 actionable, no file changes since last scan", { eventType: event?.type ?? "timer.tick" });
        return;
      }
    }

    // Sync projects to DB cache
    try {
      const db = ctx.sdk.getDb();
      for (const p of projects) ph.upsertProject(db, p);
      ph.pruneMissingProjectCache?.(db, ctx.sdk.paths.root, projects);
    } catch { /* best-effort */ }

    // Gather system context
    let breachedMetrics = new Set<string>();
    let ownerRunningProjects = new Set<string>();
    let liveProjectSessions = new Map<string, string>();
    try {
      for (const a of ctx.sdk.query.alerts({ resolved: false, limit: 500 }).rows)
        if (typeof a.metric_id === "string") breachedMetrics.add(a.metric_id);
      for (const project of projects) {
        const projectId = projectIdFor(project);
        if (ownerLoopsInFlight.has(projectId)) ownerRunningProjects.add(projectId);

        const projectSessions = [
          ...ctx.sdk.query.sessions({ projectId, status: "running", limit: 100 }).rows,
          ...ctx.sdk.query.sessions({ projectId, status: "idle", limit: 100 }).rows,
        ] as Array<{ sessionId?: string; source?: unknown }>;
        const liveSession = projectSessions.find(row => row.sessionId);
        if (liveSession?.sessionId) {
          liveProjectSessions.set(projectId, liveSession.sessionId);
        }
        if (projectSessions.some(row => row.source === OWNER_SOURCE)) {
          ownerRunningProjects.add(projectId);
        }
      }
    } catch { /* skip */ }

    // Track blocker changes
    for (const project of projects) {
      if (!healthState.projects[project.relPath]) {
        healthState.projects[project.relPath] = ph.newProjectHealthEntry();
      }
      const pState = healthState.projects[project.relPath];
      const currentStatus = project.status;
      if (currentStatus === "blocked" || currentStatus === "waiting") {
        const blockerHash = ph.simpleHash(project.blockerReason);
        if (pState.blockerHash && blockerHash && pState.blockerHash !== blockerHash) {
          pState.lastStatusChange = now;
          pState.lastEscalation = 0;
        } else if (pState.lastStatusChange === 0) {
          pState.lastStatusChange = now;
        }
        pState.blockerHash = blockerHash;
      } else if (currentStatus === "active" && pState.lastStatusChange !== 0) {
        pState.lastStatusChange = 0;
        pState.blockerHash = "";
        pState.lastEscalation = 0;
      }
    }

    // Diagnose each project
    const actions: Array<{ project: ProjectInfo; action: HealthAction }> = [];
    const projectNudge = event?.type === "project.nudge" && targetProjects.length > 0;
    const commentNudge = projectNudge && event?.data?.comment === true;
    const taskFinishedNudge = event?.type === "project.task.finished" && targetProjects.length > 0;
    const signalReason = projectSignalReason(event);
    for (const project of projects) {
      if (projectSignal && targetProjects.length === 0) continue;
      if (!matchesAnyProjectTarget(project, targetProjects)) continue;
      const forceLaunch = event?.type === "trigger.project" || projectNudge || taskFinishedNudge || projectSignal;
      let action = ph.diagnoseProject(project, healthState, breachedMetrics, ownerRunningProjects, now, projects, forceLaunch);
      if (
        projectSignal
        && action.type === "skip"
        && signalReason
        && !["closed", "done", "complete", "completed"].includes(project.status)
        && !ownerRunningProjects.has(projectIdFor(project))
      ) {
        action = { type: "launch-owner", reason: signalReason, comment: "" };
      } else if (projectSignal && action.type === "launch-owner" && signalReason) {
        action = { ...action, reason: signalReason };
      }
      actions.push({ project, action });
    }
    if (projectSignal && targetProjects.length === 0) {
      emitSkip(ctx, `Project signal had no project target: ${event?.type ?? "unknown"}`, {
        eventType: event?.type ?? "timer.tick",
        metricId: metricIdFromEvent(event),
      });
    }
    if (targetProjects.length > 0 && actions.length === 0) {
      emitSkip(ctx, `Target project not found: ${targetProjects.join(", ")}`, { eventType: event?.type ?? "timer.tick", projectPath: targetProjects.join(", ") });
    }

    // Log non-trivial actions
    const counts: Record<string, number> = {};
    for (const { action } of actions) counts[action.type] = (counts[action.type] ?? 0) + 1;
    if (Object.keys(counts).some(k => k !== "skip")) {
      ctx.sdk.log("info", `[project] ${projects.length} projects — ${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(", ")}`);
    }

    // Execute actions
    let launched = 0;
    for (const { project, action } of actions) {
      const pState = healthState.projects[project.relPath];
      const projectId = projectIdFor(project);

      if (project.status === "active" && !project.formatErrors?.length && launched < ph.MAX_LAUNCHES_PER_TICK) {
        const appTaskSignal = signalReadyProjectAppTasks(ctx, project, projectId);
        if (appTaskSignal.handled) {
          if (appTaskSignal.launched > 0) {
            pState.lastLaunch = now;
            if (!pState.launchTimestamps) pState.launchTimestamps = [];
            pState.launchTimestamps = pState.launchTimestamps.filter((t: number) => now - t < 7200_000);
            pState.launchTimestamps.push(now);
            pState.consecutiveSkips = 0;
            launched += appTaskSignal.launched;
          }
          continue;
        }

        const taskDispatch = dispatchReadyProjectTasks(ctx, project, projectId, ph.MAX_LAUNCHES_PER_TICK - launched);
        if (taskDispatch.handled) {
          if (taskDispatch.launched > 0) {
            pState.lastLaunch = now;
            if (!pState.launchTimestamps) pState.launchTimestamps = [];
            pState.launchTimestamps = pState.launchTimestamps.filter((t: number) => now - t < 7200_000);
            pState.launchTimestamps.push(now);
            pState.consecutiveSkips = 0;
            launched += taskDispatch.launched;
          }
          continue;
        }
      }

      if (action.type === "skip") {
        const liveSessionId = liveProjectSessions.get(projectId);
        if (commentNudge && liveSessionId) {
          const comment = typeof event?.data?.commentText === "string" ? event.data.commentText : "A new project comment was added.";
          ctx.sdk.log("info", `[project] Steering live project session ${liveSessionId} for ${project.relPath}: ${action.reason}`);
          ctx.sdk.emit("steer", {
            sessionId: liveSessionId,
            source: "project-comment",
            message:
              `[project comment]\n${comment}\n\n` +
              `This comment is now part of ${project.relPath}/discussion.md. Treat it as current human direction. ` +
              `If it changes the goal, scope, or next step, adjust your work now and finish promptly so the project reviewer can update project.md.`,
          });
          pState.consecutiveSkips = 0;
          continue;
        }
        if (project.status !== "closed") pState.consecutiveSkips++;
        continue;
      }

      if (action.type === "reactivate") {
        ctx.sdk.log("info", `[project] Reactivating ${project.relPath}: ${action.reason}`);
        const content = ph.updateField(project.content, "Status", "active");
        writeFileSync(project.projectFile, content, "utf-8");
        ph.appendDiscussionComment(dirname(project.projectFile), action.reason, "project-handler");
        pState.reactivationAttempts++;
        pState.blockerHash = "";
        pState.consecutiveSkips = 0;
        continue;
      }

      if (action.type === "add-comment") {
        ctx.sdk.log("info", `[project] Comment on ${project.relPath}: ${action.reason}`);
        const content = ph.updateField(project.content, "Status", "active");
        writeFileSync(project.projectFile, content, "utf-8");
        ph.appendDiscussionComment(dirname(project.projectFile), action.comment, "project-handler");
        pState.reactivationAttempts++;
        pState.blockerHash = ph.simpleHash(project.blockerReason);
        pState.consecutiveSkips = 0;
        continue;
      }

      if (action.type === "escalate") {
        ctx.sdk.log("info", `[project] Escalating ${project.relPath}: ${action.reason}`);
        pState.lastEscalation = now;
        try { ctx.sdk.message("human", `🚨 Project needs attention: ${project.relPath}\nStatus: ${project.status}\nReason: ${action.reason}\nBlocker: ${project.blockerReason.slice(0, 200)}`); } catch { /* skip */ }
        continue;
      }

      // launch owner agent
      if (launched >= ph.MAX_LAUNCHES_PER_TICK) {
        emitSkip(ctx, `Skip ${project.relPath} — cap reached`, {
          eventType: event?.type ?? "timer.tick",
          projectId: projectIdFor(project),
          projectPath: project.relPath,
        });
        continue;
      }

      if (project.status !== "active") {
        let content = ph.updateField(project.content, "Status", "active");
        content = ph.updateField(content, "Stop Reason", "");
        content = ph.updateField(content, "Resume Condition", "");
        content = ph.updateField(content, "Resume After", "");
        writeFileSync(project.projectFile, content, "utf-8");
      }

      launchProjectOwner(ctx, project, projectId, action.reason, ownerLoopsInFlight);

      pState.lastLaunch = now;
      if (!pState.launchTimestamps) pState.launchTimestamps = [];
      pState.launchTimestamps = pState.launchTimestamps.filter((t: number) => now - t < 7200_000);
      pState.launchTimestamps.push(now);
      pState.consecutiveSkips = 0;
      launched++;
      try { ctx.sdk.emit("project.iteration", { projectId }); } catch {}
    }

    healthState.lastFullScan = now;
    ph.writeHealthState(stateFile, healthState);
    recordProjectReconcileMetrics(ctx, event, now, launched, actions.length, targetProject);

    if (launched > 0) {
      ctx.sdk.emit("metric", { name: event ? "handler.project.event-triggers" : "handler.project.timer-catches", value: launched });
      ctx.sdk.log("info", `[project] Launched ${launched} project action(s) [trigger: ${event?.type ?? "timer.tick"}]`);
    }
  };
};
