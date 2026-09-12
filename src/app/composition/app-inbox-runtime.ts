import { conversationTaskId, listPendingConversationTaskChanges } from "../core/state/conversation-task-turns.js";
import type { AppTaskCapability } from "../core/tasks/app-task-capability.js";
import { createAppScheduleProducer } from "../adapters/producers/app-schedules.js";
import { OwnedTimer } from "../core/scheduling/timer.js";
import {
  matchesEventSelector,
  type AppDependencyObservation,
  type AppEvent,
  type AppInput,
  type AppInputSource,
  type EventSelector,
  type ObserverContext,
  type TaskIntent,
} from "@may-agent/sdk";
import { log } from "../../lib/log.js";
import type { SqliteDb } from "../../lib/db.js";
import { loadPersistedEvent } from "../core/events/persisted.js";
import { EVENT_ROW_ID, eventData, type AgentEvent, type DeliveryResult, type EventBus } from "../core/events/bus.js";
import {
  AppInboxHost,
  type AppInboxFailure,
  type AppTaskAttacher,
  type AppInboxHostOptions,
} from "../core/inbox/app-inbox-host.js";
import { listAppInboxItemsWaitingOnTask } from "../core/state/app-inbox-store.js";
import { listConversationTopicLinksForTask } from "../core/state/conversations.js";
import type {
  AppDefinitionSource,
  AppRegistry,
  AppRegistrySnapshot,
  LoadedAppDefinition,
} from "../core/apps/registry.js";
import {
  completeAppEventAdmissionPlan,
  createAppEventAdmissionPlan,
  getAppEventAdmissionPlan,
  listPendingAppEventAdmissionPlans,
  markAppEventAdmissionCommandAdmitted,
  recordAppEventAdmissionCommandFailure,
  type AppEventAdmissionCommand,
  type AppEventAdmissionPlan,
  type AppEventAdmissionRoute,
} from "../core/state/app-event-admission-store.js";
import { createAppObserverRuntime } from "../adapters/producers/app-observer-runtime.js";
import { canonicalAppEvent } from "../canonical-app-event.js";

export type AppRegistryReloadPreparation = (input: {
  snapshot: AppRegistrySnapshot;
  /** Must be the final synchronous step after every other consumer commits. */
  commit: () => void;
}) => Promise<void>;

export type AppInboxRuntime = {
  host: AppInboxHost;
  /** Begin recovery, schedules, and input coordination after interfaces are ready. */
  start(): Promise<void>;
  close(): void;
  scanNow(): void;
  reload(prepare?: AppRegistryReloadPreparation, discover?: AppDefinitionSource): Promise<string[]>;
};

// The Event turn persists a small admission plan. Canonical Task mutation runs
// in one persistent worker; this process only records routes and exact wakes.
// The Event journal remains the sole recovery authority.
const ADMISSION_RECOVERY_INTERVAL_MS = 60_000;
const ADMISSION_RECOVERY_BATCH_SIZE = 16;
const ADMISSION_COMMAND_TURN_GAP_MS = 2;

export type StartAppInboxRuntimeOptions = {
  registry: AppRegistry;
  db: SqliteDb;
  bus: EventBus;
  attachTask?: (input: Parameters<AppTaskAttacher>[0] & { appDir: string }) => ReturnType<AppTaskAttacher>;
  admitConversation?: AppInboxHostOptions["admitConversation"];
  admitConversationChange?: AppTaskCapability["admitConversationChange"];
  stopConversationTurn?: AppInboxHostOptions["stopConversationTurn"];
  admitTaskEvent?: (input: {
    appId: string;
    appDir: string;
    event: AgentEvent;
    intent: TaskIntent | null;
    targetedTaskId?: string;
    conditionTaskIds?: string[];
  }) => DeliveryResult | undefined;
  /** Persistent process boundary for canonical Task mutation after routing. */
  createTaskAdmissionWorker?: () => {
    dispatch(
      command: AppEventAdmissionCommand,
      event: AgentEvent,
    ): Promise<{ taskIds: string[]; supersededSessionIds: string[] }>;
    close(): void;
  };
  wakeAdmittedTasks?: (input: { appId: string; taskIds: string[]; supersededSessionIds: string[] }) => void;
  hasTaskTarget?: (input: { appId: string; taskId: string }) => boolean;
  previewTaskEvent?: (input: { appId: string; appDir: string; event: AgentEvent; targetedTaskId?: string }) => string[];
  /** One event-type-first Condition lookup across all loaded Task Apps. */
  previewTaskEventRoutes?: (input: { event: AgentEvent }) => Array<{ appId: string; taskIds: string[] }>;
  readDependency?: (input: {
    appId: string;
    appDir: string;
    dependency: { kind: "task"; id: string };
    admissionKey?: string;
  }) => Promise<AppDependencyObservation | null>;
  /** Recovery cadence, including retrying Apps whose input dispatch failed. */
  scanIntervalMs?: number;
  /** Select timed App publications only; admission, observers and recovery remain active. */
  schedulesEnabled?: boolean;
  now?: () => number;
  observerContext?: (appId: string, appDir: string) => ObserverContext;
  /** State root used to restore an oversized event body while resuming a frozen plan. */
  persistDir?: string;
  /** Construct durable routing without starting recovered work yet. */
  deferStart?: boolean;
};

function eventSelectorType(selector: EventSelector): string {
  return typeof selector === "string" ? selector : selector.type;
}

function indexAppEventSelectors(
  entries: readonly Readonly<LoadedAppDefinition>[],
  select: (definition: LoadedAppDefinition["definition"]) => readonly EventSelector[] | undefined,
): Map<string, LoadedAppDefinition[]> {
  const indexed = new Map<string, Map<string, LoadedAppDefinition>>();
  for (const entry of entries) {
    for (const selector of select(entry.definition) ?? []) {
      const eventType = eventSelectorType(selector);
      const routes = indexed.get(eventType) ?? new Map<string, LoadedAppDefinition>();
      routes.set(entry.definition.id, { appDir: entry.appDir, definition: entry.definition });
      indexed.set(eventType, routes);
    }
  }
  return new Map([...indexed].map(([eventType, routes]) => [eventType, [...routes.values()]]));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function inputSource(value: unknown, fallbackId: string): AppInputSource {
  const source = record(value);
  const kind = source.kind;
  return {
    kind: kind === "human" || kind === "app" || kind === "system" ? kind : "system",
    id: typeof source.id === "string" && source.id.trim() ? source.id.trim() : fallbackId,
  };
}

function requestedInput(data: Record<string, unknown>): AppInput {
  const input = record(data.input);
  return { kind: typeof input.kind === "string" ? input.kind : "", data: input.data };
}

function eventRowId(event: AgentEvent): number | undefined {
  const eventId = Number((event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
  return Number.isSafeInteger(eventId) && eventId > 0 ? eventId : undefined;
}

function eventIdentity(event: AgentEvent): string | undefined {
  const eventId = eventRowId(event);
  return eventId ? `event:${eventId}` : undefined;
}

function exactTaskTarget(event: AppEvent<Record<string, unknown>>): { appId?: string; taskId: string } | null {
  const taskId = typeof event.target?.taskId === "string" ? event.target.taskId.trim() : "";
  if (!taskId) return null;
  // Exact-task routing authority is entirely in the canonical envelope target.
  // App/project identities in data remain correlation and lifecycle evidence.
  const selectedAppId = [event.target?.appId, event.target?.project].find(
    (value) => typeof value === "string" && value.trim(),
  );
  const appId = typeof selectedAppId === "string" ? selectedAppId.trim() : "";
  return { appId: appId ? appId.replace(/\.app$/, "") : undefined, taskId };
}

function normalizedAgent(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim().replace(/^agent:/, "");
}

const NON_AGENT_MESSAGE_PARTICIPANTS = new Set(["human", "operator", "telegram", "console", "socket"]);

function addressedAgentMessage(event: AgentEvent):
  | {
      targetOwner: string;
      sender: string;
      sourceAppId?: string;
      input: AppInput;
      identity: string;
    }
  | undefined {
  if (event.type !== "message.created") return undefined;
  const identity = eventIdentity(event);
  if (!identity) return undefined;
  const data = eventData(event);
  // App delivery results are correlated by their stored parent/outbox link;
  // they are not fresh addressed requests.
  if (typeof data.appResponseFor === "string" && data.appResponseFor.trim()) return undefined;
  // `to` is the address. The envelope owner is only a delivery projection and
  // can still point at a channel-facing agent.
  const targetOwner = normalizedAgent(data.to);
  const sender = normalizedAgent(data.from) ?? normalizedAgent((event as { source?: unknown }).source);
  if (
    !targetOwner ||
    !sender ||
    sender === targetOwner ||
    NON_AGENT_MESSAGE_PARTICIPANTS.has(sender) ||
    NON_AGENT_MESSAGE_PARTICIPANTS.has(targetOwner)
  ) {
    return undefined;
  }
  if (data.intent === "chat.start" || data.intent === "fork") return undefined;

  const context: Record<string, unknown> = {};
  for (const key of ["from", "intent", "artifact", "priority", "sourceSessionId"] as const) {
    if (data[key] !== undefined) context[key] = data[key];
  }
  context.sourceEventId = Number(identity.slice("event:".length));
  const sourceAppId =
    typeof data.sourceAppId === "string" && data.sourceAppId.trim() ? data.sourceAppId.trim() : undefined;
  return {
    targetOwner,
    sender,
    sourceAppId,
    input: {
      kind: "message",
      data: {
        message: typeof data.content === "string" ? data.content : "",
        context,
      },
    },
    identity,
  };
}

export async function startAppInboxRuntime(options: StartAppInboxRuntimeOptions): Promise<AppInboxRuntime> {
  let taskAdmissionWorker = options.createTaskAdmissionWorker?.();
  let registrySnapshot = options.registry.snapshot();
  let loaded = options.registry.entries();
  if (loaded.some((entry) => (entry.definition.observers?.length ?? 0) > 0) && !options.observerContext) {
    throw new Error("Canonical App observers require an observer context factory");
  }
  let appDirById = new Map(loaded.map((entry) => [entry.definition.id, entry.appDir]));
  let loadedById = new Map(loaded.map((entry) => [entry.definition.id, entry]));
  let taskSubscriptionsByEventType = indexAppEventSelectors(loaded, (definition) => definition.tasks?.subscriptions);
  let observationsByEventType = indexAppEventSelectors(loaded, (definition) => definition.observations);
  const replaceRouteIndexes = (entries: LoadedAppDefinition[]): void => {
    loadedById = new Map(entries.map((entry) => [entry.definition.id, entry]));
    taskSubscriptionsByEventType = indexAppEventSelectors(entries, (definition) => definition.tasks?.subscriptions);
    observationsByEventType = indexAppEventSelectors(entries, (definition) => definition.observations);
  };
  const attachTask: AppTaskAttacher | undefined = options.attachTask
    ? (input) => {
        const appDir = appDirById.get(input.appId);
        if (!appDir) throw new Error(`Unknown App: ${input.appId}`);
        return options.attachTask!({ ...input, appDir });
      }
    : undefined;

  const pendingConversationUpdates = new Map<string, { appId: string; conversationId: string }>();
  let conversationUpdateHandle: ReturnType<typeof setTimeout> | null = null;
  const armConversationUpdate = (): void => {
    if (conversationUpdateHandle || pendingConversationUpdates.size === 0) return;
    conversationUpdateHandle = setTimeout(() => {
      conversationUpdateHandle = null;
      const entry = pendingConversationUpdates.entries().next().value as
        [string, { appId: string; conversationId: string }] | undefined;
      if (!entry) return;
      const [key, update] = entry;
      pendingConversationUpdates.delete(key);
      try {
        options.bus.emit({
          type: "conversation.updated",
          source: "app-inbox",
          owner: `app:${update.appId}`,
          data: update,
        });
      } catch (error) {
        // This is a level-triggered presentation wake; the Conversation is
        // already durable. A failed optional wake must not crash the Host.
        console.warn(
          `[app-inbox] Conversation update wake failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      armConversationUpdate();
    }, 1);
  };
  const notifyConversationUpdated = (appId: string, conversationId?: string): void => {
    const normalizedAppId = appId.trim();
    const normalizedConversationId = conversationId?.trim();
    if (!normalizedAppId || !normalizedConversationId) return;
    const key = `${normalizedAppId}\0${normalizedConversationId}`;
    pendingConversationUpdates.set(key, { appId: normalizedAppId, conversationId: normalizedConversationId });
    armConversationUpdate();
  };

  const emitConversationTaskChanged = (
    link: { appId: string; conversationId: string; topicId: string },
    taskRef: { appId: string; taskId: string },
    change: {
      idempotencyKey: string;
      attemptId?: string;
      closedGeneration?: number;
    },
  ): void => {
    // The source identity is enough. Admission reads the stored outcome;
    // the executing Task collects current Conversation context.
    if (taskRef.appId === link.appId && taskRef.taskId === conversationTaskId(link.appId, link.conversationId)) return;
    if (!change.attemptId && change.closedGeneration === undefined) return;
    options.bus.emit({
      type: "conversation.task.changed",
      source: "app-task",
      owner: `app:${link.appId}`,
      target: { appId: link.appId, project: link.appId },
      data: {
        appId: link.appId,
        conversationId: link.conversationId,
        topicId: link.topicId,
        taskRef,
        ...(change.attemptId ? { attemptId: change.attemptId } : {}),
        ...(change.closedGeneration !== undefined ? { closedGeneration: change.closedGeneration } : {}),
      },
      idempotencyKey: change.idempotencyKey,
    } as unknown as AgentEvent);
  };
  const host = new AppInboxHost({
    db: options.db,
    apps: loaded.map((entry) => entry.definition),
    attachTask,
    admitConversation: options.admitConversation,
    stopConversationTurn: options.stopConversationTurn,
    readDependency: options.readDependency
      ? async (input) => {
          const appDir = appDirById.get(input.appId);
          if (!appDir) return null;
          return options.readDependency!({ ...input, appDir });
        }
      : undefined,
    now: options.now,
    onFailure: (failure) => reportFailure(failure),
    onConversationChanged: notifyConversationUpdated,
    onRequestCompleted(item, result) {
      if (item.source.kind !== "app") return;
      options.bus.emit({
        type: "app.dependency.completed",
        source: `app-inbox:${item.appId}`,
        owner: `app:${item.source.id}`,
        data: {
          kind: "app",
          id: item.id,
          status: "done",
          summary: result.summary,
          ...(result.response ? { response: result.response } : {}),
          ...(result.result ? { result: result.result } : {}),
          ...(result.evidence ? { evidence: result.evidence } : {}),
          ...(item.waitingOn?.kind === "task" ? { taskId: item.waitingOn.id, appId: item.appId } : {}),
        },
      });
    },
  });
  let closed = false;
  let started = false;
  let startPromise: Promise<void> | null = null;
  const now = options.now ?? Date.now;
  const observerRuntime = createAppObserverRuntime({
    bus: options.bus,
    now,
    context: (appId, appDir) => {
      if (!options.observerContext) throw new Error(`App ${appId} observer context is unavailable`);
      return options.observerContext(appId, appDir);
    },
  });
  observerRuntime.replace(loaded);
  const scheduleProducer = createAppScheduleProducer({
    bus: options.bus,
    now,
    enabled: options.schedulesEnabled !== false,
  });
  scheduleProducer.replace(loaded);
  const reportFailure = (failure: AppInboxFailure): void => {
    try {
      options.bus.emit({
        type: "handler.failed",
        source: "app-inbox",
        owner: failure.appId ? `app:${failure.appId}` : "runtime",
        data: { handler: "app-inbox", durationMs: 0, ...failure, agent: normalizedAgent(failure.agent) ?? "runtime" },
      });
    } catch (reportError) {
      // Logging is independent of event persistence and contains subscriber errors.
      log("error", `[app-inbox] ${JSON.stringify(failure)}; reporting failed: ${String(reportError)}`);
    }
  };
  const reportRuntimeFailure = (
    stage: string,
    error: unknown,
    appId?: string,
    agent = loaded.find(({ definition }) => definition.id === appId)?.definition.agent,
  ): void => {
    reportFailure({
      appId,
      agent,
      stage,
      error: error instanceof Error ? error.message : String(error),
      disposition: "recovery-pending",
    });
  };
  let inputRecovery: Promise<void> | null = null;
  const inputRecoveryIntervalMs = Math.max(60_000, options.scanIntervalMs ?? 5_000);
  let nextInputRecoveryAt = 0;
  const recoverInputs = (): Promise<void> => {
    if (inputRecovery) return inputRecovery;
    nextInputRecoveryAt = now() + inputRecoveryIntervalMs;
    const current = new Promise<void>((resolve) => setTimeout(resolve, 0))
      .then(async () => {
        if (closed) return;
        await host.recoverAdmissions();
        if (!closed) await host.recoverTaskResults();
      })
      .catch((error) => reportRuntimeFailure("dependency-recovery", error))
      .finally(() => {
        if (inputRecovery === current) inputRecovery = null;
      });
    inputRecovery = current;
    return current;
  };

  const recoverNow = () => {
    if (closed || !started) return;
    const currentTime = now();
    if (currentTime >= nextInputRecoveryAt) void recoverInputs();
    recoverAdmissionPlans();
  };

  const scanNow = () => {
    if (closed || !started) return;
    scheduleProducer.scanNow();
    observerRuntime.scanNow();
    recoverNow();
  };

  const admissionRouteLabel = (command: AppEventAdmissionCommand): string =>
    `${command.kind}:${command.appId}/${command.routeId}`;

  const admissionPlanDelivery = (plan: AppEventAdmissionPlan, note: string): DeliveryResult => ({
    accepted: true,
    by: `app-runtime:events:${plan.commands.map(admissionRouteLabel).join(",")}`,
    route: "direct",
    note: `registry-snapshot:${plan.registrySnapshotId}; generation:${plan.registryGeneration}; ${plan.commands.length} frozen App admission command(s) ${note}`,
  });

  const dispatchAdmissionCommand = async (
    plan: AppEventAdmissionPlan,
    command: AppEventAdmissionCommand,
    event: AgentEvent,
  ): Promise<void> => {
    const identity = `event:${plan.eventId}`;
    try {
      const entry = loaded.find(({ definition }) => definition.id === command.appId);
      if (!entry) {
        throw new Error(
          `Frozen ${admissionRouteLabel(command)} for ${identity} names an App unavailable after registry snapshot ${plan.registrySnapshotId} (generation ${plan.registryGeneration})`,
        );
      }
      if (command.kind === "inbox") {
        host.admit({
          appId: command.appId,
          source: { kind: "system", id: identity },
          input: command.input,
          originEventId: plan.eventId,
          idempotencyKey: `subscription:${command.appId}:${command.routeId}:${identity}`,
        });

      }
      if (command.kind !== "inbox" || command.conditionTaskIds.length > 0) {
        if (!entry.definition.tasks) {
          throw new Error(
            `Frozen ${admissionRouteLabel(command)} for ${identity} names an App without its selected task capability`,
          );
        }
        if (!options.admitTaskEvent) {
          throw new Error(`Canonical App ${command.appId} task admission is unavailable`);
        }
        if (command.kind === "task" && taskAdmissionWorker) {
          const worker = taskAdmissionWorker;
          let admitted: { taskIds: string[]; supersededSessionIds: string[] };
          try {
            admitted = await worker.dispatch(command, event);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
              !closed &&
              taskAdmissionWorker === worker &&
              (message.startsWith("Task admission worker ") || message.startsWith("Invalid Task admission worker "))
            ) {
              worker.close();
              taskAdmissionWorker = options.createTaskAdmissionWorker?.();
            }
            throw error;
          }
          options.wakeAdmittedTasks?.({ appId: command.appId, ...admitted });
        } else {
          const delivery = options.admitTaskEvent({
            appId: command.appId,
            appDir: entry.appDir,
            event,
            intent: command.kind === "task" ? command.intent : null,
            ...(command.kind === "exact-task" ? { targetedTaskId: command.targetedTaskId } : {}),
            conditionTaskIds: command.conditionTaskIds,
          });
          if (!delivery) {
            throw new Error(`Canonical App ${command.appId} did not durably admit frozen ${command.routeId}`);
          }
        }
      }
      markAppEventAdmissionCommandAdmitted(options.db, {
        eventId: plan.eventId,
        appId: command.appId,
        now: now(),
      });
    } catch (error) {
      recordAppEventAdmissionCommandFailure(options.db, {
        eventId: plan.eventId,
        appId: command.appId,
        error,
        now: now(),
      });
      throw error;
    }
  };

  const pendingAdmissionEvents = new Map<number, AgentEvent>();
  let admissionDispatchHandle: ReturnType<typeof setTimeout> | null = null;
  let admissionDispatching = false;

  const scheduleAdmissionDispatch = (plan: AppEventAdmissionPlan, event: AgentEvent): void => {
    if (plan.status !== "pending" || pendingAdmissionEvents.has(plan.eventId)) return;
    pendingAdmissionEvents.set(plan.eventId, event);
    if (!admissionDispatchHandle) {
      admissionDispatchHandle = setTimeout(dispatchNextAdmissionCommand, ADMISSION_COMMAND_TURN_GAP_MS);
    }
  };

  async function dispatchNextAdmissionCommand(): Promise<void> {
    admissionDispatchHandle = null;
    if (closed || admissionDispatching) return;
    const next = pendingAdmissionEvents.entries().next().value as [number, AgentEvent] | undefined;
    if (!next) return;
    const [eventId, event] = next;
    admissionDispatching = true;
    let reschedule: AppEventAdmissionPlan | null = null;
    try {
      const plan = getAppEventAdmissionPlan(options.db, eventId);
      if (plan?.status === "pending") {
        const command = plan.commands.find((candidate) => candidate.status === "pending");
        if (command) {
          try {
            await dispatchAdmissionCommand(plan, command, event);
          } catch {
            // The durable command retains the error for bounded recovery. A
            // failed handler must not prevent unrelated plans from advancing.
          }
        }
        const updated = getAppEventAdmissionPlan(options.db, eventId);
        if (updated?.status === "pending") {
          const pendingCommands = updated.commands.filter((candidate) => candidate.status === "pending");
          if (pendingCommands.length === 0) {
            completeAppEventAdmissionPlan(options.db, eventId, now());
          } else if (pendingCommands.some((candidate) => !candidate.lastError)) {
            reschedule = updated;
          }
        }
      }
    } catch {
      // The journal remains authoritative; bounded recovery will retry a
      // transient coordinator read without blocking other Event plans.
    } finally {
      // Keep the Event present while its command runs so nested Event delivery
      // cannot schedule the same plan twice.
      pendingAdmissionEvents.delete(eventId);
      admissionDispatching = false;
    }
    if (reschedule) scheduleAdmissionDispatch(reschedule, event);
    if (pendingAdmissionEvents.size > 0 && !admissionDispatchHandle) {
      admissionDispatchHandle = setTimeout(dispatchNextAdmissionCommand, ADMISSION_COMMAND_TURN_GAP_MS);
    }
  }

  const admitAdmissionPlan = (plan: AppEventAdmissionPlan, event: AgentEvent): DeliveryResult => {
    if (plan.status === "superseded") {
      throw new Error(`Frozen App admission plan for event:${plan.eventId} is superseded`);
    }
    // An exact wake is already resolved. Persist its bounded Task update here;
    // broad App admission or a busy worker must not gate reconciliation liveness.
    if (plan.status === "pending" && plan.commands.every((command) => command.kind === "exact-task")) {
      for (const command of plan.commands) {
        if (command.status !== "pending") continue;
        try {
          const entry = loaded.find(({ definition }) => definition.id === command.appId);
          if (!entry || command.kind !== "exact-task" || !options.admitTaskEvent) {
            throw new Error(`Canonical App ${command.appId} exact Task admission is unavailable`);
          }
          const delivery = options.admitTaskEvent({
            appId: command.appId,
            appDir: entry.appDir,
            event,
            intent: null,
            targetedTaskId: command.targetedTaskId,
            conditionTaskIds: command.conditionTaskIds,
          });
          if (!delivery)
            throw new Error(`Canonical App ${command.appId} did not durably admit frozen ${command.routeId}`);
          markAppEventAdmissionCommandAdmitted(options.db, { eventId: plan.eventId, appId: command.appId, now: now() });
        } catch (error) {
          recordAppEventAdmissionCommandFailure(options.db, {
            eventId: plan.eventId,
            appId: command.appId,
            error,
            now: now(),
          });
          throw error;
        }
      }
      if (!completeAppEventAdmissionPlan(options.db, plan.eventId, now())) {
        throw new Error(`Frozen App admission plan for event:${plan.eventId} still has pending commands`);
      }
      return admissionPlanDelivery(getAppEventAdmissionPlan(options.db, plan.eventId) ?? plan, "admitted durably");
    }
    scheduleAdmissionDispatch(plan, event);
    return admissionPlanDelivery(
      plan,
      plan.status === "completed" ? "already admitted durably" : "routing recorded durably",
    );
  };

  let nextAdmissionRecoveryAt = 0;
  let admissionRecoveryHandle: ReturnType<typeof setTimeout> | null = null;
  const recoverAdmissionPlans = (force = false): void => {
    const currentTime = now();
    if (admissionRecoveryHandle || (!force && currentTime < nextAdmissionRecoveryAt)) return;
    nextAdmissionRecoveryAt = currentTime + ADMISSION_RECOVERY_INTERVAL_MS;
    // Freeze this bounded recovery slice before yielding. Otherwise the
    // zero-delay callback can accidentally capture and immediately retry a
    // plan created by a newer Event turn.
    const plans = listPendingAppEventAdmissionPlans(options.db, {
      ...(force ? {} : { updatedBefore: currentTime - ADMISSION_RECOVERY_INTERVAL_MS }),
      limit: ADMISSION_RECOVERY_BATCH_SIZE,
    });
    admissionRecoveryHandle = setTimeout(() => {
      admissionRecoveryHandle = null;
      if (closed) return;
      let index = 0;
      const recoverNext = (): void => {
        admissionRecoveryHandle = null;
        if (closed) return;
        const plan = plans[index++];
        if (!plan) return;
        const event = loadPersistedEvent(options.db, plan.eventId, options.persistDir);
        if (!event) {
          for (const command of plan.commands) {
            if (command.status !== "pending") continue;
            recordAppEventAdmissionCommandFailure(options.db, {
              eventId: plan.eventId,
              appId: command.appId,
              error: new Error(`Frozen App admission event ${plan.eventId} is unavailable`),
              now: now(),
            });
          }
        } else {
          // EventBus re-runs only idempotent durable routes and records delivery
          // acceptance on the original row; ordinary subscribers never replay.
          options.bus.redeliverPersisted(event, plan.eventId);
        }
        if (index < plans.length) admissionRecoveryHandle = setTimeout(recoverNext, 0);
      };
      recoverNext();
    }, 0);
  };

  const unsubscribe = options.bus.subscribeDurableRoute(
    (event): DeliveryResult | void => {
      const routeSnapshot = registrySnapshot;
      const routeGeneration = routeSnapshot.generation;
      const data = eventData(event);
      // These facts signal state already committed by the Task runtime. They
      // must not become new input through generic exact-target admission.
      if (event.type === "app.task.ready" || event.type === "app.task.attempt.stopped")
        return { accepted: true, by: "task-runtime-notification", route: "direct" };
      if (String(event.type) === "project.task.reconcile.started" || String(event.type) === "project.task.reconciled") {
        const rows = options.db.prepare(`SELECT DISTINCT conversation_id FROM app_inbox_items
          WHERE app_id = ? AND conversation_id IS NOT NULL AND
            (execution_task_id = ? OR (waiting_on_kind = 'task' AND waiting_on_id = ?))`)
          .all(String(data.project ?? ""), String(data.taskId ?? ""), String(data.taskId ?? ""));
        for (const row of rows) notifyConversationUpdated(String(data.project), String(row.conversation_id));
      }
      let dependencyWakeDelivery: DeliveryResult | undefined;
      if (event.type === "conversation.turn.stop.requested") {
        host.stopTurn({
          appId: String(data.appId ?? ""),
          conversationId: String(data.conversationId ?? ""),
          turnId: String(data.turnId ?? ""),
          expectedRevision: Number(data.expectedRevision),
        });
        return { accepted: true, by: "conversation-turn-control", route: "direct" };
      }
      const message = addressedAgentMessage(event);
      if (message) {
        const candidates = host.matchingAppIds(message.targetOwner, message.input);
        if (candidates.length === 1) {
          const admitted = host.admit({
            appId: candidates[0]!,
            source:
              message.sourceAppId && host.isOwnedApp(message.sourceAppId, message.sender)
                ? { kind: "app", id: message.sourceAppId }
                : { kind: "system", id: message.identity },
            input: message.input,
            originEventId: eventRowId(event),
            channel: `agent:${message.sender}`,
            idempotencyKey: message.identity,
          });

          return {
            accepted: true,
            by: `app-inbox:${admitted.item.appId}:message`,
            route: "direct",
            note: "addressed agent message admitted to App inbox",
          };
        }
        throw new Error(
          candidates.length === 0
            ? `Addressed agent message ${message.identity} names no canonical App owned by ${message.targetOwner}`
            : `Addressed agent message ${message.identity} is ambiguous across Apps owned by ${message.targetOwner}`,
        );
      }
      if (event.type === "conversation.message.created") {
        const appId = typeof data.appId === "string" ? data.appId.trim() : "";
        const conversationId = typeof data.conversationId === "string" ? data.conversationId.trim() : "";
        const author =
          data.author && typeof data.author === "object" && !Array.isArray(data.author)
            ? (data.author as Record<string, unknown>)
            : {};
        const authorKind = typeof author.kind === "string" ? author.kind.trim() : "";
        const authorId = typeof author.id === "string" ? author.id.trim() : "";
        const text = typeof data.text === "string" ? data.text.trim() : "";
        if (!appId || !conversationId || !authorKind || !authorId || !text) {
          throw new Error("Conversation message is missing its App, conversation, author, or text");
        }
        if (authorKind === "human") {
          const metadata =
            data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
              ? (data.metadata as Record<string, unknown>)
              : {};
          const persistedEventId = eventRowId(event);
          const fallbackSequence =
            typeof metadata.channelMessageId === "number" && Number.isSafeInteger(metadata.channelMessageId)
              ? metadata.channelMessageId
              : undefined;
          // Preserve the surface's Topic as input context, not a committed turn decision.
          const context: Record<string, unknown> = {
            ...record(data.context),
            ...(typeof metadata.topicId === "string" && metadata.topicId.trim()
              ? { conversationTopicId: metadata.topicId.trim() }
              : {}),
          };
          const focusedTask = record(context.focusedTask);
          const focusedAppId =
            typeof focusedTask.appId === "string" ? focusedTask.appId.trim().replace(/\.app$/, "") : "";
          const focusedTaskId = typeof focusedTask.taskId === "string" ? focusedTask.taskId.trim() : "";
          const admitted = host.admit({
            appId,
            ...(focusedAppId === appId && focusedTaskId ? { targetTaskId: focusedTaskId } : {}),
            source: { kind: "human", id: authorId },
            input: {
              kind: "message",
              data: {
                message: text,
                ...(Object.keys(context).length ? { context } : {}),
              },
            },
            originEventId: persistedEventId,
            conversationId,
            conversationSequence: persistedEventId ?? fallbackSequence,
            channel: typeof metadata.channel === "string" ? metadata.channel : undefined,
            channelTargetId: typeof metadata.channelTargetId === "string" ? metadata.channelTargetId : undefined,
            channelThreadId: typeof metadata.channelThreadId === "string" ? metadata.channelThreadId : undefined,
            channelMessageId: typeof metadata.channelMessageId === "number" ? metadata.channelMessageId : undefined,
            replyToSourceId: typeof data.replyTo === "string" ? data.replyTo : undefined,
            idempotencyKey:
              typeof data.idempotencyKey === "string" && data.idempotencyKey.trim()
                ? data.idempotencyKey.trim()
                : eventIdentity(event),
          });

          notifyConversationUpdated(admitted.item.appId, admitted.item.conversationId);
          return { accepted: true, by: `conversation:${conversationId}:app-inbox:${admitted.item.appId}` };
        }
        if (data.transient !== true) notifyConversationUpdated(appId, conversationId);
        return {
          accepted: true,
          by: `conversation:${conversationId}`,
          route: "direct",
          note: data.transient === true ? "transient conversation transport" : "durable conversation context",
        };
      }
      if (String(event.type) === "conversation.supervision.review") {
        const appId = typeof data.project === "string" ? data.project.trim() : "";
        const limit = Math.min(100, Math.max(1, Math.floor(Number(data.limit) || 100)));
        if (!appId) throw new Error("Conversation supervision review requires its App");
        if (options.admitConversationChange) {
          const changes = listPendingConversationTaskChanges(options.db, appId, limit);
          for (const change of changes) {
            emitConversationTaskChanged(
              change,
              { appId: change.taskAppId, taskId: change.taskId },
              {
                ...change,
                idempotencyKey: `conversation-change-review:${eventRowId(event)}:${change.topicId}:${change.taskAppId}:${change.taskId}:${change.attemptId ?? `closed:${change.closedGeneration}`}`,
              },
            );
          }
          return {
            accepted: true,
            by: `conversation-changes:${appId}`,
            route: "direct",
            note: `${changes.length} missing change input(s) selected`,
          };
        }
        throw new Error("Conversation Task change admission is not configured");
      }
      if (String(event.type) === "conversation.task.changed") {
        if (!options.admitConversationChange) throw new Error("Conversation Task change admission is not configured");
        const ref = record(data.taskRef);
        if (
          [data.appId, data.conversationId, data.topicId, ref.appId, ref.taskId].every(
            (value) => typeof value === "string" && value.trim(),
          )
        ) {
          const admitted = options.admitConversationChange({
            appId: String(data.appId),
            conversationId: String(data.conversationId),
            topicId: String(data.topicId),
            taskAppId: String(ref.appId),
            taskId: String(ref.taskId),
            ...(typeof data.closedGeneration === "number" &&
            Number.isSafeInteger(data.closedGeneration) &&
            data.closedGeneration > 0
              ? { closedGeneration: data.closedGeneration }
              : { attemptId: typeof data.attemptId === "string" ? data.attemptId : "" }),
          });
          if (admitted)
            return {
              accepted: true,
              by: `conversation-task:${admitted.taskId}`,
              route: "direct",
              note: admitted.created
                ? "Stored Task change admitted as Conversation input"
                : "Task change already handled or unavailable",
            };
        }
        throw new Error("Conversation Task change has no available execution owner or exact stored outcome");
      }
      if (event.type === "app.input.requested") {
        const appId = typeof data.appId === "string" ? data.appId.trim() : "";
        const identity = eventIdentity(event);
        const admitted = host.admit({
          id: typeof data.requestId === "string" ? data.requestId.trim() || undefined : undefined,
          appId,
          source: inputSource(data.source, identity ?? `event:${event.type}`),
          input: requestedInput(data),
          originEventId: eventRowId(event),
          parentId: typeof data.parentId === "string" ? data.parentId : undefined,
          targetTaskId: typeof data.targetTaskId === "string" ? data.targetTaskId : undefined,
          conversationId: typeof data.conversationId === "string" ? data.conversationId : undefined,
          conversationSequence:
            typeof data.conversationId === "string"
              ? typeof data.conversationSequence === "number"
                ? data.conversationSequence
                : eventRowId(event)
              : undefined,
          channel: typeof data.channel === "string" ? data.channel : undefined,
          channelTargetId: typeof data.channelTargetId === "string" ? data.channelTargetId : undefined,
          channelThreadId: typeof data.channelThreadId === "string" ? data.channelThreadId : undefined,
          channelMessageId: typeof data.channelMessageId === "number" ? data.channelMessageId : undefined,
          replyToSourceId: typeof data.replyToSourceId === "string" ? data.replyToSourceId : undefined,
          idempotencyKey:
            typeof data.idempotencyKey === "string" && data.idempotencyKey.trim()
              ? data.idempotencyKey.trim()
              : identity,
        });

        return {
          accepted: true,
          by: `app-inbox:${admitted.item.appId}`,
          route: "direct",
          note: `request:${admitted.item.id}; ${admitted.created ? "created" : "existing"}`,
        };
      }
      if (event.type === "app.dependency.completed" || event.type === "app.dependency.updated") {
        const kind = data.kind;
        const id = typeof data.id === "string" ? data.id.trim() : "";
        if ((kind === "app" || kind === "task" || kind === "session") && id) {
          const taskAppId = kind === "task" && typeof data.appId === "string" ? data.appId.trim() : undefined;
          if (event.type === "app.dependency.updated" && kind === "task" && taskAppId) {
            for (const request of listAppInboxItemsWaitingOnTask(options.db, taskAppId, id)) {
              if (request.source.kind !== "app") continue;
              options.bus.emit({
                type: "app.dependency.updated",
                source: "app-inbox",
                owner: `app:${request.source.id}`,
                target: { appId: request.source.id, project: request.source.id },
                data: {
                  kind: "app",
                  id: request.id,
                  appId: request.source.id,
                  idempotencyKey: `app-request-updated:${request.id}:${eventRowId(event)}`,
                },
              } as unknown as AgentEvent);
            }
          }
          if (kind === "task") {
            const appIds = taskAppId ? [taskAppId] : host.appIds();
            for (const appId of appIds)
              void host.refreshTaskResults(appId, id).catch((error) => reportRuntimeFailure("input-result", error, appId));
          }
          // Project the input answer and continue canonical Task-Condition admission.
          dependencyWakeDelivery = { accepted: true, by: "app-inbox:wake" };
        }
      }
      if (String(event.type) === "project.task.reconciled" || event.type === "app.task.cancelled") {
        const closed = event.type === "app.task.cancelled";
        const sourceAppId = closed ? data.appId : data.project;
        const appId = typeof sourceAppId === "string" ? sourceAppId.trim() : "";
        const taskId = typeof data.taskId === "string" ? data.taskId.trim() : "";
        if (appId && taskId) {
          for (const link of listConversationTopicLinksForTask(options.db, appId, taskId)) {
            emitConversationTaskChanged(
              link,
              { appId, taskId },
              {
                ...(closed
                  ? { closedGeneration: Number(data.generation) }
                  : typeof data.attemptId === "string"
                    ? { attemptId: data.attemptId }
                    : {}),
                idempotencyKey: `conversation-task-changed:${link.topicId}:${appId}:${taskId}:${eventRowId(event) ?? data.generation ?? "unknown"}`,
              },
            );
          }
        }
        // Closure is already committed; its notification cannot become fresh Task input.
        if (closed) return { accepted: true, by: "task-runtime-notification", route: "direct" };
      }
      const identity = eventIdentity(event);
      if (identity) {
        const eventId = eventRowId(event)!;
        const frozenPlan = getAppEventAdmissionPlan(options.db, eventId);
        // A timed-out plan remains as immutable routing evidence, but it is no
        // longer admission authority. An explicit retry of the unhandled event
        // must not reclassify it or report the superseded commands as pending.
        if (frozenPlan) {
          if (frozenPlan.status === "superseded") return undefined;
          return admitAdmissionPlan(frozenPlan, event);
        }

        const canonical = canonicalAppEvent(event);
        const exactTarget = exactTaskTarget(canonical);
        if (exactTarget) {
          if (!exactTarget.appId) {
            throw new Error(
              `Exact task target ${exactTarget.taskId} for event ${identity} has no canonical App identity in registry generation ${routeGeneration}`,
            );
          }
          const entry = loadedById.get(exactTarget.appId);
          const tasks = entry?.definition.tasks;
          if (!entry) {
            throw new Error(
              `Exact task target ${exactTarget.appId}/${exactTarget.taskId} for event ${identity} names an unknown canonical App in registry generation ${routeGeneration}`,
            );
          }
          if (!tasks) {
            throw new Error(
              `Exact task target ${exactTarget.appId}/${exactTarget.taskId} for event ${identity} names an App without task capability in registry generation ${routeGeneration}`,
            );
          }
          if (
            taskAdmissionWorker &&
            options.hasTaskTarget &&
            !options.hasTaskTarget({ appId: exactTarget.appId, taskId: exactTarget.taskId })
          ) {
            throw new Error(
              `Exact task target ${exactTarget.appId}/${exactTarget.taskId} for event ${identity} does not exist`,
            );
          }
          const conditionTaskIds =
            options.previewTaskEvent?.({
              appId: entry.definition.id,
              appDir: entry.appDir,
              event,
              targetedTaskId: exactTarget.taskId,
            }) ?? [];
          const plan = createAppEventAdmissionPlan(options.db, {
            eventId,
            registrySnapshotId: routeSnapshot.id,
            registryGeneration: routeGeneration,
            routes: [
              {
                appId: entry.definition.id,
                kind: "exact-task",
                routeId: exactTarget.taskId,
                targetedTaskId: exactTarget.taskId,
                conditionTaskIds,
              },
            ],
            now: now(),
          });
          return admitAdmissionPlan(plan, event);
        }

        const inboxMatches = host.subscriptionInputs(canonical);
        const inboxCountByApp = new Map<string, number>();
        for (const match of inboxMatches) {
          inboxCountByApp.set(match.appId, (inboxCountByApp.get(match.appId) ?? 0) + 1);
        }
        const duplicateInboxApp = [...inboxCountByApp].find(([, count]) => count > 1)?.[0];
        if (duplicateInboxApp) {
          throw new Error(`Canonical App ${duplicateInboxApp} has multiple inbox routes for event ${identity}`);
        }

        const conditionTaskIdsByApp = new Map<string, Set<string>>();
        for (const match of options.previewTaskEventRoutes?.({ event }) ?? []) {
          if (!loadedById.get(match.appId)?.definition.tasks) continue;
          const taskIds = conditionTaskIdsByApp.get(match.appId) ?? new Set<string>();
          for (const taskId of match.taskIds) taskIds.add(taskId);
          conditionTaskIdsByApp.set(match.appId, taskIds);
        }
        const taskCandidates = new Map(
          (options.previewTaskEventRoutes ? (taskSubscriptionsByEventType.get(canonical.type) ?? []) : loaded).map(
            (entry) => [entry.definition.id, entry],
          ),
        );
        for (const appId of conditionTaskIdsByApp.keys()) {
          const entry = loadedById.get(appId);
          if (entry) taskCandidates.set(appId, entry);
        }
        const taskAdmissions = [...taskCandidates.values()].flatMap(({ definition, appDir }) => {
          const tasks = definition.tasks;
          if (!tasks) return [];
          const subscriptionMatched = Boolean(
            tasks.subscriptions?.some((selector) => matchesEventSelector(selector, canonical)),
          );
          let intent: TaskIntent | null = null;
          if (subscriptionMatched) {
            try {
              intent = tasks.resolve?.(canonical) ?? null;
            } catch (error) {
              throw new Error(
                `Canonical App ${definition.id} task resolver failed for event ${identity} in registry generation ${routeGeneration}: ${error instanceof Error ? error.message : String(error)}`,
                { cause: error },
              );
            }
          }
          const conditionTaskIds = options.previewTaskEventRoutes
            ? [...(conditionTaskIdsByApp.get(definition.id) ?? [])].sort()
            : (options.previewTaskEvent?.({ appId: definition.id, appDir, event }) ?? []);
          return intent || conditionTaskIds.length > 0
            ? [{ appId: definition.id, appDir, intent, conditionTaskIds }]
            : [];
        });
        const inboxApps = new Set(inboxMatches.map((match) => match.appId));
        const overlap = taskAdmissions.find((admission) => admission.intent && inboxApps.has(admission.appId));
        if (overlap) {
          throw new Error(`Canonical App ${overlap.appId} has both inbox and task-intent routes for event ${identity}`);
        }
        const taskAdmissionByApp = new Map(taskAdmissions.map((admission) => [admission.appId, admission]));

        const routes: AppEventAdmissionRoute[] = [
          ...inboxMatches.map((match) => ({
            appId: match.appId,
            kind: "inbox" as const,
            routeId: match.subscriptionId,
            input: match.input,
            conditionTaskIds: taskAdmissionByApp.get(match.appId)?.conditionTaskIds ?? [],
          })),
          ...taskAdmissions
            .filter((admission) => !inboxApps.has(admission.appId))
            .map((admission) => ({
              appId: admission.appId,
              kind: "task" as const,
              routeId: admission.intent?.id ?? admission.conditionTaskIds.join("+"),
              intent: admission.intent,
              conditionTaskIds: admission.conditionTaskIds,
            })),
        ];
        if (routes.length > 0) {
          const plan = createAppEventAdmissionPlan(options.db, {
            eventId,
            registrySnapshotId: routeSnapshot.id,
            registryGeneration: routeGeneration,
            routes,
            now: now(),
          });
          return admitAdmissionPlan(plan, event);
        }

        const observationApps = (observationsByEventType.get(canonical.type) ?? [])
          .filter(({ definition }) =>
            definition.observations?.some((selector) => matchesEventSelector(selector, canonical)),
          )
          .map(({ definition }) => definition.id);
        if (observationApps.length > 0) {
          return {
            accepted: true,
            by: `app-runtime:observations:${observationApps.join(",")}`,
            route: "noop",
            note: `registry-snapshot:${routeSnapshot.id}; generation:${routeGeneration}; zero work routes selected`,
          };
        }
      }
      return dependencyWakeDelivery;
    },
    { label: "app-inbox-route" },
  );
  // Events schedule normal work immediately. This interval is recovery
  // insurance for lost in-memory request wakes; producer cadence is separate. It
  // must not turn the App inbox into an ordinary five-second polling loop.
  const scanIntervalMs = options.scanIntervalMs ?? 60_000;
  if (!Number.isFinite(scanIntervalMs) || scanIntervalMs <= 0) {
    unsubscribe();
    throw new Error("App inbox scanIntervalMs must be positive");
  }
  const timer = new OwnedTimer("app-runtime:recovery");
  const initialRecovery = new OwnedTimer("app-runtime:initial-recovery");
  const scanFromTimer = () => {
    try {
      recoverNow();
    } catch (error) {
      // A failed storage read/recovery scan must not escape a timer callback
      // and terminate unrelated work. Durable state is recollected next scan.
      reportRuntimeFailure("input-recovery", error);
    }
  };
  const runtime: AppInboxRuntime = {
    host,
    start() {
      if (closed) return Promise.resolve();
      if (startPromise) return startPromise;
      started = true;
      // Recovery is scheduled behind admission. It must not delay the caller
      // that opens the human interface or activates this message handler.
      void recoverInputs();
      recoverAdmissionPlans(true);
      timer.every(scanIntervalMs, scanFromTimer);
      initialRecovery.after(0, scanFromTimer);
      scheduleProducer.start(scanIntervalMs);
      observerRuntime.start(scanIntervalMs);
      startPromise = Promise.resolve();
      return startPromise;
    },
    scanNow,
    async reload(prepare, discover) {
      await options.registry.reload(async (snapshot) => {
        const previousLoaded = loaded;
        const previousSnapshot = registrySnapshot;
        if (
          snapshot.entries.some((entry) => (entry.definition.observers?.length ?? 0) > 0) &&
          !options.observerContext
        ) {
          throw new Error("Canonical App observers require an observer context factory");
        }
        let committed = false;
        let restoreSchedules = () => {};
        const commit = () => {
          if (committed) throw new Error(`App registry generation ${snapshot.generation} was committed twice`);
          committed = true;
          const entries = snapshot.entries.map((entry) => ({ appDir: entry.appDir, definition: entry.definition }));
          host.replaceApps(entries.map((entry) => entry.definition));
          loaded = entries;
          registrySnapshot = snapshot;
          appDirById = new Map(entries.map((entry) => [entry.definition.id, entry.appDir]));
          replaceRouteIndexes(entries);
          observerRuntime.replace(entries);
          restoreSchedules = scheduleProducer.replace(entries);
        };
        try {
          if (prepare) await prepare({ snapshot, commit });
          else commit();
          if (!committed) throw new Error(`App registry generation ${snapshot.generation} was not committed`);
        } catch (error) {
          if (committed) {
            host.replaceApps(previousLoaded.map((entry) => entry.definition));
            loaded = previousLoaded;
            registrySnapshot = previousSnapshot;
            appDirById = new Map(previousLoaded.map((entry) => [entry.definition.id, entry.appDir]));
            replaceRouteIndexes(previousLoaded);
            observerRuntime.replace(previousLoaded);
            restoreSchedules();
          }
          throw error;
        }
      }, discover);
      taskAdmissionWorker?.close();
      taskAdmissionWorker = options.createTaskAdmissionWorker?.();
      // App definitions may have made a previously unavailable frozen route
      // admissible. Retry one bounded slice immediately after the reload.
      recoverAdmissionPlans(true);
      scanNow();
      return host.appIds();
    },
    close() {
      if (closed) return;
      closed = true;
      host.close();
      timer.close();
      initialRecovery.close();
      if (admissionRecoveryHandle) clearTimeout(admissionRecoveryHandle);
      admissionRecoveryHandle = null;
      if (admissionDispatchHandle) clearTimeout(admissionDispatchHandle);
      admissionDispatchHandle = null;
      pendingAdmissionEvents.clear();
      taskAdmissionWorker?.close();
      taskAdmissionWorker = undefined;
      if (conversationUpdateHandle) clearTimeout(conversationUpdateHandle);
      conversationUpdateHandle = null;
      pendingConversationUpdates.clear();
      observerRuntime.close();
      scheduleProducer.close();
      unsubscribe();
    },
  };
  if (!options.deferStart) await runtime.start();
  return runtime;
}
