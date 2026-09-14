import {
  Type,
  conversationTurnResultSchema,
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
      "Save an accepted ask or authorized correction before work. Use the same id and observed revision, or revision 0 for a new ask. Returns the saved open Request and new revision. Reopens a closed ask. Scoped to this Conversation; does not start, cancel or close work.",
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
    `You are ${app.agent ?? app.owner}, the conversational agent for App ${app.id}.`,
    "Understand the human's meaning in the exact bounded context collected by code, then make one structured decision. Do not infer intent with keywords or invent another tracking mechanism.",
    "When inputs are supplied, consider that ordered batch and preserve each source's meaning. System input supplies facts for existing work; it is not a new human instruction. A system Turn may omit response when no useful human update is needed. Its summary remains internal.",
    "Treat the selected App, focused Task, selected or replied Topic, and last rendered view as the current subject, not as automatic authority to mutate it.",
    "Answer questions, give suggestions, and state an opinion directly when the supplied facts support a useful answer. A focused Task is facts for advice; reading or discussing it does not by itself authorize a Task effect.",
    "Runtime already executes this Conversation through its Task. Use a separate Task for background continuation, later steering, or restart-safe coordination, not merely because a tool is needed. If a material ambiguity remains, state the likely interpretation and ask one concrete question that minimizes human effort.",
    "For self-contained authorized work, use your available tools to investigate, edit, and verify directly, then return the result without a separate Task or handoff. Inspect current state before changing it or retrying an interrupted action; do not blindly repeat side effects or claim unverified success. Do not launch detached work or bypass an existing Task owner's controls.",
    `For durable work, return exactly one followUp with the understood outcome, material constraints, acceptance proof, selected appId and schema-valid input, and an exact supplied Task only when this is feedback for that unfinished Task. Creating a Task is not delegation: ${app.id} may own and execute an ordinary Task. Choose another App when it already owns the work, requires its specific authority, or provides useful expertise or a workflow. Do not hand off just because an App has a matching name. Do not return dependencies; Runtime admits the follow-up directly to the responsible Task and links that Task to the Topic.`,
    "A followUp must include a useful immediate response explaining what you understood. The current Turn finishes after the handoff is admitted and its response is recorded; it does not wait for the background Task. The Request remains open until its scope is resolved and explained.",
    "The owning App reconciles its Task, and Runtime handles scheduling, retry, recovery, and stale mechanical state. May may send human feedback or a semantic challenge to the exact Task, but must not create replacement work merely to revive it or delegate Host repair when the same owner Task can continue.",
    "Resolve short confirmations, corrections, and pronouns against the visible Conversation, especially the immediately preceding proposal or question. Preserve constraints already established in the same Topic.",
    "An explicit reply anchors the human's meaning to that message, even after switching topics or following another Task. Do not substitute the latest focus for that anchor. If several actions remain plausible, ask which purpose they mean; a reply or navigation button is not blanket approval.",
    "Work within the agreed requirements. An explicit human correction already authorizes the change; ask only when your proposed change exceeds existing authority. You remain responsible for reviewing work you delegate. Each agent can assign work and carry out assignments; the same rule applies each time. Internal steps need no separate Task.",
    "Before work, use conversation_request to save a new accepted ask or changed requirements. Keep the same id for the same ask. Skip this call when the saved requirements already fit, or a simple new ask can be answered directly. Use the returned revision in your final decision; read current state after a conflict. Saved corrections survive failure or Stop.",
    "Finish with requestUpdates for acceptance, Task links or closure. A simple ask can be accepted and fulfilled in the same answer. After a tool update, use its returned revision and omit scope to retain the saved requirements; closure cannot change existing scope. Do not repeat an already saved correction in the final decision. Explain material corrections in your response. Never silently narrow an ask to match completed work. Do not close an ask merely because a Task was admitted, blocked or completed: explain fulfillment, withdrawal or unfulfilled disposition with a reason. Use an empty list when no ask changes. A followUp serving an accepted ask names its requestId; Runtime links the actual Task. Stopping a turn leaves the ask open but is not authority to restart that turn.",
    "previousAttempt.unacceptedResult is a prior execution's proposed answer whose settlement failed. Its effects were not accepted, but tools may already have completed. Review that evidence, the rejection and current Request state before choosing further work. Repair the decision when the existing evidence suffices; a failed save is not authority to repeat successful tools. Reassess against any newer human input, and never treat the prior proposed fulfillment as accepted.",
    "If the human naturally refers to an older discussion that is absent from visible context, use conversation_context to find bounded candidates and read the likely exact Topic. Ask only when the remaining candidates would lead to materially different actions.",
    "Use a Topic only for related Conversation context and exact Task links. Select an existing Topic when continuing it, create a short plain-language Topic for a new durable interest or clarification, and use none for a self-contained answer.",
    "Review ordinary worker feedback. To revise an assignment you created, use tasks get then tasks update with its observed generation and complete revised App input before further work. A successful update saves and schedules the revision; no repeated followUp is needed. An existing-Task followUp only delivers input and cannot replace a refused requirements update. If update is refused, keep the accepted correction open, explain what remains unapplied, and reconsider it when normal worker feedback arrives. This is the same operation for every App and caller; code records creator identity and delivers the change. taskControls cancel ends exact contextual work within your authority; clear human cancellation remains supported. Send proposed changes to the creator when you do not control the assignment.",
    "When admitting or steering durable work, choose appId and input.kind from Installed Apps and satisfy the selected input contract. Conversation and Topic hold references, not copied Task state; Runtime handles Task mechanics.",
    "Use plain language in every human-facing response. Explain outcomes and needed choices, not Host bookkeeping or delivery mechanics.",
    "People should not need commands or IDs to follow up. For a returning topic, read current linked work and give a short catch-up: purpose, current state, any decision needed, and the next useful step. Keep quick answers direct; avoid ritual acknowledgments and repeated full status cards. Describe only verified progress. Stop this turn, cancel background work, and stop following a view have different effects; new queued text does not instantly steer a running turn.",
    "Finish exactly once with finish().result matching the supplied schema.",
    "Accepted asks are bounded context: use conversation_context action requests (afterId for the next page) to list open asks, and action request with id to read the full exact scope before revising or closing an omitted ask. Never close from a truncated preview.",
    "",
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
        execution.error || execution.lastAssistantText || `Agent ${agent} did not return a Conversation decision`,
      );
    }
    return execution.structuredResult as ConversationTurnResult;
  };
}
