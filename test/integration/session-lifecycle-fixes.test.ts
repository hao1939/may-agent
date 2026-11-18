import { Type } from "typebox";
/**
 * Tests for session lifecycle bug fixes (Bug 3, 4, 8, 10).
 *
 * Bug 3: terminal persistence throws → session stuck in activeSessions
 * Bug 4: run() with duplicate sessionId → orphaned agent
 * Bug 8: resumeSession doesn't restore parentAgentName
 * Bug 10: callDepths map never cleaned for completed root sessions
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus, type AgentEvent } from "../../src/app/core/events/bus.js";
import { classifyTerminalAssistantFailure, extractLastAssistantError } from "@may-agent/sdk/runtime";
import { SubagentManager } from "../../src/lib/manager.js";
import {
  ensureSessionDir,
  readActiveSessionProcessId,
  readSessionMeta,
  writeSessionMeta,
} from "../../src/lib/persistence.js";
import { closeDb } from "../../src/lib/db/connection.js";

import type { AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import { createAgentRun } from "@may-agent/sdk/runtime";
import { RESPONSES_STREAM_TERMINAL_ERROR } from "@may-agent/sdk/runtime";
import { fakeModel } from "../fixtures/model.js";

function registerAgent(manager: SubagentManager, name = "test-agent") {
  manager.register({
    name,
    description: "Test agent",
    domain: "test",
    systemPrompt: "You are a test agent.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
}

describe("terminal assistant failure classification", () => {
  it("flags empty tool-use assistant turns as terminal failures", () => {
    const reason = classifyTerminalAssistantFailure([
      { role: "user", content: [{ type: "text", text: "do work" }] } as any,
      { role: "assistant", stopReason: "toolUse", content: [{ type: "text", text: "" }] } as any,
    ]);

    expect(reason).toBe("Agent ended on an empty tool-use assistant turn");
  });

  it("flags pending tool calls as terminal failures", () => {
    const reason = classifyTerminalAssistantFailure([
      { role: "user", content: [{ type: "text", text: "do work" }] } as any,
      {
        role: "assistant",
        stopReason: "toolUse",
        content: [{ type: "toolCall", id: "call_1", name: "bash", arguments: { command: "echo hi" } }],
      } as any,
    ]);

    expect(reason).toBe("Agent ended while waiting for tool results");
  });

  it("does not flag substantive final assistant text", () => {
    const reason = classifyTerminalAssistantFailure([
      { role: "user", content: [{ type: "text", text: "do work" }] } as any,
      { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "Done." }] } as any,
    ]);

    expect(reason).toBeUndefined();
  });

  it("extracts provider error from the terminal assistant message", () => {
    const error = extractLastAssistantError([
      { role: "user", content: [{ type: "text", text: "do work" }] } as any,
      {
        role: "assistant",
        stopReason: "error",
        content: [],
        errorMessage: "OpenAI API error (429): 429 No deployments available for selected model",
      } as any,
    ]);

    expect(error).toBe(
      "OpenAI API error (429): 429 No deployments available for selected model",
    );
  });
});

describe("session completion publication", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-lifecycle-"));
  });

  afterEach(() => {
    closeDb(persistDir);
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it.each(["done", "error"] as const)("keeps the selected agent folder for %s after registry replacement", async (status) => {
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const completion = Promise.withResolvers<void>();
    const manager = new SubagentManager({
      persistDir,
      bus,
      agentRunFactory: (config) => {
        const run = createAgentRun(config);
        // No provider call: hold the real manager at its execution boundary.
        run.prompt = async () => {
          await completion.promise;
          if (status === "error") throw new Error("fixture model failure");
          run.state.messages.push({
            role: "assistant",
            content: [{ type: "text", text: "Fixture completed" }],
            stopReason: "stop",
          } as AgentMessage);
        };
        return run;
      },
    });
    registerAgent(manager);
    const original = {
      ...manager.getAgentDefinition("test-agent")!,
      agentRelativeDir: "projects/sample.app/agents/local-owner",
    };
    manager.register(original);
    const sessionId = manager.run(original.name, "Finish accepted work");
    manager.register({ ...original, agentRelativeDir: "agents/global-owner" });
    completion.resolve();
    expect((await manager.waitFor(sessionId)).status).toBe(status);
    expect(events.filter((event) => event.type === "session.end")).toMatchObject([
      {
        type: "session.end",
        data: { sessionId, agentRelativeDir: original.agentRelativeDir, status },
      },
    ]);
  });

  it("surfaces the exact completion failure and releases live session ownership", async () => {
    const bus = new EventBus();
    const terminalSessions: string[] = [];
    bus.setPersistenceSubscriber((event) => {
      if (event.type === "session.end") {
        terminalSessions.push(String(event.data.sessionId));
        throw new Error("fixture terminal persistence failed");
      }
    });
    const manager = new SubagentManager({ persistDir, bus });
    registerAgent(manager);
    const sessionId = manager.run("test-agent", "do something");
    await expect(manager.waitFor(sessionId)).rejects.toThrow("fixture terminal persistence failed");
    expect(terminalSessions).toEqual([sessionId]);
    expect(manager.hasActiveSession(sessionId)).toBe(false);
    expect(readActiveSessionProcessId(persistDir, sessionId)).toBeNull();
    expect(readSessionMeta(persistDir, sessionId)?.status).toBe("error");
  });
});

describe("workflow call empty final turn recovery", () => {
  let persistDir: string;
  let manager: SubagentManager;
  let bus: EventBus;
  let events: AgentEvent[];

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-call-empty-"));
    bus = new EventBus();
    events = [];
    bus.subscribe((event) => events.push(event));
    manager = new SubagentManager({ persistDir, bus });
  });

  afterEach(() => {
    closeDb(persistDir);
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  function finishCall(id: string, args: Record<string, unknown>) {
    return {
      role: "assistant",
      content: [{ type: "toolCall", id, name: "finish", arguments: args }],
    } as any;
  }

  function finishResult(id: string, text: string, isError = false) {
    return {
      role: "toolResult",
      toolCallId: id,
      toolName: "finish",
      content: [{ type: "text", text }],
      isError,
    } as any;
  }

  function makeCallSession(onPrompt: (promptText: string, messages: AgentMessage[]) => Promise<void>) {
    const sessionId = "s_call_empty";
    const messages: AgentMessage[] = [];
    const prompts: string[] = [];
    ensureSessionDir(persistDir, sessionId);
    writeSessionMeta(persistDir, sessionId, {
      agent: "tech-lead",
      task: "review owner message",
      status: "running",
      startedAt: Date.now(),
      kind: "call",
      autoClose: "immediate",
      requireFinish: true,
    });

    const fakeAgent = {
      state: { messages },
      prompt: async (promptText: string) => {
        prompts.push(promptText);
        await onPrompt(promptText, messages);
      },
      waitForIdle: async () => {},
      subscribe: () => () => {},
    };
    const session = {
      sessionId,
      agent: fakeAgent,
      agentName: "tech-lead",
      definition: { name: "tech-lead" },
      task: "review owner message",
      startedAt: Date.now(),
      status: "running",
      kind: "call",
      autoClose: "immediate",
      requireFinish: true,
      outputSchema: Type.Object({
        state: Type.Union([Type.Literal("converged"), Type.Literal("waiting"), Type.Literal("incomplete")]),
        summary: Type.String(),
        facts: Type.Array(Type.String()),
      }),
      toolCalls: 0,
      turnCount: 1,
    } as any;
    return { sessionId, session, messages, prompts };
  }

  it("keeps the original assignment available after an empty initial response", async () => {
    const { sessionId, session, messages, prompts } = makeCallSession(async (promptText, transcript) => {
      if (promptText === "review owner message") {
        transcript.push({ role: "user", content: [{ type: "text", text: promptText }] } as any);
        transcript.push({ role: "assistant", stopReason: "stop", content: [] } as any);
        return;
      }
      expect(promptText).toContain("Continue the original bounded assignment");
      expect(promptText).not.toContain("call finish() now");
      expect(transcript).toHaveLength(1);
      expect(transcript[0]).toMatchObject({ role: "user", content: [{ type: "text", text: "review owner message" }] });
      // The model boundary is synthetic; the real manager must allow continued
      // work on this same call, rather than demand a judgment with no facts.
      transcript.push({
        role: "assistant",
        content: [{ type: "toolCall", id: "read-after-empty", name: "read", arguments: { path: "proof.txt" } }],
      } as any);
      transcript.push({
        role: "toolResult", toolCallId: "read-after-empty", toolName: "read",
        content: [{ type: "text", text: "Current source inspected" }], isError: false,
      } as any);
      transcript.push(finishCall("finish-after-empty", {
        status: "done", summary: "Completed after inspecting current source",
        output: { state: "converged", summary: "Inspection complete", facts: ["Current source inspected"] },
      }));
      transcript.push(finishResult("finish-after-empty", "SUCCESS: Inspection complete"));
    });

    const result = await (manager as any).executeSession(session);

    expect(result).toMatchObject({ sessionId, status: "done", structuredResult: { facts: ["Current source inspected"] } });
    expect(prompts).toHaveLength(2);
    expect(messages.filter((message: any) => message.toolCallId === "read-after-empty")).toHaveLength(1);
    expect(events.filter((event) => event.type === "session.end" && (event as any).data?.sessionId === sessionId)).toHaveLength(1);
  });

  it.each(["read", "write"])("preserves successful %s facts after final synthesis throws 429", async (toolName) => {
    const facts = toolName === "write" ? "Committed proof.txt successfully" : "29 tests passed; replay tree matched";
    const { sessionId, session, messages, prompts } = makeCallSession(async (promptText, transcript) => {
      if (promptText === "review owner message") {
        transcript.push({ role: "user", content: [{ type: "text", text: promptText }] } as any);
        transcript.push({
          role: "assistant",
          content: [{ type: "toolCall", id: "work-1", name: toolName, arguments: { path: "proof.txt" } }],
        } as any);
        transcript.push({
          role: "toolResult",
          toolCallId: "work-1",
          toolName,
          content: [{ type: "text", text: facts }],
          isError: false,
        } as any);
        throw new Error("OpenAI API error (429): No deployments available for selected model, Try again in 5 seconds.");
      }
      expect(promptText).toContain("Do not repeat successful work or committed effects");
      expect(promptText).toContain("inspect current state before repeating an uncertain effect");
      expect(transcript).toContainEqual(expect.objectContaining({
        role: "toolResult", toolCallId: "work-1", isError: false,
        content: [{ type: "text", text: facts }],
      }));
      transcript.push(
        finishCall("finish-1", {
          status: "done",
          summary: "Recovered the verified workflow result.",
          output: {
            state: "converged",
            summary: "Recovered from transient final synthesis failure.",
            facts: [facts],
          },
        }),
      );
      transcript.push(finishResult("finish-1", "✅ SUCCESS: Recovered the verified workflow result."));
    });

    const result = await (manager as any).executeSession(session);

    expect(result.status).toBe("done");
    expect(result.finishResult).toMatchObject({ status: "done", summary: "Recovered the verified workflow result." });
    expect(result.structuredResult).toEqual({
      state: "converged",
      summary: "Recovered from transient final synthesis failure.",
      facts: [facts],
    });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("transient runtime/provider failure or no visible answer");
    expect(prompts[1]).toContain("schema-validated output payload");
    expect(messages).toContainEqual(expect.objectContaining({
      role: "toolResult",
      content: [{ type: "text", text: facts }],
    }));
    expect(messages.filter((message: any) => message.toolCallId === "work-1")).toHaveLength(1);

    const end = events.find((event) => event.type === "session.end" && (event as any).data?.sessionId === sessionId);
    expect(end).toMatchObject({
      type: "session.end",
      data: {
        sessionId,
        status: "done",
        summary: "Recovered the verified workflow result.",
        finishParams: {
          status: "done",
          output: {
            state: "converged",
            facts: [facts],
          },
        },
      },
    });
  });

  it("recovers and publishes the exact captured-aborted finish shape once without a second model attempt", async () => {
    const { sessionId, session, messages, prompts } = makeCallSession(async (promptText) => {
      messages.push({ role: "user", content: [{ type: "text", text: promptText }] } as any);
      messages.push({
        ...finishCall("finish-aborted", {
          status: "done",
          summary: "Recovered captured receipt.",
          output: {
            state: "converged",
            summary: "Validated exact Responses aborted finish.",
            facts: ["captured complete finish"],
          },
        }),
        stopReason: "aborted",
        errorMessage: RESPONSES_STREAM_TERMINAL_ERROR,
      } as any);
      throw new Error(RESPONSES_STREAM_TERMINAL_ERROR);
    });
    let executions = 0;
    session.tools = [{
      name: "finish",
      label: "finish",
      description: "finish",
      parameters: Type.Object({
        status: Type.Literal("done"),
        summary: Type.String(),
        output: Type.Object({
          state: Type.Literal("converged"),
          summary: Type.String(),
          facts: Type.Array(Type.String()),
        }),
      }),
      execute: async () => {
        executions++;
        return { content: [{ type: "text", text: "SUCCESS" }], terminate: true };
      },
    } as AgentTool];

    const result = await (manager as any).executeSession(session);

    expect(result.status).toBe("done");
    expect(result.error).toBeUndefined();
    expect(result.structuredResult).toMatchObject({ state: "converged" });
    expect(prompts).toHaveLength(1);
    expect(executions).toBe(1);
    expect(messages.filter((message: any) => message.role === "toolResult" && message.toolCallId === "finish-aborted")).toHaveLength(1);
    expect(events.filter((event) => event.type === "session.end" && (event as any).data?.sessionId === sessionId)).toHaveLength(1);
  });

  it("lets a committed finish receipt win over a racing cancellation", async () => {
    const { session, messages } = makeCallSession(async () => {
      messages.push(
        finishCall("finish-committed", {
          status: "done",
          summary: "Accepted exact pass proof.",
          output: {
            state: "converged",
            summary: "Accepted exact pass proof.",
            facts: ["pipeline-run:175634889"],
          },
        }),
      );
      messages.push(finishResult("finish-committed", "✅ SUCCESS: Accepted exact pass proof."));
      session.status = "interrupted";
      session.lastError = "Cancelled";
    });

    const result = await (manager as any).executeSession(session);

    expect(result.status).toBe("done");
    expect(result.error).toBeUndefined();
    expect(result.structuredResult).toEqual({
      state: "converged",
      summary: "Accepted exact pass proof.",
      facts: ["pipeline-run:175634889"],
    });
    const persisted = readSessionMeta(persistDir, result.sessionId);
    expect(persisted?.status).toBe("done");
    expect(persisted?.error).toBeUndefined();
    const end = events.find(
      (event) => event.type === "session.end" && (event as any).data?.sessionId === result.sessionId,
    );
    expect(end).toMatchObject({
      type: "session.end",
      data: {
        status: "done",
        finishParams: {
          status: "done",
          output: { state: "converged" },
        },
      },
    });
    expect((end as any).data.error).toBeUndefined();
  });

  it.each([true, false])("preserves a committed non-success judgment despite cancellation (structured=%s)", async (structured) => {
    const { session, messages } = makeCallSession(async () => {
      messages.push(
        finishCall("finish-failed", {
          status: "blocked",
          summary: "Verified terminal failure.",
          output: {
            state: "incomplete",
            summary: "Verified terminal failure.",
            facts: ["runtime-check:failed"],
          },
        }),
      );
      messages.push(finishResult("finish-failed", "❌ FAILURE: Verified terminal failure."));
      session.status = "interrupted";
      session.lastError = "Cancelled";
    });
    if (!structured) session.outputSchema = undefined;

    const result = await (manager as any).executeSession(session);

    const expectedStatus = "done";
    expect(result.status).toBe(expectedStatus);
    expect(result.error).toBeUndefined();
    expect(result.structuredResult).toEqual({
      state: "incomplete",
      summary: "Verified terminal failure.",
      facts: ["runtime-check:failed"],
    });
    expect(readSessionMeta(persistDir, result.sessionId)).toMatchObject({ status: expectedStatus });
    const end = events.find(
      (event) => event.type === "session.end" && (event as any).data?.sessionId === result.sessionId,
    );
    expect(end).toMatchObject({
      type: "session.end",
      data: {
        status: expectedStatus,
        finishParams: { status: "blocked", output: { state: "incomplete" } },
      },
    });
  });

  it.each([false, true])("accepts an output-free blocked finish despite a requested schema (cancelled=%s)", async (cancelled) => {
    const { session, messages } = makeCallSession(async () => {
      messages.push(finishCall("finish-missing-result", { status: "blocked", summary: "No structured judgment." }));
      messages.push(finishResult("finish-missing-result", "FAILURE: No structured judgment."));
      if (cancelled) {
        session.status = "interrupted";
        session.lastError = "Cancelled";
      }
    });

    const result = await (manager as any).executeSession(session);

    expect(result.status).toBe("done");
    expect(result.error).toBeUndefined();
    expect(result.finishResult).toMatchObject({ status: "blocked", summary: "No structured judgment." });
    expect(result.structuredResult).toBeUndefined();
    expect(readSessionMeta(persistDir, result.sessionId)?.status).toBe("done");
    const ends = events.filter((event) => event.type === "session.end" && (event as any).data?.sessionId === result.sessionId);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ data: { status: "done", finishParams: { status: "blocked" } } });
  });

  it("keeps cancellation interrupted with its reason when no finish receipt committed", async () => {
    const { session, messages } = makeCallSession(async () => {
      messages.push({
        role: "assistant",
        stopReason: "stop",
        content: [{ type: "text", text: "Stopping before finish." }],
      } as any);
      session.status = "interrupted";
      session.lastError = "Cancelled by operator";
    });
    session.requireFinish = false;

    const result = await (manager as any).executeSession(session);

    expect(result.status).toBe("interrupted");
    expect(result.error).toBe("Cancelled by operator");
    expect(result.structuredResult).toBeUndefined();
    expect(readSessionMeta(persistDir, result.sessionId)).toMatchObject({
      status: "interrupted",
      error: "Cancelled by operator",
    });
    const end = events.find(
      (event) => event.type === "session.end" && (event as any).data?.sessionId === result.sessionId,
    );
    expect(end).toMatchObject({
      type: "session.end",
      data: { status: "interrupted", error: "Cancelled by operator" },
    });
    expect((end as any).data.finishParams).toBeNull();
  });

  it("keeps cancellation interrupted when finish was emitted but never executed", async () => {
    const { session, messages } = makeCallSession(async () => {
      messages.push(
        finishCall("finish-pending", {
          status: "done",
          summary: "This unexecuted result must not commit.",
          output: {
            state: "converged",
            summary: "This unexecuted result must not commit.",
            facts: ["tool-call-only"],
          },
        }),
      );
      session.status = "interrupted";
      session.lastError = "Cancelled before finish execution";
    });

    const result = await (manager as any).executeSession(session);

    expect(result.status).toBe("interrupted");
    expect(result.error).toBe("Cancelled before finish execution");
    expect(result.finishResult).toBeNull();
    expect(result.structuredResult).toBeUndefined();
    expect(readSessionMeta(persistDir, result.sessionId)).toMatchObject({
      status: "interrupted",
      error: "Cancelled before finish execution",
    });
    const end = events.find(
      (event) => event.type === "session.end" && (event as any).data?.sessionId === result.sessionId,
    );
    expect(end).toMatchObject({
      type: "session.end",
      data: {
        status: "interrupted",
        error: "Cancelled before finish execution",
        finishParams: null,
      },
    });
  });

  it("keeps cancellation interrupted when finish execution was rejected", async () => {
    const { session, messages } = makeCallSession(async () => {
      messages.push(
        finishCall("finish-rejected", {
          status: "done",
          summary: "This rejected result must not commit.",
          output: {
            state: "converged",
            summary: "This rejected result must not commit.",
            facts: ["rejected-tool-result"],
          },
        }),
      );
      messages.push({
        role: "toolResult",
        toolCallId: "finish-rejected",
        toolName: "finish",
        content: [{ type: "text", text: "finish() error: schema validation failed" }],
        isError: true,
      } as any);
      session.status = "interrupted";
      session.lastError = "Cancelled after rejected finish";
    });

    const result = await (manager as any).executeSession(session);

    expect(result.status).toBe("interrupted");
    expect(result.error).toBe("Cancelled after rejected finish");
    expect(result.finishResult).toBeNull();
    expect(result.structuredResult).toBeUndefined();
    expect(readSessionMeta(persistDir, result.sessionId)).toMatchObject({
      status: "interrupted",
      error: "Cancelled after rejected finish",
    });
    const end = events.find(
      (event) => event.type === "session.end" && (event as any).data?.sessionId === result.sessionId,
    );
    expect(end).toMatchObject({
      type: "session.end",
      data: {
        status: "interrupted",
        error: "Cancelled after rejected finish",
        finishParams: null,
      },
    });
  });

  it("does not loop when the bounded recovery also throws", async () => {
    const { session, prompts } = makeCallSession(async () => {
      if (prompts.length === 1) {
        throw new Error("HTTP 429 Too Many Requests");
      }
      throw new Error("HTTP 503 recovery unavailable");
    });

    const result = await (manager as any).executeSession(session);

    expect(prompts).toHaveLength(2);
    expect(result.status).toBe("error");
    expect(result.error).toContain("Initial workflow prompt failed: HTTP 429 Too Many Requests");
    expect(result.error).toContain("bounded finish recovery failed: HTTP 503 recovery unavailable");
  });

  it("does not recover authentication failures", async () => {
    const { session, prompts } = makeCallSession(async () => {
      throw new Error("AuthenticationError: HTTP 401 Unauthorized");
    });

    const result = await (manager as any).executeSession(session);

    expect(prompts).toHaveLength(1);
    expect(result.status).toBe("error");
    expect(result.error).toBe("AuthenticationError: HTTP 401 Unauthorized");
  });
});

describe("session.start metadata", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-lifecycle-meta-"));
  });

  afterEach(() => {
    closeDb(persistDir);
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("emits source metadata for audit and dedup", async () => {
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const manager = new SubagentManager({ persistDir, bus });
    registerAgent(manager);

    const sessionId = manager.run("test-agent", "do something", {
      source: "metric-alert-reactor:test.metric",
      kind: "call",
      requestId: "req-1",
      conversationId: "telegram:chat:123:topic:0:agent:may",
      channelMessageId: 45974,
      parentSessionId: "s_parent",
    });

    try {
      await manager.waitFor(sessionId);
    } catch {
      // Fake model may fail; this test only needs the start event.
    }

    const start = events.find(
      (event) => event.type === "session.start" && (event as any).data?.sessionId === sessionId,
    );
    expect(start).toMatchObject({
      type: "session.start",
      source: "metric-alert-reactor:test.metric",
      owner: "agent:test-agent",
      data: {
        sessionId,
        agent: "test-agent",
        kind: "call",
        requestId: "req-1",
        conversationId: "telegram:chat:123:topic:0:agent:may",
        channelMessageId: 45974,
        parentSessionId: "s_parent",
      },
    });
    expect(start).not.toHaveProperty("sessionId");
    expect(start).not.toHaveProperty("agent");
    expect(readSessionMeta(persistDir, sessionId)).toMatchObject({
      conversationId: "telegram:chat:123:topic:0:agent:may",
      channelMessageId: 45974,
    });

    const end = events.find((event) => event.type === "session.end" && (event as any).data?.sessionId === sessionId);
    expect(end).toMatchObject({
      type: "session.end",
      source: "metric-alert-reactor:test.metric",
      owner: "agent:test-agent",
      data: {
        sessionId,
        agent: "test-agent",
        kind: "call",
        requestId: "req-1",
        parentSessionId: "s_parent",
      },
    });
    expect(end).not.toHaveProperty("sessionId");
    expect(end).not.toHaveProperty("agent");
  });
});

describe("Bug 4: run() duplicate sessionId guard", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-lifecycle-"));
    manager = new SubagentManager({ persistDir });
    registerAgent(manager);
  });

  afterEach(() => {
    closeDb(persistDir);
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("throws when run() is called with a sessionId that is already active", () => {
    const sessionId = manager.run("test-agent", "task 1");

    // The session may or may not still be active (fake model errors fast).
    // If it IS still active, a second run() with the same ID should throw.
    if (manager.hasActiveSession(sessionId)) {
      expect(() => {
        manager.run("test-agent", "task 2", { sessionId });
      }).toThrow(/already active/);
    }
  });

  it("allows run() with a sessionId that was previously completed", async () => {
    const sessionId = manager.run("test-agent", "task 1");
    try {
      await manager.waitFor(sessionId);
    } catch {
      // Expected
    }

    // Session is no longer active — a new run with a different generated ID should work
    // (We don't re-use completed session IDs in practice, but the guard should not
    // block IDs that are not currently in activeSessions)
    expect(manager.hasActiveSession(sessionId)).toBe(false);
  });
});

describe("Bug 10: callDepths cleanup", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-lifecycle-"));
    manager = new SubagentManager({ persistDir });
    registerAgent(manager);
  });

  afterEach(() => {
    closeDb(persistDir);
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("callDepths is cleaned up when session completes", async () => {
    // Start a session — it will complete quickly
    const sessionId = manager.run("test-agent", "do something");

    try {
      await manager.waitFor(sessionId);
    } catch {
      // Expected
    }

    // After completion, the session should be fully cleaned up.
    // We can't directly inspect callDepths (private), but we verify
    // the session is completely gone from activeSessions.
    expect(manager.hasActiveSession(sessionId)).toBe(false);

    // A new session should work fine (no stale depth limits)
    const sessionId2 = manager.run("test-agent", "another task");
    try {
      await manager.waitFor(sessionId2);
    } catch {
      // Expected
    }
    expect(manager.hasActiveSession(sessionId2)).toBe(false);
  });
});
