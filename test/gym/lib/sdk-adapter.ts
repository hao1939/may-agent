/**
 * sdk-adapter.ts — public SDK helpers for gym tests.
 *
 * App-owned gym code must not import infra internals. In-process adapters are
 * created by infra; app tests use the public SDK testing surface.
 */

import type { AgentSDK, SDKTaskResult } from "@may-agent/sdk";
import { createTestRuntime } from "@may-agent/sdk/testing";

interface AdapterOpts {
  [key: string]: unknown;
}

/**
 * Create an in-process AgentSDK adapter for gym scenarios.
 * This is the "real" adapter — scenarios run against the live system.
 */
export function createInProcessAdapter(opts: AdapterOpts): AgentSDK {
  void opts;
  throw new Error("createInProcessAdapter is an infra-owned adapter. App gym tests should use createStubAdapter() or @may-agent/sdk/testing.");
}

/**
 * Create a stub AgentSDK for fast testing (no LLM, no DB).
 * Returns canned responses. Use for scenario structure validation.
 */
export function createStubAdapter(opts?: {
  runAgentResponse?: Partial<SDKTaskResult>;
}): AgentSDK {
  const defaultResult: SDKTaskResult = {
    sessionId: "stub-session",
    status: "done",
    lastAssistantText: opts?.runAgentResponse?.lastAssistantText ?? "Stub response",
    ...opts?.runAgentResponse,
  };

  return createTestRuntime({
    runAgent: async () => defaultResult,
  }).sdk;
}
