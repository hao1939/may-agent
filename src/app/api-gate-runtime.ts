import { ApiGate } from "../lib/api-gate.js";
import { log } from "../lib/log.js";

export function createRuntimeApiGate(env: NodeJS.ProcessEnv = process.env): ApiGate {
  return new ApiGate(
    {
      defaultConcurrency: parseInt(env.API_GATE_CONCURRENCY ?? "8", 10),
      overrides: env.API_GATE_OVERRIDES ? JSON.parse(env.API_GATE_OVERRIDES) : undefined,
    },
    (event) => {
      if (event.action === "queued") {
        log("info", `[api-gate] ${event.agent} (${event.sessionId.slice(0, 12)}) queued for ${event.endpoint.slice(0, 30)}... (${event.active}/${event.active} active, ${event.queued} waiting)`);
      } else if (event.action === "acquired" && event.waitMs) {
        log("info", `[api-gate] ${event.agent} acquired slot after ${event.waitMs}ms wait (${event.active} active, ${event.queued} waiting)`);
      }
    },
  );
}
