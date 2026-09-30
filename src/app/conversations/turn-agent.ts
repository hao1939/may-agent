import type { TaskExecutionContext } from "../../lib/task-execution-context.js";
import {
  Type,
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
      "Save an accepted intention or authorized correction before work. Related inputs refine the same Request: include their inputIds, especially in a mixed batch. Use the same id and observed revision, or revision 0 for a new ask. Returns the saved open Request and new revision; use that revision in final requestUpdates and omit unchanged scope. Reopens a closed ask. A simple ask can be answered directly. Saved requirements and input associations survive failure or Stop. Scoped to this Conversation; does not start, cancel or close work.",
    parameters: Type.Object(
      {
        id: Type.String({ minLength: 1, maxLength: 200 }),
        expectedRevision: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER - 1 }),
        scope: Type.String({ minLength: 1, maxLength: 2000 }),
        inputIds: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1, maxItems: 96, uniqueItems: true })),
      },
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
    "A Request is the accepted intention, not a message. Combine related inputs into its latest complete requirements; keep independent intentions distinct. Address the whole accepted ask, not only the latest message.",
    "Save accepted unfinished asks or corrections with conversation_request before work, associating their inputIds. Every assignedRequests entry and every Request saved during this turn needs a final requestUpdate: explain fulfillment, concrete continuing work, or the remaining gap and real wait. Multiple Requests may be handled in one turn. Context-only input and simple direct answers need no new Request.",
    "previousAttempt.unacceptedResult is a proposal that was not applied. Reconsider it against current requirements and evidence; do not assume its closure or handoff happened and do not blindly replay effects.",
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
