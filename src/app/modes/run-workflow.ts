import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SubagentManager } from "../../lib/index.js";
import type { EventBus } from "../core/events/bus.js";
import { buildRuntimeCtx } from "../../lib/runtime-ctx.js";
import { importRuntimeModule } from "../../lib/runtime-import.js";
import { runWorkflowDirect } from "../../lib/workflow-tool.js";

export interface RunWorkflowMode {
  name: string;
  input: string;
}

export function parseRunWorkflowMode(argv: string[]): RunWorkflowMode | null {
  const idx = argv.indexOf("--run-workflow");
  if (idx === -1 || !argv[idx + 1]) return null;
  return { name: argv[idx + 1], input: argv[idx + 2] || "" };
}

export async function runWorkflowMode(opts: {
  mode: RunWorkflowMode;
  dryRun: boolean;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  projectRoot: string;
  persistDir: string;
  bus: EventBus;
  manager: SubagentManager;
}): Promise<void> {
  const wfPath = await findWorkflowPath(opts.agentsRoot, opts.mode.name);
  if (!wfPath) {
    throw new Error(`Workflow "${opts.mode.name}" not found`);
  }

  console.log(`Loading workflow: ${wfPath}`);
  const rtx = buildRuntimeCtx({
    bus: opts.bus,
    persistDir: opts.persistDir,
    projectRoot: opts.projectRoot,
    agentsRoot: opts.agentsRoot,
    sharedRoot: opts.sharedRoot,
    projectsRoot: opts.projectsRoot,
    agentName: "cli",
  });

  const agentMatch = opts.mode.input.match(/agent:\s*(\S+)/) || opts.mode.name.match(/^(\w+)-heartbeat$/);
  const agent = agentMatch ? agentMatch[1] : "may";

  if (!opts.dryRun) {
    const workflowDir = dirname(wfPath);
    const agentDir = dirname(workflowDir);
    console.log(`Executing workflow: ${opts.mode.name} (agent: ${agent})\n`);
    const { result, runId } = await runWorkflowDirect({
      workflowName: opts.mode.name,
      task: opts.mode.input,
      manager: opts.manager,
      runtimeCtx: rtx,
      agentName: agent,
      persistDir: opts.persistDir,
      workflowDir,
      guardsDir: join(agentDir, "guards"),
      sharedGuardsDir: join(opts.sharedRoot, "guards"),
    });
    console.log(`Run: ${runId}`);
    console.log(`Result: ${result.type}`);
    if (result.type === "done") console.log(result.summary);
    if (result.type === "blocked") console.log("Reason:", result.reason);
    return;
  }

  const wfMod = await importRuntimeModule<any>(wfPath);

  const ctx = {
    ...rtx,
    task: opts.mode.input,
    agent,
    runAgent: async (agentName: string, prompt: string, stepOpts?: { schema?: unknown; skill?: string }) => {
      console.log(`\n${"=".repeat(60)}\nDRY RUN: ${agentName}\n${"=".repeat(60)}\n${prompt}\n${"=".repeat(60)}\n`);
      if (stepOpts?.skill) console.log(`Skill: ${stepOpts.skill}`);
      if (stepOpts?.schema) console.log(`Output schema: ${JSON.stringify(stepOpts.schema, null, 2)}`);
      return {
        sessionId: "dry-run",
        status: "error" as const,
        lastAssistantText: null,
        messages: [] as any[],
        duration: "0s",
        outputDir: "",
        turnsUsed: 0,
        error: "Dry run does not execute an agent or fabricate a structured finish result",
      };
    },
    runFunction: async (label: string, fn: () => Promise<string>) => {
      const output = await fn();
      return { sessionId: `fn_${label}`, status: "done" as const, lastAssistantText: output, messages: [] as any[], duration: "0s", outputDir: "", turnsUsed: 0 };
    },
    runWorkflow: async () => ({ type: "blocked" as const, reason: "Sub-workflows not supported in CLI mode" }),
    summarize: (r: any) => r?.lastAssistantText?.slice(0, 500) ?? "",
    done: (s: string) => ({ type: "done" as const, summary: s }),
    blocked: (r: string, c?: unknown) => ({ type: "blocked" as const, reason: r, context: c }),
    createSession: async (sessionOpts: { systemPrompt: string; tools: "full" | "readonly"; label?: string }) => {
      console.log(`\n${"=".repeat(60)}\nDRY RUN createSession: ${sessionOpts.label || "session"} (tools: ${sessionOpts.tools})\n${"=".repeat(60)}\nSystem prompt: ${sessionOpts.systemPrompt.slice(0, 200)}...\n`);
      let lastPrompt = "";
      return {
        async prompt(message: string) {
          console.log(`  [${sessionOpts.label || "session"}] prompt (${message.length} chars):\n${message.slice(0, 300)}...\n`);
          lastPrompt = message;
        },
        lastText() {
          return `(dry run response to: ${lastPrompt.slice(0, 80)}...)`;
        },
        close() {},
      };
    },
  };

  console.log(`Executing workflow: ${wfMod.name} (agent: ${agent}, dry-run: ${opts.dryRun})\n`);
  const result = await wfMod.execute(ctx);
  console.log(`\nResult: ${result.type}`);
  if (result.type === "done") console.log(result.summary);
  if (result.type === "blocked") console.log("Reason:", result.reason);
}

async function findWorkflowPath(agentsRoot: string, workflowName: string): Promise<string | null> {
  const searchDirs = readdirSync(agentsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "shared")
    .map((d) => join(agentsRoot, d.name, "workflows"));

  for (const dir of searchDirs) {
    try {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
        try {
          const path = join(dir, file);
          const mod = await importRuntimeModule<any>(path);
          if (mod.name === workflowName) return path;
        } catch {
          /* skip */
        }
      }
    } catch {
      /* dir does not exist */
    }
  }

  return null;
}
