import type { AppDefinition, AppTaskAttachment } from "@may-agent/sdk";
import { Check } from "typebox/value";
import type { AppTaskContext } from "../core/tasks/app-task-store.js";
import { recordAppTaskAttemptSession, type AppTaskClaim } from "../core/tasks/app-task-reconciler.js";
import { readConversationTaskInputs, type ConversationTaskProposal } from "../core/state/conversation-task-turns.js";
import { readInputContext, freezeInputContext, type AppDependencyReader } from "../core/inbox/input-context.js";
import { prepareConversationInput } from "../conversations/context.js";
import { readConversationTopic } from "../core/state/conversations.js";
import type { AppInputResolver } from "../conversations/turn-agent.js";

/** Prepare a judgment under the Task claim. The common runtime alone settles it. */
export async function prepareConversationTaskTurn(input: {
  config: AppTaskContext;
  claim: AppTaskClaim;
  app: Readonly<AppDefinition>;
  resolveRequest: AppInputResolver;
  readDependency?: AppDependencyReader;
  getTaskApp?: (appId: string) => { app: Readonly<AppDefinition>; config: AppTaskContext };
  signal: AbortSignal;
}): Promise<ConversationTaskProposal> {
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
  if (claim.previousAttempt) request.previousAttempt = structuredClone(claim.previousAttempt);
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
  const selectedTopic =
    decision.topic.kind === "existing"
      ? readConversationTopic(config.resourceStore.db, app.id, item.conversationId!, decision.topic.id)
      : null;
  const knownTask = (appId: string, taskId: string) =>
    (request.focusedTask?.appId === appId && request.focusedTask.task.id === taskId) ||
    request.referencedTasks?.some((entry) => entry.appId === appId && entry.task.id === taskId) ||
    selectedTopic?.taskRefs.some((entry) => entry.appId === appId && entry.taskId === taskId) ||
    request.conversation?.topics?.some((topic) =>
      topic.taskRefs.some((entry) => entry.appId === appId && entry.taskId === taskId),
    );
  const taskControls: NonNullable<ConversationTaskProposal["taskControls"]> = [];
  for (const control of decision.taskControls ?? []) {
    if (item.source.kind !== "human" || !decision.response?.trim() || decision.followUp)
      throw new Error("Task controls require an explained direct human Turn without a follow-up handoff");
    if (!knownTask(control.appId, control.taskId))
      throw new Error("Task control target is absent from Conversation context");
    if (control.appId === app.id && control.taskId === claim.taskId)
      throw new Error("A Conversation worker cannot close its own Task");
    if (
      taskControls.some(
        (prior) => prior.config.resourceStore.appId === control.appId && prior.taskId === control.taskId,
      )
    )
      throw new Error("Conversation decision repeats a Task control");
    const target = input.getTaskApp?.(control.appId);
    const task = target?.config.resourceStore.readTask(control.taskId);
    if (!target || !task) throw new Error("Task control requires an installed Task App and exact Task");
    taskControls.push({
      config: target.config,
      taskId: control.taskId,
      generation: task.metadata.generation,
      resourceVersion: task.metadata.resourceVersion,
    });
  }
  let followUp: { config: AppTaskContext; attachment: AppTaskAttachment } | undefined;
  if (decision.followUp) {
    const desired = decision.followUp;
    const target = input.getTaskApp?.(desired.appId);
    if (!target?.app.task || !target.app.tasks || target.app.id !== desired.appId)
      throw new Error("Conversation follow-up requires an installed Task App");
    if (!Check(target.app.inputSchema, desired.input)) throw new Error("Invalid follow-up App input");
    if (desired.task) {
      if (desired.task.appId !== target.app.id || !knownTask(desired.task.appId, desired.task.taskId))
        throw new Error("Follow-up Task is absent from Conversation context");
    }
    const attachment = desired.task
      ? { kind: "existing" as const, taskId: desired.task.taskId }
      : target.app.task({ id: item.id, source: item.source, input: desired.input });
    if (!attachment) throw new Error("App selected no Task for Conversation follow-up");
    followUp = { config: target.config, attachment };
  }
  return { decision, followUp, taskControls };
}
