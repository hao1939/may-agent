import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  SubagentManager,
  createCodingTools,
  createReadTool,
  createWorkflowTool,
  createBackgroundExecTool,
  createCronTool,
  createScrapeTool,
  createSystemStatusTool,
  createQueryDbTool,
  createFinishTool,
  createCheckpointTool,
} from "../../lib/index.js";
import { createMessageTool } from "../../lib/tools/message-tool.js";
import { buildRuntimeCtx } from "../../lib/runtime-ctx.js";
import { importRuntimeModule } from "../../lib/runtime-import.js";
import type { EventBus } from "../event-bus.js";
import { Cron } from "../cron.js";
import type { AgentConfig } from "./agent-config.js";
import { listConfiguredAgentNames } from "./agent-discovery.js";

export interface ToolsetLoaderOptions {
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  projectRoot: string;
  persistDir: string;
  manager: SubagentManager;
  bus: EventBus;
  cronEnabled: boolean;
  getAgentSessionId: (agentName: string) => string | undefined;
  getAgentCrons: () => Map<string, Cron>;
  setAgentCron: (agentName: string, cron: Cron) => void;
  addCleanup: (agentName: string, fn: () => void) => void;
  agentDir?: string;
  /**
   * The top-level agents/ directory, used by the message tool to discover
   * all system agents for allowedTargets. When a project-scoped agent is
   * loaded, `agentsRoot` points to the project-local agents/ dir, so the
   * message tool would only see project-local agents. This field ensures
   * the message tool always resolves all configured agent names system-wide.
   */
  globalAgentsRoot?: string;
}

export async function buildTools(config: AgentConfig, opts: ToolsetLoaderOptions): Promise<AgentTool[]> {
  const { projectRoot, persistDir, manager, bus } = opts;
  const agentDir = opts.agentDir ?? resolve(opts.agentsRoot, config.name);
  const tools: AgentTool[] = [createQueryDbTool(persistDir)];

  const triggerHeartbeat = (agentName: string): boolean => {
    for (const cron of opts.getAgentCrons().values()) {
      if (cron.triggerNow(`heartbeat-${agentName}`)) return true;
      if (cron.triggerNow("heartbeat") && agentName === "may") return true;
    }
    return false;
  };

  for (const preset of config.tools) {
    switch (preset) {
      case "query_db":
      case "query-db":
        break;

      case "coding":
        tools.push(...createCodingTools(projectRoot, { agentName: config.name }));
        break;

      case "read-only": {
        tools.push(createReadTool(projectRoot) as any);
        break;
      }

      case "agents": {
        const denyConfig = config.delegateDeny;
        tools.push(
          manager.createAgentsTool({
            getCallerSessionId: () => opts.getAgentSessionId(config.name),
            getCallerAgentName: () => config.name,
            callDeny: denyConfig ? { agents: denyConfig.agents, hint: denyConfig.hint } : undefined,
            agentsRoot: opts.agentsRoot,
            triggerHeartbeat,
            bus: opts.bus,
          }),
        );
        break;
      }

      case "message": {
        // Use globalAgentsRoot (top-level agents/) when available so
        // project-scoped agents can message system agents like "may".
        const messageAgentsRoot = opts.globalAgentsRoot ?? opts.agentsRoot;
        // Lazy evaluation: agents loaded after this tool is created are still
        // visible. Prevents stale allowedTargets when project-app agents are
        // registered before global agents finish loading.
        const lazyAllowedTargets = () => listConfiguredAgentNames(messageAgentsRoot, opts.projectsRoot);
        tools.push(
          createMessageTool({
            agentName: config.name,
            agentsRoot: messageAgentsRoot,
            persistDir,
            allowedTargets: lazyAllowedTargets,
            emit: (event) => bus.emit(event as any),
            getCallerSessionId: () => opts.getAgentSessionId(config.name),
            triggerHeartbeat,
          }),
        );
        break;
      }

      case "workflow": {
        const workflowDir = resolve(agentDir, "workflows");
        tools.push(
          createWorkflowTool({
            manager,
            workflowDir,
            persistDir,
            agentName: config.name,
            runtimeCtx: buildRuntimeCtx({
              bus,
              persistDir,
              projectRoot,
              agentsRoot: opts.agentsRoot,
              sharedRoot: opts.sharedRoot,
              projectsRoot: opts.projectsRoot,
              agentName: config.name,
            }),
            callerSessionId: () => {
              const sid = opts.getAgentSessionId(config.name);
              if (!sid) throw new Error(`No active ${config.name} session`);
              return sid;
            },
            onEvent: (event) => {
              const label = `workflow:${config.name}`;
              if (event.type === "workflow.started") {
                bus.emit({ type: "info", message: `[${label}] Starting: ${event.workflow}` });
              } else if (event.type === "workflow.completed") {
                bus.emit({ type: "info", message: `[${label}] Done: ${event.summary.slice(0, 100)}` });
              } else if (event.type === "workflow.blocked" || event.type === "workflow.escalated") {
                bus.emit({ type: "info", message: `[${label}] Blocked: ${event.reason}` });
              } else if (event.type === "workflow.step_started") {
                bus.emit({ type: "info", message: `[${label}] Step: ${event.step}` });
              }
            },
          }),
        );
        break;
      }

      case "background-exec": {
        const bgExec = createBackgroundExecTool({
          cwd: projectRoot,
          denyMessage: "Do not explore outside the project root. Use relative paths.",
          allowAgentSpawn: true,
        });
        tools.push(bgExec.tool);
        opts.addCleanup(config.name, bgExec.cleanup);
        break;
      }

      case "cron": {
        const cronPath = resolve(agentDir, "cron.json");
        let cron = opts.getAgentCrons().get(config.name);
        if (!cron) {
          cron = new Cron(
            cronPath,
            manager,
            () => {
              const sid = opts.getAgentSessionId(config.name);
              if (!sid) throw new Error(`No active ${config.name} session`);
              return sid;
            },
            (msg) => bus.emit({ type: "info", message: `[cron:${config.name}] ${msg}` }),
            opts.projectRoot,
            (msg) => {
              bus.emit({
                type: "message.created",
                source: `agent:${config.name}`,
                owner: "human:operator",
                data: { from: config.name, to: "human", content: msg, priority: "P2" },
              } as any);
            },
            (event) => bus.emit(event),
          );
          cron.load();
          opts.setAgentCron(config.name, cron);
        }
        tools.push(
          createCronTool({
            configPath: cronPath,
            agentName: config.name,
            onConfigChange: () => cron!.reload(),
            cronEnabled: opts.cronEnabled,
          }),
        );
        break;
      }

      case "scrape":
        tools.push(createScrapeTool());
        break;

      case "system-status":
      case "system_status": {
        tools.push(createSystemStatusTool(opts.persistDir, opts.agentsRoot, opts.sharedRoot));
        break;
      }

      case "finish": {
        tools.push(
          createFinishTool({
            agentName: config.name,
            projectRoot,
            persistDir,
          }),
        );
        break;
      }

      case "checkpoint": {
        let currentSessionId = "unknown";
        let currentAgentName = "unknown";
        tools.push(
          createCheckpointTool({
            sessionId: () => currentSessionId,
            agentName: () => currentAgentName,
            persistDir,
          }),
        );
        const cpTool = tools[tools.length - 1] as any;
        cpTool._setSessionId = (id: string) => {
          currentSessionId = id;
        };
        cpTool._setAgentName = (name: string) => {
          currentAgentName = name;
        };
        break;
      }

      default:
        bus.emit({
          type: "info",
          message: `[loader] Unknown tool preset "${preset}" for agent "${config.name}" — skipping`,
        });
    }
  }

  tools.push(...await loadLocalTools(config.name, agentDir, opts));
  return tools;
}

export async function loadLocalTools(
  agentName: string,
  agentDir: string,
  opts: Pick<ToolsetLoaderOptions, "projectRoot" | "persistDir" | "bus">,
): Promise<AgentTool[]> {
  const toolsDir = resolve(agentDir, "tools");
  if (!existsSync(toolsDir)) return [];

  const tools: AgentTool[] = [];
  const entries = readdirSync(toolsDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

  for (const file of entries) {
    const filePath = resolve(toolsDir, file);
    try {
      const mod = await importRuntimeModule<{ default?: unknown }>(filePath);
      const factory = mod.default;
      if (typeof factory !== "function") {
        opts.bus.emit({
          type: "info",
          message: `[loader] Skipping ${agentName}/tools/${file} — no default export function`,
        });
        continue;
      }
      const tool = await factory({
        projectRoot: opts.projectRoot,
        agentRoot: agentDir,
        persistDir: opts.persistDir,
      });
      if (tool && typeof tool.name === "string") {
        tools.push(tool);
        opts.bus.emit({
          type: "info",
          message: `[loader] Loaded local tool "${tool.name}" for ${agentName}`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      opts.bus.emit({
        type: "info",
        message: `[loader] ⚠️ Failed to load ${agentName}/tools/${file}: ${msg}`,
      });
    }
  }

  return tools;
}
