import type { SubagentManager } from "../../lib/index.js";
import type { SubagentDefinition } from "../../lib/types.js";
import type { EventBus } from "../core/events/bus.js";
import type { AppTaskRuntimeOptions } from "../core/tasks/app-task-runtime.js";
import { createTaskAgentRunner } from "../adapters/executors/managed-agent.js";
import { createTaskWorkflowRunner } from "../adapters/executors/workflow.js";
import { createTaskSessionRecovery } from "../adapters/executors/session-recovery.js";
import { gitTaskWorkspaces } from "../adapters/workspaces/git.js";
import { prepareConversationTaskTurn } from "./conversation-task-turn.js";
import { createConversationAgentResolver } from "../conversations/turn-agent.js";
import { createAppTaskCapability } from "../core/tasks/app-task-capability.js";
import type { TaskConversationRunner } from "../core/tasks/execution.js";
import { captureAgentDefinitions } from "../adapters/executors/agent-definitions.js";

/** Shipped backends. The Task engine can also run without these implementations. */
export function createTaskExecutionBackends(input: {
  manager: SubagentManager;
  bus: EventBus;
  persistDir?: string;
  registerLocalAgent?: (agent: string, appDir: string, agentDir?: string) => Promise<boolean>;
  drainPersistedBashProcessGroups?: Parameters<typeof createTaskSessionRecovery>[0]["drainPersistedBashProcessGroups"];
}): Pick<AppTaskRuntimeOptions, "agents" | "conversations" | "workflows" | "sessions" | "workspaces"> {
  const conversations = (definitions?: ReadonlyMap<string, SubagentDefinition>): TaskConversationRunner => ({
    execute: (turn) =>
      prepareConversationTaskTurn({
        ...turn,
        resolveConversationInput: createConversationAgentResolver({
          manager: input.manager,
          db: turn.config.resourceStore.db,
          definitions,
          registry: { snapshot: () => turn.registry },
        }),
        readDependency: async ({ appId, ...dependency }) => {
          const entry = turn.registry.entries.find(({ definition }) => definition.id === appId);
          if (!entry) return null;
          return createAppTaskCapability({ bus: input.bus }).readDependency({ appDir: entry.appDir, ...dependency });
        },
      }),
    snapshot: () => conversations(captureAgentDefinitions(input.manager) ?? definitions),
  });
  return {
    agents: createTaskAgentRunner(input),
    conversations: conversations(),
    workflows: createTaskWorkflowRunner(input),
    sessions: createTaskSessionRecovery(input),
    workspaces: gitTaskWorkspaces,
  };
}
