import type { TaskExecutionContext } from "../../lib/task-execution-context.js";
import {
  Type,
  conversationRequestUpdatesSchema,
  type ConversationTurnResult,
  type AppDefinition,
  type AppInputContext,
} from "@may-agent/sdk";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type { SubagentManager } from "../../lib/index.js";
import type { SubagentDefinition } from "../../lib/types.js";
import type { AppRegistry } from "../core/apps/registry.js";
import { appDependencyCatalog } from "../app-dependency-catalog.js";
import type { ConversationRequestChange } from "../core/state/conversation-requests.js";
import { APP_TASK_RECOVERY_OWNER } from "../core/tasks/session-binding.js";

import type { AppInputResolver } from "../core/tasks/execution.js";
import type { ConversationContextQuery } from "../core/state/conversations.js";

const APP_REQUEST_AGENT_TIMEOUT_MS = 10 * 60_000;

function conversationRequestTool(execution: Parameters<AppInputResolver>[0]["execution"]): AgentTool | null {
  const update = execution.updateRequest;
  if (!update) return null;
  return {
    name: "conversation_request",
    label: "Update Request",
    description:
      "Save an accepted conversational promise to the human, or associate an input advancing that same promise. Routine automated review is recorded in turn/Task evidence; use a Request when an outcome is owed to the human. Use the existing id and observed revision; omit unchanged scope. A new Request needs revision 0 and its complete scope. Include inputIds in a mixed batch. Returns the saved open Request and new revision for final requestUpdates. Reopens a closed Request. Requirements and associations survive failure or Stop; closing a Request requires an explanatory response. Scoped to this Conversation; does not start, cancel or close work.",
    parameters: Type.Pick(
      conversationRequestUpdatesSchema.items,
      ["id", "expectedRevision", "scope", "inputIds"],
      { additionalProperties: false },
    ),
    execute: async (operationId, raw) => {
      execution.signal.throwIfAborted();
      const saved = update(raw as ConversationRequestChange, operationId);
      return { content: [{ type: "text", text: JSON.stringify(saved) }], details: undefined };
    },
  };
}

function conversationContextTool(execution: Parameters<AppInputResolver>[0]["execution"]): AgentTool {
  const result = (value: unknown): AgentToolResult<unknown> => ({
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    details: undefined,
  });
  return {
    name: "conversation_context",
    label: "Conversation Context",
    description:
      "Find historical Topics, list open accepted Requests (requests, paged by afterId), or read one exact Topic (read) or Request (request). Read the full Request scope before updating it. All reads are scoped to this Conversation; this tool never selects or changes work.",
    parameters: Type.Union([
      Type.Object(
        { action: Type.Literal("request"), id: Type.String({ minLength: 1 }) },
        { additionalProperties: false },
      ),
      Type.Object(
        { action: Type.Literal("requests"), afterId: Type.Optional(Type.String()) },
        { additionalProperties: false },
      ),
      Type.Object(
        {
          action: Type.Literal("find"),
          query: Type.String({ minLength: 1, maxLength: 200 }),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })),
        },
        { additionalProperties: false },
      ),
      Type.Object(
        { action: Type.Literal("read"), topicId: Type.String({ minLength: 1 }) },
        { additionalProperties: false },
      ),
    ]),
    execute: async (_toolCallId, raw) => {
      execution.signal.throwIfAborted();
      return result(execution.readContext(raw as ConversationContextQuery));
    },
  };
}

function conversationInputPrompt(
  app: Readonly<AppDefinition>,
  inputContext: Readonly<AppInputContext>,
  registry: Pick<AppRegistry, "snapshot">,
): string {
  const apps = appDependencyCatalog(registry.snapshot().entries, app.id);
  const { id, source, input, inputs, ...context } = inputContext;
  return [
    `Consider the admitted inputs for App ${app.id} together, in order, using its Conversation result contract.`,
    "The inputs are the whole current batch. replyTo identifies the response destination; every input still needs consideration.",
    "A Request is an accepted conversational promise to the human. The App recognizes these promises and judges scope and fulfillment. Routine automated handling belongs in turn/Task evidence; an automated result can also advance an existing human promise. Several inputs can belong to one Request; several Requests can share this turn.",
    "Use conversation_request before working on an accepted Request to preserve its requirements and current input associations, even when scope is unchanged. assignedRequests contains full current requirements for this turn. Every assigned Request and every Request saved during the turn needs a final requestUpdates entry with its own reason. An open disposition must explain what remains; a reply about another Request does not supply that explanation.",
    "previousAttempt.unacceptedResult is a proposal that was not applied. Reconsider it against current requirements and evidence; do not assume its closure or handoff happened and do not blindly replay effects.",
    "Context is layered: current inputs and assigned Requests first; focusedTask provides a compact current summary. referencedTasks and Topic/message taskRefs are navigation links, not expanded evidence. Use tasks get with the exact appId/taskId for relevant requirements, waits and evidence before judging fulfillment or changing work; conversation_context reads older discussion and Requests.",
    "## Input and context",
    "```json",
    JSON.stringify({ inputs: inputs ?? [{ id, source, input }], replyTo: { id, source }, ...context }, null, 2),
    "```",
    "",
    "## Installed Apps",
    "```json",
    JSON.stringify(apps, null, 2),
    "```",
  ].join("\n");
}

export function createConversationAgentResolver(options: {
  manager: SubagentManager;
  registry: Pick<AppRegistry, "snapshot">;
  definitions?: ReadonlyMap<string, SubagentDefinition>;
  taskContext?: TaskExecutionContext;
}): AppInputResolver {
  return async ({ app, inputContext, execution: binding }) => {
    const agent = (app.agent ?? app.owner ?? "").trim().replace(/^agent:/, "");
    if (!agent) throw new Error(`App ${app.id} has no conversational agent`);
    const registered = options.definitions ? options.definitions.get(agent) : options.manager.getAgentDefinition(agent);
    if (!registered) throw new Error(`Agent ${agent} is not registered`);
    const contextTool = conversationContextTool(binding);
    const requestTool = conversationRequestTool(binding);
    const tools = [contextTool, requestTool].filter((tool): tool is AgentTool => tool !== null);
    const definition = { ...registered, tools: [...registered.tools, ...tools] };
    const execution = await options.manager.callAgentDefinition(
      definition,
      conversationInputPrompt(app, inputContext, options.registry),
      {
        source: "app-conversation-agent",
        projectId: app.id,
        recoveryOwner: APP_TASK_RECOVERY_OWNER,
        taskBinding: binding.taskBinding,
        taskContext: options.taskContext,
        requireFinish: true,
        outputSchema: binding.outputSchema,
        // Reuse bounded App execution, without detached lifecycle tools.
        toolPolicy: "app-agent-full",
        timeout: APP_REQUEST_AGENT_TIMEOUT_MS,
        signal: binding.signal,
        sessionStarted: binding.sessionStarted,
      },
    );
    if (execution.status !== "done" || !execution.structuredResult) {
      throw new Error(
        execution.error || execution.lastAssistantText || `Agent ${agent} did not return a Conversation decision`,
      );
    }
    return execution.structuredResult as ConversationTurnResult;
  };
}
