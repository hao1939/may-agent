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

import type { BeforeToolCallContext as PiBeforeToolCallContext } from "@earendil-works/pi-agent-core";

export interface BeforeToolCallContext extends Omit<PiBeforeToolCallContext, "args" | "assistantMessage"> {
  args: Record<string, unknown>;
  /** Present for native Pi calls; optional for synthetic guard-test contexts. */
  assistantMessage?: PiBeforeToolCallContext["assistantMessage"];
}

export interface BeforeToolCallResult {
  block: boolean;
  reason: string;
  /** Stable detector identity propagated into guard.triggered facts. */
  guardName?: string;
}

export type BeforeToolCallHook = (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined>;

/** Normalize Pi's validated-but-unknown arguments at the guard boundary. */
export function toGuardContext(context: PiBeforeToolCallContext): BeforeToolCallContext {
  const args =
    typeof context.args === "object" && context.args !== null && !Array.isArray(context.args)
      ? (context.args as Record<string, unknown>)
      : {};
  return { ...context, args };
}

/**
 * Compose multiple beforeToolCall hooks into one.
 *
 * Evaluation order: first guard to return `{ block: true }` wins.
 * Warnings (block: false) from earlier guards are returned if no blocking guard fires.
 *
 */
export function composeGuards(...guards: BeforeToolCallHook[]): BeforeToolCallHook {
  return async (context: BeforeToolCallContext, signal?: AbortSignal): Promise<BeforeToolCallResult | undefined> => {
    let lastWarning: BeforeToolCallResult | undefined;
    const isFinish = context.toolCall.name === "finish";

    for (const guard of guards) {
      let result: BeforeToolCallResult | undefined;
      try {
        result = await guard(context, signal);
      } catch (err) {
        // Fail-open: guard crash should not block the tool call
        console.error(`[composeGuards] guard threw — failing open:`, err);
        continue;
      }
      if (!result) continue;

      // finish(blocked) and finish(failure) are never blocked — agents must be able to exit.
      // finish(success) CAN be blocked — this is the quality gate.
      if (result.block && isFinish) {
        const finishStatus = context.args?.status as string;
        if (finishStatus === 'blocked' || finishStatus === 'failure') {
          console.error(`[composeGuards] guard tried to block finish(${finishStatus}) — downgrading to warning: ${result.reason}`);
          lastWarning = { ...result, block: false };
          continue;
        }
        // finish(success) or finish(partial) — let the block proceed (quality gate)
      }

      // Blocking result — return immediately
      if (result.block) return result;

      // Non-blocking result (warning) — remember but continue checking
      lastWarning = result;
    }

    return lastWarning;
  };
}
