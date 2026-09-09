import type { SubagentManager } from "../../lib/index.js";
import type { EventBus } from "../core/events/bus.js";
import type { AppTaskRuntimeOptions } from "../app-task-runtime.js";
import { createTaskAgentRunner } from "../adapters/executors/managed-agent.js";
import { createTaskWorkflowRunner } from "../adapters/executors/workflow.js";
import { createTaskSessionRecovery } from "../adapters/executors/session-recovery.js";
import { gitTaskWorkspaces } from "../adapters/workspaces/git.js";

/** Shipped backends. The Task engine can also run without these implementations. */
export function createTaskExecutionBackends(input: {
  manager: SubagentManager;
  bus: EventBus;
  persistDir?: string;
  registerLocalAgent?: (agent: string, appDir: string, agentDir?: string) => Promise<boolean>;
  drainPersistedBashProcessGroups?: Parameters<typeof createTaskSessionRecovery>[0]["drainPersistedBashProcessGroups"];
}): Pick<AppTaskRuntimeOptions, "agents" | "workflows" | "sessions" | "workspaces"> {
  return {
    agents: createTaskAgentRunner(input),
    workflows: createTaskWorkflowRunner(input),
    sessions: createTaskSessionRecovery(input),
    workspaces: gitTaskWorkspaces,
  };
}
