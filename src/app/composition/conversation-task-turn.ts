import type { AppDefinition, AppTaskAttachment } from "@may-agent/sdk";
import { Check } from "typebox/value";
import type { AppTaskContext } from "../core/tasks/app-task-store.js";
import { recordAppTaskAttemptSession, type AppTaskClaim } from "../core/tasks/app-task-reconciler.js";
import { completeConversationTaskTurn, readConversationTaskInputs } from "../core/state/conversation-task-turns.js";
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
  getFollowUpApp?: (appId: string) => { app: Readonly<AppDefinition>; config: AppTaskContext };
  signal: AbortSignal;
}) {
  const { config, claim, app, signal } = input;
  if (app.id !== config.resourceStore.appId) throw new Error("Conversation executor belongs to another App");
  signal.throwIfAborted();
  const items = readConversationTaskInputs(config, claim);
  const item = items.at(-1)!;
  const request = await prepareConversationInput(
    config.resourceStore.db,
    item,
    await readInputContext(config.resourceStore.db, item, input.readDependency),
    input.readDependency,
  );
  request.inputs = items.map(({ id, source, input }) => ({ id, source, input }));
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
  let followUp: { config: AppTaskContext; attachment: AppTaskAttachment } | undefined;
  if (decision.followUp) {
    const desired = decision.followUp;
    const target = input.getFollowUpApp?.(desired.appId);
    if (!target?.app.task || !target.app.tasks || target.app.id !== desired.appId)
      throw new Error("Conversation follow-up requires an installed Task App");
    if (!Check(target.app.inputSchema, desired.input)) throw new Error("Invalid follow-up App input");
    if (desired.task) {
      const known =
        request.referencedTasks?.some(
          (entry) => entry.appId === desired.task!.appId && entry.task.id === desired.task!.taskId,
        ) ||
        request.conversation?.topics?.some((topic) =>
          topic.taskRefs.some((entry) => entry.appId === desired.task!.appId && entry.taskId === desired.task!.taskId),
        );
      if (desired.task.appId !== target.app.id || !known)
        throw new Error("Follow-up Task is absent from Conversation context");
    }
    const attachment = desired.task
      ? { kind: "existing" as const, taskId: desired.task.taskId }
      : target.app.task({ id: item.id, source: item.source, input: desired.input });
    if (!attachment) throw new Error("App selected no Task for Conversation follow-up");
    followUp = { config: target.config, attachment };
  }
  return completeConversationTaskTurn(config, claim, decision, { followUp });
}
