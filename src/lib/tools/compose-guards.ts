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

// TODO(pi-agent-core): Import from @mariozechner/pi-agent-core once it exports
// BeforeToolCallContext / BeforeToolCallResult. Until then, define locally so
// guard code compiles and is ready when the upstream hook ships.

export interface BeforeToolCallContext {
  toolCall: { name: string; id: string };
  args: Record<string, unknown>;
  context: {
    messages: Array<{
      role: string;
      content: unknown;
    }>;
  };
}

export interface BeforeToolCallResult {
  block: boolean;
  reason: string;
  /** Optional: suggest a workflow the agent should run instead. */
  redirect?: { workflow: string; task: string };
  /** Optional: inject a steering message for the agent's next turn. */
  steer?: string;
}

type BeforeToolCallHook = (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined>;

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

      // Blocking result — return immediately
      if (result.block) return result;

      // Non-blocking result (warning) — remember but continue checking
      lastWarning = result;
    }

    return lastWarning;
  };
}
