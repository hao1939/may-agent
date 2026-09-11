import type { AppDefinition } from "@may-agent/sdk";
import type { AppTaskContext } from "../core/tasks/app-task-store.js";
import { recordAppTaskAttemptSession, type AppTaskClaim } from "../core/tasks/app-task-reconciler.js";
import { completeConversationTaskTurn, readConversationTaskTurn } from "../core/state/conversation-task-turns.js";
import { readInputContext, freezeInputContext, type AppDependencyReader } from "../core/inbox/input-context.js";
import { prepareConversationInput } from "../conversations/context.js";
import type { AppInputResolver } from "../conversations/turn-handler.js";

/** A bounded capability under an already claimed Task, with no inbox execution. */
export async function executeConversationTaskTurn(input: {
  config: AppTaskContext;
  claim: AppTaskClaim;
  app: Readonly<AppDefinition>;
  resolveRequest: AppInputResolver;
  readDependency?: AppDependencyReader;
  signal: AbortSignal;
}) {
  const { config, claim, app, signal } = input;
  if (app.id !== config.resourceStore.appId) throw new Error("Conversation executor belongs to another App");
  signal.throwIfAborted();
  const item = readConversationTaskTurn(config, claim);
  const request = await prepareConversationInput(
    config.resourceStore.db,
    item,
    await readInputContext(config.resourceStore.db, item, input.readDependency),
    input.readDependency,
  );
  const decision = await input.resolveRequest({
    app,
    request: freezeInputContext(request),
    execution: {
      signal,
      taskBinding: { appId: app.id, taskId: claim.taskId, generation: claim.generation, attemptId: claim.attemptId },
      sessionStarted(id) {
        if (!recordAppTaskAttemptSession(config, claim, id)) throw new Error("Conversation Task claim is stale");
      },
    },
  });
  signal.throwIfAborted();
  return completeConversationTaskTurn(config, claim, decision);
}
