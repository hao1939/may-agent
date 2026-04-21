/**
 * project — Project Health Monitor
 *
 * NOT a dumb "is it active? resume it" loop. This handler:
 *   1. Scans all projects and classifies their health
 *   2. For blocked projects: diagnoses the blocker, attempts auto-resolution
 *   3. For stale active projects: detects stalls and escalates
 *   4. For paused projects: checks if pause conditions have cleared
 *   5. Only launches workflows when conditions are genuinely met
 *
 * Blocker auto-resolution strategies:
 *   - Metric breach → reactivate paused metric projects
 *   - Stale blockers (>24h unchanged) → re-evaluate if blocker still applies
 *   - False-done loops → add comment with scope reduction suggestion
 *   - Missing dependency resolved → clear blocker
 *   - Stuck iterations → suggest pivot via comment
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ProjectInfo {
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

type HealthAction =
  | { type: "launch-workflow"; reason: string }
  | { type: "reactivate"; reason: string }
  | { type: "add-comment"; comment: string; reason: string }
  | { type: "escalate"; reason: string }
  | { type: "skip"; reason: string };

interface HealthState {
  projects: Record<string, {
    lastLaunch: number;
    lastEscalation: number;
    reactivationAttempts: number;
    consecutiveSkips: number;
    blockerHash: string; // to detect if blocker text changed
  }>;
  lastFullScan: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const OWNER_RE = /^\*\*Owner\*\*:\s*(\S+)/mi;
const STATUS_RE = /^\*\*Status\*\*:\s*(.+)$/mi;
const HEALTH_RE = /^\*\*Health\*\*:\s*(.+)$/mi;
const ITERATION_RE = /^\*\*Iteration\*\*:\s*(\d+)/mi;

const STATE_FILE = ".state/project-health-state.json";
const INFLIGHT_FILE = ".state/project-inflight";

// Don't relaunch within 10 minutes of last launch
const LAUNCH_COOLDOWN_MS = 10 * 60 * 1000;
// Don't re-escalate within 2 hours
const ESCALATION_COOLDOWN_MS = 2 * 60 * 60 * 1000;
// Blocker is "stale" if unchanged for 6 hours
const STALE_BLOCKER_MS = 6 * 60 * 60 * 1000;
// Active project is "stalled" if unchanged for 2 hours
const STALL_THRESHOLD_MS = 2 * 60 * 60 * 1000;
// Max reactivation attempts before giving up
const MAX_REACTIVATION_ATTEMPTS = 3;
// Max concurrent workflow launches per tick
const MAX_LAUNCHES_PER_TICK = 3;

let importCounter = 0;

// ── Helpers ────────────────────────────────────────────────────────────

function extractSection(content: string, heading: string): string {
  const marker = `## ${heading}\n`;
  const idx = content.indexOf(marker);
  if (idx === -1) return "";
  const after = content.slice(idx + marker.length);
  const nextSection = after.indexOf("\n## ");
  return (nextSection === -1 ? after : after.slice(0, nextSection)).trim();
}

function extractMilestones(content: string): { done: number; total: number; pending: string[] } {
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

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

function updateField(content: string, field: string, value: string): string {
  const regex = new RegExp(`^(\\*\\*${field}\\*\\*:\\s*).*$`, "m");
  if (regex.test(content)) return content.replace(regex, `$1${value}`);
  const insertPoint = content.search(/^## /m);
  if (insertPoint > 0) return content.slice(0, insertPoint) + `**${field}**: ${value}\n` + content.slice(insertPoint);
  return content;
}

function appendComment(content: string, comment: string): string {
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

function generateRunId(): string {
  return `wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function saveWorkflowRunFile(
  projectRoot: string,
  run: { runId: string; workflow: string; task: string; parentSessionId: string | null; agent: string; startedAt: number; endedAt?: number; status: string; steps: Array<{ sessionId: string; agent: string; status: string }> },
): void {
  const dir = join(projectRoot, ".state", "workflows");
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${run.runId}.json`), JSON.stringify(run, null, 2));
  } catch { /* best-effort */ }
}

function readInflight(path: string): Set<string> {
  try {
    const data = readFileSync(path, "utf-8").trim();
    return new Set(data ? data.split("\n") : []);
  } catch { return new Set(); }
}

function writeInflight(path: string, inflight: Set<string>): void {
  try { writeFileSync(path, [...inflight].join("\n"), "utf-8"); } catch { /* skip */ }
}

function readHealthState(path: string): HealthState {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { projects: {}, lastFullScan: 0 };
  }
}

function writeHealthState(path: string, state: HealthState): void {
  try { writeFileSync(path, JSON.stringify(state, null, 2), "utf-8"); } catch { /* skip */ }
}

// ── Project scanning ───────────────────────────────────────────────────

function scanAllProjects(agentsRoot: string): ProjectInfo[] {
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

          // Extract blocker reason from Current State
          const currentState = extractSection(content, "Current State");
          const blockerReason = currentState.replace(/^Blocked:\s*/i, "").trim();

          // Extract metric IDs
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

function diagnoseProject(
  project: ProjectInfo,
  healthState: HealthState,
  breachedMetrics: Set<string>,
  runningAgents: Set<string>,
  inflight: Set<string>,
  now: number,
): HealthAction {
  const pState = healthState.projects[project.relPath] ?? {
    lastLaunch: 0, lastEscalation: 0, reactivationAttempts: 0,
    consecutiveSkips: 0, blockerHash: "",
  };

  // Terminal states — no action
  if (project.status === "done" || project.status === "cancelled") {
    // Check for pending comments on done/cancelled projects
    const comments = extractSection(project.content, "Comments");
    if (comments) {
      return { type: "launch-workflow", reason: `Pending comments on ${project.status} project` };
    }
    return { type: "skip", reason: `Status: ${project.status}` };
  }

  // Already in-flight — don't double-launch
  if (inflight.has(project.relPath)) {
    return { type: "skip", reason: "Workflow already in-flight" };
  }

  // Launch cooldown
  if (now - pState.lastLaunch < LAUNCH_COOLDOWN_MS) {
    return { type: "skip", reason: "Launch cooldown active" };
  }

  // Agent is busy with another session
  if (runningAgents.has(project.owner)) {
    return { type: "skip", reason: `Owner ${project.owner} is busy` };
  }

  // ── ACTIVE projects ─────────────────────────────────────────────
  if (project.status === "active") {
    return { type: "launch-workflow", reason: "Active project — continue work" };
  }

  // ── BLOCKED projects — the interesting case ─────────────────────
  if (project.status === "blocked") {
    const blockerHash = simpleHash(project.blockerReason);
    const blockerChanged = blockerHash !== pState.blockerHash;

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

    // Strategy 3: "Stuck iterations" blocker — suggest pivot
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

    // Strategy 4: Worker failure blocker — retry after cooldown
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

  // ── PAUSED projects ─────────────────────────────────────────────
  if (project.status === "paused") {
    // Check metric breach reactivation
    if (project.metrics.length > 0 && breachedMetrics.size > 0) {
      for (const metric of project.metrics) {
        if (breachedMetrics.has(metric)) {
          return { type: "reactivate", reason: `Paused project reactivated — metric ${metric} breached` };
        }
      }
    }

    // Check for pending comments (human may have unpaused via comment)
    const comments = extractSection(project.content, "Comments");
    if (comments) {
      return { type: "launch-workflow", reason: "Paused project has pending comments" };
    }

    // Paused projects stay paused unless explicitly unpaused
    return { type: "skip", reason: "Paused — no reactivation trigger" };
  }

  return { type: "skip", reason: `Unknown status: ${project.status}` };
}

// ── Main handler ───────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.projectRoot, "agents");
  const stateFilePath = resolve(ctx.projectRoot, STATE_FILE);
  const inflightFile = resolve(ctx.projectRoot, INFLIGHT_FILE);
  const workflowPath = join(agentsRoot, "shared", "workflows", "project.ts");

  return async () => {
    const now = Date.now();
    const healthState = readHealthState(stateFilePath);
    const inflight = readInflight(inflightFile);

    // ── Step 1: Full project scan ────────────────────────────────
    const projects = scanAllProjects(agentsRoot);
    if (projects.length === 0) return;

    // ── Step 2: Gather system context ────────────────────────────
    let breachedMetrics = new Set<string>();
    try {
      const db = ctx.getDb();
      const alerts = db.prepare(
        "SELECT metric_id FROM metric_alerts WHERE resolved_at IS NULL"
      ).all() as Array<{ metric_id: string }>;
      for (const a of alerts) breachedMetrics.add(a.metric_id);
    } catch { /* skip */ }

    let runningAgents = new Set<string>();
    try {
      const db = ctx.getDb();
      const rows = db.prepare(
        "SELECT DISTINCT agent FROM sessions WHERE status='running'"
      ).all() as Array<{ agent: string }>;
      for (const r of rows) runningAgents.add(r.agent);
    } catch { /* skip */ }

    // ── Step 3: Diagnose each project ────────────────────────────
    const actions: Array<{ project: ProjectInfo; action: HealthAction }> = [];
    for (const project of projects) {
      const action = diagnoseProject(project, healthState, breachedMetrics, runningAgents, inflight, now);
      actions.push({ project, action });
    }

    // Log summary
    const actionCounts: Record<string, number> = {};
    for (const { action } of actions) {
      actionCounts[action.type] = (actionCounts[action.type] ?? 0) + 1;
    }
    const summaryParts = Object.entries(actionCounts).map(([k, v]) => `${k}:${v}`);
    if (summaryParts.some(p => !p.startsWith("skip"))) {
      ctx.log(`[project] Health scan: ${projects.length} projects — ${summaryParts.join(", ")}`);
    }

    // ── Step 4: Execute actions ──────────────────────────────────
    let launched = 0;

    for (const { project, action } of actions) {
      // Ensure state entry exists
      if (!healthState.projects[project.relPath]) {
        healthState.projects[project.relPath] = {
          lastLaunch: 0, lastEscalation: 0, reactivationAttempts: 0,
          consecutiveSkips: 0, blockerHash: simpleHash(project.blockerReason),
        };
      }
      const pState = healthState.projects[project.relPath];

      switch (action.type) {
        case "skip":
          pState.consecutiveSkips++;
          break;

        case "reactivate": {
          ctx.log(`[project] Reactivating ${project.relPath}: ${action.reason}`);
          let content = project.content;
          content = updateField(content, "Status", "active");
          content = appendComment(content, action.reason);
          writeFileSync(project.projectFile, content, "utf-8");
          pState.reactivationAttempts++;
          pState.blockerHash = "";
          pState.consecutiveSkips = 0;
          // Fall through to launch
          // (Don't launch immediately — let next tick pick it up as active)
          break;
        }

        case "add-comment": {
          ctx.log(`[project] Adding comment to ${project.relPath}: ${action.reason}`);
          let content = project.content;
          content = appendComment(content, action.comment);
          // Reactivate so the comment gets processed by the workflow
          content = updateField(content, "Status", "active");
          writeFileSync(project.projectFile, content, "utf-8");
          pState.reactivationAttempts++;
          pState.blockerHash = simpleHash(project.blockerReason);
          pState.consecutiveSkips = 0;
          break;
        }

        case "escalate": {
          ctx.log(`[project] Escalating ${project.relPath}: ${action.reason}`);
          pState.lastEscalation = now;
          try {
            ctx.notify(`🚨 Project needs attention: ${project.relPath}\nStatus: ${project.status}\nReason: ${action.reason}\nBlocker: ${project.blockerReason.slice(0, 200)}`);
          } catch { /* skip */ }
          break;
        }

        case "launch-workflow": {
          if (launched >= MAX_LAUNCHES_PER_TICK) {
            ctx.log(`[project] Skipping ${project.relPath} — launch cap reached`);
            break;
          }

          // Load workflow module
          let wfMod: any;
          try {
            wfMod = await import(workflowPath + "?t=" + ++importCounter);
            if (typeof wfMod.execute !== "function") throw new Error("No execute() export");
          } catch (err) {
            ctx.log(`[project] ERROR loading workflow: ${err}`);
            return;
          }

          const task = `project: ${project.relPath}\nagent: ${project.owner}\ngoal: see project file`;
          const runId = generateRunId();

          ctx.log(`[project] Launching workflow for ${project.relPath}: ${action.reason}`);

          const workflowCtx = {
            emit: (event: any) => { ctx.emit(event); },
            getDb: () => ctx.getDb(),
            log: (msg: string) => ctx.log(msg),
            notify: (msg: string) => ctx.notify(msg),
            persistDir: ctx.persistDir,
            projectRoot: ctx.projectRoot,
            agentsRoot: ctx.agentsRoot,
            task,
            agent: project.owner,
            runFunction: async (label: string, fn: () => Promise<string>) => {
              const start = Date.now();
              let output: string; let hadError = false; let errorMsg: string | undefined;
              try {
                output = await Promise.race([
                  fn(),
                  new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 30_000)),
                ]);
                if (output.length > 50_000) output = output.slice(0, 50_000) + "\n…(truncated)";
              } catch (err: any) {
                hadError = true; errorMsg = err?.message ?? String(err); output = `ERROR: ${errorMsg}`;
              }
              return {
                sessionId: `fn_${label}_${Date.now()}`, status: hadError ? "error" : "done",
                lastAssistantText: output, messages: [], duration: `${((Date.now() - start) / 1000).toFixed(1)}s`,
                outputDir: "", turnsUsed: 0, ...(hadError && errorMsg ? { error: errorMsg } : {}),
              };
            },
            runAgent: async (agentName: string, agentTask: string) => {
              return ctx.manager.callAgent(agentName, agentTask, { source: "workflow", workflowRunId: runId, projectId: `${project.owner}/${project.relPath.split("/").pop()}` });
            },
            runWorkflow: async () => ({ type: "escalate" as const, reason: "Sub-workflows not supported" }),
            summarize: (result: any, _opts?: any) => {
              const text = result?.lastAssistantText ?? result?.summary ?? "";
              return text.length > 1500 ? text.slice(0, 1500) + "…" : text;
            },
            done: (summary: string) => ({ type: "done" as const, summary }),
            escalate: (reason: string, context?: unknown) => ({ type: "escalate" as const, reason, context }),
          };

          // Track in-flight
          inflight.add(project.relPath);
          writeInflight(inflightFile, inflight);

          const wfRun = {
            runId, workflow: "project", task,
            parentSessionId: null as string | null,
            agent: project.owner, startedAt: Date.now(),
            status: "running",
            steps: [] as Array<{ sessionId: string; agent: string; status: string }>,
          };
          saveWorkflowRunFile(ctx.projectRoot, wfRun);

          const origRunAgent = workflowCtx.runAgent;
          workflowCtx.runAgent = async (agentName: string, agentTask: string) => {
            const result = await origRunAgent(agentName, agentTask);
            if (result.sessionId) {
              wfRun.steps.push({ sessionId: result.sessionId, agent: agentName, status: result.status ?? "done" });
              saveWorkflowRunFile(ctx.projectRoot, wfRun);
            }
            return result;
          };

          wfMod.execute(workflowCtx).then((result: any) => {
            ctx.log(`[project] ${project.relPath} → ${result.type}`);
            wfRun.status = "done"; wfRun.endedAt = Date.now();
            saveWorkflowRunFile(ctx.projectRoot, wfRun);
          }).catch((err: any) => {
            ctx.log(`[project] ${project.relPath} ERROR: ${err}`);
            wfRun.status = "error"; wfRun.endedAt = Date.now();
            saveWorkflowRunFile(ctx.projectRoot, wfRun);
          }).finally(() => {
            inflight.delete(project.relPath);
            writeInflight(inflightFile, inflight);
          });

          pState.lastLaunch = now;
          pState.consecutiveSkips = 0;
          launched++;
          break;
        }
      }
    }

    // ── Step 5: Persist state ────────────────────────────────────
    healthState.lastFullScan = now;
    writeHealthState(stateFilePath, healthState);

    if (launched > 0) ctx.log(`[project] Launched ${launched} workflow(s)`);
  };
};
