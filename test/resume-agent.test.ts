import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/lib/manager.js";
import { EventBus, type AgentEvent } from "../src/app/event-bus.js";
import {
  ensureSessionDir,
  appendSessionMessage,
  sessionOutputDir,
  writeSessionMeta,
  readSessionMeta,
} from "../src/lib/persistence.js";
import type { PersistedSession } from "../src/lib/persistence.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";

function fakeModel(): Model<any> {
  return {
    id: "test-model",
    name: "Test Model",
    api: "anthropic",
    provider: "anthropic",
    baseUrl: "http://localhost:0",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096,
    maxTokens: 1024,
  };
}

function userMessage(text: string): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function assistantMessage(text: string): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function writeRegistryState(persistDir: string, sessions: Record<string, PersistedSession>): void {
  mkdirSync(persistDir, { recursive: true });
  for (const [sid, meta] of Object.entries(sessions)) {
    writeSessionMeta(persistDir, sid, meta);
  }
}

function setupSession(persistDir: string, sessionId: string, messages?: AgentMessage[]): void {
  ensureSessionDir(persistDir, sessionId);
  mkdirSync(sessionOutputDir(persistDir, sessionId), { recursive: true });
  if (messages) {
    for (const msg of messages) {
      appendSessionMessage(persistDir, sessionId, msg);
    }
  }
}

function registerAgent(manager: SubagentManager, name: string): void {
  manager.register({
    name,
    description: `Agent ${name}`,
    domain: "test",
    systemPrompt: `You are ${name}.`,
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
}

// ── resumeStaleSessions() ──────────────────────────────────────────────

describe("SubagentManager.resumeStaleSessions()", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-resume-stale-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("resumes all running sessions with registered agents", async () => {
    writeRegistryState(persistDir, {
      "session-a": {
        agent: "agent-a",
        task: "task A",
        status: "running",
        startedAt: Date.now() - 30000,
      },
      "session-b": {
        agent: "agent-b",
        task: "task B",
        status: "running",
        startedAt: Date.now() - 20000,
      },
      "session-done": {
        agent: "agent-a",
        task: "done task",
        status: "done",
        startedAt: Date.now() - 60000,
        endedAt: Date.now() - 55000,
      },
    });

    setupSession(persistDir, "session-a", [userMessage("task A"), assistantMessage("Working on A...")]);
    setupSession(persistDir, "session-b", [userMessage("task B")]);

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "agent-a");
    registerAgent(manager, "agent-b");

    const { resumed, interrupted } = manager.resumeStaleSessions();

    expect(resumed).toHaveLength(2);
    expect(interrupted).toHaveLength(0);

    const resumedIds = resumed.map((s) => s.sessionId).sort();
    expect(resumedIds).toEqual(["session-a", "session-b"]);

    for (const info of resumed) {
      expect(info.status).toBe("running");
      expect(info.outputDir).toBe(sessionOutputDir(persistDir, info.sessionId));
      expect(info.runtime).toMatch(/^\d+s$|^\d+m\d+s$/);
    }

    // Done sessions should be untouched
    const metaDone = readSessionMeta(persistDir, "session-done");
    expect(metaDone!.status).toBe("done");

    // Wait for resumed sessions to complete (will error from fake model)
    await manager.waitFor("session-a");
    await manager.waitFor("session-b");
  });

  it("interrupts sessions whose agent is not registered", () => {
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    writeRegistryState(persistDir, {
      "session-x": {
        agent: "unknown-agent",
        task: "task X",
        status: "running",
        startedAt: Date.now() - 10000,
      },
    });
    setupSession(persistDir, "session-x");

    const manager = new SubagentManager({ persistDir, bus, infraRetryMax: 0 });
    // Do NOT register unknown-agent

    const { resumed, interrupted } = manager.resumeStaleSessions();

    expect(resumed).toHaveLength(0);
    expect(interrupted).toHaveLength(1);
    expect(interrupted[0].sessionId).toBe("session-x");
    expect(interrupted[0].error).toContain("agent not registered");

    const meta = readSessionMeta(persistDir, "session-x");
    expect(meta!.status).toBe("interrupted");
    expect(events).toContainEqual(expect.objectContaining({
      type: "session.resume_failed",
      source: "manager",
      owner: "agent:unknown-agent",
      data: expect.objectContaining({
        sessionId: "session-x",
        agent: "unknown-agent",
        category: "agent_not_registered",
        recoverable: false,
      }),
    }));
  });

  it("emits session.resume_failed when cold resume cannot find the session", () => {
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const manager = new SubagentManager({ persistDir, bus, infraRetryMax: 0 });

    expect(() => manager.resumeSession("missing-session", "continue")).toThrow(/not found/);

    expect(events).toContainEqual(expect.objectContaining({
      type: "session.resume_failed",
      source: "manager",
      owner: "agent:may",
      data: expect.objectContaining({
        sessionId: "missing-session",
        category: "session_not_found",
        recoverable: false,
      }),
    }));
  });

  it("releases stale heartbeat dispatch dedup leases on restart", () => {
    writeRegistryState(persistDir, {
      "session-heartbeat": {
        agent: "may",
        task: "You are **may** waking up for your heartbeat.",
        status: "running",
        source: "workflow:may-heartbeat",
        kind: "job",
        startedAt: Date.now() - 10000,
      },
    });
    setupSession(persistDir, "session-heartbeat");
    writeFileSync(join(persistDir, "dispatch-dedup.json"), JSON.stringify({
      records: {
        "may::heartbeat": {
          agent: "may",
          taskPrefix: "heartbeat",
          attempts: 1,
          failures: 0,
          lastAttempt: new Date().toISOString(),
          lastStatus: "running",
          blocked: false,
        },
      },
      version: 1,
    }, null, 2));

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    const { resumed, interrupted } = manager.resumeStaleSessions();

    expect(resumed).toHaveLength(0);
    expect(interrupted).toHaveLength(1);
    const dedup = JSON.parse(readFileSync(join(persistDir, "dispatch-dedup.json"), "utf8"));
    expect(dedup.records["may::heartbeat"].lastStatus).toBe("interrupted");
  });

  it("releases orphaned heartbeat dedup leases when heartbeat session is already terminal", () => {
    writeRegistryState(persistDir, {
      "session-heartbeat": {
        agent: "dev",
        task: "You are **dev** waking up for your heartbeat.",
        status: "interrupted",
        source: "workflow:dev-heartbeat",
        kind: "job",
        startedAt: Date.now() - 60000,
        endedAt: Date.now() - 30000,
        error: "Clean start (fresh)",
      },
    });
    setupSession(persistDir, "session-heartbeat");
    writeFileSync(join(persistDir, "dispatch-dedup.json"), JSON.stringify({
      records: {
        "dev::heartbeat": {
          agent: "dev",
          taskPrefix: "heartbeat",
          attempts: 1,
          failures: 0,
          lastAttempt: new Date().toISOString(),
          lastStatus: "running",
          blocked: false,
        },
      },
      version: 1,
    }, null, 2));

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    const { resumed, interrupted } = manager.resumeStaleSessions();

    expect(resumed).toHaveLength(0);
    expect(interrupted).toHaveLength(0);
    const dedup = JSON.parse(readFileSync(join(persistDir, "dispatch-dedup.json"), "utf8"));
    expect(dedup.records["dev::heartbeat"].lastStatus).toBe("interrupted");
  });

  it("resumes registered agents and interrupts unregistered ones", async () => {
    writeRegistryState(persistDir, {
      "session-reg": {
        agent: "agent-a",
        task: "registered task",
        status: "running",
        startedAt: Date.now() - 10000,
      },
      "session-unreg": {
        agent: "unknown",
        task: "unregistered task",
        status: "running",
        startedAt: Date.now() - 10000,
      },
    });
    setupSession(persistDir, "session-reg", [userMessage("task")]);
    setupSession(persistDir, "session-unreg");

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "agent-a");

    const { resumed, interrupted } = manager.resumeStaleSessions();

    expect(resumed).toHaveLength(1);
    expect(resumed[0].sessionId).toBe("session-reg");
    expect(interrupted).toHaveLength(1);
    expect(interrupted[0].sessionId).toBe("session-unreg");

    await manager.waitFor("session-reg");
  });

  it("returns empty when no stale sessions exist", () => {
    writeRegistryState(persistDir, {
      "session-done": {
        agent: "agent-a",
        task: "done",
        status: "done",
        startedAt: Date.now() - 60000,
        endedAt: Date.now() - 55000,
      },
    });

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    const { resumed, interrupted } = manager.resumeStaleSessions();
    expect(resumed).toEqual([]);
    expect(interrupted).toEqual([]);
  });

  it("returns empty when no sessions exist at all", () => {
    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    const { resumed, interrupted } = manager.resumeStaleSessions();
    expect(resumed).toEqual([]);
    expect(interrupted).toEqual([]);
  });

  it("does not scan archived sessions during stale recovery", () => {
    const archivedDir = join(persistDir, "sessions", "history", "archived-running");
    mkdirSync(archivedDir, { recursive: true });
    writeFileSync(
      join(archivedDir, "meta.json"),
      JSON.stringify({
        agent: "agent-a",
        task: "archived task",
        status: "running",
        startedAt: Date.now() - 60000,
      } satisfies PersistedSession),
    );

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "agent-a");
    const { resumed, interrupted } = manager.resumeStaleSessions();
    expect(resumed).toEqual([]);
    expect(interrupted).toEqual([]);
  });

  it("does not touch done/error/interrupted sessions", () => {
    writeRegistryState(persistDir, {
      "s-done": { agent: "a", task: "t", status: "done", startedAt: Date.now() - 60000, endedAt: Date.now() - 55000 },
      "s-error": {
        agent: "a",
        task: "t",
        status: "error",
        startedAt: Date.now() - 50000,
        endedAt: Date.now() - 45000,
        error: "err",
      },
      "s-int": {
        agent: "a",
        task: "t",
        status: "interrupted",
        startedAt: Date.now() - 40000,
        endedAt: Date.now() - 35000,
      },
    });

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    const { resumed, interrupted } = manager.resumeStaleSessions();
    expect(resumed).toEqual([]);
    expect(interrupted).toEqual([]);

    expect(readSessionMeta(persistDir, "s-done")!.status).toBe("done");
    expect(readSessionMeta(persistDir, "s-error")!.status).toBe("error");
    expect(readSessionMeta(persistDir, "s-int")!.status).toBe("interrupted");
  });

  it("runtime formatting: seconds", () => {
    writeRegistryState(persistDir, {
      s: { agent: "a", task: "t", status: "running", startedAt: Date.now() - 5000 },
    });
    setupSession(persistDir, "s");

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "a");
    const { resumed } = manager.resumeStaleSessions();
    expect(resumed[0].runtime).toMatch(/^\d+s$/);
  });

  it("runtime formatting: minutes", () => {
    writeRegistryState(persistDir, {
      s: { agent: "a", task: "t", status: "running", startedAt: Date.now() - 125000 },
    });
    setupSession(persistDir, "s");

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "a");
    const { resumed } = manager.resumeStaleSessions();
    expect(resumed[0].runtime).toMatch(/^\d+m\d+s$/);
  });
});
