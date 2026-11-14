import type { SubagentManager } from "../../lib/index.js";
import type { SubagentDefinition } from "../../lib/types.js";
import { captureAgentDefinitions } from "../adapters/executors/agent-definitions.js";
import { createTaskAgentRunner } from "../adapters/executors/managed-agent.js";
import { createTaskSessionRecovery } from "../adapters/executors/session-recovery.js";
import { createTaskWorkflowRunner } from "../adapters/executors/workflow.js";
import { gitTaskWorkspaces } from "../adapters/workspaces/git.js";
import type { EventBus } from "../core/events/bus.js";
import type { TaskRunner } from "../core/tasks/execution.js";
import type { AppTaskRuntimeOptions } from "../core/tasks/runtime-options.js";

export function createTaskRunner(
  input: {
    manager: SubagentManager;
    bus: EventBus;
    registerLocalAgent?: (agent: string, appDir: string, agentDir?: string) => Promise<boolean>;
  },
  definitions?: ReadonlyMap<string, SubagentDefinition>,
): TaskRunner {
  const agents = createTaskAgentRunner(input, definitions);
  const workflows = createTaskWorkflowRunner(input, definitions);
  return {
    ...agents,
    inspect: workflows.inspect,
    executeWorkflow: workflows.execute,
    snapshot: () => createTaskRunner(input, captureAgentDefinitions(input.manager) ?? definitions),
  };
}

/** Shipped backends share one Task attempt and result contract. */
export function createTaskExecutionBackends(input: {
  manager: SubagentManager;
  bus: EventBus;
  persistDir?: string;
  registerLocalAgent?: (agent: string, appDir: string, agentDir?: string) => Promise<boolean>;
  drainPersistedBashProcessGroups?: Parameters<typeof createTaskSessionRecovery>[0]["drainPersistedBashProcessGroups"];
}): Pick<AppTaskRuntimeOptions, "runner" | "agents" | "workflows" | "sessions" | "workspaces"> {
  const runner = createTaskRunner(input);
  return {
    runner,
    agents: runner,
    workflows: {
      inspect: runner.inspect,
      execute: runner.executeWorkflow,
      snapshot: () => {
        const snap = runner.snapshot();
        return {
          inspect: snap.inspect,
          execute: snap.executeWorkflow,
        };
      },
    },
    sessions: createTaskSessionRecovery(input),
    workspaces: gitTaskWorkspaces,
  };
}
