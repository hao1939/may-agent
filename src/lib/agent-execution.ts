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

const CHAT_TOOL_DENYLIST = new Set(["bash", "background_exec", "cron", "edit", "finish", "write"]);
const READONLY_TOOL_ALLOWLIST = new Set(["finish", "query_db", "read"]);
const PERSISTENT_CHAT_SUFFIX =
  "This is a persistent conversation. Answer the current input and leave the conversation open for later messages.";

export type AgentPreparationOptions = Omit<SdkAgentPreparationOptions, "toolPolicy"> & {
  taskContext?: TaskExecutionContext;
  taskDecisionContext?: () => Promise<AgentMessage>;
  chatContext?: () => string;
  persistentChat?: boolean;
  toolPolicy?: ToolPolicy;
};

function hostTools(
  tools: AgentTool[],
  toolPolicy: ToolPolicy | undefined,
  persistentChat: boolean,
): AgentTool[] {
  let selected = persistentChat
    ? tools.filter((tool) => !CHAT_TOOL_DENYLIST.has(tool.name))
    : [...tools];
  if (toolPolicy === "readonly") {
    selected = selected.filter((tool) => READONLY_TOOL_ALLOWLIST.has(tool.name));
  }
  return selected;
}

export function prepareAgentExecution(options: AgentPreparationOptions): PreparedAgentExecution {
  const {
    taskContext,
    taskDecisionContext: suppliedTaskDecisionContext,
    chatContext,
    persistentChat = false,
    toolPolicy = "full",
    contextMessages: suppliedContextMessages,
    sourceRoot: suppliedSourceRoot,
    enableCompaction,
    preparerLabel,
    systemPromptSuffix,
    definition: registeredDefinition,
    createFinish,
    onPreparation,
    ...sdkOptions
  } = options;

  const taskDecisionContext =
    suppliedTaskDecisionContext ?? (taskContext ? createTaskDecisionContext(taskContext) : undefined);
  const contextMessages =
    chatContext || taskDecisionContext || suppliedContextMessages
      ? async (): Promise<AgentMessage[]> => {
          const messages: AgentMessage[] = [];
          if (chatContext) {
            messages.push({
              role: "user",
              content: [{ type: "text", text: `Current observations (source data):\n${chatContext()}` }],
              timestamp: Date.now(),
            });
          }
          if (taskDecisionContext) messages.push(await taskDecisionContext());
          // Host context retains its historical observation/Task order; generic
          // caller context follows it in a stable final segment.
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
  const filteredDefinition = {
    ...registeredDefinition,
    ...(persistentChat ? { contextPreparation: undefined } : {}),
    tools: hostTools(registeredDefinition.tools, toolPolicy, persistentChat),
  };
  const finishFactory = createFinish ?? (originalFinish ? () => originalFinish : undefined);
  let observedPreparation: PreparedAgentExecution["preparation"] | undefined;
  let prepared: PreparedAgentExecution;
  try {
    prepared = prepareSdkAgentExecution({
      ...sdkOptions,
      definition: filteredDefinition,
      toolPolicy: "full",
      sourceRoot,
      contextMessages,
      enableCompaction: persistentChat || enableCompaction,
      preparerLabel: persistentChat ? "not-applicable" : preparerLabel,
      systemPromptSuffix: [systemPromptSuffix, persistentChat ? PERSISTENT_CHAT_SUFFIX : undefined]
        .filter((value): value is string => Boolean(value))
        .join("\n\n") || undefined,
      onPreparation: persistentChat
        ? (measurement) => {
            observedPreparation = measurement;
          }
        : onPreparation,
      ...(finishFactory ? { createFinish: finishFactory } : {}),
    });
  } catch (error) {
    if (persistentChat && observedPreparation) {
      try {
        onPreparation?.({ ...observedPreparation });
      } catch {
        /* observation cannot reject work */
      }
    }
    throw error;
  }

  let finalPrepared = prepared;
  if (prepared.activatedSkill && persistentChat) {
    const reminder = `\n\nSelected skill reference: ${JSON.stringify(prepared.activatedSkill.canonicalPath)}. Read it again if its instructions were compacted.`;
    const systemPrompt = prepared.systemPrompt.replace(reminder, "");
    const preparation = { ...prepared.preparation, systemBytes: Buffer.byteLength(systemPrompt) };
    finalPrepared = {
      ...prepared,
      preparation,
      systemPrompt,
      runner: {
        ...prepared.runner,
        initialState: { ...prepared.runner.initialState, systemPrompt },
      },
    };
  }
  if (persistentChat) {
    try {
      onPreparation?.({ ...finalPrepared.preparation });
    } catch {
      /* observation cannot reject work */
    }
  }
  return finalPrepared;
}
