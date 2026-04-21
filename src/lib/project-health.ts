/**
 * project-health — Core logic for the project health monitor.
 *
 * Extracted from agents/may/handlers/project.ts to keep the handler
 * under the 100-line limit per cron-system.md conventions.
 *
 * This module provides:
 *   - Project scanning (scanAllProjects)
 *   - Health diagnosis (diagnoseProject)
 *   - Action execution helpers (reactivateProject, addComment, etc.)
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

export interface ProjectInfo {
  relPath: string;
  projectFile: string;
  owner: string;
  status: string;
  mtime: number;
  content: string;
  blockerReason: string;
  health: string;
  iteration: number;
  milestonesDone: number;
  milestonesTotal: number;
  metrics: string[];
  lastUpdatedAgo: number; // ms since last modification
}

export type HealthAction =
  | { type: "launch-workflow"; reason: string }
  | { type: "reactivate"; reason: string }
  | { type: "add-comment"; comment: string; reason: string }
  | { type: "escalate"; reason: string }
  | { type: "skip"; reason: string };

export interface ProjectHealthEntry {
  lastLaunch: number;
  lastEscalation: number;
  reactivationAttempts: number;
  consecutiveSkips: number;
  blockerHash: string;
}

export interface HealthState {
  projects: Record<string, ProjectHealthEntry>;
  lastFullScan: number;
}

// ── Constants ──────────────────────────────────────────────────────────

export const LAUNCH_COOLDOWN_MS = 10 * 60 * 1000;
export const ESCALATION_COOLDOWN_MS = 2 * 60 * 60 * 1000;
export const STALE_BLOCKER_MS = 6 * 60 * 60 * 1000;
export const STALL_THRESHOLD_MS = 2 * 60 * 60 * 1000;
export const MAX_REACTIVATION_ATTEMPTS = 3;
export const MAX_LAUNCHES_PER_TICK = 3;

const OWNER_RE = /^\*\*Owner\*\*:\s*(\S+)/mi;
const STATUS_RE = /^\*\*Status\*\*:\s*(.+)$/mi;
const HEALTH_RE = /^\*\*Health\*\*:\s*(.+)$/mi;
const ITERATION_RE = /^\*\*Iteration\*\*:\s*(\d+)/mi;

// ── Helpers ────────────────────────────────────────────────────────────

export function extractSection(content: string, heading: string): string {
  const marker = `## ${heading}\n`;
  const idx = content.indexOf(marker);
  if (idx === -1) return "";
  const after = content.slice(idx + marker.length);
  const nextSection = after.indexOf("\n## ");
  return (nextSection === -1 ? after : after.slice(0, nextSection)).trim();
}

export function extractMilestones(content: string): { done: number; total: number; pending: string[] } {
  const milestones: { done: boolean; text: string }[] = [];
  const lines = content.split("\n");
  let inMilestones = false;
  for (const line of lines) {
    if (/^##\s*Milestones/i.test(line)) { inMilestones = true; continue; }
    if (inMilestones && /^##\s/.test(line)) break;
    if (!inMilestones) continue;
    const m = line.match(/^\s*-\s*\[([ x])\]\s*(.+)/i);
    if (m) milestones.push({ done: m[1].toLowerCase() === "x", text: m[2].trim() });
  }
  return {
    total: milestones.length,
    done: milestones.filter(m => m.done).length,
    pending: milestones.filter(m => !m.done).map(m => m.text),
  };
}

export function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

export function updateField(content: string, field: string, value: string): string {
  const regex = new RegExp(`^(\\*\\*${field}\\*\\*:\\s*).*$`, "m");
  if (regex.test(content)) return content.replace(regex, `$1${value}`);
  const insertPoint = content.search(/^## /m);
  if (insertPoint >= 0) return content.slice(0, insertPoint) + `**${field}**: ${value}\n` + content.slice(insertPoint);
  return content;
}

export function appendComment(content: string, comment: string): string {
  const section = extractSection(content, "Comments");
  const now = new Date().toISOString().slice(0, 16);
  const newComment = `[${now} health-monitor] ${comment}`;
  if (section) {
    return content.replace(
      /## Comments\n[\s\S]*?(?=\n## |$)/,
      `## Comments\n${section}\n${newComment}\n`
    );
  }
  return content + `\n## Comments\n${newComment}\n`;
}

// ── File I/O ───────────────────────────────────────────────────────────

export function readInflight(path: string): Set<string> {
  try {
    const data = readFileSync(path, "utf-8").trim();
    return new Set(data ? data.split("\n") : []);
  } catch { return new Set(); }
}

export function writeInflight(path: string, inflight: Set<string>): void {
  try { writeFileSync(path, [...inflight].join("\n"), "utf-8"); } catch { /* skip */ }
}

export function readHealthState(path: string): HealthState {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { projects: {}, lastFullScan: 0 };
  }
}

export function writeHealthState(path: string, state: HealthState): void {
  try { writeFileSync(path, JSON.stringify(state, null, 2), "utf-8"); } catch { /* skip */ }
}

export function saveWorkflowRunFile(
  projectRoot: string,
  run: { runId: string; workflow: string; task: string; parentSessionId: string | null; agent: string; startedAt: number; endedAt?: number; status: string; steps: Array<{ sessionId: string; agent: string; status: string }> },
): void {
  const dir = join(projectRoot, ".state", "workflows");
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${run.runId}.json`), JSON.stringify(run, null, 2));
  } catch { /* best-effort */ }
}

export function generateRunId(): string {
  return `wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Project scanning ───────────────────────────────────────────────────

export function scanAllProjects(agentsRoot: string): ProjectInfo[] {
  const projects: ProjectInfo[] = [];
  const now = Date.now();

  try {
    for (const dir of readdirSync(agentsRoot, { withFileTypes: true })) {
      if (!dir.isDirectory() || dir.name.startsWith(".")) continue;
      const projDir = join(agentsRoot, dir.name, "workspace", "projects");
      if (!existsSync(projDir)) continue;

      for (const entry of readdirSync(projDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const projectFile = join(projDir, entry.name, "project.md");
        if (!existsSync(projectFile)) continue;
        const relPath = `agents/${dir.name}/workspace/projects/${entry.name}`;

        try {
          const content = readFileSync(projectFile, "utf-8");
          const mtime = statSync(projectFile).mtimeMs;
          const statusMatch = STATUS_RE.exec(content);
          const status = statusMatch ? statusMatch[1].trim().toLowerCase().split(/\s/)[0] : "";
          const ownerMatch = OWNER_RE.exec(content);
          const owner = ownerMatch ? ownerMatch[1] : dir.name;
          const healthMatch = HEALTH_RE.exec(content);
          const health = healthMatch ? healthMatch[1].trim() : "";
          const iterMatch = ITERATION_RE.exec(content);
          const iteration = iterMatch ? parseInt(iterMatch[1], 10) : 0;
          const ms = extractMilestones(content);

          const currentState = extractSection(content, "Current State");
          const blockerReason = currentState.replace(/^Blocked:\s*/i, "").trim();

          const metricsSection = extractSection(content, "Metrics");
          const metrics = metricsSection
            .split("\n")
            .filter(l => l.startsWith("- "))
            .map(l => l.match(/^- (\S+)/)?.[1])
            .filter(Boolean) as string[];

          projects.push({
            relPath, projectFile, owner, status, mtime, content,
            blockerReason, health, iteration,
            milestonesDone: ms.done, milestonesTotal: ms.total,
            metrics, lastUpdatedAgo: now - mtime,
          });
        } catch { /* skip unreadable */ }
      }
    }
  } catch { /* skip */ }

  return projects;
}

// ── Health diagnosis ───────────────────────────────────────────────────

export function newProjectHealthEntry(): ProjectHealthEntry {
  return {
    lastLaunch: 0, lastEscalation: 0, reactivationAttempts: 0,
    consecutiveSkips: 0, blockerHash: "",
  };
}

export function diagnoseProject(
  project: ProjectInfo,
  healthState: HealthState,
  breachedMetrics: Set<string>,
  runningAgents: Set<string>,
  inflight: Set<string>,
  now: number,
): HealthAction {
  const pState = healthState.projects[project.relPath] ?? newProjectHealthEntry();

  // Terminal states
  if (project.status === "done" || project.status === "cancelled") {
    const comments = extractSection(project.content, "Comments");
    if (comments) {
      return { type: "launch-workflow", reason: `Pending comments on ${project.status} project` };
    }
    return { type: "skip", reason: `Status: ${project.status}` };
  }

  // Already in-flight
  if (inflight.has(project.relPath)) {
    return { type: "skip", reason: "Workflow already in-flight" };
  }

  // Launch cooldown
  if (now - pState.lastLaunch < LAUNCH_COOLDOWN_MS) {
    return { type: "skip", reason: "Launch cooldown active" };
  }

  // Agent is busy
  if (runningAgents.has(project.owner)) {
    return { type: "skip", reason: `Owner ${project.owner} is busy` };
  }

  // ACTIVE projects
  if (project.status === "active") {
    return { type: "launch-workflow", reason: "Active project — continue work" };
  }

  // BLOCKED projects — auto-resolution strategies
  if (project.status === "blocked") {
    const blockerHash = simpleHash(project.blockerReason);

    // Strategy 1: Metric-based unblock
    if (project.metrics.length > 0 && breachedMetrics.size > 0) {
      for (const metric of project.metrics) {
        if (breachedMetrics.has(metric)) {
          return { type: "reactivate", reason: `Metric ${metric} breached — unblocking` };
        }
      }
    }

    // Strategy 2: False-done loop detection
    if (project.blockerReason.includes("false-done") || project.blockerReason.includes("evaluator scored <7")) {
      if (pState.reactivationAttempts < MAX_REACTIVATION_ATTEMPTS) {
        return {
          type: "add-comment",
          comment: "The project entered a false-done loop. Consider: (1) reducing scope to achievable milestones, (2) redefining success criteria, (3) splitting into smaller projects. Reactivating with scope reduction guidance.",
          reason: "False-done loop — attempting scope reduction",
        };
      }
      return { type: "escalate", reason: `False-done loop persists after ${pState.reactivationAttempts} attempts` };
    }

    // Strategy 3: Stuck iterations
    if (project.blockerReason.includes("without milestone progress") || project.blockerReason.includes("without progress")) {
      if (pState.reactivationAttempts < MAX_REACTIVATION_ATTEMPTS) {
        return {
          type: "add-comment",
          comment: "Project stalled due to repeated iterations without progress. The current approach should be abandoned. Consider: (1) a completely different technical strategy, (2) manual intervention to redefine milestones, (3) cancelling if the goal is no longer relevant.",
          reason: "Stall-blocked — suggesting pivot",
        };
      }
      return { type: "escalate", reason: `Stall persists after ${pState.reactivationAttempts} pivot attempts` };
    }

    // Strategy 4: Worker failure — retry after cooldown
    if (project.blockerReason.includes("Worker failed")) {
      if (project.lastUpdatedAgo > STALE_BLOCKER_MS) {
        return {
          type: "add-comment",
          comment: "Worker failures may have been transient. Retrying with fresh session.",
          reason: "Worker failure blocker — stale, retrying",
        };
      }
      return { type: "skip", reason: "Worker failure blocker — too recent to retry" };
    }

    // Strategy 5: Stale blocker — re-evaluate
    if (project.lastUpdatedAgo > STALE_BLOCKER_MS && pState.reactivationAttempts < MAX_REACTIVATION_ATTEMPTS) {
      return {
        type: "add-comment",
        comment: `This project has been blocked for ${Math.round(project.lastUpdatedAgo / 3600000)}h. Re-evaluating whether the blocker still applies. If the blocker is resolved, set Status to active.`,
        reason: `Stale blocker (${Math.round(project.lastUpdatedAgo / 3600000)}h) — re-evaluating`,
      };
    }

    // Strategy 6: Escalate persistent blockers
    if (pState.reactivationAttempts >= MAX_REACTIVATION_ATTEMPTS) {
      if (now - pState.lastEscalation > ESCALATION_COOLDOWN_MS) {
        return { type: "escalate", reason: `Blocked ${pState.reactivationAttempts} times, all auto-resolution failed` };
      }
    }

    return { type: "skip", reason: "Blocked — no auto-resolution strategy available" };
  }

  // PAUSED projects
  if (project.status === "paused") {
    if (project.metrics.length > 0 && breachedMetrics.size > 0) {
      for (const metric of project.metrics) {
        if (breachedMetrics.has(metric)) {
          return { type: "reactivate", reason: `Paused project reactivated — metric ${metric} breached` };
        }
      }
    }

    const comments = extractSection(project.content, "Comments");
    if (comments) {
      return { type: "launch-workflow", reason: "Paused project has pending comments" };
    }

    return { type: "skip", reason: "Paused — no reactivation trigger" };
  }

  return { type: "skip", reason: `Unknown status: ${project.status}` };
}
