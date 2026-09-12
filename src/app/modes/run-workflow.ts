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
  if (opts.dryRun) {
    const definition = await importRuntimeModule<{ name: string; description?: string }>(wfPath);
    console.log(`Workflow: ${definition.name}`);
    if (definition.description) console.log(definition.description);
    console.log("Dry run: definition inspected; workflow, tools and agents were not executed.");
    console.log("Task-owned workflows run through their App input, with normal Task admission.");
    return;
  }

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
