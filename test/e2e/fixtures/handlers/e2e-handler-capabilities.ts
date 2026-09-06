/** E2E fixture proving that Host maintenance cannot launch App work. */
import type { CronEntry } from "../../../../src/lib/cron-tool.js";
import type { HandlerContext, HandlerModule } from "../../../../src/lib/handler-context.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
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
