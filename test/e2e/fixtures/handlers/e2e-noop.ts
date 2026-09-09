/**
 * E2E fixture handler: emits e2e.tick events on every fire.
 *
 * Used by e1-handler-loop-liveness to validate that the cron + handler-loader +
 * event-persistence pipeline runs end-to-end against a real daemon.
 */
import type { MaintenanceEntry } from "../../../../src/app/adapters/maintenance/contracts.js";
import type { HandlerContext, HandlerModule } from "../../../../src/app/adapters/maintenance/context.js";
import type { EventEnvelope } from "../../../../src/app/event-bus.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: MaintenanceEntry) => {
  return async (event?: EventEnvelope) => {
    ctx.sdk.emit(
      "e2e.tick",
      {
        handler: entry.name,
        source: event?.source ?? "timer",
        eventType: event?.type ?? null,
      },
      { owner: "agent:may", source: entry.name },
    );
  };
};
