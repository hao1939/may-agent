/**
 * project-creative-audit — semantic fallback project review.
 *
 * Deterministic project-steward findings catch known structural problems. This
 * handler keeps a bounded May audit lane alive for the unknown cases: it picks
 * projects that deserve a fresh look and routes one proposal-only workflow.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CronEntry, EventEnvelope, HandlerContext, HandlerModule } from "@may-agent/sdk";
import { parseProjectTasks } from "@may-agent/sdk";
import { scanAllProjects, type ProjectInfo } from "../../../shared/lib/project-health.ts";

type AuditState = {
  projects: Record<string, { lastAuditAt: number; lastWorkflowRunId?: string | null }>;
};

type AuditConfig = {
  cooldownMs?: number;
  maxProjectsPerRun?: number;
};

export type AuditCandidate = {
  project: ProjectInfo;
  projectId: string;
  score: number;
  reason: string;
};

const DEFAULT_COOLDOWN_MS = 6 * 60 * 60_000;
const DEFAULT_MAX_PROJECTS_PER_RUN = 1;
const AUDITABLE_STATUSES = new Set(["active", "waiting", "blocked", "paused", "pending-review"]);

function projectIdFor(project: ProjectInfo): string {
  return `${project.owner}/${project.relPath.split("/").pop()}`;
}

function statePath(root: string): string {
  return resolve(root, ".state/project-creative-audit.json");
}

function readState(root: string): AuditState {
  try {
    const parsed = JSON.parse(readFileSync(statePath(root), "utf-8")) as AuditState;
    return { projects: parsed.projects && typeof parsed.projects === "object" ? parsed.projects : {} };
  } catch {
    return { projects: {} };
  }
}

function writeState(root: string, state: AuditState): void {
  const path = statePath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2), "utf-8");
}

function safeMtime(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function normalizeProjectPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\\/g, "/");
  if (!trimmed) return null;
  const idx = trimmed.indexOf("projects/");
  return idx >= 0 ? trimmed.slice(idx) : trimmed;
}

function eventTarget(event?: EventEnvelope): string | null {
  const data = (event?.data ?? {}) as Record<string, unknown>;
  return normalizeProjectPath(data.projectPath)
    ?? normalizeProjectPath(data.project);
}

function projectMatchesTarget(project: ProjectInfo, targetProject: string | null): boolean {
  if (!targetProject) return true;
  const targetSlug = targetProject.split("/").pop();
  return project.relPath === targetProject || (!!targetSlug && project.relPath.endsWith(`/${targetSlug}`));
}

function isRunningAudit(ctx: HandlerContext): boolean {
  try {
    const rows = ctx.sdk.query.workflowRuns({ workflow: "project-creative-audit", status: "running", limit: 1 }).rows;
    return rows.length > 0;
  } catch {
    return false;
  }
}

function isOnCooldown(project: ProjectInfo, state: AuditState, now: number, cooldownMs: number): boolean {
  const lastAuditAt = state.projects[project.relPath]?.lastAuditAt ?? 0;
  return lastAuditAt > 0 && now - lastAuditAt < cooldownMs;
}

function scoreProject(project: ProjectInfo, now: number, targetProject: string | null): AuditCandidate | null {
  if (!AUDITABLE_STATUSES.has(project.status)) return null;

  const parsed = parseProjectTasks(project.content);
  const projectMtime = safeMtime(project.projectFile);
  const ageHours = projectMtime ? (now - projectMtime) / 3_600_000 : 999;
  const reasons: string[] = [];
  let score = 0;

  if (targetProject && (project.relPath === targetProject || project.relPath.endsWith(`/${targetProject.split("/").pop()}`))) {
    score += 1000;
    reasons.push("targeted by event");
  }

  if (project.status === "blocked" || project.status === "waiting" || project.status === "paused" || project.status === "pending-review") {
    score += 80;
    reasons.push(`project is ${project.status}`);
  } else if (project.status === "active") {
    score += 50;
    reasons.push("project is active");
  }

  if (parsed.errors.length > 0) {
    score += 15;
    reasons.push("task section needs human-readable review");
  }
  if (parsed.tasks.length === 0) {
    score += 20;
    reasons.push("no parser-visible tasks");
  } else {
    const running = parsed.tasks.filter((task) => task.status === "running").length;
    const ready = parsed.tasks.filter((task) => task.status === "ready").length;
    const done = parsed.tasks.filter((task) => task.status === "done").length;
    if (running > 0) {
      score += 20;
      reasons.push(`${running} running task(s)`);
    }
    if (ready > 0) {
      score += 15;
      reasons.push(`${ready} ready task(s)`);
    }
    if (done === parsed.tasks.length) {
      score += 25;
      reasons.push("all parser-visible tasks are done");
    }
  }

  if (ageHours <= 24) {
    score += 15;
    reasons.push("recently changed");
  }

  return {
    project,
    projectId: projectIdFor(project),
    score,
    reason: reasons.join("; ") || "selected for broad project audit",
  };
}

export function selectAuditCandidates(
  projects: ProjectInfo[],
  state: AuditState,
  now: number,
  cooldownMs: number,
  targetProject: string | null = null,
  forceCooldownBypass = false,
): AuditCandidate[] {
  return projects
    .filter((project) => projectMatchesTarget(project, targetProject))
    .filter((project) => forceCooldownBypass || !isOnCooldown(project, state, now, cooldownMs))
    .map((project) => scoreProject(project, now, targetProject))
    .filter((candidate): candidate is AuditCandidate => !!candidate)
    .sort((a, b) => b.score - a.score || a.project.relPath.localeCompare(b.project.relPath));
}

export function buildAuditTask(candidate: AuditCandidate, triggerType: string): string {
  const projectDir = dirname(candidate.project.projectFile);
  return [
    "[project-creative-audit] Review one project for unknown issues and improvement opportunities.",
    "",
    "This is a proposal-only audit. Do not edit project files directly. Do not create tasks directly.",
    "Read the project and nearby evidence, think broadly, and write concrete suggestions for the project owner to review.",
    "",
    "Look for missing or misleading next actions, stale assumptions, contradictory project state, evidence gaps, bad task decomposition, false blockers, hidden blockers, and any other issue that a fixed rule might miss.",
    "It is fine to say no issue found if the project is coherent and moving.",
    "",
    "## Project Audit Request",
    "```json",
    JSON.stringify({
      projectId: candidate.projectId,
      projectPath: candidate.project.relPath,
      projectDir,
      owner: candidate.project.owner,
      status: candidate.project.status,
      trigger: triggerType,
      selectionReason: candidate.reason,
      guardrails: [
        "proposal-only",
        "no direct project.md edits",
        "no direct task creation",
        "owner/project loop reviews suggestions before applying",
      ],
    }, null, 2),
    "```",
  ].join("\n");
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const projectsRoot = ctx.sdk.paths.projects ?? resolve(ctx.sdk.paths.root, "projects");
  const config = (entry.handlerConfig ?? {}) as AuditConfig;
  const cooldownMs = config.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const maxProjectsPerRun = config.maxProjectsPerRun ?? DEFAULT_MAX_PROJECTS_PER_RUN;

  return async (event?: EventEnvelope) => {
    if (!existsSync(projectsRoot)) {
      ctx.sdk.emit("handler.skipped", {
        handler: "project-creative-audit",
        reason: "projects root not found",
        projectsRoot,
        eventType: event?.type ?? "timer.tick",
      });
      return;
    }

    if (isRunningAudit(ctx)) {
      ctx.sdk.emit("handler.skipped", {
        handler: "project-creative-audit",
        reason: "prior audit workflow still running",
        eventType: event?.type ?? "timer.tick",
      });
      return;
    }

    const now = Date.now();
    const triggerType = event?.type ?? "timer.tick";
    const targetProject = eventTarget(event);
    const isExplicitTrigger = triggerType === "trigger.project-creative-audit";
    if (triggerType !== "timer.tick" && !isExplicitTrigger && !targetProject) {
      ctx.sdk.emit("handler.skipped", {
        handler: "project-creative-audit",
        reason: "non-timer audit trigger missing projectPath",
        eventType: triggerType,
      });
      return;
    }

    const projects = scanAllProjects({ projectsRoot });
    const state = readState(ctx.sdk.paths.root);
    const candidates = selectAuditCandidates(
      projects,
      state,
      now,
      cooldownMs,
      targetProject,
      isExplicitTrigger,
    ).slice(0, maxProjectsPerRun);

    if (candidates.length === 0) {
      ctx.sdk.emit("handler.skipped", {
        handler: "project-creative-audit",
        reason: "no audit candidate",
        projectCount: projects.length,
        eventType: event?.type ?? "timer.tick",
      });
      return;
    }

    for (const candidate of candidates) {
      const task = buildAuditTask(candidate, event?.type ?? "timer.tick");
      state.projects[candidate.project.relPath] = {
        lastAuditAt: now,
        lastWorkflowRunId: state.projects[candidate.project.relPath]?.lastWorkflowRunId ?? null,
      };
      ctx.sdk.runWorkflow("project-creative-audit", task, {
        source: "may",
        projectId: candidate.projectId,
      })
        .then((result) => {
          state.projects[candidate.project.relPath] = {
            lastAuditAt: now,
            lastWorkflowRunId: result.runId ?? null,
          };
          writeState(ctx.sdk.paths.root, state);
          ctx.sdk.emit("handler.workflow_dispatched", {
            handler: "project-creative-audit",
            workflow: "project-creative-audit",
            source: "may",
            owner: "may",
            projectId: candidate.projectId,
            projectPath: candidate.project.relPath,
            workflowRunId: result.runId ?? null,
            status: result.status,
            reason: candidate.reason,
          });
        })
        .catch((err) => {
          writeState(ctx.sdk.paths.root, state);
          const msg = err instanceof Error ? err.message : String(err);
          ctx.sdk.emit("handler.failed", {
            handler: "project-creative-audit",
            workflow: "project-creative-audit",
            projectId: candidate.projectId,
            projectPath: candidate.project.relPath,
            error: msg.slice(0, 200),
          });
        });
    }

    writeState(ctx.sdk.paths.root, state);
    ctx.sdk.log("info", `[project-creative-audit] dispatched ${candidates.length} audit workflow(s).`);
  };
};
