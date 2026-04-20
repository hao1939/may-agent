/**
 * Shared test helper: mock RuntimeCtx and HandlerContext.
 *
 * One place to update when RuntimeCtx changes — all handler/workflow
 * tests that use this get the new fields automatically.
 */

import { vi } from "vitest";
import type { RuntimeCtx } from "../../src/lib/handler-context.js";
import type { HandlerContext } from "../../src/lib/handler-context.js";

export interface MockRuntimeCtx extends RuntimeCtx {
  /** All events passed to emit(). */
  emitted: Array<{ type: string; [key: string]: unknown }>;
  /** All messages passed to log(). */
  logged: string[];
  /** All messages passed to notify(). */
  notified: string[];
}

/**
 * Build a fully-mocked RuntimeCtx with spy functions.
 * Tests can inspect .emitted, .logged, .notified arrays.
 */
export function mockRuntimeCtx(overrides?: Partial<RuntimeCtx>): MockRuntimeCtx {
  const emitted: Array<{ type: string; [key: string]: unknown }> = [];
  const logged: string[] = [];
  const notified: string[] = [];

  return {
    emit: vi.fn((event) => emitted.push(event)),
    getDb: vi.fn(() => { throw new Error("getDb not configured in test"); }),
    log: vi.fn((msg) => logged.push(msg)),
    notify: vi.fn((msg) => notified.push(msg)),
    persistDir: "/tmp/test-persist",
    projectRoot: "/tmp/test-project",
    agentsRoot: "/tmp/test-agents",
    emitted,
    logged,
    notified,
    ...overrides,
  };
}

/**
 * Build a fully-mocked HandlerContext.
 * Spreads mockRuntimeCtx + handler-specific stubs.
 */
export function mockHandlerCtx(overrides?: Partial<HandlerContext>): HandlerContext & MockRuntimeCtx {
  const rtx = mockRuntimeCtx();
  return {
    ...rtx,
    manager: {} as any,
    agentName: "test-agent",
    getSessionId: () => null,
    triggerNow: () => false,
    trackRequest: vi.fn(() => "req-mock"),
    loadAllSessionMetas: vi.fn(() => ({})),
    evaluateTask: vi.fn(async () => null),
    ...overrides,
  } as HandlerContext & MockRuntimeCtx;
}
