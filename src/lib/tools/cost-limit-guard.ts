/**
 * Cost-limit guard — prevents runaway sessions by capping total tool calls.
 *
 * Usage: call `createCostLimitGuard()` once per session. The returned hook
 * increments an internal counter on every invocation and blocks when the
 * configured limit is reached.
 *
 * The default limit (200) can be overridden via the `TOOL_CALL_LIMIT`
 * environment variable.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

type BeforeToolCallHook = (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined>;

const DEFAULT_TOOL_CALL_LIMIT = 200;

/**
 * Factory: creates a cost-limit guard with its own call counter.
 *
 * Each call to createCostLimitGuard() produces an independent closure,
 * so different sessions don't share counters.
 */
export function createCostLimitGuard(limit?: number): BeforeToolCallHook {
  const max = limit ?? (Number(process.env.TOOL_CALL_LIMIT) || DEFAULT_TOOL_CALL_LIMIT);
  let callCount = 0;

  return async (_context: BeforeToolCallContext, _signal?: AbortSignal): Promise<BeforeToolCallResult | undefined> => {
    callCount++;

    if (callCount > max) {
      return {
        block: true,
        reason: `Cost limit reached: ${callCount} tool calls exceeds the limit of ${max}. End the session with a finish() call.`,
        steer: "You have exceeded the tool call limit. Wrap up immediately by calling finish().",
      };
    }

    // Warn when approaching the limit (90% threshold)
    if (callCount >= Math.floor(max * 0.9)) {
      return {
        block: false,
        reason: `Approaching cost limit: ${callCount}/${max} tool calls used. Start wrapping up.`,
      };
    }

    return undefined;
  };
}
