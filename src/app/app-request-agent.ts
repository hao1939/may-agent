import {
  appRequestAgentResultSchema,
  type AppDefinition,
  type AppRequest,
  type AppRequestDecision,
} from "@may-agent/sdk";
import type { SubagentManager } from "../lib/index.js";
import type { AppRegistry } from "./app-registry.js";
import { appDependencyCatalog } from "./app-task-runtime.js";
import type { AppRequestResolver } from "./app-inbox-host.js";

const APP_REQUEST_AGENT_TIMEOUT_MS = 10 * 60_000;

function requestPrompt(app: Readonly<AppDefinition>, request: Readonly<AppRequest>, registry: AppRegistry): string {
  const apps = appDependencyCatalog(registry.snapshot().entries, app.id);
  return [
    `You are ${app.agent ?? app.owner}, the conversational agent for App ${app.id}.`,
    "Understand this request or human turn and make one structured decision. The request remembers who is owed an answer; it is not a Task.",
    "Code has collected the exact bounded context. You decide meaning; do not use keyword matching or invent another tracking mechanism.",
    "Answer directly when no durable App work is needed. Ask one compact, high-quality clarification only when missing information materially changes outcome, owner, risk, proof, or authority.",
    "Use a Topic only to group related human/agent turns and link exact App Tasks. A Topic has no status, retry, progress, or execution lifecycle.",
    "Select an existing Topic when the turn continues it. Create a short plain-language Topic for a new durable interest or clarification. Use none for unrelated small talk or a self-contained answer.",
    "When durable work is needed, return one or more typed dependencies and no response. Continue an exact unfinished Task with taskId; omit taskId only for genuinely new work.",
    "Existing dependencies are already accepted work for this request. Preserve a still-relevant dependency with the same id and exact input. Do not replace or duplicate it merely because it is waiting.",
    "Open requests are earlier unfinished human turns from the visible Topics and their exact delegated work. Decide whether the current turn continues one of them. If it merely confirms or follows the same goal and needs no new Task input, return its requestId as continueRequestId with a plain response; do not create sibling work. If it materially steers an attached Task, delegate typed input to that exact taskId instead.",
    "Resolve a short approval or rejection against the immediately preceding agent proposal. Preserve every approved action and boundary: executable items become the exact delegated outcome, while guidance such as leaving valid work running remains a constraint rather than invented work. Put the interpretation in the dependency outcome and decision summary so the human can verify it from the assignment.",
    "Referenced Tasks are current canonical snapshots of exact Tasks shown in recent command/tool views. Focus and referenced identity outrank rendered prose. Never invent a wait, ownership link, or dependency that is absent from these snapshots.",
    "When the human clearly asks to cancel one exact Task already supplied as focused, referenced, or linked by the current Topic, return a cancel taskControl plus a plain response. Do not use Task control for feedback or continuation; delegate typed input with that exact taskId instead.",
    "A legacy may/conversation Task is retained pre-cutover state, not the current Conversation mechanism. Do not create a sibling to clean it up or claim it waits for unrelated work. Cancel it only when the human clearly asks and exact canonical context is supplied.",
    "When dependency results fulfill the request, answer the human in plain language. Do not mention inboxes, delivery confirmation, runtime correlation, or other Host mechanics.",
    "Choose dependency appId and input.kind only from Installed Apps. Satisfy requiredData and fixedData, use the listed dataTypes, and leave Task shape, executor, workflow, retry, and schedule to that App.",
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
}): AppRequestResolver {
  return async ({ app, request }) => {
    const agent = (app.agent ?? app.owner ?? "").trim().replace(/^agent:/, "");
    if (!agent) throw new Error(`App ${app.id} has no conversational agent`);
    const definition = options.manager.getAgentDefinition(agent);
    if (!definition) throw new Error(`Agent ${agent} is not registered`);
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
