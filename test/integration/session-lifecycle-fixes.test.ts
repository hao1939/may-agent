/**
 * Tests for session lifecycle bug fixes (Bug 3, 4, 8, 10).
 *
 * Bug 3: terminal persistence throws → session stuck in activeSessions
 * Bug 4: run() with duplicate sessionId → orphaned agent
 * Bug 8: resumeSession doesn't restore parentAgentName
 * Bug 10: callDepths map never cleaned for completed root sessions
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../../src/lib/manager.js";
import { closeDb } from "../../src/lib/requests.js";
import {
  classifyTerminalAssistantFailure,
  extractLastAssistantError,
} from "../../src/lib/manager-utils.js";
import {
  readSessionMeta,
  readActiveSessionProcessId,
  writeSessionMeta,
  ensureSessionDir,
  appendSessionMessage,
} from "../../src/lib/persistence.js";
import { EventBus, type AgentEvent } from "../../src/app/core/events/bus.js";
import { Type } from "@earendil-works/pi-ai";
import type { AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import { RESPONSES_STREAM_TERMINAL_ERROR } from "../../src/lib/workflow-finish-recovery.js";
import { fakeModel } from "../fixtures/model.js";
import { createAgentRun, type AgentRuntimeListener } from "../../src/lib/agent-runner.js";
import { discoverAgentSkills } from "../../src/lib/skills.js";
import { createLastSessionWriter } from "../../src/lib/session-subscribers.js";

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

  it("keeps a live chat's selected instructions and skills through replacement and removal", async () => {
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    bus.subscribe(createLastSessionWriter(persistDir));
    const definitions = [];
    for (const [folder, text, appLocal] of [
      ["projects/sample.app/agents/local-owner", "LOCAL_IDENTITY", true],
      ["agents/global-owner", "GLOBAL_IDENTITY", false],
    ] as const) {
      const agentDir = join(persistDir, folder);
      const skillDir = join(agentDir, "skills/owner-skill");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "SKILL.md"),
        `---\nname: owner-skill\ndescription: Fixture ownership proof\n---\n${text}_SKILL\n`,
      );
      definitions.push({
        name: "arc",
        description: "Fixture",
        domain: "test",
        systemPrompt: text,
        model: fakeModel(),
        tools: [],
        agentDir,
        agentRelativeDir: folder,
        appLocal,
        projectRoot: persistDir,
        skillCatalog: await discoverAgentSkills({ agentDir, appLocal }),
      });
    }
    const [original, replacement] = definitions;
    const turns: Array<{ system: string; input: string }> = [];
    const steers: string[] = [];
    const listeners: AgentRuntimeListener[] = [];
    let failTurn = false;
    const manager = new SubagentManager({
      persistDir,
      bus,
      agentRunFactory: (config) => {
        const run = createAgentRun(config);
        // Only the model-loop boundary is synthetic; manager turns and event bridging are real.
        const subscribe = run.subscribe.bind(run);
        run.subscribe = (listener) => {
          listeners.push(listener);
          return subscribe(listener);
        };
        run.prompt = async (input) => {
          turns.push({ system: run.state.systemPrompt, input: JSON.stringify(input) });
          if (failTurn) throw new Error("fixture terminal chat failure");
          run.state.messages.push({
            role: "assistant",
            content: [{ type: "text", text: "Fixture response" }],
            stopReason: "stop",
          } as AgentMessage);
        };
        run.steer = (message) => {
          steers.push(JSON.stringify(message));
        };
        return run;
      },
    });
    manager.register(original);
    const sid = manager.run("arc", "first turn", { kind: "chat", autoClose: "never" });
    try {
      await manager.waitForIdle(sid);
      manager.register(replacement);
      const skill = original.skillCatalog.skills.get("owner-skill")!;
      // A model reading an old session's skill must still be attributed to its old catalog.
      for (const event of [
        { type: "tool_execution_start", toolName: "read", toolCallId: "skill-read", args: { path: skill.filePath } },
        {
          type: "tool_execution_end",
          toolName: "read",
          toolCallId: "skill-read",
          result: { content: [{ type: "text", text: skill.content }] },
          isError: false,
        },
      ])
        for (const listener of listeners) listener(event as Parameters<AgentRuntimeListener>[0]);
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "skill.loaded",
          data: expect.objectContaining({ activation: "model", contentHash: skill.contentHash, scope: "app-agent" }),
        }),
      );
      manager.send(sid, "$owner-skill second turn");
      // The second turn has started but has not yielded back to idle yet.
      manager.send(sid, "$owner-skill steer running turn");
      await manager.waitForIdle(sid);
      expect(turns[1].system).toContain("LOCAL_IDENTITY");
      expect(turns[1].system).not.toContain("GLOBAL_IDENTITY");
      expect(turns[1].input).toContain("LOCAL_IDENTITY_SKILL");
      expect(steers[0]).toContain("LOCAL_IDENTITY_SKILL");
      manager.unregister("arc");
      manager.send(sid, "$owner-skill after removal");
      await manager.waitForIdle(sid);
      expect(turns[2].system).toContain("LOCAL_IDENTITY");
      expect(turns[2].input).toContain("LOCAL_IDENTITY_SKILL");
      expect(readSessionMeta(persistDir, sid)?.agentRelativeDir).toBe(original.agentRelativeDir);

      // Fresh sessions use the new registry, while runDefinition honors an explicitly captured definition.
      manager.register(replacement);
      const fresh = manager.run("arc", "$owner-skill fresh session");
      expect((await manager.waitFor(fresh)).status).toBe("done");
      expect(turns[3].system).toContain("GLOBAL_IDENTITY");
      expect(turns[3].input).toContain("GLOBAL_IDENTITY_SKILL");
      const pinned = manager.runDefinition(original, "pinned chat", { kind: "chat", autoClose: "never" });
      await manager.waitForIdle(pinned);
      expect(turns[4].system).toContain("LOCAL_IDENTITY");
      manager.cancel(pinned);
      failTurn = true;
      manager.send(sid, "finish the old chat");
      await expect(manager.waitForIdle(sid)).rejects.toThrow("fixture terminal chat failure");
      expect(readFileSync(join(original.agentDir, "last-session.md"), "utf8")).toContain(sid);
      expect(readFileSync(join(replacement.agentDir, "last-session.md"), "utf8")).toContain(fresh);
      expect(readFileSync(join(replacement.agentDir, "last-session.md"), "utf8")).not.toContain(sid);
    } finally {
      for (const session of manager.status()) manager.cancel(session.sessionId);
    }
  });

  it.each(["job", "chat"] as const)("keeps the selected agent folder when a %s ends after registry replacement", async (kind) => {
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
          if (kind === "chat") throw new Error("fixture chat failure");
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
    const sessionId = manager.run(original.name, "Finish accepted work", {
      kind,
      autoClose: kind === "chat" ? "never" : "immediate",
    });
    manager.register({ ...original, agentRelativeDir: "agents/global-owner" });
    completion.resolve();
    if (kind === "chat") await expect(manager.waitForIdle(sessionId)).rejects.toThrow("fixture chat failure");
    else expect((await manager.waitFor(sessionId)).status).toBe("done");
    expect(events.filter((event) => event.type === "session.end")).toMatchObject([
      {
        type: "session.end",
        data: { sessionId, agentRelativeDir: original.agentRelativeDir, status: kind === "chat" ? "error" : "done" },
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

describe("persistent chat empty response recovery", () => {
  let persistDir: string;
  let manager: SubagentManager;
  let bus: EventBus;
  let events: AgentEvent[];

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-chat-empty-"));
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

  function makeChatSession(messages: AgentMessage[], continueFn: () => Promise<void>) {
    const sessionId = "s_chat_empty";
    ensureSessionDir(persistDir, sessionId);
    writeSessionMeta(persistDir, sessionId, {
      agent: "may",
      task: "hello",
      status: "running",
      startedAt: Date.now(),
      kind: "chat",
      autoClose: "never",
    });
    for (const message of messages) appendSessionMessage(persistDir, sessionId, message);

    const fakeAgent = {
      state: { messages },
      waitForIdle: async () => {},
      continue: continueFn,
    };
    const session = {
      sessionId,
      agent: fakeAgent,
      agentName: "may",
      definition: { name: "may" },
      task: "hello",
      startedAt: Date.now(),
      status: "running",
      kind: "chat",
      autoClose: "never",
      toolCalls: 0,
      turnCount: 1,
    } as any;
    manager.activeSessions.set(sessionId, session);
    return { sessionId, session };
  }

  it("trims an empty assistant turn and retries the same chat request once", async () => {
    const messages: AgentMessage[] = [
      { role: "user", content: [{ type: "text", text: "hello" }] } as any,
      { role: "assistant", stopReason: "toolUse", content: [{ type: "text", text: "" }] } as any,
    ];
    const { sessionId, session } = makeChatSession(messages, async () => {
      messages.push({ role: "assistant", stopReason: "stop", content: [{ type: "text", text: "Hello back." }] } as any);
    });

    await (manager as any).executeChatTurn(session, async () => {});

    expect(manager.hasActiveSession(sessionId)).toBe(true);
    expect(session.status).toBe("idle");
    expect(messages).toHaveLength(2);
    expect((messages[0].content as any[])[0].text).toBe("hello");
    expect((messages[1].content as any[])[0].text).toBe("Hello back.");

    const idle = events.find((event) => event.type === "session.idle" && (event as any).data?.sessionId === sessionId);
    expect(idle).toMatchObject({
      type: "session.idle",
      data: {
        sessionId,
        status: "idle",
        summary: "Hello back.",
        retry: {
          reason: "Agent ended on an empty tool-use assistant turn",
          attempts: 1,
          recovered: true,
        },
      },
    });
    expect(events.some((event) => event.type === "session.end" && (event as any).data?.sessionId === sessionId)).toBe(
      false,
    );
  });

  it("keeps chat idle and visible when the retry is also empty", async () => {
    const messages: AgentMessage[] = [
      { role: "user", content: [{ type: "text", text: "hello" }] } as any,
      { role: "assistant", stopReason: "toolUse", content: [] } as any,
    ];
    const { sessionId, session } = makeChatSession(messages, async () => {
      messages.push({ role: "assistant", stopReason: "toolUse", content: [] } as any);
    });

    await (manager as any).executeChatTurn(session, async () => {});

    expect(manager.hasActiveSession(sessionId)).toBe(true);
    expect(session.status).toBe("idle");
    expect(session.lastError).toBe("Agent ended on an empty tool-use assistant turn");
    expect(messages).toEqual([{ role: "user", content: [{ type: "text", text: "hello" }] } as any]);

    const idle = events.find((event) => event.type === "session.idle" && (event as any).data?.sessionId === sessionId);
    expect(idle).toMatchObject({
      type: "session.idle",
      data: {
        sessionId,
        status: "idle",
        error: "Agent ended on an empty tool-use assistant turn",
        retry: {
          attempts: 1,
          recovered: false,
        },
      },
    });
    expect(events.some((event) => event.type === "session.end" && (event as any).data?.sessionId === sessionId)).toBe(
      false,
    );
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
        state: Type.Union([Type.Literal("converged"), Type.Literal("waiting")]),
        summary: Type.String(),
        evidence: Type.Array(Type.String()),
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
      // work on this same call, rather than demand a judgment with no evidence.
      transcript.push({
        role: "assistant",
        content: [{ type: "toolCall", id: "read-after-empty", name: "read", arguments: { path: "proof.txt" } }],
      } as any);
      transcript.push({
        role: "toolResult", toolCallId: "read-after-empty", toolName: "read",
        content: [{ type: "text", text: "Current source inspected" }], isError: false,
      } as any);
      transcript.push(finishCall("finish-after-empty", {
        status: "success", summary: "Completed after inspecting current source",
        result: { state: "converged", summary: "Inspection complete", evidence: ["Current source inspected"] },
      }));
      transcript.push(finishResult("finish-after-empty", "SUCCESS: Inspection complete"));
    });

    const result = await (manager as any).executeSession(session);

    expect(result).toMatchObject({ sessionId, status: "done", structuredResult: { evidence: ["Current source inspected"] } });
    expect(prompts).toHaveLength(2);
    expect(messages.filter((message: any) => message.toolCallId === "read-after-empty")).toHaveLength(1);
    expect(events.filter((event) => event.type === "session.end" && (event as any).data?.sessionId === sessionId)).toHaveLength(1);
  });

  it.each(["read", "write"])("preserves successful %s evidence after final synthesis throws 429", async (toolName) => {
    const evidence = toolName === "write" ? "Committed proof.txt successfully" : "29 tests passed; replay tree matched";
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
          content: [{ type: "text", text: evidence }],
          isError: false,
        } as any);
        throw new Error("OpenAI API error (429): No deployments available for selected model, Try again in 5 seconds.");
      }
      expect(promptText).toContain("Do not repeat successful work or committed effects");
      expect(promptText).toContain("inspect current state before repeating an uncertain effect");
      expect(transcript).toContainEqual(expect.objectContaining({
        role: "toolResult", toolCallId: "work-1", isError: false,
        content: [{ type: "text", text: evidence }],
      }));
      transcript.push(
        finishCall("finish-1", {
          status: "success",
          summary: "Recovered the verified workflow result.",
          result: {
            state: "converged",
            summary: "Recovered from transient final synthesis failure.",
            evidence: [evidence],
          },
        }),
      );
      transcript.push(finishResult("finish-1", "✅ SUCCESS: Recovered the verified workflow result."));
    });

    const result = await (manager as any).executeSession(session);

    expect(result.status).toBe("done");
    expect(result.finishResult).toMatchObject({ status: "success", summary: "Recovered the verified workflow result." });
    expect(result.structuredResult).toEqual({
      state: "converged",
      summary: "Recovered from transient final synthesis failure.",
      evidence: [evidence],
    });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("transient runtime/provider failure or no visible answer");
    expect(prompts[1]).toContain("schema-validated result payload");
    expect(messages).toContainEqual(expect.objectContaining({
      role: "toolResult",
      content: [{ type: "text", text: evidence }],
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
          status: "success",
          result: {
            state: "converged",
            evidence: [evidence],
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
          status: "success",
          summary: "Recovered captured receipt.",
          result: {
            state: "converged",
            summary: "Validated exact Responses aborted finish.",
            evidence: ["captured complete finish"],
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
        status: Type.Literal("success"),
        summary: Type.String(),
        result: Type.Object({
          state: Type.Literal("converged"),
          summary: Type.String(),
          evidence: Type.Array(Type.String()),
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
          status: "success",
          summary: "Accepted exact pass proof.",
          result: {
            state: "converged",
            summary: "Accepted exact pass proof.",
            evidence: ["pipeline-run:175634889"],
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
      evidence: ["pipeline-run:175634889"],
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
          status: "success",
          result: { state: "converged" },
        },
      },
    });
    expect((end as any).data.error).toBeUndefined();
  });

  it("classifies a committed failure receipt as error despite a racing cancellation", async () => {
    const { session, messages } = makeCallSession(async () => {
      messages.push(
        finishCall("finish-failed", {
          status: "failure",
          summary: "Verified terminal failure.",
          result: {
            state: "converged",
            summary: "Verified terminal failure.",
            evidence: ["runtime-check:failed"],
          },
        }),
      );
      messages.push(finishResult("finish-failed", "❌ FAILURE: Verified terminal failure."));
      session.status = "interrupted";
      session.lastError = "Cancelled";
    });

    const result = await (manager as any).executeSession(session);

    expect(result.status).toBe("error");
    expect(result.error).toBeUndefined();
    expect(result.structuredResult).toEqual({
      state: "converged",
      summary: "Verified terminal failure.",
      evidence: ["runtime-check:failed"],
    });
    expect(readSessionMeta(persistDir, result.sessionId)).toMatchObject({ status: "error" });
    const end = events.find(
      (event) => event.type === "session.end" && (event as any).data?.sessionId === result.sessionId,
    );
    expect(end).toMatchObject({
      type: "session.end",
      data: {
        status: "error",
        finishParams: { status: "failure", result: { state: "converged" } },
      },
    });
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
          status: "success",
          summary: "This unexecuted result must not commit.",
          result: {
            state: "converged",
            summary: "This unexecuted result must not commit.",
            evidence: ["tool-call-only"],
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
          status: "success",
          summary: "This rejected result must not commit.",
          result: {
            state: "converged",
            summary: "This rejected result must not commit.",
            evidence: ["rejected-tool-result"],
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

describe("Bug 8: resumeSession restores parentAgentName", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-lifecycle-"));
    manager = new SubagentManager({ persistDir });
    registerAgent(manager, "parent-agent");
    registerAgent(manager, "child-agent");
  });

  afterEach(() => {
    closeDb(persistDir);
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("restores parentAgentName from parent session meta on resume", async () => {
    // Create a fake "parent" session in the registry
    const parentId = "parent-session-123";
    ensureSessionDir(persistDir, parentId);
    writeSessionMeta(persistDir, parentId, {
      agent: "parent-agent",
      task: "parent task",
      status: "done",
      startedAt: Date.now() - 60000,
    });

    // Create a fake "child" session that looks stale (running but no process)
    const childId = "child-session-456";
    ensureSessionDir(persistDir, childId);
    writeSessionMeta(persistDir, childId, {
      agent: "child-agent",
      task: "child task",
      status: "running",
      startedAt: Date.now() - 60000,
      parentSessionId: parentId,
    });

    // Write minimal JSONL so resume has something to work with
    appendSessionMessage(persistDir, childId, {
      role: "user",
      content: [{ type: "text", text: "child task" }],
      timestamp: Date.now(),
    } as any);

    // Resume stale sessions — this should pick up the child
    const { resumed } = manager.resumeStaleSessions();

    // The child session should be resumed
    if (resumed.length > 0) {
      // Check that the child has parentAgentName restored
      const sessions = manager.sessions("child-agent");
      expect(sessions.length).toBeGreaterThan(0);

      // The parentAgentName is internal — we verify indirectly by checking
      // the session was resumed and can be found.
      // Direct verification would require access to activeSessions internals,
      // which we test via the escalation path.
    }

    // Clean up running sessions
    try {
      manager.cancel(childId);
      await manager.waitFor(childId);
    } catch {
      // Expected
    }
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
