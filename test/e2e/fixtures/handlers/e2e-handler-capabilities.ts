/** E2E fixture proving that Host maintenance cannot launch App work. */
import type { MaintenanceEntry } from "../../../../src/app/adapters/maintenance/contracts.js";
import type { HandlerContext, HandlerModule } from "../../../../src/app/adapters/maintenance/context.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: MaintenanceEntry) => {
  return async () => {
    const sdk = ctx.sdk as unknown as Record<string, unknown>;
    ctx.sdk.emit(
      "e2e.handler-capabilities.checked",
      {
        caller: entry.name,
        hasRunAgent: typeof sdk.runAgent === "function",
        hasRunWorkflow: typeof sdk.runWorkflow === "function",
        hasEscalate: typeof sdk.escalate === "function",
      },
      { owner: "agent:may", source: entry.name },
    );
  };
};
