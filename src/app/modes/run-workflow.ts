import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { ModelWithApiKey } from "../../lib/types.js";
import type { SubagentManager } from "../../lib/index.js";
import type { EventBus } from "../event-bus.js";
import { buildRuntimeCtx } from "../../lib/runtime-ctx.js";

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
  projectRoot: string;
  persistDir: string;
  bus: EventBus;
  manager: SubagentManager;
  models: Record<string, ModelWithApiKey>;
  apiKey: string;
}): Promise<void> {
  const wfPath = await findWorkflowPath(opts.agentsRoot, opts.mode.name);
  if (!wfPath) {
    throw new Error(`Workflow "${opts.mode.name}" not found`);
  }

  console.log(`Loading workflow: ${wfPath}`);
  const wfMod = await import(wfPath + "?t=" + Date.now());
  const rtx = buildRuntimeCtx({
    bus: opts.bus,
    persistDir: opts.persistDir,
    projectRoot: opts.projectRoot,
    agentsRoot: opts.agentsRoot,
    agentName: "cli",
  });

  const agentMatch = opts.mode.input.match(/agent:\s*(\S+)/) || opts.mode.name.match(/^(\w+)-heartbeat$/);
  const agent = agentMatch ? agentMatch[1] : "may";

  const ctx = {
    ...rtx,
    task: opts.mode.input,
    agent,
    runAgent: opts.dryRun
      ? async (agentName: string, prompt: string) => {
          console.log(`\n${"=".repeat(60)}\nDRY RUN: ${agentName}\n${"=".repeat(60)}\n${prompt}\n${"=".repeat(60)}\n`);
          return { sessionId: "dry-run", status: "done" as const, lastAssistantText: "(dry run)", messages: [] as any[], duration: "0s", outputDir: "", turnsUsed: 0 };
        }
      : async (agentName: string, prompt: string) => {
          console.log(`Running agent: ${agentName} (${prompt.length} chars)...`);
          return opts.manager.callAgent(agentName, prompt, { source: "cli" });
        },
    runFunction: async (label: string, fn: () => Promise<string>) => {
      const output = await fn();
      return { sessionId: `fn_${label}`, status: "done" as const, lastAssistantText: output, messages: [] as any[], duration: "0s", outputDir: "", turnsUsed: 0 };
    },
    runWorkflow: async () => ({ type: "escalate" as const, reason: "Sub-workflows not supported in CLI mode" }),
    summarize: (r: any) => r?.lastAssistantText?.slice(0, 500) ?? "",
    done: (s: string) => ({ type: "done" as const, summary: s }),
    escalate: (r: string, c?: unknown) => ({ type: "escalate" as const, reason: r, context: c }),
    createSession: opts.dryRun
      ? async (sessionOpts: { systemPrompt: string; tools: "full" | "readonly"; label?: string }) => {
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
        }
      : async (sessionOpts: { systemPrompt: string; tools: "full" | "readonly"; label?: string }) => {
          const { Agent } = await import("@mariozechner/pi-agent-core");
          const { createCodingTools } = await import("../../lib/tools/coding.js");
          const { createReadTool } = await import("../../lib/tools/read.js");

          const tools = sessionOpts.tools === "readonly"
            ? [createReadTool(opts.projectRoot)]
            : createCodingTools(opts.projectRoot, { agentName: sessionOpts.label || "worker" });

          const agentInstance = new Agent({
            initialState: {
              systemPrompt: sessionOpts.systemPrompt,
              model: opts.models.opus,
              tools: tools as any[],
            },
            getApiKey: () => opts.apiKey,
          });

          agentInstance.subscribe(async (event: any) => {
            if (event.type === "tool_execution_start") {
              console.log(`  [${sessionOpts.label || "session"}] tool ${event.toolName}(${JSON.stringify(event.args).slice(0, 80)}...)`);
            }
          });

          return {
            async prompt(message: string) { await agentInstance.prompt(message); },
            lastText() {
              const msgs = agentInstance.state.messages;
              for (let i = msgs.length - 1; i >= 0; i--) {
                const m = msgs[i] as any;
                if (m.role === "assistant") {
                  return (m.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
                }
              }
              return "";
            },
            close() {},
          };
        },
  };

  console.log(`Executing workflow: ${wfMod.name} (agent: ${agent}, dry-run: ${opts.dryRun})\n`);
  const result = await wfMod.execute(ctx);
  console.log(`\nResult: ${result.type}`);
  if (result.type === "done") console.log(result.summary);
  if (result.type === "escalate") console.log("Reason:", result.reason);
}

async function findWorkflowPath(agentsRoot: string, workflowName: string): Promise<string | null> {
  const searchDirs = [
    ...readdirSync(agentsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => join(agentsRoot, d.name, "workflows")),
    join(agentsRoot, "shared", "workflows"),
  ];

  for (const dir of searchDirs) {
    try {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".ts")) continue;
        try {
          const path = join(dir, file);
          const mod = await import(path + "?t=" + Date.now());
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
