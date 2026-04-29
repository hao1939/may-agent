/**
 * sdk-adapter.ts — In-process AgentSDK adapter for the gym runner.
 *
 * Wraps the running may-agent system to provide AgentSDK to gym scenarios.
 * Import this from the gym runner when executing scenarios in-process.
 *
 * Usage:
 *   import { createInProcessAdapter } from "./sdk-adapter.ts";
 *   const sdk = createInProcessAdapter(manager, bus, persistDir, projectRoot, agentsRoot);
 *   await runScenario(sdk);
 */

import { buildAgentSDK } from "../../src/lib/sdk-impl.js";
import type { AgentSDK } from "../../src/lib/sdk.js";
import type { EventBus } from "../../src/app/event-bus.js";

interface AdapterOpts {
  bus: EventBus;
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
  /** Manager's callAgent function. */
  callAgent: (agent: string, task: string, opts?: any) => Promise<any>;
}

/**
 * Create an in-process AgentSDK adapter for gym scenarios.
 * This is the "real" adapter — scenarios run against the live system.
 */
export function createInProcessAdapter(opts: AdapterOpts): AgentSDK {
  return buildAgentSDK({
    ...opts,
    agentName: "gym",
  });
}

/**
 * Create a stub AgentSDK for fast testing (no LLM, no DB).
 * Returns canned responses. Use for scenario structure validation.
 */
export function createStubAdapter(opts?: {
  runAgentResponse?: Partial<import("../../src/lib/sdk.js").TaskResult>;
}): AgentSDK {
  const defaultResult = {
    sessionId: "stub-session",
    status: "done",
    lastAssistantText: opts?.runAgentResponse?.lastAssistantText ?? "Stub response",
    ...opts?.runAgentResponse,
  };

  const events: Array<{ type: string; data?: Record<string, unknown> }> = [];
  const logs: string[] = [];

  return {
    runAgent: async () => defaultResult as any,
    createLLMSession: async () => { throw new Error("createLLMSession not available in stub mode"); },
    emit: (type, data) => { events.push({ type, data }); },
    getDb: () => { throw new Error("getDb not available in stub mode"); },
    log: (_level, msg) => { logs.push(msg); },
    notify: (_target, msg) => { logs.push(`[notify] ${msg}`); },
    escalate: (_target, reason) => { logs.push(`[escalate] ${reason}`); },
    paths: { persist: "/tmp/gym-stub", root: "/tmp/gym-stub", agents: "/tmp/gym-stub/agents" },
  };
}
