import {
  prepareAgentExecution as prepareSdkAgentExecution,
  type AgentPreparationOptions as SdkAgentPreparationOptions,
  type PreparedAgentExecution,
} from "../../packages/sdk/src/runtime/lib/agent-execution.js";
import { createTaskDecisionContext } from "./task-decision-context.js";
import type { TaskExecutionContext } from "./task-execution-context.js";

export * from "../../packages/sdk/src/runtime/lib/agent-execution.js";

export type AgentPreparationOptions = Omit<SdkAgentPreparationOptions, "taskContext"> & {
  taskContext?: TaskExecutionContext;
};

export function prepareAgentExecution(options: AgentPreparationOptions): PreparedAgentExecution {
  return prepareSdkAgentExecution({
    ...options,
    ...(options.taskContext && !options.taskDecisionContext
      ? { taskDecisionContext: createTaskDecisionContext(options.taskContext) }
      : {}),
  });
}
