import {
  prepareAgentExecution as prepareSdkAgentExecution,
  type AgentPreparationOptions as SdkAgentPreparationOptions,
  type PreparedAgentExecution,
} from "@may-agent/sdk/runtime";
import { createTaskDecisionContext } from "./task-decision-context.js";
import type { TaskExecutionContext } from "./task-execution-context.js";

export * from "@may-agent/sdk/runtime";

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
