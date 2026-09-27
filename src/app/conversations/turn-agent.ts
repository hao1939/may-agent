import type { TaskExecutionContext } from "../../lib/task-execution-context.js";
import {
  Type,
  type TSchema,
  type ConversationTurnResult,
  type AppDefinition,
  type AppInputContext,
  type AppConversationRequest,
} from "@may-agent/sdk";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type { SubagentManager } from "../../lib/index.js";
import type { SubagentDefinition } from "../../lib/types.js";
import type { SqliteDb } from "../../lib/db.js";
import type { AppRegistry } from "../core/apps/registry.js";
import { appDependencyCatalog } from "../app-dependency-catalog.js";
import {
  findConversationTopics,
  readAppConversationResource,
  readConversationTopic,
} from "../core/state/conversations.js";
import {
  pageOpenConversationRequests,
  readConversationRequest,
  type ConversationRequestChange,
} from "../core/state/conversation-requests.js";
import { APP_TASK_RECOVERY_OWNER } from "../core/tasks/session-binding.js";

import type { TaskBinding } from "../../lib/persistence.js";

export type AppInputResolver = (input: {
  app: Readonly<AppDefinition>;
  inputContext: Readonly<AppInputContext>;
  execution: {
    outputSchema: TSchema;
    signal: AbortSignal;
    sessionStarted: (sessionId: string) => void;
    taskBinding: TaskBinding;
    updateRequest?: (change: ConversationRequestChange, operationId: string) => AppConversationRequest;
  };
}) => Promise<ConversationTurnResult>;

const APP_REQUEST_AGENT_TIMEOUT_MS = 10 * 60_000;

function conversationRequestTool(execution: Parameters<AppInputResolver>[0]["execution"]): AgentTool | null {
  const update = execution.updateRequest;
  if (!update) return null;
  return {
    name: "conversation_request",
    label: "Update Request",
    description:
      "Save an accepted ask or authorized correction before work. Use the same id and observed revision, or revision 0 for a new ask. Returns the saved open Request and new revision; use that revision in final requestUpdates and omit unchanged scope. Reopens a closed ask. Skip when saved requirements already fit or a simple ask can be answered directly. Saved corrections survive failure or Stop. Scoped to this Conversation; does not start, cancel or close work.",
    parameters: Type.Object(
      {
        id: Type.String({ minLength: 1, maxLength: 200 }),
        expectedRevision: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER - 1 }),
        scope: Type.String({ minLength: 1, maxLength: 2000 }),
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

function conversationContextTool(db: SqliteDb, inputContext: Readonly<AppInputContext>): AgentTool | null {
  const conversation = inputContext.conversation;
  if (!conversation) return null;
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
      const input = raw as
        | { action: "find"; query: string; limit?: number }
        | { action: "read"; topicId: string }
        | { action: "request"; id: string }
        | { action: "requests"; afterId?: string };
      if (input.action === "request")
        return result(readConversationRequest(db, conversation.owner, conversation.id, input.id));
      if (input.action === "requests")
        return result(pageOpenConversationRequests(db, conversation.owner, conversation.id, input.afterId));
      if (input.action === "find") {
        return result({
          candidates: findConversationTopics(db, conversation.owner, conversation.id, input.query, input.limit ?? 8),
        });
      }
      const topic = readConversationTopic(db, conversation.owner, conversation.id, input.topicId);
      if (!topic) return result({ topic: null });
      const exact = readAppConversationResource(db, conversation.owner, conversation.id, {
        limit: 40,
        topicId: topic.id,
      });
      return result({
        topic,
        requests: exact.requests,
        messages: exact.messages.filter((message) => message.metadata?.topicId === topic.id),
      });
    },
  };
}

function conversationInputPrompt(
  app: Readonly<AppDefinition>,
  inputContext: Readonly<AppInputContext>,
  registry: Pick<AppRegistry, "snapshot">,
): string {
  const apps = appDependencyCatalog(registry.snapshot().entries, app.id);
  return [
    `Respond to the admitted input for App ${app.id}, using its Conversation result contract.`,
    "## Input and context",
    "```json",
    JSON.stringify(inputContext, null, 2),
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
  db: SqliteDb;
  definitions?: ReadonlyMap<string, SubagentDefinition>;
  taskContext?: TaskExecutionContext;
}): AppInputResolver {
  return async ({ app, inputContext, execution: binding }) => {
    const agent = (app.agent ?? app.owner ?? "").trim().replace(/^agent:/, "");
    if (!agent) throw new Error(`App ${app.id} has no conversational agent`);
    const registered = options.definitions ? options.definitions.get(agent) : options.manager.getAgentDefinition(agent);
    if (!registered) throw new Error(`Agent ${agent} is not registered`);
    const contextTool = conversationContextTool(options.db, inputContext);
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
