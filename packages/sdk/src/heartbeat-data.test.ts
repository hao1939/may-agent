import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { genericHeartbeat, type HeartbeatWorkflowContext } from "./heartbeat-data.js";
import { recordOutcome as recordCircuitOutcome } from "./circuit-breaker.js";

function makeHeartbeatCtx(agentsRoot: string): HeartbeatWorkflowContext & {
  events: any[];
  runAgentCalls: Array<{ agent: string; source?: string }>;
} {
  const events: any[] = [];
  const runAgentCalls: Array<{ agent: string; source?: string }> = [];
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
    commands: {} as any,
    log: () => {},
    notify: () => {},
    metrics: {} as any,
    persistDir: agentsRoot,
    projectRoot: agentsRoot,
    agentsRoot,
    sharedRoot: join(agentsRoot, "..", "shared"),
    projectsRoot: join(agentsRoot, "..", "projects"),
    runAgent: async (agentName, _task, options) => {
      runAgentCalls.push({ agent: agentName, source: options?.source });
      return { status: "success", summary: "ok" } as any;
    },
    runWorkflow: async () => ({ type: "done", summary: "ok" }),
    runFunction: async () => ({ status: "success", summary: "ok" } as any),
    summarize: () => "",
    done: (summary) => ({ type: "done", summary }),
    blocked: (reason) => ({ type: "blocked", reason }),
    createSession: async () => ({ prompt: async () => {}, lastText: () => "", close: () => {} }),
    events,
    runAgentCalls,
  };
}

describe("genericHeartbeat events", () => {
  it("emits canonical heartbeat.step_started envelope before the heartbeat session", async () => {
    const appRoot = mkdtempSync(join(tmpdir(), "heartbeat-events-"));
    const agentsRoot = join(appRoot, "agents");
    const ctx = makeHeartbeatCtx(agentsRoot);
    const previousStateDir = process.env.STATE_DIR;
    process.env.STATE_DIR = join(appRoot, ".state");

    try {
      const result = await genericHeartbeat(ctx, "builder");

      expect(result.type).toBe("done");
      expect(ctx.runAgentCalls).toEqual([{ agent: "builder", source: "heartbeat" }]);
      expect(ctx.events).toContainEqual({
        type: "heartbeat.step_started",
        source: "agent:builder",
        owner: "agent:builder",
        data: {
          workflow: "heartbeat",
          step: "heartbeat",
        },
      });
      expect(ctx.events.some((event) => event.type === "step_start")).toBe(false);
    } finally {
      if (previousStateDir === undefined) {
        delete process.env.STATE_DIR;
      } else {
        process.env.STATE_DIR = previousStateDir;
      }
      rmSync(appRoot, { recursive: true, force: true });
    }
  });

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
