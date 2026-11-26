import type { AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import { resolve } from "node:path";
import {
  prepareAgentExecution as prepareSdkAgentExecution,
  type AgentPreparationOptions as SdkAgentPreparationOptions,
  type PreparedAgentExecution,
} from "@may-agent/sdk/runtime";
import { createTaskDecisionContext } from "./task-decision-context.js";
import type { TaskExecutionContext } from "./task-execution-context.js";

export * from "@may-agent/sdk/runtime";

/** Host capability profile persisted with a session so recovery cannot broaden its tools. */
export type ToolPolicy = "full" | "readonly";

export type AgentPreparationOptions = Omit<SdkAgentPreparationOptions, "toolPolicy"> & {
  taskContext?: TaskExecutionContext;
  taskDecisionContext?: () => Promise<AgentMessage>;
  /** Trusted bindings for this invocation; replace matching names, then apply policy. */
  toolBindings?: readonly AgentTool[];
  toolPolicy?: ToolPolicy;
};

export function prepareAgentExecution(options: AgentPreparationOptions): PreparedAgentExecution {
  const {
    taskContext,
    taskDecisionContext: suppliedTaskDecisionContext,
    toolPolicy = "full",
    contextMessages: suppliedContextMessages,
    sourceRoot: suppliedSourceRoot,
    definition: registeredDefinition,
    createFinish,
    toolBindings = [],
    ...sdkOptions
  } = options;

  const taskDecisionContext =
    suppliedTaskDecisionContext ?? (taskContext ? createTaskDecisionContext(taskContext) : undefined);
  const contextMessages =
    taskDecisionContext || suppliedContextMessages
      ? async (): Promise<AgentMessage[]> => {
          const messages: AgentMessage[] = [];
          if (taskDecisionContext) messages.push(await taskDecisionContext());
          if (suppliedContextMessages) messages.push(...(await suppliedContextMessages()));
          return messages;
        }
      : undefined;

  let sourceRoot = suppliedSourceRoot;
  const paths = taskContext?.executionPaths;
  if (
    options.executionRoot &&
    paths &&
    typeof paths.workspaceDir === "string" &&
    typeof paths.appDir === "string" &&
    typeof paths.projectDir === "string" &&
    resolve(paths.workspaceDir) === resolve(options.executionRoot)
  ) {
    sourceRoot = resolve(paths.appDir) === resolve(options.executionRoot) ? null : paths.projectDir;
  }

  const originalFinish = registeredDefinition.tools.find((tool) => tool.name === "finish");
  const finishFactory = createFinish ?? (originalFinish ? () => originalFinish : undefined);
  const boundNames = new Set(toolBindings.map(tool => tool.name));
  return prepareSdkAgentExecution({
    ...sdkOptions,
    definition: {
      ...registeredDefinition,
      tools: [...registeredDefinition.tools.filter(tool => !boundNames.has(tool.name)), ...toolBindings],
    },
    toolPolicy,
    sourceRoot,
    contextMessages,
    ...(finishFactory ? { createFinish: finishFactory } : {}),
  });
}
