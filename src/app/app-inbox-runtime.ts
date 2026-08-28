import { createHash } from "node:crypto";
import {
  matchesEventSelector,
  type AppDependencyObservation,
  type AppEvent,
  type AppInput,
  type AppInputSource,
  type AppRequest,
  type EventSelector,
  type ObserverContext,
  type TaskIntent,
} from "@may-agent/sdk";
import type { SqliteDb } from "../lib/db.js";
import { readJsonArtifactWithDescriptor } from "../lib/artifacts.js";
import {
  EVENT_RECORD_ONLY,
  EVENT_ROW_ID,
  eventData,
  type AgentEvent,
  type DeliveryResult,
  type EventBus,
} from "./event-bus.js";
import {
  AppInboxHost,
  type AppInboxReconcileResult,
  type AppRequestResolver,
  type AppRequestTaskController,
  type AppTaskAttacher,
} from "./app-inbox-host.js";
import {
  linkConversationTopicTask,
  listConversationTopicLinksForTask,
  listStaleConversationTopicTasks,
  listAppInboxItemsWaitingOnTask,
  listHumanAppInboxItemsWaitingOnAppRequest,
  listHumanAppInboxItemsWaitingOnTask,
  readAppConversationResource,
  readConversationTopic,
  type AppInboxItem,
} from "./app-inbox-store.js";
import type { AppRegistry, AppRegistrySnapshot } from "./app-registry.js";
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
} from "./app-event-admission-store.js";
import { createAppObserverRuntime } from "./app-observer-runtime.js";
import { canonicalAppEvent } from "./canonical-app-event.js";
import type { HostCapacity } from "./host-capacity.js";
import type { LoadedAppDefinition } from "./loader/app-loader.js";

export type AppRegistryReloadPreparation = (input: {
  snapshot: AppRegistrySnapshot;
  /** Must be the final synchronous step after every other consumer commits. */
  commit: () => void;
}) => Promise<void>;

export type AppInboxRuntime = {
  host: AppInboxHost;
  /** Begin recovery, schedules, and request execution after interfaces are ready. */
  start(): Promise<void>;
  close(): void;
  scanNow(): void;
  reload(prepare?: AppRegistryReloadPreparation, projectsRoot?: string): Promise<string[]>;
};

// Admission normally completes on the event's synchronous durable-route pass.
// This recovery pass exists only for an interrupted or transiently failed
// pass, so it stays bounded and never becomes the normal work path.
const ADMISSION_RECOVERY_INTERVAL_MS = 60_000;
const ADMISSION_RECOVERY_BATCH_SIZE = 16;

function assignmentText(item: AppInboxItem): string {
  const data = item.input.data;
  const outcome =
    data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>).outcome : undefined;
  return typeof outcome === "string" && outcome.trim()
    ? `Assigned to ${item.appId}: ${outcome.trim()}`
    : `Assigned to ${item.appId}.`;
}

export type StartAppInboxRuntimeOptions = {
  registry: AppRegistry;
  db: SqliteDb;
  bus: EventBus;
  attachTask?: (input: Parameters<AppTaskAttacher>[0] & { appDir: string }) => ReturnType<AppTaskAttacher>;
  resolveRequest?: AppRequestResolver;
  controlTask?: AppRequestTaskController;
  admitTaskEvent?: (input: {
    appId: string;
    appDir: string;
    event: AgentEvent;
    intent: TaskIntent | null;
    targetedTaskId?: string;
    conditionTaskIds?: string[];
  }) => DeliveryResult | undefined;
  previewTaskEvent?: (input: { appId: string; appDir: string; event: AgentEvent; targetedTaskId?: string }) => string[];
  /** One event-type-first Condition lookup across all loaded Task Apps. */
  previewTaskEventRoutes?: (input: { event: AgentEvent }) => Array<{ appId: string; taskIds: string[] }>;
  readDependency?: (input: {
    appId: string;
    appDir: string;
    dependency: { kind: "task"; id: string };
  }) => Promise<AppDependencyObservation | null>;
  /** Shared Host capacity used by both request decisions and Task attempts. */
  hostCapacity: HostCapacity;
  /** Maximum request decisions admitted to shared Host capacity at once. */
  maxConcurrentRequests?: number;
  scanIntervalMs?: number;
  leaseMs?: number;
  retryAfterMs?: number;
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

function parseStoredEventData(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Rebuild the immutable event input needed to finish a plan after restart. */
function loadAdmissionEvent(db: SqliteDb, eventId: number, persistDir?: string): AgentEvent | null {
  const row = db
    .prepare(
      `SELECT event_type, source, owner, data, body_ref, body_sha256, body_bytes,
              session_id, project_id, task_id, timestamp, urgency, ttl_ms
       FROM events
       WHERE id = ?`,
    )
    .get(eventId);
  if (!row || typeof row.event_type !== "string") return null;

  let data = parseStoredEventData(row.data) ?? {};
  if (persistDir && typeof row.body_ref === "string" && row.body_ref.trim()) {
    const artifact = readJsonArtifactWithDescriptor<Record<string, unknown>>(persistDir, row.body_ref);
    if (
      artifact &&
      (!row.body_sha256 || artifact.descriptor.sha256 === row.body_sha256) &&
      (!row.body_bytes || artifact.descriptor.bytes === Number(row.body_bytes))
    ) {
      data = artifact.value;
    }
  }
  const appId =
    typeof data.appId === "string" && data.appId.trim()
      ? data.appId.trim()
      : typeof row.project_id === "string" && row.project_id.trim()
        ? row.project_id.trim()
        : undefined;
  const taskId = typeof row.task_id === "string" && row.task_id.trim() ? row.task_id.trim() : undefined;
  const sessionId = typeof row.session_id === "string" && row.session_id.trim() ? row.session_id.trim() : undefined;
  const target = { ...(appId ? { appId } : {}), ...(taskId ? { taskId } : {}), ...(sessionId ? { sessionId } : {}) };
  const event = {
    type: row.event_type,
    ...(typeof row.source === "string" ? { source: row.source } : {}),
    ...(typeof row.owner === "string" ? { owner: row.owner } : {}),
    ...(Object.keys(target).length > 0 ? { target } : {}),
    data,
    ...(typeof row.timestamp === "number" ? { timestamp: row.timestamp } : {}),
    ...(row.urgency === "low" || row.urgency === "normal" || row.urgency === "high" || row.urgency === "immediate"
      ? { urgency: row.urgency }
      : {}),
    ...(typeof row.ttl_ms === "number" ? { ttl_ms: row.ttl_ms } : {}),
  } as AgentEvent;
  Object.defineProperty(event, EVENT_ROW_ID, { value: eventId, configurable: true });
  return event;
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
    ? async (input) => {
        const appDir = appDirById.get(input.appId);
        if (!appDir) throw new Error(`Unknown App: ${input.appId}`);
        return options.attachTask!({ ...input, appDir });
      }
    : undefined;

  const notifyConversationUpdated = (appId: string, conversationId?: string): void => {
    const normalizedAppId = appId.trim();
    const normalizedConversationId = conversationId?.trim();
    if (!normalizedAppId || !normalizedConversationId) return;
    options.bus.emit({
      type: "conversation.updated",
      source: "app-inbox",
      owner: `app:${normalizedAppId}`,
      data: { appId: normalizedAppId, conversationId: normalizedConversationId },
    });
  };

  const emitConversationTaskChanged = (
    link: { appId: string; conversationId: string; topicId: string },
    taskRef: { appId: string; taskId: string },
    change: {
      followUpId: string;
      idempotencyKey: string;
      disposition?: string;
      summary?: string;
      reason?: string;
    },
  ): void => {
    const topic = readConversationTopic(options.db, link.appId, link.conversationId, link.topicId);
    const conversation = readAppConversationResource(options.db, link.appId, link.conversationId, {
      limit: 20,
      topicId: link.topicId,
    });
    options.bus.emit({
      type: "conversation.task.changed",
      source: change.reason ? "conversation-supervision-recovery" : "app-task",
      owner: `app:${link.appId}`,
      target: { appId: link.appId, project: link.appId },
      data: {
        appId: link.appId,
        conversationId: link.conversationId,
        topicId: link.topicId,
        followUpId: change.followUpId,
        taskRef,
        ...(change.disposition ? { disposition: change.disposition } : {}),
        ...(change.summary ? { summary: change.summary } : {}),
        ...(change.reason ? { reason: change.reason } : {}),
        topicTitle: topic?.title,
        messages: conversation.messages
          .filter((message) => message.metadata?.topicId === link.topicId)
          .slice(-12)
          .map((message) => ({
            messageId: message.id,
            author: message.author,
            text: message.text,
          })),
      },
      idempotencyKey: change.idempotencyKey,
    } as unknown as AgentEvent);
  };
  const oneItemPerConversationTask = (items: AppInboxItem[]): AppInboxItem[] => {
    const selected = new Map<string, AppInboxItem>();
    for (const item of items) {
      if (!item.conversationId || item.waitingOn?.kind !== "task") continue;
      const key = `${item.conversationId}\0${item.appId}\0${item.waitingOn.id}`;
      // Prefer the request that first linked this Conversation to the Task.
      // Later focused human turns steer the same Task; they are not additional
      // owners of its public output stream. Oldest-first order is the fallback
      // for Tasks that predate this Conversation.
      const current = selected.get(key);
      if (!current || (current.targetTaskId && !item.targetTaskId)) selected.set(key, item);
    }
    return [...selected.values()];
  };
  const host = new AppInboxHost({
    db: options.db,
    apps: loaded.map((entry) => entry.definition),
    attachTask,
    resolveRequest: options.resolveRequest,
    controlTask: options.controlTask,
    readDependency: options.readDependency
      ? async (input) => {
          const appDir = appDirById.get(input.appId);
          if (!appDir) return null;
          return options.readDependency!({ ...input, appDir });
        }
      : undefined,
    leaseMs: options.leaseMs,
    retryAfterMs: options.retryAfterMs,
    onConversationChanged: notifyConversationUpdated,
    onRequestDelegated(item) {
      schedule(item.appId);
    },
    onRequestMessage(item, text, topicId) {
      if (!item.conversationId) return;
      options.bus.emit({
        type: "conversation.message.created",
        source: "app-inbox",
        owner: `app:${item.appId}`,
        data: {
          appId: item.appId,
          conversationId: item.conversationId,
          messageId: `result:${item.id}`,
          author: { kind: "agent", id: item.appId },
          text,
          metadata: {
            channel: item.channel,
            channelTargetId: item.channelTargetId,
            channelThreadId: item.channelThreadId,
            requestId: item.id,
            topicId,
          },
          idempotencyKey: `conversation-request-message:${item.conversationId}:${item.id}`,
        },
      });
    },
    async onRequestFollowUp(item, followUp, topicId) {
      if (!item.conversationId) {
        throw new Error(`App follow-up ${item.id} requires a Conversation`);
      }
      const requestId = `appreq_${createHash("sha256")
        .update(`${item.id}\0follow-up`)
        .digest("hex")
        .slice(0, 24)}`;
      const target = loadedById.get(followUp.appId);
      if (!target?.definition.task || !target.definition.tasks) {
        throw new Error(`App follow-up targets non-Task App ${followUp.appId}`);
      }
      if (!attachTask) throw new Error("App follow-up Task admission is not configured");
      const source = { kind: "app" as const, id: item.appId };
      const request: AppRequest = {
        id: requestId,
        source,
        ...(item.source.kind === "human" ? { humanRequested: true } : {}),
        input: followUp.input,
      };
      const attachment = followUp.task
        ? ({ kind: "existing", taskId: followUp.task.taskId } as const)
        : target.definition.task({ id: requestId, source, input: followUp.input });
      if (!attachment) throw new Error(`App ${followUp.appId} returned no Task for conversational follow-up`);
      const attached = await attachTask({
        appId: followUp.appId,
        attachment,
        idempotencyKey: `conversation-follow-up:${item.appId}:${item.id}`,
        request,
      });
      linkConversationTopicTask(options.db, topicId, followUp.appId, attached.taskId, now());
      options.bus.emit({
        type: "conversation.message.created",
        source: "app-task-admission",
        owner: `app:${item.appId}`,
        data: {
          appId: item.appId,
          conversationId: item.conversationId,
          author: { kind: "tool", id: "runtime" },
          text: `Accepted durable work: ${followUp.outcome}`,
          metadata: {
            command: "task-admitted",
            channel: item.channel,
            channelTargetId: item.channelTargetId,
            channelThreadId: item.channelThreadId,
            requestId: item.id,
            topicId,
            taskRefs: [{ appId: followUp.appId, taskId: attached.taskId }],
            followTask: { appId: followUp.appId, taskId: attached.taskId },
          },
          idempotencyKey: `conversation-task-assigned:${item.conversationId}:${requestId}:${followUp.appId}:${attached.taskId}`,
        },
      });
      options.bus.emit({
        type: "conversation.task.linked",
        source: "app-inbox",
        owner: `app:${item.appId}`,
        target: { appId: item.appId, project: item.appId },
        data: {
          appId: item.appId,
          conversationId: item.conversationId,
          topicId,
          requestId,
          taskRef: { appId: followUp.appId, taskId: attached.taskId },
        },
        idempotencyKey: `conversation-task-linked:${item.conversationId}:${topicId}:${followUp.appId}:${attached.taskId}`,
      } as unknown as AgentEvent);
    },
    onRequestTaskAttached(item, taskId) {
      if (item.source.kind !== "app") return;
      if (item.conversationId && item.topicId && !item.parentId) {
        options.bus.emit({
          type: "conversation.message.created",
          source: "app-task-admission",
          owner: `app:${item.source.id}`,
          data: {
            appId: item.source.id,
            conversationId: item.conversationId,
            author: { kind: "tool", id: "runtime" },
            text: assignmentText(item),
            metadata: {
              channel: item.channel,
              channelTargetId: item.channelTargetId,
              channelThreadId: item.channelThreadId,
              requestId: item.replyToSourceId ?? item.id,
              topicId: item.topicId,
              taskRefs: [{ appId: item.appId, taskId }],
              followTask: { appId: item.appId, taskId },
            },
            idempotencyKey: `conversation-task-assigned:${item.conversationId}:${item.id}:${item.appId}:${taskId}`,
          },
        });
        options.bus.emit({
          type: "conversation.task.linked",
          source: "app-inbox",
          owner: `app:${item.source.id}`,
          target: { appId: item.source.id, project: item.source.id },
          data: {
            appId: item.source.id,
            conversationId: item.conversationId,
            topicId: item.topicId,
            requestId: item.id,
            taskRef: { appId: item.appId, taskId },
          },
          idempotencyKey: `conversation-task-linked:${item.conversationId}:${item.topicId}:${item.appId}:${taskId}`,
        } as unknown as AgentEvent);
        return;
      }
      const directParent = item.parentId ? host.get(item.parentId) : null;
      if (directParent?.conversationId) {
        options.bus.emit({
          type: "conversation.message.created",
          source: "app-inbox",
          owner: `app:${directParent.appId}`,
          data: {
            appId: directParent.appId,
            conversationId: directParent.conversationId,
            author: { kind: "agent", id: directParent.appId },
            text: assignmentText(item),
            metadata: {
              channel: directParent.channel,
              channelTargetId: directParent.channelTargetId,
              channelThreadId: directParent.channelThreadId,
              requestId: directParent.id,
              ...(item.topicId ? { topicId: item.topicId } : {}),
              taskRefs: [{ appId: item.appId, taskId }],
              followTask: { appId: item.appId, taskId },
            },
            idempotencyKey: `conversation-task-assigned:${directParent.conversationId}:${directParent.id}:${item.appId}:${taskId}`,
          },
        });
        return;
      }
      for (const parent of oneItemPerConversationTask(listHumanAppInboxItemsWaitingOnAppRequest(options.db, item.id))) {
        const parentTaskId = parent.waitingOn?.kind === "task" ? parent.waitingOn.id : undefined;
        if (!parent.conversationId || !parentTaskId) continue;
        options.bus.emit({
          type: "conversation.message.created",
          source: "app-inbox",
          owner: `app:${parent.appId}`,
          data: {
            appId: parent.appId,
            conversationId: parent.conversationId,
            author: { kind: "agent", id: parent.appId },
            text: assignmentText(item),
            metadata: {
              channel: parent.channel,
              channelTargetId: parent.channelTargetId,
              channelThreadId: parent.channelThreadId,
              requestId: parent.id,
              taskRefs: [
                { appId: parent.appId, taskId: parentTaskId },
                { appId: item.appId, taskId },
              ],
              followTask: { appId: item.appId, taskId },
            },
            idempotencyKey: `conversation-task-assigned:${parent.conversationId}:${parent.appId}:${parentTaskId}:${item.appId}:${taskId}`,
          },
        });
      }
    },
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
  const active = new Map<string, number>();
  const dirty = new Set<string>();
  const pending: string[] = [];
  const queued = new Set<string>();
  let pumpHandle: ReturnType<typeof setTimeout> | null = null;
  const maxConcurrentRequests = options.maxConcurrentRequests ?? 2;
  if (!Number.isSafeInteger(maxConcurrentRequests) || maxConcurrentRequests <= 0) {
    throw new Error("App request concurrency must be a positive safe integer");
  }
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
  const scheduleActivations = new Map<string, { fingerprint: string; activatedAt: number; lastSlot?: number }>();

  const refreshScheduleActivations = (): void => {
    const activeKeys = new Set<string>();
    for (const { definition } of loaded) {
      for (const schedule of definition.schedules ?? []) {
        const key = `${definition.id}/${schedule.id}`;
        activeKeys.add(key);
        const fingerprint = JSON.stringify({
          intervalMs: schedule.intervalMs,
          ...(schedule.input
            ? { input: schedule.input, catchUp: schedule.catchUp ?? "latest" }
            : { event: schedule.event }),
          enabled: schedule.enabled !== false,
        });
        if (scheduleActivations.get(key)?.fingerprint !== fingerprint) {
          const activatedAt = now();
          scheduleActivations.set(key, {
            fingerprint,
            activatedAt,
            ...(!schedule.input ? { lastSlot: Math.floor(activatedAt / schedule.intervalMs) } : {}),
          });
        }
      }
    }
    for (const key of scheduleActivations.keys()) {
      if (!activeKeys.has(key)) scheduleActivations.delete(key);
    }
  };
  refreshScheduleActivations();

  const report = (appId: string, outcome: AppInboxReconcileResult) => {
    if (outcome.errors.length === 0) return;
    options.bus.emit({
      type: "info",
      message: `[app-inbox:${appId}] ${outcome.errors.join("; ")}`,
    });
  };

  const armPump = (): void => {
    if (closed || !started || pumpHandle) return;
    pumpHandle = setTimeout(() => {
      pumpHandle = null;
      pump();
    }, 0);
  };

  const pump = (): void => {
    const activeCount = () => [...active.values()].reduce((total, count) => total + count, 0);
    if (closed) return;
    const totalActive = activeCount();
    const foregroundActive = active.get("may") ?? 0;
    const backgroundActive = totalActive - foregroundActive;
    const backgroundLimit = maxConcurrentRequests === 1 ? 1 : maxConcurrentRequests - 1;
    const foregroundIndex = pending.findIndex((appId) => appId === "may");
    const backgroundIndex = pending.findIndex((appId) => appId !== "may");
    const nextIndex =
      foregroundIndex >= 0 && totalActive < maxConcurrentRequests
        ? foregroundIndex
        : backgroundIndex >= 0 && totalActive < maxConcurrentRequests && backgroundActive < backgroundLimit
          ? backgroundIndex
          : -1;
    if (nextIndex < 0) return;
    const [appId] = pending.splice(nextIndex, 1);
    if (!appId) return;
    queued.delete(appId);
    if (!dirty.has(appId)) {
      armPump();
      return;
    }
    const appActive = active.get(appId) ?? 0;
    active.set(appId, appActive + 1);
    dirty.delete(appId);
    const work =
      appId === "may"
        ? options.hostCapacity.runForeground(() => host.reconcileOnce(appId))
        : options.hostCapacity.run(() => host.reconcileOnce(appId));
    // Start at most one request claim per event-loop turn. Event publication
    // has already returned before this pump claims the request and resolves
    // its Task, and unrelated I/O can run between independent claims.
    if (host.readyCount(appId) > 0) schedule(appId);
    void work
      .then((outcome) => {
        report(appId, outcome);
        for (const conversationId of outcome.conversationIds ?? []) {
          notifyConversationUpdated(appId, conversationId);
        }
      })
      .catch((error) => {
        options.bus.emit({
          type: "info",
          message: `[app-inbox:${appId}] ${error instanceof Error ? error.message : String(error)}`,
        });
      })
      .finally(() => {
        const remaining = (active.get(appId) ?? 1) - 1;
        if (remaining > 0) active.set(appId, remaining);
        else active.delete(appId);
        // A later Turn in the same Conversation becomes claimable only after
        // this handler releases its lease. Recheck here rather than keeping a
        // fake ready item spinning while the earlier Turn is still active.
        if (dirty.has(appId) || host.readyCount(appId) > 0) schedule(appId);
        armPump();
      });
    armPump();
  };

  const schedule = (appId: string): void => {
    if (closed || !host.appIds().includes(appId)) return;
    dirty.add(appId);
    if (queued.has(appId)) return;
    queued.add(appId);
    pending.push(appId);
    armPump();
  };

  let taskRecovery: Promise<void> | null = null;
  const dependencyRecoveryIntervalMs = Math.max(60_000, options.scanIntervalMs ?? 5_000);
  let nextDependencyRecoveryAt = 0;
  const recoverTaskDependencies = (): Promise<void> => {
    if (taskRecovery) return taskRecovery;
    const current = new Promise<void>((resolve) => setTimeout(resolve, 0))
      .then(() =>
        closed ? { linked: 0, woken: 0, wokenAppIds: [], errors: [] } : host.recoverTaskDependencies(),
      )
      .then((outcome) => {
        for (const appId of outcome.wokenAppIds) schedule(appId);
        if (outcome.errors.length > 0) {
          options.bus.emit({
            type: "info",
            message: `[app-inbox:task-recovery] ${outcome.errors.join("; ")}`,
          });
        }
      })
      .finally(() => {
        if (taskRecovery === current) taskRecovery = null;
        nextDependencyRecoveryAt = now() + dependencyRecoveryIntervalMs;
      });
    taskRecovery = current;
    return current;
  };

  const scanNow = () => {
    if (closed || !started) return;
    const currentTime = now();
    for (const { definition } of loaded) {
      for (const configuredSchedule of definition.schedules ?? []) {
        if (configuredSchedule.enabled === false) continue;
        const activation = scheduleActivations.get(`${definition.id}/${configuredSchedule.id}`);
        if (!activation) continue;
        const slot = Math.floor(currentTime / configuredSchedule.intervalMs);
        if (!configuredSchedule.input) {
          if (activation.lastSlot === undefined || slot <= activation.lastSlot) continue;
          const event = configuredSchedule.event;
          const scheduledFact = {
            ...event,
            source: event.source ?? `app:${definition.id}:schedule:${configuredSchedule.id}`,
            owner: event.owner ?? `app:${definition.id}`,
            data: {
              ...record(event.data),
              idempotencyKey: `schedule:${definition.id}:${configuredSchedule.id}:${slot}`,
            },
          } as AgentEvent;
          // Event schedules publish facts; they do not create a reliable
          // command channel or make a passive observer the delivery owner.
          Object.defineProperty(scheduledFact, EVENT_RECORD_ONLY, { value: true, configurable: true });
          options.bus.emit(scheduledFact);
          activation.lastSlot = slot;
          continue;
        }
        if (activation.lastSlot !== undefined && slot <= activation.lastSlot) continue;
        const slotStartedAt = slot * configuredSchedule.intervalMs;
        if ((configuredSchedule.catchUp ?? "latest") === "none" && slotStartedAt < activation.activatedAt) {
          activation.lastSlot = slot;
          continue;
        }
        options.bus.emit({
          type: "app.input.requested",
          source: `app:${definition.id}:schedule:${configuredSchedule.id}`,
          owner: `app:${definition.id}`,
          data: {
            appId: definition.id,
            input: configuredSchedule.input,
            source: { kind: "system", id: `schedule:${definition.id}:${configuredSchedule.id}` },
            idempotencyKey: `schedule:${definition.id}:${configuredSchedule.id}:${slot}`,
          },
        });
        activation.lastSlot = slot;
      }
    }
    for (const appId of host.readyAppIds()) schedule(appId);
    observerRuntime.scanNow();
    if (currentTime >= nextDependencyRecoveryAt) void recoverTaskDependencies();
    recoverAdmissionPlans();
  };

  const admissionRouteLabel = (command: AppEventAdmissionCommand): string =>
    `${command.kind}:${command.appId}/${command.routeId}`;

  const admissionPlanDelivery = (plan: AppEventAdmissionPlan, note: string): DeliveryResult => ({
    accepted: true,
    by: `app-runtime:events:${plan.commands.map(admissionRouteLabel).join(",")}`,
    route: "direct",
    note: `registry-snapshot:${plan.registrySnapshotId}; generation:${plan.registryGeneration}; ${plan.commands.length} frozen App admission command(s) ${note}`,
  });

  const dispatchAdmissionCommand = (
    plan: AppEventAdmissionPlan,
    command: AppEventAdmissionCommand,
    event: AgentEvent,
  ): void => {
    const identity = `event:${plan.eventId}`;
    try {
      const entry = loaded.find(({ definition }) => definition.id === command.appId);
      if (!entry) {
        throw new Error(
          `Frozen ${admissionRouteLabel(command)} for ${identity} names an App unavailable after registry snapshot ${plan.registrySnapshotId} (generation ${plan.registryGeneration})`,
        );
      }
      if (command.kind === "inbox") {
        const admitted = host.admit({
          appId: command.appId,
          source: { kind: "system", id: identity },
          input: command.input,
          originEventId: plan.eventId,
          idempotencyKey: `subscription:${command.appId}:${command.routeId}:${identity}`,
        });
        schedule(admitted.item.appId);
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
        if (String(event.type) === "app.follow-up.requested" && command.kind === "task" && command.intent) {
          const data = eventData(event);
          const conversationId = typeof data.conversationId === "string" ? data.conversationId.trim() : "";
          const topicId = typeof data.topicId === "string" ? data.topicId.trim() : "";
          const requestId = typeof data.requestId === "string" ? data.requestId.trim() : "";
          const followUp = record(data.followUp);
          const outcome = typeof followUp.outcome === "string" ? followUp.outcome.trim() : "";
          if (conversationId && requestId && outcome) {
            options.bus.emit({
              type: "conversation.message.created",
              source: "app-task-admission",
              owner: `app:${command.appId}`,
              data: {
                appId: command.appId,
                conversationId,
                author: { kind: "tool", id: "runtime" },
                text: `Accepted durable work: ${outcome}`,
                metadata: {
                  requestId,
                  command: "task-admitted",
                  ...(topicId ? { topicId } : {}),
                  taskRefs: [{ appId: command.appId, taskId: command.intent.id }],
                  followTask: { appId: command.appId, taskId: command.intent.id },
                },
                idempotencyKey: `conversation-task-admitted:${conversationId}:${requestId}:${command.appId}:${command.intent.id}`,
              },
            });
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

  const admitAdmissionPlan = (plan: AppEventAdmissionPlan, event: AgentEvent): DeliveryResult => {
    if (plan.status === "superseded") {
      throw new Error(`Frozen App admission plan for event:${plan.eventId} is superseded`);
    }
    if (plan.status === "pending") {
      for (const command of plan.commands) {
        if (command.status === "pending") dispatchAdmissionCommand(plan, command, event);
      }
      if (!completeAppEventAdmissionPlan(options.db, plan.eventId, now())) {
        throw new Error(`Frozen App admission plan for event:${plan.eventId} still has pending commands`);
      }
    }
    const admitted = getAppEventAdmissionPlan(options.db, plan.eventId) ?? plan;
    return admissionPlanDelivery(
      admitted,
      plan.status === "completed" ? "already admitted durably" : "admitted durably",
    );
  };

  let nextAdmissionRecoveryAt = 0;
  let admissionRecoveryHandle: ReturnType<typeof setTimeout> | null = null;
  const recoverAdmissionPlans = (force = false): void => {
    const currentTime = now();
    if (admissionRecoveryHandle || (!force && currentTime < nextAdmissionRecoveryAt)) return;
    nextAdmissionRecoveryAt = currentTime + ADMISSION_RECOVERY_INTERVAL_MS;
    admissionRecoveryHandle = setTimeout(() => {
      admissionRecoveryHandle = null;
      if (closed) return;
      const plans = listPendingAppEventAdmissionPlans(options.db, {
        ...(force ? {} : { updatedBefore: currentTime - ADMISSION_RECOVERY_INTERVAL_MS }),
        limit: ADMISSION_RECOVERY_BATCH_SIZE,
      });
      let index = 0;
      const recoverNext = (): void => {
        admissionRecoveryHandle = null;
        if (closed) return;
        const plan = plans[index++];
        if (!plan) return;
        const event = loadAdmissionEvent(options.db, plan.eventId, options.persistDir);
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
      let dependencyWakeDelivery: DeliveryResult | undefined;
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
          schedule(admitted.item.appId);
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
          const context = record(data.context);
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
                ...(data.context && typeof data.context === "object" && !Array.isArray(data.context)
                  ? { context: data.context }
                  : {}),
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
          schedule(admitted.item.appId);
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
        const minQuietMs = Math.max(60_000, Math.floor(Number(data.minQuietMs) || 900_000));
        const limit = Math.min(100, Math.max(1, Math.floor(Number(data.limit) || 100)));
        if (!appId) throw new Error("Conversation supervision review requires its App");
        const links = listStaleConversationTopicTasks(options.db, appId, {
          updatedBefore: now() - minQuietMs,
          limit,
        });
        for (const link of links) {
          const reviewId = eventRowId(event) ?? eventIdentity(event) ?? "review";
          emitConversationTaskChanged(
            link,
            { appId: link.taskAppId, taskId: link.taskId },
            {
              followUpId: `recovery:${reviewId}:${link.taskAppId}:${link.taskId}`,
              reason: "No Task update was observed during the review interval.",
              idempotencyKey: `conversation-task-recovery:${reviewId}:${link.topicId}:${link.taskAppId}:${link.taskId}`,
            },
          );
        }
        return {
          accepted: true,
          by: `conversation-supervision:${appId}`,
          route: "direct",
          note: `${links.length} quiet linked Task(s) selected for bounded review`,
        };
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
        schedule(admitted.item.appId);
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
          for (const appId of host.wakeAppIds({ kind, id }, taskAppId || undefined)) schedule(appId);
          // One dependency Event may advance both an inbox request and one or
          // more Tasks. Preserve the direct inbox wake, then continue through
          // canonical Task-Condition admission below.
          dependencyWakeDelivery = { accepted: true, by: "app-inbox:wake" };
        }
      }
      if (
        event.type === "cli.task.completed" ||
        event.type === "cli.task.failed" ||
        event.type === "cli.task.orphaned"
      ) {
        const analysisId = typeof data.taskId === "string" ? data.taskId.trim() : "";
        if (analysisId) {
          for (const appId of host.wakeAppIds({ kind: "analysis", id: analysisId })) schedule(appId);
        }
      }
      if (event.type === "session.end") {
        const sessionId = typeof data.sessionId === "string" ? data.sessionId.trim() : "";
        if (sessionId) {
          for (const appId of host.wakeAppIds({ kind: "session", id: sessionId })) schedule(appId);
        }
      }
      if (String(event.type) === "project.task.reconciled") {
        const appId = typeof data.project === "string" ? data.project.trim() : "";
        const taskId = typeof data.taskId === "string" ? data.taskId.trim() : "";
        const disposition = typeof data.disposition === "string" ? data.disposition.trim() : "";
        const summary = typeof data.summary === "string" ? data.summary.trim() : "";
        if (appId && taskId && !(appId === "may" && taskId === "conversation/follow-up")) {
          for (const link of listConversationTopicLinksForTask(options.db, appId, taskId)) {
            emitConversationTaskChanged(link, { appId, taskId }, {
              followUpId: `task-event:${eventRowId(event) ?? `${appId}:${taskId}:${data.generation ?? "?"}`}`,
              disposition,
              summary,
              idempotencyKey: `conversation-task-changed:${link.topicId}:${appId}:${taskId}:${eventRowId(event) ?? data.generation ?? "unknown"}`,
            });
          }
        }
        const conversationResult = record(record(data.result).conversation);
        const conversationId =
          typeof conversationResult.conversationId === "string" ? conversationResult.conversationId.trim() : "";
        const topicId = typeof conversationResult.topicId === "string" ? conversationResult.topicId.trim() : "";
        const followUpId =
          typeof conversationResult.followUpId === "string" ? conversationResult.followUpId.trim() : "";
        const text = typeof conversationResult.text === "string" ? conversationResult.text.trim() : "";
        const taskRefs = Array.isArray(conversationResult.taskRefs)
          ? conversationResult.taskRefs
              .flatMap((value) => {
                const item = record(value);
                const refAppId = typeof item.appId === "string" ? item.appId.trim().replace(/\.app$/, "") : "";
                const refTaskId = typeof item.taskId === "string" ? item.taskId.trim() : "";
                return refAppId && refTaskId ? [{ appId: refAppId, taskId: refTaskId }] : [];
              })
              .slice(0, 100)
          : [];
        const followUp = followUpId ? host.get(followUpId) : null;
        const followUpContext = record(record(followUp?.input.data).conversationContext);
        const correlatedConversationId =
          followUp?.source.kind === "app" &&
          followUp.source.id === appId &&
          typeof followUpContext.conversationId === "string"
            ? followUpContext.conversationId.trim()
            : "";
        const correlatedTopicId =
          followUp?.source.kind === "app" && followUp.source.id === appId && typeof followUpContext.topicId === "string"
            ? followUpContext.topicId.trim()
            : "";
        const targetConversationId = correlatedConversationId || conversationId;
        const targetTopicId = correlatedTopicId || topicId;
        if (appId && targetConversationId && targetTopicId && followUpId && text) {
          const topic = readConversationTopic(options.db, appId, targetConversationId, targetTopicId);
          if (topic) {
            for (const ref of taskRefs) linkConversationTopicTask(options.db, topic.id, ref.appId, ref.taskId, now());
            options.bus.emit({
              type: "conversation.message.created",
              source: "app-task-follow-up",
              owner: `app:${appId}`,
              data: {
                appId,
                conversationId: targetConversationId,
                messageId: `result:${followUpId}`,
                author: { kind: "agent", id: appId },
                text,
                metadata: {
                  requestId: followUpId,
                  topicId: targetTopicId,
                  taskRefs,
                  ...(taskRefs.length === 1 ? { followTask: taskRefs[0] } : {}),
                },
                idempotencyKey: `conversation-follow-up:${appId}:${followUpId}:${createHash("sha256")
                  .update(text)
                  .digest("hex")
                  .slice(0, 16)}`,
              },
            });
          } else {
            options.bus.emit({
              type: "info",
              message: `[app-inbox:${appId}] Follow-up ${followUpId} result names unavailable Topic ${targetTopicId}`,
            });
          }
        }
        if (appId === "may" && taskId && disposition === "waiting") {
          const statusIdentity = `${data.generation ?? "?"}:${createHash("sha256")
            .update(`${disposition}\0${summary}`)
            .digest("hex")
            .slice(0, 16)}`;
          for (const item of oneItemPerConversationTask(
            listHumanAppInboxItemsWaitingOnTask(options.db, appId, taskId),
          )) {
            const idempotencyKey = `conversation-task-status:${item.conversationId}:${appId}:${taskId}:${statusIdentity}:${disposition}`;
            options.bus.emit({
              type: "conversation.message.created",
              source: "app-inbox",
              owner: `app:${appId}`,
              data: {
                appId,
                conversationId: item.conversationId!,
                author: { kind: "agent", id: "may" },
                text: summary || "I’m continuing this as a Task and it is waiting for new evidence.",
                metadata: {
                  channel: item.channel,
                  channelTargetId: item.channelTargetId,
                  channelThreadId: item.channelThreadId,
                  requestId: item.id,
                  taskRefs: [{ appId, taskId }],
                },
                idempotencyKey,
              },
            });
          }
        }
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
  // insurance for lost in-memory wakes, due schedules, and observer slots; it
  // must not turn the App inbox into an ordinary five-second polling loop.
  const scanIntervalMs = options.scanIntervalMs ?? 60_000;
  if (!Number.isFinite(scanIntervalMs) || scanIntervalMs <= 0) {
    unsubscribe();
    throw new Error("App inbox scanIntervalMs must be positive");
  }
  let timer: ReturnType<typeof setInterval> | null = null;
  const runtime: AppInboxRuntime = {
    host,
    start() {
      if (closed) return Promise.resolve();
      if (startPromise) return startPromise;
      started = true;
      // Recovery is scheduled behind admission. It must not delay the caller
      // that opens the human interface or activates this message handler.
      void recoverTaskDependencies();
      recoverAdmissionPlans(true);
      timer = setInterval(scanNow, scanIntervalMs);
      timer.unref?.();
      setTimeout(scanNow, 0);
      armPump();
      startPromise = Promise.resolve();
      return startPromise;
    },
    scanNow,
    async reload(prepare, projectsRoot) {
      const previousLoaded = loaded;
      const previousSnapshot = registrySnapshot;
      await options.registry.reload(async (snapshot) => {
        if (
          snapshot.entries.some((entry) => (entry.definition.observers?.length ?? 0) > 0) &&
          !options.observerContext
        ) {
          throw new Error("Canonical App observers require an observer context factory");
        }
        let committed = false;
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
          refreshScheduleActivations();
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
            refreshScheduleActivations();
          }
          throw error;
        }
      }, projectsRoot);
      // App definitions may have made a previously unavailable frozen route
      // admissible. Retry one bounded slice immediately after the reload.
      recoverAdmissionPlans(true);
      scanNow();
      return host.appIds();
    },
    close() {
      if (closed) return;
      closed = true;
      if (timer) clearInterval(timer);
      timer = null;
      if (pumpHandle) clearTimeout(pumpHandle);
      pumpHandle = null;
      if (admissionRecoveryHandle) clearTimeout(admissionRecoveryHandle);
      admissionRecoveryHandle = null;
      observerRuntime.close();
      unsubscribe();
      pending.length = 0;
      queued.clear();
      dirty.clear();
    },
  };
  if (!options.deferStart) await runtime.start();
  return runtime;
}
