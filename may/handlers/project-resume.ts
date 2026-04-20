/**
 * project-resume — Scan modified projects, run persistent-task workflow directly.
 * Simple: if project.md changed since last check and no workflow is in-flight, launch one.
 * The workflow handles all logic (status checks, comments, evaluation).
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

const OWNER_RE = /^\*\*Owner\*\*:\s*(\S+)/mi;
const STATE_FILE = ".state/project-resume-last-check";
const INFLIGHT_FILE = ".state/project-resume-inflight";

let importCounter = 0;

function generateRunId(): string {
  return `wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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
  const workflowPath = join(agentsRoot, "shared", "workflows", "persistent-task.ts");

  return async () => {
    let lastCheck = 0;
    try {
      lastCheck = parseInt(readFileSync(stateFile, "utf-8").trim(), 10) || 0;
    } catch { /* first run */ }

    const now = Date.now();
    const inflight = readInflight(inflightFile);
    const projects: Array<{ owner: string; relPath: string }> = [];

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
            const mtime = statSync(projectFile).mtimeMs;
            if (mtime <= lastCheck) continue;
            if (inflight.has(relPath)) continue; // Already in-flight
            const content = readFileSync(projectFile, "utf-8");
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
      ctx.log(`[project-resume] ERROR loading workflow: ${err}`);
      return;
    }

    let launched = 0;
    for (const project of projects) {
      const task = `project: ${project.relPath}\nagent: ${project.owner}\ngoal: see project file`;

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
          return ctx.manager.callAgent(agentName, agentTask, { source: "workflow" });
        },
        runWorkflow: async () => ({ type: "escalate" as const, reason: "Sub-workflows not supported" }),
        emit: (event: any) => ctx.log(`[project-resume:${project.relPath}] ${event.type ?? event}`),
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

      wfMod.execute(workflowCtx).then((result: any) => {
        ctx.log(`[project-resume] ${project.relPath} → ${result.type}`);
      }).catch((err: any) => {
        ctx.log(`[project-resume] ${project.relPath} ERROR: ${err}`);
      }).finally(() => {
        // Remove from in-flight when done
        inflight.delete(project.relPath);
        writeInflight(inflightFile, inflight);
      });

      launched++;
    }

    if (launched > 0) ctx.log(`[project-resume] launched ${launched} workflow(s)`);
  };
};
