import {
  conversationTurnResultSchema,
  type AppDefinition,
  type AppInput,
  type AppInputContext,
  type AppDependencyObservation,
  type ConversationTurnResult,
  type AppRequestFollowUp,
  type AppRequestTaskControl,
} from "@may-agent/sdk";
import { Check, Errors } from "typebox/value";
import type { SqliteDb } from "../../lib/db.js";
import type { TaskBinding } from "../../lib/persistence.js";
import {
  recordAppInboxHandling,
  type AppInboxItem,
  type AppInboxClaim,
} from "../core/state/app-inbox-store.js";
import { acceptConversationTurnDecision, applyTurnTopic } from "../core/state/conversation-turns.js";
import { readConversationTopic } from "../core/state/conversations.js";
import { readConversationRequest, ConversationRequestConflict } from "../core/state/conversation-requests.js";
import { observeTaskDependency, freezeInputContext, type AppDependencyReader } from "../core/inbox/input-context.js";
import type { AppInputHandler } from "../core/inbox/input-handler.js";

const TERMINAL_TASK_INPUT_STATUSES = new Set(["error", "interrupted", "unknown"]);
const APP_REQUEST_RECONSIDERATION_MAX = 2;

export type AppInputResolver = (input: {
  app: Readonly<AppDefinition>;
  request: Readonly<AppInputContext>;
  execution?: { signal: AbortSignal; sessionStarted: (sessionId: string) => void; taskBinding?: TaskBinding };
}) => Promise<ConversationTurnResult>;

export type AppRequestTaskController = (input: {
  requestId: string;
  control: AppRequestTaskControl;
  authorize: () => void;
}) => Promise<void>;

export type ConversationHandlerOptions = {
  db: SqliteDb;
  readDependency?: AppDependencyReader;
  resolveRequest?: AppInputResolver;
  controlTask?: AppRequestTaskController;
  now?: () => number;
  /** Conversational text emitted after the turn finishes or hands off. */
  onRequestMessage?: (item: AppInboxItem, text: string, topicId: string) => void;
  /** Durable handoff from one bounded conversational turn to App-owned follow-up work. */
  onRequestFollowUp?: (
    item: AppInboxItem,
    followUp: AppRequestFollowUp,
    topicId: string,
    authorize: () => void,
  ) => void | Promise<void>;
};
function requestTaskIdentityKeys(request: Readonly<AppInputContext>): Set<string> {
  const identities = new Set<string>();
  if (request.focusedTask) {
    identities.add(`${request.focusedTask.appId}\0${request.focusedTask.task.id}`);
  }
  for (const referenced of request.referencedTasks ?? []) {
    identities.add(`${referenced.appId}\0${referenced.task.id}`);
  }
  const currentTopicId = request.conversation?.current?.topicId;
  const currentTopic = request.conversation?.topics?.find((topic) => topic.id === currentTopicId);
  for (const task of currentTopic?.taskRefs ?? []) {
    identities.add(`${task.appId}\0${task.taskId}`);
  }
  return identities;
}

function validateInput(app: Readonly<AppDefinition>, input: AppInput): void {
  if (!Check(app.inputSchema, input)) {
    const first = [...Errors(app.inputSchema, input)][0];
    throw new Error(`Invalid input for App ${app.id}: ${first?.message ?? "schema mismatch"}`);
  }
}

export function createConversationTurnHandler(options: ConversationHandlerOptions): AppInputHandler {
  const now = options.now ?? Date.now;
  function publishRequestMessage(item: AppInboxItem, text: string | undefined, topicId: string | undefined): void {
    if (!text || !topicId || !options.onRequestMessage) return;
    try {
      options.onRequestMessage(item, text, topicId);
    } catch {
      // The accepted request result remains authoritative. Publication is
      // idempotent, so recovery can project it without repeating the work.
    }
  }

  return async ({ app, claim, request, execution, authorize, complete, getApp, refreshInput }) => {
    async function resolveDirectRequest(
      app: Readonly<AppDefinition>,
      claim: AppInboxClaim,
      request: Readonly<AppInputContext>,
      reconsiderations = 0,
    ): Promise<string | undefined> {
      if (!options.resolveRequest) throw new Error("Direct App request resolution is not configured");
      authorize();
      const directTurn = request.source.kind === "human" && Boolean(claim.item.conversationId);
      const saved = claim.item.handling;
      if (directTurn && saved?.phase === "executing" && reconsiderations === 0) {
        throw new Error(
          "Previous conversational execution ended without an accepted decision; explicit retry is required",
        );
      }
      if (directTurn && saved?.phase !== "decided") {
        recordAppInboxHandling(options.db, claim, { phase: "executing" }, now());
        claim.item.handling = { phase: "executing" };
      }
      const decision =
        saved?.phase === "decided"
          ? saved.decision
          : await options.resolveRequest({
              app,
              request,
              execution,
            });
      authorize();
      if (!Check(conversationTurnResultSchema, decision)) {
        const first = [...Errors(conversationTurnResultSchema, decision)][0];
        throw new Error(`App ${app.id} returned an invalid request decision: ${first?.message ?? "schema mismatch"}`);
      }
      const taskControls = decision.taskControls ?? [];
      const followUp = decision.followUp;
      const requestUpdates = decision.requestUpdates ?? [];
      if (requestUpdates.length && (!directTurn || !decision.response?.trim()))
        throw new Error("Accepted Request updates require a conversational answer");
      if (requestUpdates.some((update) => update.disposition !== "open" && !update.reason?.trim()))
        throw new Error("Request closure requires an explicit reason");
      if (followUp && decision.topic.kind === "none" && !claim.item.topicId)
        throw new Error("Durable handoff requires a Topic");
      if (followUp && taskControls.length > 0) {
        throw new Error(`App ${app.id} request decision cannot combine follow-up with direct Task effects`);
      }
      if (!decision.response && !followUp && taskControls.length === 0) {
        throw new Error(`App ${app.id} request decision must answer or hand off exact Task work`);
      }
      if (followUp && !decision.response) {
        throw new Error(`App ${app.id} request decision must explain its durable follow-up to the human`);
      }
      if (taskControls.length > 0 && !decision.response) {
        throw new Error(`App ${app.id} request decision must explain an applied Task control to the human`);
      }
      if (taskControls.length > 0 && request.source.kind !== "human") {
        throw new Error(`App ${app.id} request decision cannot control Tasks without a direct human turn`);
      }
      const availableTaskIdentities = requestTaskIdentityKeys(request);
      if (decision.topic.kind === "existing") {
        const conversation = request.conversation;
        const topic = conversation
          ? readConversationTopic(options.db, app.id, conversation.id, decision.topic.id)
          : null;
        if (!topic) throw new Error(`App ${app.id} selected unavailable Topic ${decision.topic.id}`);
        for (const task of topic.taskRefs) availableTaskIdentities.add(`${task.appId}\0${task.taskId}`);
      }
      const controlledTaskIdentities = new Set<string>();
      for (const control of taskControls) {
        const appId = control.appId.trim().replace(/\.app$/, "");
        const taskId = control.taskId.trim();
        const identity = `${appId}\0${taskId}`;
        if (!availableTaskIdentities.has(identity)) {
          throw new Error(`App ${app.id} request decision cannot control unavailable Task ${appId}/${taskId}`);
        }
        if (controlledTaskIdentities.has(identity)) {
          throw new Error(`App ${app.id} request decision repeats Task control ${appId}/${taskId}`);
        }
        controlledTaskIdentities.add(identity);
      }
      if (followUp?.task) {
        const appId = followUp.task.appId.trim().replace(/\.app$/, "");
        const taskId = followUp.task.taskId.trim();
        if (!availableTaskIdentities.has(`${appId}\0${taskId}`)) {
          throw new Error(`App ${app.id} request decision cannot follow unavailable Task ${appId}/${taskId}`);
        }
      }
      if (followUp) {
        const target = getApp(followUp.appId);
        if (!target.task || !target.tasks) {
          throw new Error(`App follow-up targets non-Task App ${target.id}`);
        }
        validateInput(target, followUp.input);
        if (followUp.task && followUp.task.appId.trim().replace(/\.app$/, "") !== target.id) {
          throw new Error(`App follow-up Task owner must match target App ${target.id}`);
        }
        if (followUp.task && options.readDependency && saved?.phase !== "decided") {
          const taskId = followUp.task.taskId.trim();
          const observed: AppDependencyObservation =
            (await observeTaskDependency(options.readDependency, target.id, { kind: "task", id: taskId })) ??
            ({ kind: "task", id: taskId, status: "unknown" } as const);
          if (observed.closed || TERMINAL_TASK_INPUT_STATUSES.has(observed.status)) {
            if (reconsiderations >= APP_REQUEST_RECONSIDERATION_MAX) {
              throw new Error(
                `App ${app.id} repeatedly selected unavailable Task ${target.id}/${taskId}; retry with current Task evidence`,
              );
            }
            const fresh = await refreshInput();
            const prior = fresh.referencedTasks?.find(
              (candidate) => candidate.appId === target.id && candidate.task.id === taskId,
            );
            const reconsidered: AppInputContext = {
              ...fresh,
              referencedTasks: [
                { appId: target.id, ...(prior?.ref ? { ref: prior.ref } : {}), task: observed },
                ...(fresh.referencedTasks ?? []).filter(
                  (candidate) => candidate.appId !== target.id || candidate.task.id !== taskId,
                ),
              ],
            };
            return resolveDirectRequest(app, claim, freezeInputContext(reconsidered), reconsiderations + 1);
          }
        }
      }
      let topicId: string | undefined;
      if (directTurn && saved?.phase !== "decided") {
        const accepted = acceptConversationTurnDecision(options.db, {
          claim,
          request,
          decision,
          authorize: () => authorize(),
          now: now(),
        });
        topicId = accepted.topicId;
        claim.item.handling = accepted.handling;
      } else {
        topicId = applyTurnTopic(options.db, {
          claim,
          request,
          decision,
          authorize: () => authorize(),
          now: now(),
        });
      }

      if (followUp && !topicId) {
        throw new Error(`Delegated App request ${request.id} requires a Topic`);
      }
      if (taskControls.length > 0) {
        if (!options.controlTask) throw new Error("Human Task control is not configured");
        for (const control of taskControls) {
          authorize();
          await options.controlTask({ requestId: request.id, control, authorize: () => authorize() });
        }
      }
      if (followUp) {
        if (!options.onRequestFollowUp) throw new Error("App follow-up event publication is not configured");
        authorize();
        await options.onRequestFollowUp(claim.item, followUp, topicId!, () => {
          authorize();
          if (followUp.requestId) {
            const current = readConversationRequest(options.db, app.id, claim.item.conversationId!, followUp.requestId);
            const revision =
              claim.item.handling?.phase === "decided"
                ? claim.item.handling.requestRevisions?.[followUp.requestId]
                : undefined;
            if (!current || current.status !== "open" || current.revision !== revision)
              throw new ConversationRequestConflict("Accepted Request changed before handoff");
          }
        });
      }
      const conversationId = complete({
        summary: decision.summary,
        response: decision.response,
        evidence: decision.evidence,
      });
      publishRequestMessage(claim.item, decision.response, topicId);
      return conversationId;
    }

    return resolveDirectRequest(app, claim, request);
  };
}
