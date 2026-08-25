import {
  Type,
  appRequestAgentResultSchema,
  type AppDefinition,
  type AppRequest,
  type AppRequestDecision,
} from "@may-agent/sdk";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type { SubagentManager } from "../lib/index.js";
import type { SqliteDb } from "../lib/db.js";
import type { AppRegistry } from "./app-registry.js";
import { appDependencyCatalog } from "./app-task-runtime.js";
import { findConversationTopics, readAppConversationResource, readConversationTopic } from "./app-inbox-store.js";
import type { AppRequestResolver } from "./app-inbox-host.js";

const APP_REQUEST_AGENT_TIMEOUT_MS = 10 * 60_000;

function conversationContextTool(db: SqliteDb, request: Readonly<AppRequest>): AgentTool | null {
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
      "Find bounded historical Topic candidates or read one exact Topic in this Conversation. This is read-only retrieval: inspect the evidence and decide its meaning yourself; the tool never selects work or changes context.",
    parameters: Type.Union([
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
      const input = raw as { action: "find"; query: string; limit?: number } | { action: "read"; topicId: string };
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
        messages: exact.messages.filter((message) => message.metadata?.topicId === topic.id),
      });
    },
  };
}

function requestPrompt(app: Readonly<AppDefinition>, request: Readonly<AppRequest>, registry: AppRegistry): string {
  const apps = appDependencyCatalog(registry.snapshot().entries, app.id);
  const usesStandingFollowUp = Boolean(app.requests?.inputKinds && app.tasks);
  return [
    `You are ${app.agent ?? app.owner}, the conversational agent for App ${app.id}.`,
    "Understand the human's meaning in the exact bounded context collected by code, then make one structured decision. Do not infer intent with keywords or invent another tracking mechanism.",
    "Treat the selected App, focused Task, selected or replied Topic, and last rendered view as the current subject, not as automatic authority to mutate it.",
    "Answer questions, give suggestions, and state an opinion directly when the supplied evidence supports a useful answer. A focused Task is evidence for advice; reading or discussing it does not by itself authorize a Task effect.",
    "Add durable work only when the human asks for an outcome that cannot be fulfilled in this bounded answer. If a material ambiguity remains, state the likely interpretation and ask one concrete question that minimizes human effort.",
    ...(usesStandingFollowUp
      ? [
          `For durable work, return exactly one followUp with the understood outcome, material constraints, acceptance proof, selected appId and schema-valid input, and an exact supplied Task only when this is feedback for that unfinished Task. Choose another App from Installed Apps when it owns the outcome; choose ${app.id} only when this App is genuinely the best owner. Do not return dependencies; the standing App Task owns Task linkage and follow-through.`,
          "A followUp must include a useful immediate response explaining what you understood. The bounded conversation request completes when that durable event is accepted; it does not wait for another App.",
        ]
      : [
          "Continue an exact unfinished Task with taskId whenever its owner and goal can fulfill the intent. Omit taskId only for genuinely new work whose outcome or accountable owner changed. Never create a sibling merely because work is pending or waiting.",
          "A response may accompany dependencies when the human asked for both judgment and action: answer usefully now, then continue only the necessary exact work. The final result comes after the work finishes.",
        ]),
    "The owning App reconciles its Task, and Runtime handles scheduling, retry, recovery, and stale mechanical state. May may send human feedback or a semantic challenge to the exact Task, but must not create replacement work merely to revive it or delegate Host repair when the same owner Task can continue.",
    "Resolve short confirmations, corrections, and pronouns against the visible Conversation, especially the immediately preceding proposal or question. Preserve constraints already established in the same Topic.",
    "If the human naturally refers to an older discussion that is absent from visible context, use conversation_context to find bounded candidates and read the likely exact Topic. Ask only when the remaining candidates would lead to materially different actions.",
    "Use a Topic only for related Conversation context and exact Task links. Select an existing Topic when continuing it, create a short plain-language Topic for a new durable interest or clarification, and use none for a self-contained answer.",
    "Only cancel a Task when the human clearly asks and that exact Task is present in focused, referenced, or current-Topic context. Other feedback is typed input to the existing Task.",
    "Choose dependency appId and input.kind only from Installed Apps, satisfy its input contract, and leave Task mechanics to that App.",
    "Use plain language in every human-facing response. Explain outcomes and needed choices, not Host bookkeeping or delivery mechanics.",
    "Finish exactly once with finish().result matching the supplied schema.",
    "",
    "## Request and context",
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

export function createAppRequestAgentResolver(options: {
  manager: SubagentManager;
  registry: AppRegistry;
  db: SqliteDb;
}): AppRequestResolver {
  return async ({ app, request }) => {
    const agent = (app.agent ?? app.owner ?? "").trim().replace(/^agent:/, "");
    if (!agent) throw new Error(`App ${app.id} has no conversational agent`);
    const registered = options.manager.getAgentDefinition(agent);
    if (!registered) throw new Error(`Agent ${agent} is not registered`);
    const contextTool = conversationContextTool(options.db, request);
    const definition = contextTool ? { ...registered, tools: [...registered.tools, contextTool] } : registered;
    const execution = await options.manager.callAgentDefinition(
      definition,
      requestPrompt(app, request, options.registry),
      {
        source: "app-request-agent",
        projectId: app.id,
        recoveryOwner: "app-inbox",
        requireFinish: true,
        outputSchema: appRequestAgentResultSchema,
        toolPolicy: "app-agent-deputy",
        timeout: APP_REQUEST_AGENT_TIMEOUT_MS,
      },
    );
    if (execution.status !== "done" || !execution.structuredResult) {
      throw new Error(
        execution.error || execution.lastAssistantText || `Agent ${agent} did not return a request decision`,
      );
    }
    return execution.structuredResult as AppRequestDecision;
  };
}
