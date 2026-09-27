import type { AppDefinition } from "@may-agent/sdk";
import type { AppTaskContext } from "../core/tasks/app-task-store.js";
import { recordAppTaskAttemptSession, type AppTaskClaim } from "../core/tasks/app-task-reconciler.js";
import {
  readConversationTaskTurn,
  prepareConversationTaskProposal,
  updateConversationTaskRequest,
  type ConversationTaskProposal,
  type ConversationTaskAppResolver,
} from "../core/state/conversation-task-turns.js";
import { freezeInputContext, type AppDependencyReader } from "../core/inbox/input-context.js";
import { prepareConversationTaskContext } from "../conversations/context.js";
import { readConversationContext } from "../core/state/conversations.js";
import type { AppInputResolver } from "../core/tasks/execution.js";

/** Connect context and model execution to core-owned preparation; runtime settles the result. */
export async function prepareConversationTaskTurn(input: {
  config: AppTaskContext;
  claim: AppTaskClaim;
  app: Readonly<AppDefinition>;
  resolveConversationInput: AppInputResolver;
  readDependency?: AppDependencyReader;
  getTaskApp?: ConversationTaskAppResolver;
  prepareContext?: typeof prepareConversationTaskContext;
  signal: AbortSignal;
}): Promise<ConversationTaskProposal> {
  const { config, claim, app, signal } = input;
  if (app.id !== config.resourceStore.appId) throw new Error("Conversation executor belongs to another App");
  signal.throwIfAborted();
  const turn = readConversationTaskTurn(config, claim);
  const { replyInput: item } = turn;
  const db = config.resourceStore.db;
  const { appId, conversationId } = item;
  const inputContext = await (input.prepareContext ?? prepareConversationTaskContext)(
    db,
    { items: turn.items, replyInput: item },
    claim.previousAttempt,
    input.readDependency,
  );
  const decision = await input.resolveConversationInput({
    app,
    inputContext: freezeInputContext(inputContext),
    execution: {
      outputSchema: turn.outputSchema,
      signal,
      taskBinding: { appId: app.id, taskId: claim.taskId, generation: claim.generation, attemptId: claim.attemptId },
      readContext: (query) => readConversationContext(db, appId, conversationId!, query),
      updateRequest(change, operationId) {
        signal.throwIfAborted();
        return updateConversationTaskRequest(config, claim, change, operationId);
      },
      sessionStarted(id) {
        if (!recordAppTaskAttemptSession(config, claim, id)) throw new Error("Conversation Task claim is stale");
      },
    },
  });
  signal.throwIfAborted();
  return prepareConversationTaskProposal(config, claim, decision, input.getTaskApp);
}
