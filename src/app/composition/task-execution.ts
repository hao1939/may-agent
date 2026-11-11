import type { SubagentManager } from "../../lib/index.js";
import { createTaskAgentRunner } from "../adapters/executors/managed-agent.js";
import { createTaskSessionRecovery } from "../adapters/executors/session-recovery.js";
import { createTaskWorkflowRunner } from "../adapters/executors/workflow.js";
import { gitTaskWorkspaces } from "../adapters/workspaces/git.js";
import type { EventBus } from "../core/events/bus.js";
import type { AppTaskRuntimeOptions } from "../core/tasks/runtime-options.js";

/** Shipped backends share one Task attempt and result contract. */
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
