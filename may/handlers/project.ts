/**
 * project — Scan modified projects, run project workflow directly.
 * Simple: if project.md changed since last check and no workflow is in-flight, launch one.
 * The workflow handles all logic (status checks, comments, evaluation).
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

const OWNER_RE = /^\*\*Owner\*\*:\s*(\S+)/mi;

function extractSection(content: string, heading: string): string {
  const marker = `## ${heading}\n`;
  const idx = content.indexOf(marker);
  if (idx === -1) return "";
  const after = content.slice(idx + marker.length);
  const nextSection = after.indexOf("\n## ");
  return (nextSection === -1 ? after : after.slice(0, nextSection)).trim();
}
const STATE_FILE = ".state/project-last-check";
const INFLIGHT_FILE = ".state/project-inflight";

let importCounter = 0;

function generateRunId(): string {
  return `wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Save a workflow run file so session-sync can backfill workflowRunId into the DB. */
function saveWorkflowRunFile(
  projectRoot: string,
  run: {
    runId: string;
    workflow: string;
    task: string;
    parentSessionId: string | null;
    agent: string;
    startedAt: number;
    endedAt?: number;
    status: string;
    steps: Array<{ sessionId: string; agent: string; status: string }>;
  },
): void {
  const dir = join(projectRoot, ".state", "workflows");
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${run.runId}.json`), JSON.stringify(run, null, 2));
  } catch { /* Non-fatal — coverage tracking is best-effort */ }
}

/** Read the set of projects currently being worked on. */
function readInflight(path: string): Set<string> {
  try {
    const data = readFileSync(path, "utf-8").trim();
    return new Set(data ? data.split("\n") : []);
  } catch { return new Set(); }
}

function writeInflight(path: string, inflight: Set<string>): void {
  try { writeFileSync(path, [...inflight].join("\n"), "utf-8"); } catch { /* skip */ }
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.projectRoot, "agents");
  const stateFile = resolve(ctx.projectRoot, STATE_FILE);
  const inflightFile = resolve(ctx.projectRoot, INFLIGHT_FILE);
  const workflowPath = join(agentsRoot, "shared", "workflows", "project.ts");

  // Reset on process start — first scan picks up everything
  try { writeFileSync(stateFile, "0", "utf-8"); } catch { /* skip */ }

  return async () => {
    let lastCheck = 0;
    try {
      lastCheck = parseInt(readFileSync(stateFile, "utf-8").trim(), 10) || 0;
    } catch { /* first run */ }

    const now = Date.now();
    const inflight = readInflight(inflightFile);
    const projects: Array<{ owner: string; relPath: string }> = [];

    // Check for recently breached metrics (for reactivating paused metric projects)
    let breachedMetrics: Set<string> = new Set();
    try {
      const db = ctx.getDb();
      const alerts = db.prepare(
        "SELECT metric_id FROM metric_alerts WHERE resolved_at IS NULL"
      ).all() as Array<{ metric_id: string }>;
      for (const a of alerts) breachedMetrics.add(a.metric_id);
    } catch { /* skip */ }

    // Scan all project directories for modified files
    try {
      for (const dir of readdirSync(agentsRoot, { withFileTypes: true })) {
        if (!dir.isDirectory() || dir.name.startsWith(".")) continue;
        const projDir = join(agentsRoot, dir.name, "workspace", "projects");
        if (!existsSync(projDir)) continue;

        for (const entry of readdirSync(projDir, { withFileTypes: true })) {
          let projectFile: string;
          let relPath: string;

          if (entry.isDirectory()) {
            projectFile = join(projDir, entry.name, "project.md");
            if (!existsSync(projectFile)) continue;
            relPath = `agents/${dir.name}/workspace/projects/${entry.name}`;
          } else if (entry.isFile() && entry.name.endsWith(".md")) {
            projectFile = join(projDir, entry.name);
            relPath = `agents/${dir.name}/workspace/projects/${entry.name}`;
          } else {
            continue;
          }

          try {
            const content = readFileSync(projectFile, "utf-8");
            const mtime = statSync(projectFile).mtimeMs;
            const statusMatch = content.match(/^\*\*Status\*\*:\s*(\S+)/m);
            const status = statusMatch ? statusMatch[1].toLowerCase() : "";

            // Pick up if: file changed since last check, OR status is active,
            // OR paused project declares a metric that just breached
            const changed = mtime > lastCheck;
            const isActive = status === "active";
            let metricReactivated = false;
            if (status === "paused" && breachedMetrics.size > 0) {
              const metricsSection = extractSection(content, "Metrics");
              for (const metric of breachedMetrics) {
                if (metricsSection.includes(metric)) {
                  metricReactivated = true;
                  const updated = content.replace(/^\*\*Status\*\*:\s*\S+/m, "**Status**: active");
                  writeFileSync(projectFile, updated, "utf-8");
                  ctx.log(`[project] Reactivated ${relPath} — metric ${metric} breached`);
                  break;
                }
              }
            }
            if (!changed && !isActive && !metricReactivated) continue;
            if (inflight.has(relPath)) continue;

            const m = OWNER_RE.exec(content);
            const owner = m ? m[1] : dir.name;
            projects.push({ owner, relPath });
          } catch { /* skip */ }
        }
      }
    } catch { return; }

    try { writeFileSync(stateFile, String(now), "utf-8"); } catch { /* skip */ }
    if (projects.length === 0) return;

    // Load workflow module
    let wfMod: any;
    try {
      wfMod = await import(workflowPath + "?t=" + ++importCounter);
      if (typeof wfMod.execute !== "function") throw new Error("No execute() export");
    } catch (err) {
      ctx.log(`[project] ERROR loading workflow: ${err}`);
      return;
    }

    let launched = 0;
    for (const project of projects) {
      const projectName = project.relPath.split("/").pop() ?? "";
      const projectId = `${project.owner}/${projectName}`;
      const task = `project: ${project.relPath}\nagent: ${project.owner}\ngoal: see project file`;

      const runId = generateRunId();

      const workflowCtx = {
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
          return ctx.manager.callAgent(agentName, agentTask, { source: "workflow", workflowRunId: runId, projectId });
        },
        runWorkflow: async () => ({ type: "escalate" as const, reason: "Sub-workflows not supported" }),
        emit: (event: any) => {
          ctx.emit(event);
          ctx.log(`[project:${project.relPath}] ${event.type ?? event}`);
        },
        summarize: (result: any, _opts?: any) => {
          const text = result?.lastAssistantText ?? result?.summary ?? "";
          return text.length > 1500 ? text.slice(0, 1500) + "…" : text;
        },
        done: (summary: string) => ({ type: "done" as const, summary }),
        escalate: (reason: string, context?: unknown) => ({ type: "escalate" as const, reason, context }),
      };

      // Mark in-flight before launching
      inflight.add(project.relPath);
      writeInflight(inflightFile, inflight);

      // Save initial workflow run file for session-sync backfill
      const wfRun = {
        runId,
        workflow: "project",
        task,
        parentSessionId: null as string | null,
        agent: project.owner,
        startedAt: Date.now(),
        status: "running",
        steps: [] as Array<{ sessionId: string; agent: string; status: string }>,
      };
      saveWorkflowRunFile(ctx.projectRoot, wfRun);

      // Wrap runAgent to track step sessions
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
        wfRun.status = "done";
        wfRun.endedAt = Date.now();
        saveWorkflowRunFile(ctx.projectRoot, wfRun);
      }).catch((err: any) => {
        ctx.log(`[project] ${project.relPath} ERROR: ${err}`);
        wfRun.status = "error";
        wfRun.endedAt = Date.now();
        saveWorkflowRunFile(ctx.projectRoot, wfRun);
      }).finally(() => {
        // Remove from in-flight when done
        inflight.delete(project.relPath);
        writeInflight(inflightFile, inflight);
      });

      launched++;
    }

    if (launched > 0) ctx.log(`[project] launched ${launched} workflow(s)`);
  };
};
