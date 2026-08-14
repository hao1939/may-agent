import type { AppDependencyObservation, AppInput, AppInputSource, ObserverContext } from "@may-agent/sdk";
import type { SqliteDb } from "../lib/db.js";
import { EVENT_ROW_ID, eventData, type AgentEvent, type DeliveryResult, type EventBus } from "./event-bus.js";
import { AppInboxHost, type AppInboxReconcileResult, type AppTaskAttacher } from "./app-inbox-host.js";
import { createManagerAppOwnerInvoker, type AppOwnerManager } from "./app-owner-manager-adapter.js";
import type { AppRegistry, AppRegistrySnapshot } from "./app-registry.js";
import { createAppObserverRuntime } from "./app-observer-runtime.js";
import { canonicalAppEvent } from "./canonical-app-event.js";

export type AppRegistryReloadPreparation = (input: {
  snapshot: AppRegistrySnapshot;
  /** Must be the final synchronous step after every other consumer commits. */
  commit: () => void;
}) => Promise<void>;

export type AppInboxRuntime = {
  host: AppInboxHost;
  close(): void;
  scanNow(): void;
  enableDelivery(): void;
  reload(prepare?: AppRegistryReloadPreparation): Promise<string[]>;
};

export type StartAppInboxRuntimeOptions = {
  registry: AppRegistry;
  db: SqliteDb;
  manager: AppOwnerManager;
  bus: EventBus;
  attachTask?: (input: Parameters<AppTaskAttacher>[0] & { appDir: string }) => ReturnType<AppTaskAttacher>;
  readDependency?: (input: {
    appId: string;
    appDir: string;
    dependency: { kind: "task" | "session"; id: string };
  }) => Promise<AppDependencyObservation | null>;
  runOwner?: <T>(work: () => Promise<T>) => Promise<T>;
  maxConcurrentApps?: number;
  scanIntervalMs?: number;
  leaseMs?: number;
  retryAfterMs?: number;
  maxBatchSize?: number;
  now?: () => number;
  observerContext?: (appId: string, appDir: string) => ObserverContext;
};

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

function eventIdentity(event: AgentEvent): string | undefined {
  const eventId = Number((event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
  return Number.isSafeInteger(eventId) && eventId > 0 ? `event:${eventId}` : undefined;
}

function normalizedAgent(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim().replace(/^agent:/, "");
}

const NON_AGENT_MESSAGE_SENDERS = new Set(["human", "operator", "telegram", "console", "socket"]);

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
  if (!targetOwner || !sender || sender === targetOwner || NON_AGENT_MESSAGE_SENDERS.has(sender)) return undefined;
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
  let loaded = options.registry.entries();
  if (loaded.some((entry) => (entry.definition.observers?.length ?? 0) > 0) && !options.observerContext) {
    throw new Error("Canonical App observers require an observer context factory");
  }
  for (const { definition } of loaded) {
    if (!options.manager.hasAgent(definition.owner)) {
      throw new Error(`App ${definition.id} owner agent is not registered: ${definition.owner}`);
    }
  }
  let appDirById = new Map(loaded.map((entry) => [entry.definition.id, entry.appDir]));
  const attachTask: AppTaskAttacher | undefined = options.attachTask
    ? async (input) => {
        const appDir = appDirById.get(input.appId);
        if (!appDir) throw new Error(`Unknown App task owner: ${input.appId}`);
        return options.attachTask!({ ...input, appDir });
      }
    : undefined;

  const invokeOwner = createManagerAppOwnerInvoker(options.manager);
  const host = new AppInboxHost({
    db: options.db,
    apps: loaded.map((entry) => entry.definition),
    invokeOwner: options.runOwner ? (input) => options.runOwner!(() => invokeOwner(input)) : invokeOwner,
    attachTask,
    readDependency: options.readDependency
      ? async (input) => {
          const appDir = appDirById.get(input.appId);
          if (!appDir) return null;
          return options.readDependency!({ ...input, appDir });
        }
      : undefined,
    leaseMs: options.leaseMs,
    retryAfterMs: options.retryAfterMs,
    maxBatchSize: options.maxBatchSize,
  });
  host.recoverDeliveries();
  const active = new Set<string>();
  const dirty = new Set<string>();
  const pending: string[] = [];
  const queued = new Set<string>();
  const maxConcurrentApps = options.maxConcurrentApps ?? 2;
  if (!Number.isSafeInteger(maxConcurrentApps) || maxConcurrentApps <= 0) {
    throw new Error("App inbox maxConcurrentApps must be a positive safe integer");
  }
  let closed = false;
  let deliveryEnabled = false;
  let dispatchingDelivery = false;
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
  const scheduleActivations = new Map<string, { fingerprint: string; activatedAt: number }>();

  const refreshScheduleActivations = (): void => {
    const activeKeys = new Set<string>();
    for (const { definition } of loaded) {
      for (const schedule of definition.schedules ?? []) {
        if (!schedule.input) continue;
        const key = `${definition.id}/${schedule.id}`;
        activeKeys.add(key);
        const fingerprint = JSON.stringify({
          intervalMs: schedule.intervalMs,
          input: schedule.input,
          catchUp: schedule.catchUp ?? "latest",
          enabled: schedule.enabled !== false,
        });
        if (scheduleActivations.get(key)?.fingerprint !== fingerprint) {
          scheduleActivations.set(key, { fingerprint, activatedAt: now() });
        }
      }
    }
    for (const key of scheduleActivations.keys()) {
      if (!activeKeys.has(key)) scheduleActivations.delete(key);
    }
  };
  refreshScheduleActivations();

  const pumpDeliveries = (): void => {
    if (closed || !deliveryEnabled || dispatchingDelivery) return;
    dispatchingDelivery = true;
    try {
      for (;;) {
        const dispatch = host.claimDelivery();
        if (!dispatch) break;
        const { delivery, item, text } = dispatch;
        try {
          options.bus.emit({
            type: "app.response.delivery.requested",
            source: "app-inbox",
            owner: `app:${item.appId}`,
            target: delivery.channel.startsWith("agent:")
              ? { agent: delivery.channel.slice("agent:".length) }
              : { human: true },
            data: {
              appId: item.appId,
              operationId: delivery.operationId,
              appInboxItemId: delivery.itemId,
              appInboxRequestId: delivery.requestId,
              sessionId: delivery.sessionId,
              channel: delivery.channel,
              channelThreadId: item.channelThreadId,
              channelMessageId: item.channelMessageId,
              conversationId: item.conversationId,
              text,
            },
          });
        } catch (error) {
          // Event persistence runs before transport subscribers. If it failed,
          // no external send started and this outbox operation is safe to retry.
          host.restoreDelivery(delivery.operationId);
          throw error;
        }
      }
    } catch (error) {
      try {
        options.bus.emit({
          type: "info",
          message: `[app-inbox:delivery] ${error instanceof Error ? error.message : String(error)}`,
        });
      } catch {
        // Persistence is already known to be unavailable; avoid turning the
        // diagnostic path into a second outbox failure.
      }
    } finally {
      dispatchingDelivery = false;
    }
  };

  const report = (appId: string, outcome: AppInboxReconcileResult) => {
    if (outcome.errors.length === 0) return;
    options.bus.emit({
      type: "info",
      message: `[app-inbox:${appId}] ${outcome.errors.join("; ")}`,
    });
  };

  const pump = (): void => {
    while (!closed && active.size < maxConcurrentApps) {
      const appId = pending.shift();
      if (!appId) return;
      queued.delete(appId);
      if (active.has(appId) || !dirty.has(appId)) continue;
      active.add(appId);
      dirty.delete(appId);
      void host
        .reconcileOnce(appId)
        .then((outcome) => {
          report(appId, outcome);
          if (outcome.claimed > 0) dirty.add(appId);
          pumpDeliveries();
        })
        .catch((error) => {
          options.bus.emit({
            type: "info",
            message: `[app-inbox:${appId}] ${error instanceof Error ? error.message : String(error)}`,
          });
        })
        .finally(() => {
          active.delete(appId);
          if (dirty.has(appId)) schedule(appId);
          pump();
        });
    }
  };

  const schedule = (appId: string): void => {
    if (closed || !host.appIds().includes(appId)) return;
    dirty.add(appId);
    if (active.has(appId) || queued.has(appId)) return;
    queued.add(appId);
    pending.push(appId);
    pump();
  };

  let sessionRecovery: Promise<void> | null = null;
  const recoverSessionDependencies = (includeAssociatedClaims = false): Promise<void> => {
    if (sessionRecovery) return sessionRecovery;
    const current = host
      .recoverSessionDependencies({ includeAssociatedClaims })
      .then((outcome) => {
        for (const appId of outcome.wokenAppIds) schedule(appId);
        if (outcome.errors.length > 0) {
          options.bus.emit({
            type: "info",
            message: `[app-inbox:session-recovery] ${outcome.errors.join("; ")}`,
          });
        }
      })
      .finally(() => {
        if (sessionRecovery === current) sessionRecovery = null;
      });
    sessionRecovery = current;
    return current;
  };

  const scanNow = () => {
    const currentTime = now();
    for (const { definition } of loaded) {
      for (const configuredSchedule of definition.schedules ?? []) {
        if (!configuredSchedule.input) continue;
        if (configuredSchedule.enabled === false) continue;
        const activation = scheduleActivations.get(`${definition.id}/${configuredSchedule.id}`);
        if (!activation) continue;
        const slot = Math.floor(currentTime / configuredSchedule.intervalMs);
        const slotStartedAt = slot * configuredSchedule.intervalMs;
        if ((configuredSchedule.catchUp ?? "latest") === "none" && slotStartedAt < activation.activatedAt) continue;
        const admitted = host.admit({
          appId: definition.id,
          source: { kind: "system", id: `schedule:${definition.id}:${configuredSchedule.id}` },
          input: configuredSchedule.input,
          idempotencyKey: `schedule:${definition.id}:${configuredSchedule.id}:${slot}`,
        });
        if (admitted.created) schedule(admitted.item.appId);
      }
    }
    for (const appId of host.appIds()) schedule(appId);
    observerRuntime.scanNow();
    void recoverSessionDependencies();
    pumpDeliveries();
  };

  const unsubscribe = options.bus.subscribeDurableRoute((event): DeliveryResult | void => {
    const data = eventData(event);
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
    }
    if (event.type === "app.input.requested") {
      const appId = typeof data.appId === "string" ? data.appId.trim() : "";
      const identity = eventIdentity(event);
      const admitted = host.admit({
        appId,
        source: inputSource(data.source, identity ?? `event:${event.type}`),
        input: requestedInput(data),
        parentId: typeof data.parentId === "string" ? data.parentId : undefined,
        conversationId: typeof data.conversationId === "string" ? data.conversationId : undefined,
        conversationSequence: typeof data.conversationSequence === "number" ? data.conversationSequence : undefined,
        channel: typeof data.channel === "string" ? data.channel : undefined,
        channelThreadId: typeof data.channelThreadId === "string" ? data.channelThreadId : undefined,
        channelMessageId: typeof data.channelMessageId === "number" ? data.channelMessageId : undefined,
        idempotencyKey:
          typeof data.idempotencyKey === "string" && data.idempotencyKey.trim() ? data.idempotencyKey.trim() : identity,
      });
      schedule(admitted.item.appId);
      return { accepted: true, by: `app-inbox:${admitted.item.appId}` };
    }
    if (event.type === "app.response.delivery.requested") {
      const channel = typeof data.channel === "string" ? data.channel.trim() : "";
      const target = channel.startsWith("agent:") ? normalizedAgent(channel.slice("agent:".length)) : undefined;
      const operationId = typeof data.operationId === "string" ? data.operationId.trim() : "";
      const itemId = typeof data.appInboxItemId === "string" ? data.appInboxItemId.trim() : "";
      const requestId = typeof data.appInboxRequestId === "string" ? data.appInboxRequestId.trim() : "";
      const sessionId = typeof data.sessionId === "string" ? data.sessionId.trim() : "";
      const appId = typeof data.appId === "string" ? data.appId.trim() : "";
      const response = typeof data.text === "string" ? data.text.trim() : "";
      if (target && operationId && itemId && requestId && sessionId && appId && response) {
        try {
          const outbound = options.bus.emit({
            type: "message.created",
            source: `app:${appId}`,
            owner: `agent:${target}`,
            data: {
              from: appId,
              to: target,
              content: response,
              intent: "result",
              priority: "P2",
              sourceSessionId: sessionId,
              sourceAppId: appId,
              appResponseFor: itemId,
              appDeliveryOperationId: operationId,
              idempotencyKey: operationId,
            },
          });
          const outboundEventId = Number(outbound[EVENT_ROW_ID]);
          const outcome = host.recordDelivery({
            operationId,
            itemId,
            requestId,
            sessionId,
            channel,
            status: "delivered",
            externalMessageId:
              Number.isSafeInteger(outboundEventId) && outboundEventId > 0 ? String(outboundEventId) : undefined,
            eventId: Number.isSafeInteger(outboundEventId) && outboundEventId > 0 ? outboundEventId : undefined,
          });
          if (!outcome.matched) {
            throw new Error(`Internal App delivery ${operationId} no longer matches its outbox row`);
          }
          if (outcome.completed) scanNow();
          options.bus.emit({
            type: "channel.delivery.completed",
            source: "app-inbox:agent-message",
            owner: `app:${appId}`,
            target: { agent: target },
            data: {
              channel,
              sessionId,
              resultEventType: event.type,
              operationId,
              appInboxItemId: itemId,
              appInboxRequestId: requestId,
              ...(Number.isSafeInteger(outboundEventId) && outboundEventId > 0
                ? { externalMessageId: String(outboundEventId) }
                : {}),
            },
          });
          return { accepted: true, by: `app-inbox:agent-delivery:${itemId}`, route: "direct" };
        } catch (error) {
          const retry = setTimeout(() => {
            if (host.restoreDelivery(operationId)) pumpDeliveries();
          }, options.retryAfterMs ?? 1_000);
          retry.unref?.();
          return {
            accepted: true,
            by: `app-inbox:agent-delivery-retry:${itemId}`,
            route: "direct",
            note: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }
    if (event.type === "app.dependency.completed") {
      const kind = data.kind;
      const id = typeof data.id === "string" ? data.id.trim() : "";
      if ((kind === "app" || kind === "task" || kind === "session") && id) {
        if (host.wake({ kind, id }) > 0) scanNow();
        return { accepted: true, by: "app-inbox:wake" };
      }
    }
    if (event.type === "session.end") {
      const sessionId = typeof data.sessionId === "string" ? data.sessionId.trim() : "";
      if (sessionId && host.wake({ kind: "session", id: sessionId }) > 0) {
        scanNow();
      }
    }
    if (event.type === "channel.delivery.completed" || event.type === "channel.delivery.failed") {
      const operationId = typeof data.operationId === "string" ? data.operationId.trim() : "";
      const itemId = typeof data.appInboxItemId === "string" ? data.appInboxItemId.trim() : "";
      const requestId = typeof data.appInboxRequestId === "string" ? data.appInboxRequestId.trim() : "";
      const sessionId = typeof data.sessionId === "string" ? data.sessionId.trim() : "";
      const channel = typeof data.channel === "string" ? data.channel.trim() : "";
      if (operationId && itemId && requestId && sessionId && channel) {
        const external = data.externalMessageId;
        const outcome = host.recordDelivery({
          operationId,
          itemId,
          requestId,
          sessionId,
          channel,
          status:
            event.type === "channel.delivery.completed"
              ? "delivered"
              : data.certainty === "not-delivered"
                ? "failed"
                : "uncertain",
          externalMessageId:
            typeof external === "string" || typeof external === "number" ? String(external) : undefined,
          reason: typeof data.reason === "string" ? data.reason : undefined,
          eventId: Number(eventIdentity(event)?.replace(/^event:/, "")) || undefined,
        });
        if (outcome.matched) {
          if (outcome.completed) scanNow();
          return { accepted: true, by: `app-inbox:delivery:${itemId}` };
        }
      }
    }
    const identity = eventIdentity(event);
    if (identity) {
      const matches = host.subscriptionInputs(canonicalAppEvent(event));
      for (const match of matches) {
        const admitted = host.admit({
          appId: match.appId,
          source: { kind: "system", id: identity },
          input: match.input,
          idempotencyKey: `subscription:${match.appId}:${match.subscriptionId}:${identity}`,
        });
        schedule(admitted.item.appId);
      }
      if (matches.length > 0) {
        return {
          accepted: true,
          by: `app-inbox:subscriptions:${matches.map((match) => `${match.appId}/${match.subscriptionId}`).join(",")}`,
          route: "direct",
          note: `${matches.length} App subscription(s) admitted durably`,
        };
      }
    }
  });
  const scanIntervalMs = options.scanIntervalMs ?? 5_000;
  if (!Number.isFinite(scanIntervalMs) || scanIntervalMs <= 0) {
    unsubscribe();
    throw new Error("App inbox scanIntervalMs must be positive");
  }
  await recoverSessionDependencies(true);
  const timer = setInterval(scanNow, scanIntervalMs);
  timer.unref?.();
  scanNow();

  return {
    host,
    scanNow,
    async reload(prepare) {
      const previousDefinitions = loaded.map((entry) => entry.definition);
      const next = await options.registry.reload(async (snapshot) => {
        for (const { definition } of snapshot.entries) {
          if (!options.manager.hasAgent(definition.owner)) {
            throw new Error(`App ${definition.id} owner agent is not registered: ${definition.owner}`);
          }
        }
        if (
          snapshot.entries.some((entry) => (entry.definition.observers?.length ?? 0) > 0) &&
          !options.observerContext
        ) {
          throw new Error("Canonical App observers require an observer context factory");
        }
        let committed = false;
        const commit = () => {
          if (committed) throw new Error(`App registry generation ${snapshot.generation} was committed twice`);
          host.replaceApps(snapshot.entries.map((entry) => entry.definition));
          committed = true;
        };
        try {
          if (prepare) await prepare({ snapshot, commit });
          else commit();
          if (!committed) throw new Error(`App registry generation ${snapshot.generation} was not committed`);
        } catch (error) {
          if (committed) host.replaceApps(previousDefinitions);
          throw error;
        }
      });
      loaded = next;
      observerRuntime.replace(next);
      appDirById = new Map(next.map((entry) => [entry.definition.id, entry.appDir]));
      refreshScheduleActivations();
      scanNow();
      return host.appIds();
    },
    enableDelivery() {
      if (closed || deliveryEnabled) return;
      deliveryEnabled = true;
      pumpDeliveries();
    },
    close() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      observerRuntime.close();
      unsubscribe();
      pending.length = 0;
      queued.clear();
      dirty.clear();
    },
  };
}
