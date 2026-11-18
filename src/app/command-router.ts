import { isRecord } from "../../packages/control/src/event-envelope.js";
import { log } from "@may-agent/sdk/runtime";
import {
  EVENT_RECORD_ONLY,
  EVENT_ROW_ID,
  childEventTrace,
  type DeliveryResult,
  type EventBus,
} from "./core/events/bus.js";
import type { RuntimeReloadResult } from "./daemon-lifecycle.js";

export interface CommandRouterOptions {
  bus: EventBus;
  reload: (options?: { expectedSourceCommit?: string }) => RuntimeReloadResult | Promise<RuntimeReloadResult>;
  restart: () => void;
  shutdown: () => void;
}

export interface CommandRouter {
  close: () => void;
}

function eventData(event: unknown): Record<string, unknown> {
  if (!isRecord(event)) return {};
  return isRecord(event.data) ? event.data : event;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Route durable Host lifecycle controls to their owning service. */
export function attachCommandRouter(options: CommandRouterOptions): CommandRouter {
  const { bus } = options;

  const accepted = (control: string, note = "input handled by an explicit runtime route"): DeliveryResult => ({
    accepted: true,
    by: `command-router:${control}`,
    route: "direct",
    note,
  });

  const eventRowId = (event: unknown): number | null => {
    if (!isRecord(event)) return null;
    const value = (event as Record<PropertyKey, unknown>)[EVENT_ROW_ID];
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
  };

  const inFlightReloads = new Set<number>();
  function finishReload(event: unknown): void {
    const rowId = eventRowId(event);
    if (rowId !== null) {
      if (inFlightReloads.has(rowId)) return;
      inFlightReloads.add(rowId);
    }
    const request = eventData(event);
    const emitResult = (result: RuntimeReloadResult): void => {
      bus.emit({
        type: "runtime.reload.finished",
        source: "runtime",
        owner: isRecord(event) ? String(event.owner ?? "system:host") : "system:host",
        data: {
          ...(nonEmptyString(request.requestId) ? { requestId: nonEmptyString(request.requestId) } : {}),
          ok: result.ok,
          summary: result.summary,
          ...(nonEmptyString(result.sourceCommit) ? { sourceCommit: nonEmptyString(result.sourceCommit) } : {}),
        },
        trace: childEventTrace(event),
        [EVENT_RECORD_ONLY]: true,
      } as any);
    };
    const expectedSourceCommit = nonEmptyString(request.expectedSourceCommit);
    void Promise.resolve()
      .then(() => options.reload(expectedSourceCommit ? { expectedSourceCommit } : undefined))
      .catch((error) => ({
        ok: false,
        summary: `[reload] Failed: ${error instanceof Error ? error.message : String(error)}`,
      }))
      .then(emitResult)
      .catch((error) => log("warn", `[reload] Could not record result: ${String(error)}`))
      .finally(() => {
        if (rowId !== null) inFlightReloads.delete(rowId);
      });
  }

  const unsubscribeRequiredControls = bus.subscribeDurableRoute((event) => {
    switch (event.type) {
      case "runtime.reload.requested":
        finishReload(event);
        return accepted("runtime-reload");
      case "runtime.restart.requested":
        options.restart();
        return accepted("runtime-restart");
      case "runtime.shutdown.requested":
        options.shutdown();
        return accepted("runtime-shutdown");
    }
  });

  return {
    close: () => {
      unsubscribeRequiredControls();
    },
  };
}
