import { resolve } from "node:path";
import { currentAgentSessionId } from "../../lib/agent-session-context.js";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { SubagentManager } from "../../lib/manager.js";
import type { AgentFileWriteScope } from "../../lib/tools/cross-edit-guard.js";
import { createCodingTools } from "../../lib/tools/coding.js";
import { createReadTool } from "../../lib/tools/read.js";
import { createWorkflowTool } from "../../lib/workflow-tool.js";
import { createBackgroundExecTool } from "../../lib/background-exec.js";
import { createScrapeTool } from "../../lib/scrape.js";
import { createSystemStatusTool } from "../../lib/tools/system-status.js";
import { createQueryDbTool } from "../../lib/tools/query-db.js";
import { createFinishTool } from "../../lib/tools/lifecycle.js";
import { createCheckpointTool } from "../../lib/tools/checkpoint.js";
import { createRunCliAgentTool } from "../../lib/tools/run-cli-agent.js";
import { createMessageTool } from "../../lib/tools/message-tool.js";
import { buildRuntimeCtx } from "../../lib/runtime-ctx.js";
import type { EventBus } from "../core/events/bus.js";
import type { HostMaintenance } from "../adapters/maintenance/runtime.js";
import { createMaintenanceTool } from "../adapters/maintenance/tool.js";
import type { AgentConfig } from "./agent-config.js";
import { listConfiguredAgentNames } from "./agent-discovery.js";
import { loadAgentLocalTools } from "./agent-local-tools.js";
import { createAppTaskReadTool } from "../app-task-read-tool.js";

export interface ToolsetLoaderOptions {
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  canonicalProjectsRoot?: string;
  appDirectories?: readonly string[];
  projectRoot: string;
  fileWriteScope: Readonly<AgentFileWriteScope>;
  persistDir: string;
  manager: SubagentManager;
  bus: EventBus;
  cronEnabled: boolean;
  getAgentSessionId: (agentName: string) => string | undefined;
  getAgentMaintenance: () => Map<string, HostMaintenance>;
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
  const tools: AgentTool[] = [];

  for (const preset of config.tools) {
    switch (preset) {
      case "query_db":
      case "query-db":
        tools.push(createQueryDbTool(persistDir));
        break;

      case "coding":
        tools.push(...createCodingTools(projectRoot, {
          agentName: config.name,
          ...opts.fileWriteScope,
        }));
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
        // visible. Prevents stale allowedTargets when App-local agents are
        // registered before global agents finish loading.
        const lazyAllowedTargets = () =>
          listConfiguredAgentNames(
            messageAgentsRoot,
            opts.projectsRoot,
            opts.canonicalProjectsRoot,
            opts.appDirectories,
          );
        tools.push(
          createMessageTool({
            agentName: config.name,
            agentsRoot: messageAgentsRoot,
            persistDir,
            allowedTargets: lazyAllowedTargets,
            emit: (event: { type: string; [key: string]: unknown }) => bus.emit(event as any),
            getCallerSessionId: () => opts.getAgentSessionId(config.name),
            getCallerTrace: () => {
              const sid = opts.getAgentSessionId(config.name);
              return sid ? manager.activeSessions.get(sid)?.trace : undefined;
            },
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
            callerTrace: () => {
              const sid = opts.getAgentSessionId(config.name);
              return sid ? manager.activeSessions.get(sid)?.trace : undefined;
            },
            onEvent: (event) => {
              const label = `workflow:${config.name}`;
              if (event.type === "workflow.started") {
                bus.emit({ type: "info", message: `[${label}] Starting: ${event.workflow}` });
              } else if (event.type === "workflow.completed") {
                bus.emit({ type: "info", message: `[${label}] Done: ${event.summary.slice(0, 100)}` });
              } else if (event.type === "workflow.blocked") {
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

      case "cron":
        tools.push(
          createMaintenanceTool({
            configPath: resolve(agentDir, "cron.json"),
            cronEnabled: opts.cronEnabled,
            onConfigChange: () => {
              const maintenance = opts.getAgentMaintenance().get(config.name);
              if (!maintenance) throw new Error("Host maintenance is not configured for " + config.name);
              maintenance.reload();
            },
          }),
        );
        break;

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

      case "cli-delegation": {
        tools.push(
          createRunCliAgentTool({
            agentName: config.name,
            projectRoot,
            persistDir,
            emit: (event) => bus.emit(event as any),
            getCallerSessionId: () => currentAgentSessionId(config.name),
            getCallerTrace: () => {
              const sid = currentAgentSessionId(config.name);
              return sid ? manager.activeSessions.get(sid)?.trace : undefined;
            },
          }),
        );
        break;
      }

      default:
        bus.emit({
          type: "info",
          message: `[loader] Unknown tool preset "${preset}" for agent "${config.name}" — skipping`,
        });
    }
  }

  tools.push(...(await loadLocalTools(config.name, agentDir, opts)));
  tools.push(
    createAppTaskReadTool({
      bus,
      scope: () => {
        const sessionId = opts.getAgentSessionId(config.name);
        const session = sessionId ? manager.activeSessions.get(sessionId) : undefined;
        if (session?.taskBinding) return session.taskBinding;
        if ((session?.source !== "app-task-agent" && session?.source !== "app-task-owner") || !session.projectId) {
          return undefined;
        }
        return { appId: session.projectId };
      },
    }),
  );
  return tools;
}

export async function loadLocalTools(
  agentName: string,
  agentDir: string,
  opts: Pick<ToolsetLoaderOptions, "projectRoot" | "persistDir" | "bus">,
): Promise<AgentTool[]> {
  return loadAgentLocalTools(agentName, agentDir, {
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    onNotice: (message) => opts.bus.emit({ type: "info", message: `[loader] ${message}` }),
    onLoaded: (toolName) =>
      opts.bus.emit({ type: "info", message: `[loader] Loaded local tool "${toolName}" for ${agentName}` }),
  });
}
