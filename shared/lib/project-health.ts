/**
 * project-health — Project scanning, diagnosis, and health state management.
 *
 * Used by the project handler to:
 * 1. Scan all projects across agents
 * 2. Diagnose what action each project needs
 * 3. Persist health state and inflight tracking
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash, randomBytes } from "node:crypto";

// ── Constants ────────────────────────────────────────────────────────────

export const MAX_LAUNCHES_PER_TICK = 3;

// ── Types ────────────────────────────────────────────────────────────────

export interface ProjectInfo {
  /** Relative path from agentsRoot, e.g. "bob/workspace/projects/my-project" */
  relPath: string;
  /** Absolute path to project.md */
  projectFile: string;
  /** Raw content of project.md */
  content: string;
  /** Parsed status field */
  status: string;
  /** Parsed owner field */
  owner: string;
  /** Parsed blocker reason (from Current State or Stop Reason) */
  blockerReason: string;
}

export interface HealthAction {
  type: "skip" | "reactivate" | "add-comment" | "escalate" | "launch-workflow";
  reason: string;
  comment: string;
}

export interface ProjectHealthEntry {
  blockerHash: string;
  consecutiveSkips: number;
  reactivationAttempts: number;
  lastEscalation: number;
  lastLaunch: number;
  lastStatusChange: number;
}

export interface HealthState {
  lastFullScan: number;
  projects: Record<string, ProjectHealthEntry>;
}

// ── Markdown helpers ─────────────────────────────────────────────────────

/** Extract a **Field**: value from markdown content */
function extractField(content: string, field: string): string {
  const re = new RegExp(`^\\*\\*${field}\\*\\*:\\s*(.+)`, "m");
  const m = content.match(re);
  return m ? m[1].trim() : "";
}

/** Extract the body of a ## Section */
function extractSection(content: string, heading: string): string {
  const re = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "m");
  const m = content.match(re);
  return m ? m[1].trim() : "";
}

/** Update **Field**: value in markdown content */
export function updateField(content: string, field: string, value: string): string {
  const re = new RegExp(`^(\\*\\*${field}\\*\\*:\\s*)(.+)`, "m");
  if (re.test(content)) {
    return content.replace(re, `$1${value}`);
  }
  // If field doesn't exist, add after the first line
  const lines = content.split("\n");
  lines.splice(1, 0, `**${field}**: ${value}`);
  return lines.join("\n");
}

/** Append a comment to the ## Comments section */
export function appendComment(content: string, comment: string): string {
  const now = new Date().toISOString().slice(0, 10);
  const entry = `- [${now}] ${comment}`;

  if (content.includes("## Comments")) {
    return content.replace(/(## Comments\s*\n)/, `$1${entry}\n`);
  }
  return content + `\n## Comments\n${entry}\n`;
}

// ── Scanning ─────────────────────────────────────────────────────────────

/** Scan all projects across all agents under agentsRoot */
export function scanAllProjects(agentsRoot: string): ProjectInfo[] {
  const projects: ProjectInfo[] = [];

  let agents: string[];
  try {
    agents = readdirSync(agentsRoot).filter(d => {
      const p = join(agentsRoot, d);
      return statSync(p).isDirectory() && d !== "shared" && d !== "test" && d !== "src";
    });
  } catch {
    return [];
  }

  for (const agent of agents) {
    const projectsDir = join(agentsRoot, agent, "workspace", "projects");
    if (!existsSync(projectsDir)) continue;

    let projectDirs: string[];
    try {
      projectDirs = readdirSync(projectsDir).filter(d =>
        statSync(join(projectsDir, d)).isDirectory()
      );
    } catch {
      continue;
    }

    for (const projDir of projectDirs) {
      const projectFile = join(projectsDir, projDir, "project.md");
      if (!existsSync(projectFile)) continue;

      let content: string;
      try {
        content = readFileSync(projectFile, "utf-8");
      } catch {
        continue;
      }

      const status = extractField(content, "Status").toLowerCase() || "active";
      const owner = extractField(content, "Owner") || agent;
      const blockerReason =
        extractField(content, "Stop Reason") ||
        extractSection(content, "Current State") ||
        "";

      projects.push({
        relPath: relative(agentsRoot, join(projectsDir, projDir)),
        projectFile,
        content,
        status,
        owner,
        blockerReason,
      });
    }
  }

  return projects;
}

// ── Diagnosis ────────────────────────────────────────────────────────────

/** Check if project.md has pending comments */
function hasPendingComments(content: string): boolean {
  const comments = extractSection(content, "Comments");
  return comments.length > 0;
}

/**
 * Diagnose what action a project needs.
 * This is the core decision function — one branch per project state.
 */
export function diagnoseProject(
  project: ProjectInfo,
  healthState: HealthState,
  breachedMetrics: Set<string>,
  runningAgents: Set<string>,
  inflight: Set<string>,
  now: number,
  allProjects: ProjectInfo[],
): HealthAction {
  const skip: HealthAction = { type: "skip", reason: "no action needed", comment: "" };

  // Already running — don't double-launch
  if (inflight.has(project.relPath)) {
    return { ...skip, reason: "already inflight" };
  }

  const entry = healthState.projects[project.relPath];
  const status = project.status;

  // Terminal states
  if (status === "done" || status === "cancelled") {
    return { ...skip, reason: `status is ${status}` };
  }

  // Paused — don't touch
  if (status === "paused") {
    return { ...skip, reason: "paused" };
  }

  // Blocked or waiting
  if (status === "blocked" || status === "waiting") {
    // Has pending comments → launch workflow to process them (comment = unblock signal)
    if (hasPendingComments(project.content)) {
      return { type: "launch-workflow", reason: `${status} with pending comments`, comment: "" };
    }

    // No comments — escalate based on time
    const stoppedAt = entry?.lastStatusChange || entry?.lastLaunch || now;
    const stoppedHours = (now - stoppedAt) / (1000 * 60 * 60);

    if (stoppedHours > 24) {
      return { type: "escalate", reason: `${status} for ${Math.round(stoppedHours)}h — needs human attention`, comment: "" };
    }
    if (stoppedHours > 2) {
      return { type: "escalate", reason: `${status} for ${Math.round(stoppedHours)}h — needs review`, comment: "" };
    }

    return { ...skip, reason: `${status} — waiting for fix (${Math.round(stoppedHours * 60)}min)` };
  }

  // Active — launch if no session running
  if (status === "active") {
    // Already has an agent session running
    if (runningAgents.has(project.owner)) {
      return { ...skip, reason: "agent already running" };
    }

    // Cooldown — don't relaunch too fast
    const lastLaunch = entry?.lastLaunch || 0;
    const sinceLastLaunch = now - lastLaunch;
    if (sinceLastLaunch < 60_000) {
      return { ...skip, reason: "cooldown" };
    }

    return { type: "launch-workflow", reason: "active project needs work", comment: "" };
  }

  return skip;
}

// ── Health state persistence ─────────────────────────────────────────────

export function newProjectHealthEntry(): ProjectHealthEntry {
  return {
    blockerHash: "",
    consecutiveSkips: 0,
    reactivationAttempts: 0,
    lastEscalation: 0,
    lastLaunch: 0,
    lastStatusChange: 0,
  };
}

export function readHealthState(file: string): HealthState {
  try {
    const raw = readFileSync(file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { lastFullScan: 0, projects: {} };
  }
}

export function writeHealthState(file: string, state: HealthState): void {
  try {
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, JSON.stringify(state, null, 2), "utf-8");
  } catch { /* best effort */ }
}

// ── Inflight tracking ────────────────────────────────────────────────────

export function readInflight(file: string): Set<string> {
  try {
    const raw = readFileSync(file, "utf-8");
    return new Set(raw.split("\n").filter(Boolean));
  } catch {
    return new Set();
  }
}

export function writeInflight(file: string, inflight: Set<string>): void {
  try {
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, [...inflight].join("\n"), "utf-8");
  } catch { /* best effort */ }
}

// ── Workflow run persistence ─────────────────────────────────────────────

export function generateRunId(): string {
  return randomBytes(8).toString("hex");
}

export function saveWorkflowRunFile(projectRoot: string, wfRun: Record<string, unknown>): void {
  const dir = join(projectRoot, ".state", "workflow-runs");
  try {
    mkdirSync(dir, { recursive: true });
    const id = wfRun.runId ?? "unknown";
    writeFileSync(join(dir, `${id}.json`), JSON.stringify(wfRun, null, 2), "utf-8");
  } catch { /* best effort */ }
}

// ── Utilities ────────────────────────────────────────────────────────────

export function simpleHash(str: string): string {
  if (!str) return "";
  return createHash("md5").update(str).digest("hex").slice(0, 8);
}
