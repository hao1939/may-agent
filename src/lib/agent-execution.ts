import type { AgentMessage } from "@earendil-works/pi-agent-core";
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

const READONLY_TOOL_ALLOWLIST = new Set(["finish", "query_db", "read"]);

export type AgentPreparationOptions = Omit<SdkAgentPreparationOptions, "toolPolicy"> & {
  taskContext?: TaskExecutionContext;
  taskDecisionContext?: () => Promise<AgentMessage>;
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
  return prepareSdkAgentExecution({
    ...sdkOptions,
    definition: {
      ...registeredDefinition,
      tools: toolPolicy === "readonly"
        ? registeredDefinition.tools.filter((tool) => READONLY_TOOL_ALLOWLIST.has(tool.name))
        : [...registeredDefinition.tools],
    },
    toolPolicy: "full",
    sourceRoot,
    contextMessages,
    ...(finishFactory ? { createFinish: finishFactory } : {}),
  });
}
