import type { AppDependencyObservation, AppInput, AppInputSource } from "@may-agent/sdk";
import type { SqliteDb } from "../lib/db.js";
import { EVENT_ROW_ID, eventData, type AgentEvent, type DeliveryResult, type EventBus } from "./event-bus.js";
import { AppInboxHost, type AppInboxReconcileResult, type AppTaskAttacher } from "./app-inbox-host.js";
import { createManagerAppOwnerInvoker, type AppOwnerManager } from "./app-owner-manager-adapter.js";
import { loadAppInboxDefinitions } from "./loader/app-inbox-loader.js";

export type AppInboxRuntime = {
  host: AppInboxHost;
  close(): void;
  scanNow(): void;
  enableDelivery(): void;
};

export type StartAppInboxRuntimeOptions = {
  projectsRoot: string;
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

export async function startAppInboxRuntime(options: StartAppInboxRuntimeOptions): Promise<AppInboxRuntime | null> {
  const loaded = await loadAppInboxDefinitions(options.projectsRoot);
  if (loaded.length === 0) return null;
  for (const { definition } of loaded) {
    if (!options.manager.hasAgent(definition.owner)) {
      throw new Error(`App ${definition.id} owner agent is not registered: ${definition.owner}`);
    }
  }
  const appDirById = new Map(loaded.map((entry) => [entry.definition.id, entry.appDir]));
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
            target: { human: true },
            data: {
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

  const scanNow = () => {
    for (const appId of host.appIds()) schedule(appId);
    pumpDeliveries();
  };

  const unsubscribe = options.bus.subscribeDurableRoute((event): DeliveryResult | void => {
    const data = eventData(event);
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
    if (event.type === "app.dependency.completed") {
      const kind = data.kind;
      const id = typeof data.id === "string" ? data.id.trim() : "";
      if ((kind === "app" || kind === "task" || kind === "session") && id) {
        if (host.wake({ kind, id }) > 0) scanNow();
        return { accepted: true, by: "app-inbox:wake" };
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
  });
  const scanIntervalMs = options.scanIntervalMs ?? 5_000;
  if (!Number.isFinite(scanIntervalMs) || scanIntervalMs <= 0) {
    unsubscribe();
    throw new Error("App inbox scanIntervalMs must be positive");
  }
  const timer = setInterval(scanNow, scanIntervalMs);
  timer.unref?.();
  scanNow();

  return {
    host,
    scanNow,
    enableDelivery() {
      if (closed || deliveryEnabled) return;
      deliveryEnabled = true;
      pumpDeliveries();
    },
    close() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      unsubscribe();
      pending.length = 0;
      queued.clear();
      dirty.clear();
    },
  };
}
