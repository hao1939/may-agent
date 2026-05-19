import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { genericHeartbeat } from "./heartbeat-data.js";
import { recordOutcome as recordCircuitOutcome } from "./circuit-breaker.js";
import type { WorkflowContext } from "./index.js";

function makeHeartbeatCtx(agentsRoot: string): WorkflowContext & { events: any[]; runAgentCalls: string[] } {
  const events: any[] = [];
  const runAgentCalls: string[] = [];
  return {
    task: "heartbeat",
    agent: "may",
    emit: (event) => events.push(event),
    dispatchEvent: () => {},
    getDb: () => {
      throw new Error("not used");
    },
    query: {
      heartbeatContext: () => ({ metrics: [], projects: [], alerts: [], inbox: [] }),
      events: () => ({ rows: [] }),
    } as any,
    log: () => {},
    notify: () => {},
    metrics: {} as any,
    persistDir: agentsRoot,
    projectRoot: agentsRoot,
    agentsRoot,
    sharedRoot: join(agentsRoot, "..", "shared"),
    projectsRoot: join(agentsRoot, "..", "projects"),
    runAgent: async (agentName) => {
      runAgentCalls.push(agentName);
      return { status: "success", summary: "ok" } as any;
    },
    runWorkflow: async () => ({ type: "done", summary: "ok" }),
    runFunction: async () => ({ status: "success", summary: "ok" } as any),
    summarize: () => "",
    done: (summary) => ({ type: "done", summary }),
    escalate: (reason) => ({ type: "escalate", reason }),
    createSession: async () => ({ prompt: async () => {}, lastText: () => "", close: () => {} }),
    events,
    runAgentCalls,
  };
}

describe("genericHeartbeat events", () => {
  it("emits canonical heartbeat.skipped envelope when the circuit breaker is open", async () => {
    const appRoot = mkdtempSync(join(tmpdir(), "heartbeat-events-"));
    const agentsRoot = join(appRoot, "agents");
    const ctx = makeHeartbeatCtx(agentsRoot);

    try {
      recordCircuitOutcome(agentsRoot, "builder", true, "provider failed");
      recordCircuitOutcome(agentsRoot, "builder", true, "provider failed");
      recordCircuitOutcome(agentsRoot, "builder", true, "provider failed");

      const result = await genericHeartbeat(ctx, "builder");

      expect(result.type).toBe("done");
      expect(ctx.runAgentCalls).toEqual([]);
      expect(ctx.events).toContainEqual({
        type: "heartbeat.skipped",
        source: "agent:builder",
        owner: "agent:builder",
        data: {
          agent: "builder",
          gate: "circuit_breaker",
          reason: expect.stringContaining("Circuit breaker OPEN"),
        },
      });
      expect(ctx.events.some((event) => event.type === "circuit_breaker_open")).toBe(false);
    } finally {
      rmSync(appRoot, { recursive: true, force: true });
    }
  });
});
