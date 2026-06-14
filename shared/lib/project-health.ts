/**
 * project-health — Project scanning, diagnosis, and health state management.
 *
 * Used by the project handler to:
 * 1. Scan all projects across agents
 * 2. Diagnose what action each project needs
 * 3. Persist health state and inflight tracking
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

// ── Constants ────────────────────────────────────────────────────────────

export const MAX_LAUNCHES_PER_TICK = 3;
export const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between launches per project
export const MAX_ITERATIONS_PER_HOUR = 2;   // Max 2 owner-loop launches per project per hour
export const ESCALATION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // Max one human escalation per project per day
const COMMENT_RESUME_STATUSES = new Set(["waiting", "blocked", "pending-review", "paused"]);

// ── Types ────────────────────────────────────────────────────────────────

export interface ProjectInfo {
  /** Relative project path, e.g. "projects/my-project" */
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
  /** Legacy workflow field, no longer used to drive projects. */
  workflow: string;
  /** Project file format violations. Empty means current convention. */
  formatErrors?: string[];
}

export interface ProjectScanRoots {
  /** Canonical first-class projects directory. */
  projectsRoot: string;
}

export interface HealthAction {
  type: "skip" | "reactivate" | "add-comment" | "escalate" | "launch-owner";
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

/** Hard minimum cooldown that even forceLaunch respects (prevents tight error loops). */
const HARD_MIN_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function launchHardCooldownReason(entry: ProjectHealthEntry | undefined, now: number): string | null {
  if (!entry) return null;
  const sinceLastLaunch = now - (entry.lastLaunch || 0);
  if (entry.lastLaunch && sinceLastLaunch < HARD_MIN_COOLDOWN_MS) {
    return `hard cooldown (${Math.round((HARD_MIN_COOLDOWN_MS - sinceLastLaunch) / 60_000)}min remaining)`;
  }
  return null;
}

function launchRateLimitReason(entry: ProjectHealthEntry | undefined, now: number): string | null {
  if (!entry) return null;

  const sinceLastLaunch = now - (entry.lastLaunch || 0);
  if (entry.lastLaunch && sinceLastLaunch < COOLDOWN_MS) {
    return `cooldown (${Math.round((COOLDOWN_MS - sinceLastLaunch) / 60_000)}min remaining)`;
  }

  const recentLaunches = (entry.launchTimestamps || []).filter(t => now - t < 3600_000);
  if (recentLaunches.length >= MAX_ITERATIONS_PER_HOUR) {
    return `hourly cap reached (${recentLaunches.length}/${MAX_ITERATIONS_PER_HOUR} in last hour)`;
  }

  return null;
}

// ── Markdown helpers ─────────────────────────────────────────────────────
//
// Project-md schema parsers and editors are owned by @may-agent/sdk.
//

import {
  parseProjectMeta,
  validateProjectFormat,
  updateProjectField as updateField,
  appendDiscussionComment,
  unreadDiscussionTail,
  type ProjectMeta,
} from "@may-agent/sdk";

export { parseProjectMeta, validateProjectFormat, updateField, appendDiscussionComment, unreadDiscussionTail };
export type { ProjectMeta };

// ── Scanning ─────────────────────────────────────────────────────────────

function scanProjectDir(projectsDir: string, relPrefix: string, seen: Set<string>): ProjectInfo[] {
  const projects: ProjectInfo[] = [];
  if (!existsSync(projectsDir)) return projects;

  try {
    const projectDirs = readdirSync(projectsDir).filter(d =>
      d !== "_archive" && statSync(join(projectsDir, d)).isDirectory()
    );
    for (const projDir of projectDirs) {
      if (seen.has(projDir)) continue;
      // Accept both project.md (legacy) and project.json (v3 apps)
      let projectFile = join(projectsDir, projDir, "project.md");
      let content: string;
      if (existsSync(projectFile)) {
        try { content = readFileSync(projectFile, "utf-8"); } catch { continue; }
      } else {
        const jsonFile = join(projectsDir, projDir, "project.json");
        if (!existsSync(jsonFile)) continue;
        try {
          const jsonContent = JSON.parse(readFileSync(jsonFile, "utf-8"));
          // Synthesize project.md-compatible content from project.json
          const frontmatter = [
            "---",
            `id: ${jsonContent.id || projDir}`,
            `owner: ${jsonContent.owner || "unknown"}`,
            `status: ${jsonContent.status || "active"}`,
            `type: ${jsonContent.type || "milestone"}`,
            `priority: ${jsonContent.priority || "P2"}`,
            "---",
          ].join("\n");
          content = `${frontmatter}\n\n# ${jsonContent.goal || projDir}\n\n## Goal\n${jsonContent.goal || ""}\n`;
          projectFile = jsonFile;
        } catch { continue; }
      }
      const meta = parseProjectMeta(content);
      const formatErrors = validateProjectFormat(content, projDir);
      const status = meta.status?.toLowerCase() || "active";
      const owner = meta.owner || "unknown";
      const blockerReason = meta.stop_reason || meta.resume_condition || "";
      const workflow = meta.workflow || "";
      seen.add(projDir);
      projects.push({ relPath: `${relPrefix}/${projDir}`, projectFile, content, status, owner, blockerReason, workflow, formatErrors });
    }
  } catch { /* ignore */ }

  return projects;
}

/** Scan all first-class projects under /projects. */
export function scanAllProjects(root: string | ProjectScanRoots): ProjectInfo[] {
  const seen = new Set<string>();
  if (typeof root === "string") {
    return scanProjectDir(join(root, "projects"), "projects", seen);
  }

  return scanProjectDir(root.projectsRoot, "projects", seen);
}

// ── Diagnosis ────────────────────────────────────────────────────────────

function parseResumeAfter(content: string): number | null {
  const value = parseProjectMeta(content).resume_after;
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
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
  forceLaunch = false,
): HealthAction {
  const skip: HealthAction = { type: "skip", reason: "no action needed", comment: "" };

  // Already running — don't double-launch
  const entry = healthState.projects[project.relPath];
  let status = project.status;

  if (project.formatErrors?.length) {
    return { ...skip, reason: `invalid project format: ${project.formatErrors.join("; ")}` };
  }

  // "closed" is terminal — unless there are unread comments (human wants it reopened)
  if (status === "closed") {
    let hasUnread = false;
    try {
      const discFile = project.projectFile.replace("project.md", "discussion.md");
      if (existsSync(discFile)) {
        const disc = readFileSync(discFile, "utf-8");
        hasUnread = !!unreadDiscussionTail(disc);
      }
    } catch {}
    if (hasUnread) {
      const limited = forceLaunch ? launchHardCooldownReason(entry, now) : launchRateLimitReason(entry, now);
      if (limited) return { ...skip, reason: limited };
      return { type: "launch-owner", reason: "closed but has unread comments — reopening", comment: "" };
    }
    return { ...skip, reason: "closed by human" };
  }

  // "done"/"complete"/"completed" are terminal — same as closed
  if (["done", "complete", "completed"].includes(status)) {
    return { ...skip, reason: `terminal status: ${status}` };
  }

  // Paused-for-input states — check for unread discussion comments
  if (COMMENT_RESUME_STATUSES.has(status)) {
    // Check discussion.md for unread comments (after last ---read marker)
    let hasUnread = false;
    try {
      const discFile = project.projectFile.replace("project.md", "discussion.md");
      if (existsSync(discFile)) {
        const disc = readFileSync(discFile, "utf-8");
        hasUnread = !!unreadDiscussionTail(disc);
      }
    } catch {}
    if (hasUnread) {
      const limited = forceLaunch ? launchHardCooldownReason(entry, now) : launchRateLimitReason(entry, now);
      if (limited) return { ...skip, reason: limited };
      return { type: "launch-owner", reason: `${status} with unread comments`, comment: "" };
    }

    const resumeAfter = parseResumeAfter(project.content);
    if (resumeAfter !== null) {
      if (now >= resumeAfter) {
        const limited = forceLaunch ? launchHardCooldownReason(entry, now) : launchRateLimitReason(entry, now);
        if (limited) return { ...skip, reason: limited };
        return { type: "launch-owner", reason: `${status} resume_after is due`, comment: "" };
      }
      return { ...skip, reason: `${status} until ${new Date(resumeAfter).toISOString()}` };
    }

    if (status === "waiting" && parseProjectMeta(project.content).resume_condition) {
      return { ...skip, reason: "waiting — watching resume condition" };
    }

    if (status === "pending-review" || status === "paused") {
      return { ...skip, reason: status === "pending-review" ? "pending-review — waiting for review" : "paused — waiting for explicit resume" };
    }

    // No comments — escalate based on time
    const stoppedAt = entry?.lastStatusChange || entry?.lastLaunch || now;
    const stoppedHours = (now - stoppedAt) / (1000 * 60 * 60);
    const lastEscalation = entry?.lastEscalation || 0;

    if (lastEscalation && now - lastEscalation < ESCALATION_COOLDOWN_MS) {
      const remainingHours = Math.ceil((ESCALATION_COOLDOWN_MS - (now - lastEscalation)) / (1000 * 60 * 60));
      return { ...skip, reason: `escalation cooldown (${remainingHours}h remaining)` };
    }

    if (stoppedHours > 24) {
      return { type: "escalate", reason: `${status} for ${Math.round(stoppedHours)}h — needs human attention`, comment: "" };
    }
    if (stoppedHours > 2) {
      return { type: "escalate", reason: `${status} for ${Math.round(stoppedHours)}h — needs review`, comment: "" };
    }

    return { ...skip, reason: `${status} — waiting for fix (${Math.round(stoppedHours * 60)}min)` };
  }

  // Active — launch if no owner loop is already running for this project
  if (status === "active") {
    // Task sessions may run in parallel; only an existing owner loop suppresses
    // another owner launch for this project.
    const projectId = `${project.owner}/${project.relPath.split("/").pop()}`;
    if (runningProjects.has(projectId)) {
      return { ...skip, reason: "project owner already running" };
    }

    if (!forceLaunch) {
      const limited = launchRateLimitReason(entry, now);
      if (limited) return { ...skip, reason: limited };
    } else {
      // Even forceLaunch respects hard minimum cooldown to prevent tight error loops
      const hardLimited = launchHardCooldownReason(entry, now);
      if (hardLimited) return { ...skip, reason: hardLimited };
    }

    return { type: "launch-owner", reason: forceLaunch ? "manual project trigger" : "active project needs work", comment: "" };
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
  const meta = parseProjectMeta(project.content);
  const name = meta.name || meta.id || project.relPath.split("/").pop() || project.relPath;
  const type = meta.type?.toLowerCase() || "milestone";
  const workflow = project.workflow || "";
  const iteration = parseInt(meta.iteration || "0", 10);
  const priority = meta.priority || "";
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

/** Remove stale top-level project cache rows after project folders move/vanish. */
export function pruneMissingProjectCache(db: any, root: string, projects: ProjectInfo[]): number {
  const livePaths = new Set(projects.map((project) => project.relPath));
  let deleted = 0;
  try {
    const rows = db.prepare(
      "SELECT id, path FROM projects WHERE path LIKE 'projects/%' AND path NOT LIKE 'projects/_archive/%'",
    ).all() as Array<{ id: string; path: string }>;
    for (const row of rows) {
      if (livePaths.has(row.path)) continue;
      if (existsSync(join(root, row.path, "project.md")) || existsSync(join(root, row.path, "project.json"))) continue;
      db.run("DELETE FROM projects WHERE id = ?", [row.id]);
      deleted += 1;
    }
  } catch {
    return deleted;
  }
  return deleted;
}
