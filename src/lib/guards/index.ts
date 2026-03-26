/**
 * Unified Guard Architecture — Phase 1.
 * 
 * Provides a clean Guard interface and registry that wraps the existing
 * beforeToolCall guards and adds support for afterToolResult hooks.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "../tools/compose-guards.js";

// ── After Tool Result Hook (NEW — post-execution interception) ──

export interface AfterToolResultContext {
  toolCall: { name: string; id: string };
  args: Record<string, unknown>;
  result: unknown;
  context: {
    messages: Array<{ role: string; content: unknown }>;
  };
}

export interface AfterToolResultAction {
  /** If set, replaces the tool result content shown to the agent */
  modifiedResult?: string;
  /** If set, appends a warning message to the tool result */
  appendWarning?: string;
}

export type AfterToolResultHook = (
  context: AfterToolResultContext,
  signal?: AbortSignal,
) => Promise<AfterToolResultAction | undefined>;

// ── Guard Interface ──

export interface Guard {
  name: string;
  /** Pre-execution check — can block or warn */
  beforeToolCall?: (
    context: BeforeToolCallContext,
    signal?: AbortSignal,
  ) => Promise<BeforeToolCallResult | undefined>;
  /** Post-execution check — can modify result or append warnings */
  afterToolResult?: AfterToolResultHook;
}

// ── Guard Registry ──

export class GuardRegistry {
  private guards: Guard[] = [];

  register(guard: Guard): void {
    this.guards.push(guard);
  }

  /** Compose all beforeToolCall hooks (same semantics as composeGuards) */
  composeBeforeHooks(): (
    context: BeforeToolCallContext,
    signal?: AbortSignal,
  ) => Promise<BeforeToolCallResult | undefined> {
    const guards = this.guards.filter((g) => g.beforeToolCall);
    return async (context, signal) => {
      let lastWarning: BeforeToolCallResult | undefined;
      for (const guard of guards) {
        const result = await guard.beforeToolCall!(context, signal);
        if (!result) continue;
        if (result.block) return result;
        lastWarning = result;
      }
      return lastWarning;
    };
  }

  /** Compose all afterToolResult hooks — all run, results are merged */
  composeAfterHooks(): AfterToolResultHook {
    const guards = this.guards.filter((g) => g.afterToolResult);
    return async (context, signal) => {
      let merged: AfterToolResultAction | undefined;
      for (const guard of guards) {
        const action = await guard.afterToolResult!(context, signal);
        if (!action) continue;
        if (!merged) merged = {};
        if (action.modifiedResult !== undefined) merged.modifiedResult = action.modifiedResult;
        if (action.appendWarning) {
          merged.appendWarning = merged.appendWarning
            ? `${merged.appendWarning}\n${action.appendWarning}`
            : action.appendWarning;
        }
      }
      return merged;
    };
  }

  getGuardNames(): string[] {
    return this.guards.map((g) => g.name);
  }
}
