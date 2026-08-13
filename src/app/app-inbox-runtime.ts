import type { AppInput, AppInputSource } from "@may-agent/sdk";
import type { SqliteDb } from "../lib/db.js";
import { EVENT_ROW_ID, eventData, type AgentEvent, type DeliveryResult, type EventBus } from "./event-bus.js";
import { AppInboxHost, type AppInboxReconcileResult, type AppTaskAttacher } from "./app-inbox-host.js";
import { recoverLeasedAppInboxItems } from "./app-inbox-store.js";
import { createManagerAppOwnerInvoker, type AppOwnerManager } from "./app-owner-manager-adapter.js";
import { loadAppInboxDefinitions } from "./loader/app-inbox-loader.js";

export type AppInboxRuntime = {
  host: AppInboxHost;
  close(): void;
  scanNow(): void;
};

export type StartAppInboxRuntimeOptions = {
  projectsRoot: string;
  db: SqliteDb;
  manager: AppOwnerManager;
  bus: EventBus;
  attachTask?: AppTaskAttacher;
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

  const host = new AppInboxHost({
    db: options.db,
    apps: loaded.map((entry) => entry.definition),
    invokeOwner: createManagerAppOwnerInvoker(options.manager),
    attachTask: options.attachTask,
    leaseMs: options.leaseMs,
    retryAfterMs: options.retryAfterMs,
    maxBatchSize: options.maxBatchSize,
  });
  recoverLeasedAppInboxItems(options.db);
  const active = new Set<string>();
  const dirty = new Set<string>();
  let closed = false;

  const report = (appId: string, outcome: AppInboxReconcileResult) => {
    if (outcome.errors.length === 0) return;
    options.bus.emit({
      type: "info",
      message: `[app-inbox:${appId}] ${outcome.errors.join("; ")}`,
    });
  };

  const schedule = (appId: string): void => {
    if (closed || !host.appIds().includes(appId)) return;
    dirty.add(appId);
    if (active.has(appId)) return;
    active.add(appId);
    void (async () => {
      try {
        while (!closed) {
          dirty.delete(appId);
          const outcome = await host.reconcileOnce(appId);
          report(appId, outcome);
          if (outcome.claimed === 0 && !dirty.has(appId)) break;
        }
      } catch (error) {
        options.bus.emit({
          type: "info",
          message: `[app-inbox:${appId}] ${error instanceof Error ? error.message : String(error)}`,
        });
      } finally {
        active.delete(appId);
        if (dirty.has(appId)) schedule(appId);
      }
    })();
  };

  const scanNow = () => {
    for (const appId of host.appIds()) schedule(appId);
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
        conversationSequence:
          typeof data.conversationSequence === "number" ? data.conversationSequence : undefined,
        idempotencyKey:
          typeof data.idempotencyKey === "string" && data.idempotencyKey.trim()
            ? data.idempotencyKey.trim()
            : identity,
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
    close() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      unsubscribe();
    },
  };
}
