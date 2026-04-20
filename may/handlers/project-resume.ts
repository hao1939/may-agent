/**
 * project-resume — Scan projects modified since last check, run persistent-task workflow directly.
 * No LLM wrapper — the workflow handles everything.
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import type { WorkflowContext, WorkflowModule, WorkflowEvent } from "../../../src/lib/workflow.js";
import type { WorkflowRun, WorkflowStep } from "../../../src/lib/persistence.js";
import { saveWorkflowRun } from "../../../src/lib/persistence.js";
import { summarizeForHandoff } from "../../../src/lib/handoff.js";

const OWNER_RE = /^\*\*Owner\*\*:\s*(\S+)/mi;
const STATE_FILE = ".state/project-resume-last-check";

let importCounter = 0;

async function loadPersistentTask(sharedDir: string): Promise<WorkflowModule> {
  const filePath = join(sharedDir, "persistent-task.ts");
  const mod = await import(filePath + "?t=" + ++importCounter);
  return { name: mod.name, description: mod.description ?? "", execute: mod.execute };
}

function generateRunId(): string {
  return `wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.projectRoot, "agents");
  const stateFile = resolve(ctx.projectRoot, STATE_FILE);
  const sharedWorkflowDir = join(agentsRoot, "shared", "workflows");

  return async () => {
    // Read last check time
    let lastCheck = 0;
    try {
      lastCheck = parseInt(readFileSync(stateFile, "utf-8").trim(), 10) || 0;
    } catch { /* first run */ }

    const now = Date.now();
    const projects: Array<{ owner: string; relPath: string }> = [];

    // Scan all project directories
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
            const mtime = statSync(projectFile).mtimeMs;
            if (mtime <= lastCheck) continue;

            const content = readFileSync(projectFile, "utf-8");
            const m = OWNER_RE.exec(content);
            const owner = m ? m[1] : dir.name;
            projects.push({ owner, relPath });
          } catch { /* skip */ }
        }
      }
    } catch { return; }

    // Save check time
    try { writeFileSync(stateFile, String(now), "utf-8"); } catch { /* skip */ }

    if (projects.length === 0) return;

    // Find projects already being worked on
    const busyProjects = new Set<string>();
    try {
      const db = ctx.getDb();
      const wfRows = db.prepare(
        "SELECT task FROM sessions WHERE status = 'running' AND task LIKE '%persistent-task%'"
      ).all() as Array<{ task: string }>;
      for (const r of wfRows) {
        const m = r.task.match(/project:\s*([^\n"]+)/);
        if (m) busyProjects.add(m[1].trim());
      }
    } catch { /* skip */ }

    // Load the persistent-task workflow once
    let wf: WorkflowModule;
    try {
      wf = await loadPersistentTask(sharedWorkflowDir);
    } catch (err) {
      ctx.log(`[project-resume] ERROR loading persistent-task workflow: ${err}`);
      return;
    }

    let launched = 0;
    for (const project of projects) {
      if (busyProjects.has(project.relPath)) continue;

      const task = `project: ${project.relPath}\nagent: ${project.owner}\ngoal: see project file`;
      const runId = generateRunId();
      const run: WorkflowRun = {
        runId,
        workflow: "persistent-task",
        task,
        parentSessionId: `cron:project-resume`,
        depth: 1,
        startedAt: Date.now(),
        status: "running",
        steps: [],
      };
      saveWorkflowRun(ctx.persistDir, run);

      const workflowCtx: WorkflowContext = {
        task,
        agent: project.owner,

        runFunction: async (label: string, fn: () => Promise<string>) => {
          const start = Date.now();
          let output: string;
          let hadError = false;
          let errorMsg: string | undefined;
          try {
            output = await Promise.race([
              fn(),
              new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 30_000)),
            ]);
            if (output.length > 50_000) output = output.slice(0, 50_000) + "\n…(truncated)";
          } catch (err) {
            hadError = true;
            errorMsg = err instanceof Error ? err.message : String(err);
            output = `ERROR: ${errorMsg}`;
          }
          const step: WorkflowStep = {
            sessionId: `fn_${label}_${Date.now()}`,
            agent: `fn:${label}`, task: label,
            status: hadError ? "error" : "done",
            startedAt: start, endedAt: Date.now(),
            lastAssistantText: output,
          };
          run.steps.push(step);
          saveWorkflowRun(ctx.persistDir, run);
          return {
            sessionId: step.sessionId, status: step.status,
            lastAssistantText: output, messages: [],
            duration: `${((Date.now() - start) / 1000).toFixed(1)}s`,
            outputDir: "", turnsUsed: 0,
            ...(hadError && errorMsg ? { error: errorMsg } : {}),
          };
        },

        runAgent: async (agentName: string, agentTask: string) => {
          const result = await ctx.manager.callAgent(agentName, agentTask, {
            workflowRunId: runId,
            stepLabel: agentName,
            source: "workflow",
          });
          const step: WorkflowStep = {
            sessionId: result.sessionId, agent: agentName, task: agentTask,
            status: result.status as "done" | "error" | "interrupted",
            startedAt: result.messages[0]?.timestamp ?? Date.now(),
            endedAt: Date.now(),
            lastAssistantText: result.lastAssistantText,
          };
          run.steps.push(step);
          saveWorkflowRun(ctx.persistDir, run);
          return result;
        },

        runWorkflow: async () => ({ type: "escalate" as const, reason: "Sub-workflows not supported" }),
        emit: (event: WorkflowEvent) => { ctx.log(`[project-resume:${project.relPath}] ${event.type}`); },
        summarize: (result, opts?) => summarizeForHandoff(result, opts),
        done: (summary: string) => ({ type: "done" as const, summary }),
        escalate: (reason: string, context?: unknown) => ({ type: "escalate" as const, reason, context }),
      };

      // Run workflow (don't await — let them run in parallel)
      wf.execute(workflowCtx).then((result) => {
        run.endedAt = Date.now();
        run.status = result.type === "done" ? "done" : "escalated";
        run.result = result.type === "done" ? { summary: result.summary } : { reason: result.reason };
        saveWorkflowRun(ctx.persistDir, run);
        const dur = ((run.endedAt - run.startedAt) / 1000).toFixed(1);
        ctx.log(`[project-resume] ${project.relPath} → ${result.type} (${dur}s, ${run.steps.length} steps)`);
      }).catch((err) => {
        run.endedAt = Date.now();
        run.status = "error";
        run.result = { reason: err instanceof Error ? err.message : String(err) };
        saveWorkflowRun(ctx.persistDir, run);
        ctx.log(`[project-resume] ${project.relPath} ERROR: ${err}`);
      });

      launched++;
    }

    if (launched > 0) {
      ctx.log(`[project-resume] launched ${launched} workflow(s) for modified projects`);
    }
  };
};
