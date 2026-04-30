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
export const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between launches per project
export const MAX_ITERATIONS_PER_HOUR = 2;   // Max 2 workflow launches per project per hour

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
  /** Parsed workflow field (default: "project") */
  workflow: string;
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
  /** Timestamps of recent launches for rate limiting (pruned to last 2h) */
  launchTimestamps?: number[];
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

  // Scan shared projects (new location)
  const sharedProjDir = join(agentsRoot, "shared", "projects");
  if (existsSync(sharedProjDir)) {
    try {
      const projectDirs = readdirSync(sharedProjDir).filter(d =>
        d !== "_archive" && statSync(join(sharedProjDir, d)).isDirectory()
      );
      for (const projDir of projectDirs) {
        const projectFile = join(sharedProjDir, projDir, "project.md");
        if (!existsSync(projectFile)) continue;
        let content: string;
        try { content = readFileSync(projectFile, "utf-8"); } catch { continue; }
        const status = extractField(content, "Status").toLowerCase() || "active";
        const owner = extractField(content, "Owner") || "unknown";
        const blockerReason = extractField(content, "Stop Reason") || extractField(content, "Resume Condition") || "";
        const workflow = extractField(content, "Workflow") || "master-worker";
        projects.push({ relPath: `shared/projects/${projDir}`, projectFile, content, status, owner, blockerReason, workflow });
      }
    } catch { /* ignore */ }
  }

  // Also scan legacy per-agent locations
  let agents: string[];
  try {
    agents = readdirSync(agentsRoot).filter(d => {
      const p = join(agentsRoot, d);
      return statSync(p).isDirectory() && d !== "shared" && d !== "test" && d !== "src";
    });
  } catch {
    return projects;
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
      const workflow = extractField(content, "Workflow").toLowerCase() || "master-worker";

      projects.push({
        relPath: relative(agentsRoot, join(projectsDir, projDir)),
        projectFile,
        content,
        status,
        owner,
        blockerReason,
        workflow,
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
  runningProjects: Set<string>,
  now: number,
  allProjects: ProjectInfo[],
): HealthAction {
  const skip: HealthAction = { type: "skip", reason: "no action needed", comment: "" };

  // Already running — don't double-launch
  const entry = healthState.projects[project.relPath];
  let status = project.status;

  // "closed" is terminal — unless there are unread comments (human wants it reopened)
  if (status === "closed") {
    let hasUnread = false;
    try {
      const discFile = project.projectFile.replace("project.md", "discussion.md");
      if (existsSync(discFile)) {
        const disc = readFileSync(discFile, "utf-8");
        const lastMarker = disc.lastIndexOf("---read @");
        const unread = lastMarker >= 0 ? disc.slice(disc.indexOf("\n", lastMarker) + 1).trim() : disc.replace(/^# Discussion\s*/, "").trim();
        hasUnread = !!unread;
      }
    } catch {}
    if (hasUnread) {
      return { type: "launch-workflow", reason: "closed but has unread comments — reopening", comment: "" };
    }
    return { ...skip, reason: "closed by human" };
  }

  // "done"/"complete" are treated as waiting — only "closed" is terminal
  if (["done", "complete", "completed"].includes(status)) {
    status = "waiting";
  }

  // Waiting/blocked — check for unread discussion comments
  if (status === "waiting" || status === "blocked") {
    // Check discussion.md for unread comments (after last ---read marker)
    let hasUnread = false;
    try {
      const discFile = project.projectFile.replace("project.md", "discussion.md");
      if (existsSync(discFile)) {
        const disc = readFileSync(discFile, "utf-8");
        const lastMarker = disc.lastIndexOf("---read @");
        const unread = lastMarker >= 0 ? disc.slice(disc.indexOf("\n", lastMarker) + 1).trim() : disc.replace(/^# Discussion\s*/, "").trim();
        hasUnread = !!unread;
      }
    } catch {}
    // Also check legacy ## Comments in project.md
    if (!hasUnread) hasUnread = hasPendingComments(project.content);
    if (hasUnread) {
      return { type: "launch-workflow", reason: `${status} with unread comments`, comment: "" };
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

  // Active — launch if no session running for this project
  if (status === "active") {
    // Check if there's already a live session for this specific project
    const projectId = `${project.owner}/${project.relPath.split("/").pop()}`;
    if (runningProjects.has(projectId)) {
      return { ...skip, reason: "project has live session" };
    }

    // Cooldown — don't relaunch too fast (30min between launches)
    const lastLaunch = entry?.lastLaunch || 0;
    const sinceLastLaunch = now - lastLaunch;
    if (sinceLastLaunch < COOLDOWN_MS) {
      return { ...skip, reason: `cooldown (${Math.round((COOLDOWN_MS - sinceLastLaunch) / 60_000)}min remaining)` };
    }

    // Hourly iteration cap — prevent runaway cascades
    const recentLaunches = (entry?.launchTimestamps || []).filter(t => now - t < 3600_000);
    if (recentLaunches.length >= MAX_ITERATIONS_PER_HOUR) {
      return { ...skip, reason: `hourly cap reached (${recentLaunches.length}/${MAX_ITERATIONS_PER_HOUR} in last hour)` };
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
    launchTimestamps: [],
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

// ── DB sync ──────────────────────────────────────────────────────────────

/** Sync a scanned project to the projects table (DB cache of project.md). */
export function upsertProject(db: any, project: ProjectInfo): void {
  const name = extractField(project.content, "Project") ||
    project.relPath.split("/").pop() || project.relPath;
  const type = extractField(project.content, "Type").toLowerCase() || "milestone";
  const workflow = project.workflow || "project";
  const iteration = parseInt(extractField(project.content, "Iteration") || "0", 10);
  const priority = extractField(project.content, "Priority") || "";
  const id = project.relPath.split("/").pop() || project.relPath;

  // Count milestones
  const lines = project.content.split("\n").filter(l => /^\s*-\s*\[/.test(l));
  const done = lines.filter(l => /\[x\]/i.test(l)).length;
  const total = lines.length;

  // Use file mtime for updated_at
  let mtime = Date.now();
  try { mtime = statSync(project.projectFile).mtimeMs; } catch {}

  try {
    db.run(
      `INSERT INTO projects (id, path, name, owner, status, type, workflow, iteration, priority, milestones_done, milestones_total, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         path=excluded.path, name=excluded.name, owner=excluded.owner,
         status=excluded.status, type=excluded.type, workflow=excluded.workflow,
         iteration=excluded.iteration, priority=excluded.priority,
         milestones_done=excluded.milestones_done, milestones_total=excluded.milestones_total,
         updated_at=excluded.updated_at`,
      [id, project.relPath, name, project.owner, project.status, type, workflow, iteration, priority, done, total, mtime]
    );
  } catch { /* best-effort */ }
}
