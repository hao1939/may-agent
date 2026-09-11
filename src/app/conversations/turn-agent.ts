import {
  Type,
  conversationTurnResultSchema,
  type ConversationTurnResult,
  type AppDefinition,
  type AppInputContext,
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
import { pageOpenConversationRequests, readConversationRequest } from "../core/state/conversation-requests.js";
import { APP_TASK_RECOVERY_OWNER } from "../core/tasks/session-binding.js";

import type { TaskBinding } from "../../lib/persistence.js";

export type AppInputResolver = (input: {
  app: Readonly<AppDefinition>;
  request: Readonly<AppInputContext>;
  execution: { signal: AbortSignal; sessionStarted: (sessionId: string) => void; taskBinding: TaskBinding };
}) => Promise<ConversationTurnResult>;

const APP_REQUEST_AGENT_TIMEOUT_MS = 10 * 60_000;

function conversationContextTool(db: SqliteDb, request: Readonly<AppInputContext>): AgentTool | null {
  const conversation = request.conversation;
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

function requestPrompt(
  app: Readonly<AppDefinition>,
  request: Readonly<AppInputContext>,
  registry: Pick<AppRegistry, "snapshot">,
): string {
  const apps = appDependencyCatalog(registry.snapshot().entries, app.id);
  return [
    `You are ${app.agent ?? app.owner}, the conversational agent for App ${app.id}.`,
    "Understand the human's meaning in the exact bounded context collected by code, then make one structured decision. Do not infer intent with keywords or invent another tracking mechanism.",
    "When inputs are supplied, consider that ordered batch and preserve each source's meaning. System input supplies evidence for existing work; it is not a new human instruction. A system Turn may omit response when no useful human update is needed. Its summary remains internal.",
    "Treat the selected App, focused Task, selected or replied Topic, and last rendered view as the current subject, not as automatic authority to mutate it.",
    "Answer questions, give suggestions, and state an opinion directly when the supplied evidence supports a useful answer. A focused Task is evidence for advice; reading or discussing it does not by itself authorize a Task effect.",
    "Runtime already executes this Conversation through its Task. Use a separate Task for background continuation, later steering, or restart-safe coordination, not merely because a tool is needed. If a material ambiguity remains, state the likely interpretation and ask one concrete question that minimizes human effort.",
    "For self-contained authorized work, use your available tools to investigate, edit, and verify directly, then return the result without a separate Task or handoff. Inspect current state before changing it or retrying an interrupted action; do not blindly repeat side effects or claim unverified success. Do not launch detached work or bypass an existing Task owner's controls.",
    `For durable work, return exactly one followUp with the understood outcome, material constraints, acceptance proof, selected appId and schema-valid input, and an exact supplied Task only when this is feedback for that unfinished Task. Creating a Task is not delegation: ${app.id} may own and execute an ordinary Task. Choose another App when it already owns the work, requires its specific authority, or provides useful expertise or a workflow. Do not hand off just because an App has a matching name. Do not return dependencies; Runtime admits the follow-up directly to the responsible Task and links that Task to the Topic.`,
    "A followUp must include a useful immediate response explaining what you understood. The current Turn finishes after the handoff is admitted and its response is recorded; it does not wait for the background Task. The Request remains open until its scope is resolved and explained.",
    "The owning App reconciles its Task, and Runtime handles scheduling, retry, recovery, and stale mechanical state. May may send human feedback or a semantic challenge to the exact Task, but must not create replacement work merely to revive it or delegate Host repair when the same owner Task can continue.",
    "Resolve short confirmations, corrections, and pronouns against the visible Conversation, especially the immediately preceding proposal or question. Preserve constraints already established in the same Topic.",
    "Track accepted human asks with requestUpdates. An input handling result is not fulfillment. Accept a new ask with a stable id, expectedRevision: 0, its scope, and disposition: open; revise the same id using the supplied revision when the human corrects it. Use an empty list when no ask changes. A simple question can be accepted and fulfilled in the same answer without creating a separate Task. Do not close an ask merely because a Task was admitted, blocked or completed: judge whether the accepted scope was addressed and explain fulfillment, withdrawal or unfulfilled disposition with a reason. Closing an existing ask must retain its exact scope. A followUp serving an accepted ask names its requestId; Runtime links the actual Task. Stopping a turn leaves the ask open but is not authority to restart that turn.",
    "If the human naturally refers to an older discussion that is absent from visible context, use conversation_context to find bounded candidates and read the likely exact Topic. Ask only when the remaining candidates would lead to materially different actions.",
    "Use a Topic only for related Conversation context and exact Task links. Select an existing Topic when continuing it, create a short plain-language Topic for a new durable interest or clarification, and use none for a self-contained answer.",
    "Only cancel a Task when the human clearly asks and that exact Task is present in focused, referenced, or current-Topic context. Other feedback is typed input to the existing Task.",
    "When admitting or steering durable work, choose appId and input.kind from Installed Apps and satisfy the selected input contract. Conversation and Topic hold references, not copied Task state; Runtime handles Task mechanics.",
    "Use plain language in every human-facing response. Explain outcomes and needed choices, not Host bookkeeping or delivery mechanics.",
    "Finish exactly once with finish().result matching the supplied schema.",
    "Accepted asks are bounded context: use conversation_context action requests (afterId for the next page) to list open asks, and action request with id to read the full exact scope before revising or closing an omitted ask. Never close from a truncated preview.",
    "",
    "## Input and context",
    "```json",
    JSON.stringify(request, null, 2),
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
}): AppInputResolver {
  return async ({ app, request, execution: binding }) => {
    const agent = (app.agent ?? app.owner ?? "").trim().replace(/^agent:/, "");
    if (!agent) throw new Error(`App ${app.id} has no conversational agent`);
    const registered = options.definitions ? options.definitions.get(agent) : options.manager.getAgentDefinition(agent);
    if (!registered) throw new Error(`Agent ${agent} is not registered`);
    const contextTool = conversationContextTool(options.db, request);
    const definition = contextTool ? { ...registered, tools: [...registered.tools, contextTool] } : registered;
    const execution = await options.manager.callAgentDefinition(
      definition,
      requestPrompt(app, request, options.registry),
      {
        source: "app-request-agent",
        projectId: app.id,
        recoveryOwner: APP_TASK_RECOVERY_OWNER,
        taskBinding: binding.taskBinding,
        requireFinish: true,
        outputSchema: conversationTurnResultSchema,
        // Reuse bounded App execution, without detached lifecycle tools.
        toolPolicy: "app-agent-full",
        timeout: APP_REQUEST_AGENT_TIMEOUT_MS,
        signal: binding.signal,
        sessionStarted: binding.sessionStarted,
      },
    );
    if (execution.status !== "done" || !execution.structuredResult) {
      throw new Error(
        execution.error || execution.lastAssistantText || `Agent ${agent} did not return a request decision`,
      );
    }
    return execution.structuredResult as ConversationTurnResult;
  };
}
