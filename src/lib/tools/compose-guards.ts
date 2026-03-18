/**
 * Compose multiple beforeToolCall guards into a single hook.
 *
 * Guards are executed in order. The first guard that returns a blocking result
 * wins — subsequent guards are not called. Non-blocking results (warnings)
 * from earlier guards are returned but don't prevent later guards from also
 * checking.
 *
 * If no guard returns a result, returns undefined (allow the tool call).
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "@mariozechner/pi-agent-core";

type BeforeToolCallHook = (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined>;

/**
 * Compose multiple beforeToolCall hooks into one.
 *
 * Evaluation order: first guard to return `{ block: true }` wins.
 * Warnings (block: false) from earlier guards are returned if no blocking guard fires.
 */
export function composeGuards(...guards: BeforeToolCallHook[]): BeforeToolCallHook {
  return async (context: BeforeToolCallContext, signal?: AbortSignal): Promise<BeforeToolCallResult | undefined> => {
    let lastWarning: BeforeToolCallResult | undefined;

    for (const guard of guards) {
      const result = await guard(context, signal);
      if (!result) continue;

      // Blocking result — return immediately
      if (result.block) return result;

      // Non-blocking result (warning) — remember but continue checking
      lastWarning = result;
    }

    return lastWarning;
  };
}
