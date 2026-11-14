import type { AgentTool } from "@earendil-works/pi-agent-core";
import { resolve } from "node:path";
import { currentAgentSessionId } from "../../lib/agent-session-context.js";
import type { SubagentManager } from "../../lib/manager.js";
import { buildRuntimeCtx } from "../../lib/runtime-ctx.js";
import { assertUniqueToolNames } from "../../lib/tool-name-audit.js";
import { createCodingTools } from "../../lib/tools/coding.js";
import type { FileWritePolicy } from "../../lib/tools/file-write-policy.js";
import { createFinishTool } from "../../lib/tools/lifecycle.js";
import { createQueryDbTool } from "../../lib/tools/query-db.js";
import { createReadTool } from "../../lib/tools/read.js";
import { createRunCliAgentTool } from "../../lib/tools/run-cli-agent.js";
import type { WorkflowEvent } from "../../lib/workflow.js";
import { readMetricView } from "../adapters/reporting/metric-read.js";
import { createAppTaskReadTool } from "../app-task-read-tool.js";
import type { AppRegistry } from "../core/apps/registry.js";
import type { EventBus } from "../core/events/bus.js";
import { createRuntimeAppRead } from "../core/reads/app-read.js";
import { getLoadedAppInputContract } from "../core/tasks/app-task-runtime.js";
import type { AgentConfig } from "./agent-config.js";
import { loadAgentLocalTools } from "./agent-local-tools.js";

export interface ToolsetLoaderOptions {
  appRegistry?: AppRegistry;
  fileWritePolicy?: FileWritePolicy;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  canonicalProjectsRoot?: string;
  appDirectories?: readonly string[];
  projectRoot: string;
  persistDir: string;
  manager: SubagentManager;
  bus: EventBus;
  getAgentSessionId: (agentName: string) => string | undefined;
  agentDir?: string;
}

export async function buildTools(config: AgentConfig, opts: ToolsetLoaderOptions): Promise<AgentTool[]> {
  const { projectRoot, persistDir, manager, bus } = opts;
  const agentDir = opts.agentDir ?? resolve(opts.agentsRoot, config.name);
  const tools: AgentTool[] = [];
  const sources: string[] = [];

  for (const preset of config.tools) {
    const start = tools.length;
    switch (preset) {
      case "query_db":
        tools.push(createQueryDbTool(persistDir));
        break;

      case "coding":
        tools.push(...createCodingTools(projectRoot, { agentName: config.name, fileWritePolicy: opts.fileWritePolicy }));
        break;

      case "read-only": {
        tools.push(createReadTool(projectRoot) as any);
        break;
      }

      case "agents": {
        if (tools.some((t) => t.name === "agents")) {
          break;
        }
        const denyConfig = config.delegateDeny;
        const runtimeCtx = buildRuntimeCtx({
          bus,
          persistDir,
          projectRoot,
          agentsRoot: opts.agentsRoot,
          sharedRoot: opts.sharedRoot,
          projectsRoot: opts.projectsRoot,
          agentName: config.name,
        });
        tools.push(
          manager.createAgentsTool({
            getCallerSessionId: () => currentAgentSessionId(config.name),
            getCallerAgentName: () => config.name,
            callDeny: denyConfig ? { agents: denyConfig.agents, hint: denyConfig.hint } : undefined,
            runtimeCtx,
            createRead: (context) =>
              createRuntimeAppRead({
                readContract: async (appId) => getLoadedAppInputContract({ bus, appId }),
                getDb: runtimeCtx.getDb,
                taskRead: context?.taskRead,
                readMetric: async (id) => readMetricView(runtimeCtx.metrics, id),
              }),
            onWorkflowEvent: (event: WorkflowEvent) => {
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

      case "finish": {
        tools.push(
          createFinishTool({
            projectRoot,
          }),
        );
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
    while (sources.length < tools.length) sources.push(`preset "${preset}"`);
    if (tools.length < start) throw new Error("Tool construction removed an earlier tool");
  }

  const localTools = await loadLocalTools(config.name, agentDir, opts);
  tools.push(...localTools);
  sources.push(...localTools.map(() => `agent-local tools for "${config.name}"`));
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
      communicationReader: () => {
        const sessionId = opts.getAgentSessionId(config.name);
        return sessionId ? manager.activeSessions.get(sessionId)?.taskContext?.readCommunication : undefined;
      },
      workloadReader: () => {
        const sessionId = opts.getAgentSessionId(config.name);
        const read = sessionId ? manager.activeSessions.get(sessionId)?.taskContext?.taskRead : undefined;
        return read?.workload;
      },
      createdReader: () => {
        const sessionId = opts.getAgentSessionId(config.name);
        return sessionId ? manager.activeSessions.get(sessionId)?.taskContext?.taskRead?.created : undefined;
      },
      applier: () => {
        const sessionId = opts.getAgentSessionId(config.name);
        const session = sessionId ? manager.activeSessions.get(sessionId) : undefined;
        if (session?.taskBinding && !session.taskContext)
          throw new Error("Current Task execution context is unavailable");
        return session?.taskContext?.applyTaskChanges;
      },
    }),
  );
  sources.push('built-in "tasks"');
  assertUniqueToolNames(tools.map((tool, index) => ({ tool, source: sources[index]! })), config.name);
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
