/**
 * project-resume — Project health monitor (5-stage pipeline).
 *
 * Scans agents/*\/workspace/projects/*.md every 5 minutes. For each project
 * file, runs a 5-stage pipeline:
 *
 *   1. Check pause conditions — auto-unpause if time/condition met
 *   2. Try to unblock — check request DB, notify human if needed
 *   3. Escalate what can't be fixed — stale blocks, vague pauses
 *   4. Error handling — garbled status, repeated failures
 *   5. Resume — fork owner with workflow framing
 *
 * Exports create() conforming to HandlerModule.
 */

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Types ─────────────────────────────────────────────────────────────

const STATUS_RE = /^[\s*]*Status[\s*:]*\s+(\S[\S ]*\S|\S)/mi;
const VALID_STATUSES = new Set(["active", "paused", "blocked", "pending-review", "done"]);

interface ProjectFile {
  owner: string;
  path: string;
  relPath: string;
  mtimeMs: number;
  status: string;
  content: string;
}

interface ResumeState {
  attempts: Record<string, { count: number; lastAttempt: string; childSessions: number }>;
  notifications: Record<string, string>; // relPath → ISO timestamp of last notification
}

// ── Scanning (preserved from original) ────────────────────────────────

export function scanProjects(agentsRoot: string): ProjectFile[] {
  const out: ProjectFile[] = [];
  let agentDirs: string[] = [];
  try {
    agentDirs = readdirSync(agentsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);
  } catch {
    return out;
  }

  for (const owner of agentDirs) {
    const projDir = join(agentsRoot, owner, "workspace", "projects");
    if (!existsSync(projDir)) continue;

    let entries: string[] = [];
    try {
      entries = readdirSync(projDir).filter((f) => f.endsWith(".md"));
    } catch {
      continue;
    }

    for (const name of entries) {
      const abs = join(projDir, name);
      try {
        const content = readFileSync(abs, "utf-8");
        const m = STATUS_RE.exec(content);
        if (!m) continue;
        const status = m[1]!.toLowerCase().trim();
        const st = statSync(abs);
        out.push({
          owner,
          path: abs,
          relPath: `agents/${owner}/workspace/projects/${name}`,
          mtimeMs: st.mtimeMs,
          status,
          content,
        });
      } catch {
        // unreadable — skip
      }
    }
  }
  return out;
}

export function runningAgents(ctx: HandlerContext): Set<string> {
  const db = ctx.getDb();
  const rows = db
    .prepare(`SELECT DISTINCT agent FROM sessions WHERE status = 'running'`)
    .all() as Array<{ agent: string }>;
  return new Set(rows.map((r) => r.agent));
}

// ── Time parsing utilities ────────────────────────────────────────────

const WAIT_DURATION_RE = /wait\s+(\d+)\s*(h|hr|hrs|hours?|d|days?|m|min|mins|minutes?)/i;
const RESUME_AFTER_RE = /(?:resume\s+after|until|after)\s+(\d{4}-\d{2}-\d{2}(?:T[\d:]+Z?)?)/i;

/**
 * Parse a pause condition from the project content.
 * Returns { type, resolved } where resolved=true means the condition has passed.
 */
function parsePauseCondition(content: string, mtimeMs: number): {
  type: "time-elapsed" | "date-passed" | "vague" | "legitimate-wait";
  resolved: boolean;
  detail: string;
} {
  const now = Date.now();

  // Check "wait Xh/Xd" patterns
  const waitMatch = WAIT_DURATION_RE.exec(content);
  if (waitMatch) {
    const amount = parseInt(waitMatch[1]!, 10);
    const unit = waitMatch[2]!.toLowerCase();
    let ms = amount * 3600_000; // default hours
    if (unit.startsWith("d")) ms = amount * 86400_000;
    if (unit.startsWith("m")) ms = amount * 60_000;
    const deadline = mtimeMs + ms;
    if (now >= deadline) {
      return { type: "time-elapsed", resolved: true, detail: `wait ${amount}${unit} elapsed` };
    }
    const remainH = Math.round((deadline - now) / 3600_000 * 10) / 10;
    return { type: "legitimate-wait", resolved: false, detail: `${remainH}h remaining` };
  }

  // Check "resume after YYYY-MM-DD" patterns
  const dateMatch = RESUME_AFTER_RE.exec(content);
  if (dateMatch) {
    const target = new Date(dateMatch[1]!).getTime();
    if (!isNaN(target) && now >= target) {
      return { type: "date-passed", resolved: true, detail: `date ${dateMatch[1]} passed` };
    }
    if (!isNaN(target)) {
      return { type: "legitimate-wait", resolved: false, detail: `waiting until ${dateMatch[1]}` };
    }
  }

  return { type: "vague", resolved: false, detail: "no parseable time condition" };
}

// ── Status mutation ───────────────────────────────────────────────────

function setProjectStatus(project: ProjectFile, newStatus: string): void {
  const updated = project.content.replace(STATUS_RE, (match, _oldStatus) => {
    return match.replace(_oldStatus, newStatus);
  });
  writeFileSync(project.path, updated, "utf-8");
  project.status = newStatus;
  project.content = updated;
}

// ── State persistence ─────────────────────────────────────────────────

function loadState(persistDir: string): ResumeState {
  const path = join(persistDir, "project-resume-state.json");
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as ResumeState;
  } catch {
    return { attempts: {}, notifications: {} };
  }
}

function saveState(persistDir: string, state: ResumeState): void {
  const path = join(persistDir, "project-resume-state.json");
  writeFileSync(path, JSON.stringify(state, null, 2), "utf-8");
}

function shouldNotify(state: ResumeState, key: string, cooldownMs = 6 * 3600_000): boolean {
  const last = state.notifications[key];
  if (!last) return true;
  return Date.now() - new Date(last).getTime() > cooldownMs;
}

function markNotified(state: ResumeState, key: string): void {
  state.notifications[key] = new Date().toISOString();
}

// ── Stage implementations ─────────────────────────────────────────────

function stage1_checkPause(project: ProjectFile, ctx: HandlerContext): boolean {
  if (project.status !== "paused") return false;

  const condition = parsePauseCondition(project.content, project.mtimeMs);
  if (condition.resolved) {
    setProjectStatus(project, "active");
    ctx.log(`[project-health] ✅ auto-unpaused ${project.relPath}: ${condition.detail}`);
    return true; // now active, proceed to stage 5
  }

  // Legitimate wait — skip silently
  if (condition.type === "legitimate-wait") return false;

  // Vague condition — will be caught by stage 3
  return false;
}

function stage2_tryUnblock(project: ProjectFile, ctx: HandlerContext, state: ResumeState): boolean {
  if (project.status !== "blocked") return false;

  const content = project.content.toLowerCase();
  const db = ctx.getDb();

  // Check if blocked on a request that's now completed
  const blockedOnMatch = project.content.match(/blocked\s+(?:on|by|waiting\s+for)\s+(\w+)/i);
  if (blockedOnMatch) {
    const blockingAgent = blockedOnMatch[1]!.toLowerCase();

    // Check if there are completed requests from that agent recently
    const rows = db.prepare(
      `SELECT id, status FROM requests WHERE agent = ? AND status = 'completed' ORDER BY updatedAt DESC LIMIT 5`
    ).all(blockingAgent) as Array<{ id: string; status: string }>;

    if (rows.length > 0) {
      setProjectStatus(project, "active");
      ctx.log(`[project-health] ✅ auto-unblocked ${project.relPath}: ${blockingAgent} has completed requests`);
      return true;
    }
  }

  // Blocked on human approval
  if (content.includes("approval") || content.includes("human") || content.includes("hao")) {
    const key = `blocked-human:${project.relPath}`;
    if (shouldNotify(state, key)) {
      ctx.notify(`🔒 Project ${project.relPath} blocked on human approval. Please review.`);
      markNotified(state, key);
      ctx.log(`[project-health] 📢 notified human: ${project.relPath} blocked on approval`);
    }
    return false;
  }

  // Blocked with no clear reason — escalate to May
  return false;
}

function stage3_escalate(project: ProjectFile, ctx: HandlerContext, state: ResumeState): void {
  const now = Date.now();
  const ageMs = now - project.mtimeMs;
  const ageH = Math.round(ageMs / 3600_000);

  // Blocked >24h
  if (project.status === "blocked" && ageMs > 24 * 3600_000) {
    const key = `stale-block:${project.relPath}`;
    if (shouldNotify(state, key, 24 * 3600_000)) {
      ctx.notify(`⚠️ Project ${project.relPath} blocked for ${ageH}h with no progress. Needs attention.`);
      markNotified(state, key);
      ctx.log(`[project-health] 🚨 escalated stale block: ${project.relPath} (${ageH}h)`);
    }
    return;
  }

  // Paused with vague condition
  if (project.status === "paused") {
    const condition = parsePauseCondition(project.content, project.mtimeMs);
    if (condition.type === "vague" && ageMs > 12 * 3600_000) {
      const key = `vague-pause:${project.relPath}`;
      if (shouldNotify(state, key, 24 * 3600_000)) {
        ctx.notify(`⚠️ Project ${project.relPath} paused ${ageH}h ago with no clear resume condition. Consider unpausing or adding a deadline.`);
        markNotified(state, key);
        ctx.log(`[project-health] 🚨 escalated vague pause: ${project.relPath}`);
      }
    }
  }
}

function stage4_errorHandling(project: ProjectFile, ctx: HandlerContext, state: ResumeState): boolean {
  // Garbled / unknown status
  if (!VALID_STATUSES.has(project.status)) {
    const key = `garbled:${project.relPath}`;
    if (shouldNotify(state, key)) {
      ctx.notify(`⚠️ Project ${project.relPath} has unrecognized status: "${project.status}". Needs manual fix.`);
      markNotified(state, key);
    }
    ctx.log(`[project-health] ⚠️ garbled status "${project.status}" in ${project.relPath}`);
    return true; // stop processing
  }

  // Active but persistent-task keeps failing (3+ attempts, 0 child sessions)
  if (project.status === "active") {
    const record = state.attempts[project.relPath];
    if (record && record.count >= 3 && record.childSessions === 0) {
      const key = `failing-resume:${project.relPath}`;
      if (shouldNotify(state, key)) {
        ctx.notify(`🚨 Project ${project.relPath} has been resumed ${record.count} times but 0 child sessions completed. Workflow may not be starting.`);
        markNotified(state, key);
      }
      ctx.log(`[project-health] 🚨 persistent failure: ${project.relPath} (${record.count} attempts, 0 children)`);
      return true; // stop trying to resume
    }
  }

  return false;
}

function stage5_resume(
  project: ProjectFile,
  ctx: HandlerContext,
  state: ResumeState,
  busy: Set<string>,
  dryRun: boolean,
): { forked: boolean; skippedBusy: boolean } {
  if (project.status !== "active") return { forked: false, skippedBusy: false };

  if (busy.has(project.owner)) {
    return { forked: false, skippedBusy: true };
  }

  // "Run the workflow" framing triggers workflow tool use.
  // "Resume the project" framing triggers read() instead. (Verified finding, 100% rates n=25+.)
  const task =
    `Run the persistent-task workflow for this project.\n\n` +
    `workflow.run("persistent-task", "project: ${project.relPath}\nagent: ${project.owner}\ngoal: see project file")\n\n` +
    `If the project is blocked or done, update Status in the file and call finish().`;

  if (dryRun) {
    ctx.log(`[project-health] DRY_RUN would fork ${project.owner} for ${project.relPath}`);
    return { forked: false, skippedBusy: false };
  }

  try {
    const sessionId = ctx.manager.run(project.owner, task, { source: "cron" });
    ctx.log(`[project-health] forked ${project.owner} → ${sessionId} (project: ${project.relPath})`);

    // Track resume attempt
    const record = state.attempts[project.relPath] ??= { count: 0, lastAttempt: "", childSessions: 0 };
    record.count++;
    record.lastAttempt = new Date().toISOString();

    // Count child sessions since last attempt to detect failing workflows
    const db = ctx.getDb();
    const children = db.prepare(
      `SELECT COUNT(*) as cnt FROM sessions WHERE parentSessionId = ? AND status = 'done'`
    ).get(sessionId) as { cnt: number } | undefined;
    if (children) record.childSessions += children.cnt;

    return { forked: true, skippedBusy: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.log(`[project-health] ⚠️ failed to fork ${project.owner} for ${project.relPath}: ${msg}`);
    return { forked: false, skippedBusy: false };
  }
}

// ── Pick per owner (keep most-recently-modified active project) ───────

export function pickPerOwner(projects: ProjectFile[]): Map<string, ProjectFile> {
  const byOwner = new Map<string, ProjectFile>();
  for (const p of projects) {
    if (p.status !== "active") continue;
    const cur = byOwner.get(p.owner);
    if (!cur || p.mtimeMs > cur.mtimeMs) byOwner.set(p.owner, p);
  }
  return byOwner;
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.projectRoot, "agents");

  return async () => {
    const dryRun = process.env.DRY_RUN === "1";
    const state = loadState(ctx.persistDir);
    const all = scanProjects(agentsRoot);

    if (all.length === 0) return;

    const busy = runningAgents(ctx);
    let forked = 0;
    let skippedBusy = 0;
    let unpaused = 0;
    let unblocked = 0;
    let escalated = 0;

    // Count stuck projects for system health check
    const stuckProjects = all.filter(
      (p) => (p.status === "blocked" || p.status === "paused") &&
        Date.now() - p.mtimeMs > 24 * 3600_000
    );

    if (stuckProjects.length >= 3) {
      const key = "system-health:multiple-stuck";
      if (shouldNotify(state, key, 24 * 3600_000)) {
        ctx.notify(`🚨 System health: ${stuckProjects.length} projects stuck (blocked/paused >24h). This may indicate a systemic issue.`);
        markNotified(state, key);
      }
    }

    for (const project of all) {
      // Stage 1: Check pause conditions
      if (stage1_checkPause(project, ctx)) {
        unpaused++;
        // Falls through to stage 5 (now active)
      }

      // Stage 2: Try to unblock
      if (stage2_tryUnblock(project, ctx, state)) {
        unblocked++;
        // Falls through to stage 5 (now active)
      }

      // Stage 3: Escalate what can't be fixed
      stage3_escalate(project, ctx, state);

      // Stage 4: Error handling (may stop processing)
      if (stage4_errorHandling(project, ctx, state)) continue;

      // Stage 5: Resume active projects
      const result = stage5_resume(project, ctx, state, busy, dryRun);
      if (result.forked) forked++;
      if (result.skippedBusy) skippedBusy++;
    }

    saveState(ctx.persistDir, state);

    const total = all.length;
    const active = all.filter((p) => p.status === "active").length;
    if (forked > 0 || skippedBusy > 0 || unpaused > 0 || unblocked > 0) {
      ctx.log(
        `[project-health] scan: ${total} projects, ${active} active, ` +
        `forked=${forked} skipped-busy=${skippedBusy} unpaused=${unpaused} unblocked=${unblocked}` +
        `${dryRun ? " (dry-run)" : ""}`,
      );
    }
  };
};
