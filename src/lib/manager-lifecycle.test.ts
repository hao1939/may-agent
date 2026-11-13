import { AppTaskResourceStore } from "../app/core/state/app-task-resource-store.js";
import { getDb } from "./db/connection.js";
import {
  createAssistantMessageEventStream,
  getCurrentSystemPrompt,
  type AssistantMessage,
} from "@earendil-works/pi-ai";
import type { TaskDetail } from "@may-agent/sdk";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeModel } from "../../test/fixtures/model.js";
import { markStaleSession } from "../../test/fixtures/stale-session.js";
import { EventBus } from "../app/core/events/bus.js";
import { createAgentRun } from "./agent-runner.js";
import { closeDb, getDb } from "./db/connection.js";
import { SubagentManager } from "./manager.js";
import { appendSessionMessage, loadAllSessionMetas } from "./persistence.js";
import type { TaskExecutionContext } from "./task-execution-context.js";
import type { SubagentDefinition } from "./types.js";

function definition(version: string) {
  return {
    name: "worker",
    description: version,
    domain: "test",
    systemPrompt: `Instructions for ${version}`,
    model: { ...fakeModel(), id: version },
    tools: [],
  };
}

function taskContext(root: string, definitions: ReadonlyMap<string, SubagentDefinition>): TaskExecutionContext {
  AppTaskResourceStore.fromDb(getDb(root), "sample").bootstrapSnapshot(
    {
      project: "sample",
      resources: {
        review: {
          metadata: { id: "review", generation: 1, resourceVersion: 1 },
          spec: { parentId: "root", outcome: "Review the candidate", acceptance: ["Done"] },
          status: { phase: "running", observedGeneration: 0, currentAttemptId: "attempt-1" },
        },
      },
      attempts: {
        "attempt-1": {
          metadata: { id: "attempt-1", resourceVersion: 1 },
          taskId: "review",
          taskGeneration: 1,
          specHash: "hash",
          owner: "worker",
          handler: "agent:worker",
          runtimeId: "rt",
          state: "running",
          reason: "event",
          startedAt: new Date().toISOString(),
        },
      },
    },
    "fixture",
  );
  const task: TaskDetail = {
    id: "review",
    parentId: "root",
    generation: 1,
    resourceVersion: 1,
    status: "running",
    outcome: "Review the candidate",
    acceptance: [],
    input: {},
    conditions: [],
    acceptedEvidence: { available: true, maxPageSize: 8 },
    currentObligations: { available: false },
  };
  return {
    taskBinding: { appId: "sample", taskId: task.id, generation: 1, attemptId: "attempt-1" },
    recoveryOwner: "app-task",
    executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
    reconciliation: {
      task,
      appId: "sample",
      taskId: task.id,
      generation: 1,
      resourceVersion: 1,
      agent: "worker",
      outcome: task.outcome,
      acceptance: [],
      input: {},
      events: { items: [], truncated: false },
    },
    taskRead: { get: async () => task },
    observeEvents: () => () => {},
    agentDefinitions: definitions,
  } as unknown as TaskExecutionContext;
}

describe("manager session lifecycle", () => {
  let persistDir: string;
  let manager: SubagentManager;
  let bus: EventBus;
  let holdReplies: boolean;
  let replyFailure: string | undefined;
  let started: ReturnType<typeof Promise.withResolvers<void>>;
  let requests: Array<{ model: string; systemPrompt: string; prompt: string; reply: () => void }>;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-manager-lifecycle-"));
    holdReplies = false;
    replyFailure = undefined;
    started = Promise.withResolvers<void>();
    requests = [];
    bus = new EventBus();
    manager = new SubagentManager({
      persistDir,
      bus,
      agentRunFactory: (config) => {
        return createAgentRun({
          ...config,
          streamFn: (model, context) => {
            const stream = createAssistantMessageEventStream();
            const reply = () => {
              const message: AssistantMessage = {
                role: "assistant",
                api: model.api,
                provider: model.provider,
                model: model.id,
                content: [{ type: "text", text: `Reply from ${model.id}` }],
                stopReason: replyFailure ? "error" : "stop",
                errorMessage: replyFailure,
                timestamp: Date.now(),
                usage: {
                  input: 1,
                  output: 1,
                  totalTokens: 2,
                  cacheRead: 0,
                  cacheWrite: 0,
                  cost: { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0 },
                },
              };
              if (replyFailure) stream.push({ type: "error", reason: "error", error: message });
              else stream.push({ type: "done", reason: "stop", message });
            };
            requests.push({ model: model.id, systemPrompt: getCurrentSystemPrompt(context.messages), prompt: JSON.stringify(context.messages), reply });
            started.resolve();
            if (!holdReplies) reply();
            return stream;
          },
        });
      },
    });
    manager.register(definition("old"));
  });

  afterEach(async () => {
    const sessions = manager.status();
    for (const session of sessions) manager.cancel(session.sessionId);
    for (const request of requests) request.reply();
    try {
      await Promise.allSettled(sessions.map((session) => manager.waitFor(session.sessionId)));
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  const skill = {
    name: "review-guide", description: "Review a patch",
    filePath: "/fixture/review-guide/SKILL.md", canonicalPath: "/fixture/review-guide/SKILL.md",
    content: "Activate the selected review method.", scope: "agent" as const, contentHash: "review-guide-hash",
  };
  const skilledWorker = () => ({
    ...definition("worker"),
    skillCatalog: { skills: new Map([[skill.name, skill]]), diagnostics: [], omittedFromPrompt: [] },
  });

  it.each([
    ["call", "caller-only-guide"], ["fork", "caller-only-guide"],
    ["call", "review-guide"], ["fork", "review-guide"],
  ] as const)("%s treats leading $%s as delegated text", async (action, name) => {
    manager.register(skilledWorker());
    holdReplies = true;
    const caller = manager.run("worker", "Coordinate the review");
    await started.promise;
    holdReplies = false;
    const task = `$${name} Review the patch`;
    const tool = manager.createAgentsTool({ getCallerSessionId: () => caller });
    const response = await tool.execute("delegate", { action, agent: "worker", task });
    const result = JSON.parse((response.content[0] as { text: string }).text);
    expect(result.error).toBeUndefined();
    expect(await manager.waitFor(result.sessionId)).toMatchObject({ status: "done" });
    expect(requests[1].prompt).toContain(task);
    expect(requests[1].prompt).not.toContain(skill.content);
    expect(manager.registryStore.getSession(result.sessionId)?.task).toBe(task);
  });

  it("retains direct skill commands and explicit activation for authored calls", async () => {
    manager.register(skilledWorker());
    const direct = manager.run("worker", "$review-guide Review directly");
    expect(await manager.waitFor(direct)).toMatchObject({ status: "done" });
    expect(requests[0].prompt).toContain(skill.content);
    expect(manager.registryStore.getSession(direct)?.task).toBe("Review directly");
    const authored = await manager.callAgent("worker", "Review in a procedure", { skill: "review-guide" });
    expect(authored.status).toBe("done");
    expect(requests[1].prompt).toContain(skill.content);
    expect(requests[1].prompt).toContain("Review in a procedure");
  });

  it("delivers a helper correction into its next model request without starting another execution", async () => {
    manager.register(skilledWorker());
    holdReplies = true;
    const caller = manager.run("worker", "Coordinate the review");
    await started.promise;
    started = Promise.withResolvers<void>();
    const tool = manager.createAgentsTool({ getCallerSessionId: () => caller });
    const call = async (params: Record<string, unknown>) => {
      const response = await tool.execute("helper-control", params);
      return JSON.parse((response.content[0] as { text: string }).text);
    };
    const helper = await call({ action: "fork", agent: "worker", task: "Inspect the candidate" });
    await started.promise;
    const correction = "$review-guide Preserve the patch and use the available search tool";
    expect(await call({ action: "follow-up", sessionId: helper.sessionId, content: correction }))
      .toMatchObject({ accepted: true, sessionId: helper.sessionId });
    expect(manager.status()).toHaveLength(2);
    holdReplies = false;
    requests[1].reply();
    expect(await manager.waitFor(helper.sessionId)).toMatchObject({ status: "done" });
    expect(requests).toHaveLength(3);
    expect(requests[2].prompt).toContain(correction);
    expect(requests[2].prompt).not.toContain(skill.content);
    expect(JSON.stringify(manager.progress(helper.sessionId))).toContain(correction);
    const closed = await call({ action: "follow-up", sessionId: helper.sessionId, content: "Too late" });
    expect(closed.error).toContain("live helper");
    expect(requests).toHaveLength(3);
  });

  it("keeps an active execution's model and instructions when the registered definition changes", async () => {
    holdReplies = true;
    const oldSession = manager.run("worker", "First assignment");
    await started.promise;
    manager.register(definition("new"));
    requests[0].reply();
    expect(await manager.waitFor(oldSession)).toMatchObject({
      sessionId: oldSession,
      status: "done",
      lastAssistantText: "Reply from old",
    });

    holdReplies = false;
    const newSession = manager.run("worker", "Second assignment");
    expect(await manager.waitFor(newSession)).toMatchObject({
      sessionId: newSession,
      status: "done",
      lastAssistantText: "Reply from new",
    });
    expect(requests.map(({ model, systemPrompt }) => ({ model, systemPrompt }))).toEqual([
      { model: "old", systemPrompt: expect.stringContaining("Instructions for old") },
      { model: "new", systemPrompt: expect.stringContaining("Instructions for new") },
    ]);
  });

  it("executes a captured definition after its registered replacement", async () => {
    const captured = { ...definition("captured"), sessionIdPrefix: "captured" };
    manager.register(captured);
    manager.register(definition("replacement"));
    const sessionId = manager.runDefinition(captured, "Use the captured release");
    expect(sessionId).toMatch(/^captured_/);
    expect(await manager.waitFor(sessionId)).toMatchObject({
      status: "done",
      lastAssistantText: "Reply from captured",
    });
    expect(requests[0]).toMatchObject({
      model: "captured",
      systemPrompt: expect.stringContaining("Instructions for captured"),
    });
  });

  it.each(["call", "fork"] as const)(
    "%s executes the Task's captured helper after registry replacement",
    async (action) => {
      const captured = { ...definition("captured"), name: "helper" };
      manager.register(captured);
      const context = taskContext(persistDir, new Map([[captured.name, captured]]));
      holdReplies = true;
      const caller = manager.run("worker", "Coordinate the review", { taskContext: context });
      await started.promise;
      manager.register({ ...definition("replacement"), name: "helper" });
      holdReplies = false;

      for (const replacement of ["public", "private", "removed"] as const) {
        if (replacement === "private")
          manager.register({
            ...definition("replacement"),
            name: "helper",
            appLocal: true,
            projectId: "another-app",
          });
        if (replacement === "removed") manager.unregister("helper");
        const response = await manager.createAgentsTool({ getCallerSessionId: () => caller }).execute("delegate", {
          action,
          agent: "helper",
          task: "Inspect the candidate",
        });
        const result = JSON.parse((response.content[0] as { text: string }).text);
        expect(result.error).toBeUndefined();
        expect(await manager.waitFor(result.sessionId)).toMatchObject({
          status: "done",
          lastAssistantText: "Reply from captured",
        });
        expect(requests.at(-1)).toMatchObject({
          model: "captured",
          systemPrompt: expect.stringContaining("Instructions for captured"),
        });
      }
    },
  );

  it.each(["call", "fork"] as const)(
    "%s checks the captured helper's App boundary before any execution",
    async (action) => {
      const captured = { ...definition("private"), name: "helper", appLocal: true, projectId: "another-app" };
      manager.register(captured);
      const context = taskContext(persistDir, new Map([[captured.name, captured]]));
      holdReplies = true;
      const caller = manager.run("worker", "Coordinate the review", { taskContext: context });
      await started.promise;
      // Reloading the same name as a public agent cannot grant access to the
      // private definition retained by this attempt.
      manager.register({ ...definition("replacement"), name: "helper" });
      holdReplies = false;
      const before = structuredClone(loadAllSessionMetas(manager.registryStore.persistDir));

      const response = await manager.createAgentsTool({ getCallerSessionId: () => caller }).execute("delegate", {
        action,
        agent: "helper",
        task: "Inspect the candidate",
      });
      const result = JSON.parse((response.content[0] as { text: string }).text);
      expect(result.error).toContain('app-local to "another-app"');
      expect(result.sessionId).toBeUndefined();
      expect(requests).toHaveLength(1);
      expect(manager.status().map((session) => session.sessionId)).toEqual([caller]);
      expect(loadAllSessionMetas(manager.registryStore.persistDir)).toEqual(before);
    },
  );

  it("rejects a premature result and resolves concurrent waiters to the completed result", async () => {
    holdReplies = true;
    const sessionId = manager.run("worker", "Wait for the model reply");
    await started.promise;
    expect(manager.status().find((session) => session.sessionId === sessionId)?.status).toBe("running");
    expect(() => manager.result(sessionId)).toThrow("still running");
    const first = manager.waitFor(sessionId);
    const second = manager.waitFor(sessionId);
    requests[0].reply();
    const results = await Promise.all([first, second]);
    expect(results[0]).toMatchObject({ sessionId, status: "done", lastAssistantText: "Reply from old" });
    expect(results[1]).toEqual(results[0]);
    expect(manager.result(sessionId)).toEqual(results[0]);
  });

  it("retains usage when a persistent chat fails", async () => {
    replyFailure = "Synthetic provider failure";
    const sessionId = manager.run("worker", "Fail this chat input", { kind: "chat", autoClose: "never" });
    await expect(manager.waitForIdle(sessionId)).rejects.toThrow(replyFailure);
    expect(
      getDb(persistDir)
        .prepare(
          `SELECT task_id, outcome,
      json_extract(data, '$.totals.replies') AS replies FROM execution_usage`,
        )
        .all(),
    ).toEqual([{ task_id: null, outcome: "error", replies: 1 }]);
  });

  it("recovers chat usage after restart without adding activity or recounting completed invocations", async () => {
    const completed = manager.run("worker", "Complete before restart");
    await manager.waitFor(completed);
    const sessionId = manager.run("worker", "Chat before restart", { kind: "chat", autoClose: "never" });
    await manager.waitForIdle(sessionId);
    const rows = () =>
      getDb(persistDir)
        .prepare("SELECT id, outcome, duration_ms, updated_at, data FROM execution_usage ORDER BY started_at, rowid")
        .all();
    const before = rows();
    expect(before).toHaveLength(2);
    expect(before[0].outcome).toBe("done");
    expect(before[1].outcome).toBeNull();
    expect(manager.cleanupStaleSessions().interrupted).toHaveLength(0);
    expect(rows()).toEqual(before);

    // Model the previous owner's exit, not just another manager in the same
    // still-live process. Real process lifetime is covered by startup recovery.
    markStaleSession(persistDir, sessionId);
    closeDb(persistDir);
    const recovered = new SubagentManager({ persistDir });
    expect(recovered.cleanupStaleSessions().interrupted).toHaveLength(1);
    expect(rows()).toEqual([before[0], { ...before[1], outcome: "interrupted" }]);
    expect(before[1].duration_ms).toBeNull();
    expect(JSON.parse(before[1].data as string).totals.replies).toBe(1);
    recovered.cleanupStaleSessions();
    expect(rows()).toEqual([before[0], { ...before[1], outcome: "interrupted" }]);
  });

  it("returns no progress when the requested limit is zero", async () => {
    const sessionId = manager.run("worker", "Produce progress");
    await manager.waitFor(sessionId);
    expect(manager.progress(sessionId).length).toBeGreaterThan(0);
    expect(manager.progress(sessionId, 0)).toEqual([]);
  });

  it("preserves a completed result when cancelled later", async () => {
    const sessionId = manager.run("worker", "Complete this assignment");
    const result = await manager.waitFor(sessionId);
    expect(result.status).toBe("done");
    manager.cancel(sessionId);
    expect(manager.result(sessionId)).toEqual(result);
  });

  it("keeps recovered system setup out of progress and results before and after restart", async () => {
    const sessionId = manager.run("worker", "Retain the work history");
    const result = await manager.waitFor(sessionId);
    // Transcript recovery may save system messages along with the work.
    appendSessionMessage(persistDir, sessionId, {
      role: "system", content: "Recovered system setup", timestamp: Date.now(),
    });
    const restarted = new SubagentManager({ persistDir });
    for (const reader of [manager, restarted]) {
      expect(reader.progress(sessionId)).toEqual(result.messages);
      expect(reader.result(sessionId).messages).toEqual(result.messages);
    }
  });

  it("keeps the completed duration when the wall clock advances", async () => {
    const sessionId = manager.run("worker", "Complete before the clock advances");
    const result = await manager.waitFor(sessionId);
    const clock = spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    try {
      expect(manager.result(sessionId).duration).toBe(result.duration);
    } finally {
      clock.mockRestore();
    }
  });

  it("reports missing sessions and agents through the public accessors", async () => {
    expect(() => manager.result("missing")).toThrow('Session "missing" not found');
    expect(() => manager.progress("missing")).toThrow('Session "missing" not found');
    await expect(manager.waitFor("missing")).rejects.toThrow('Session "missing" not found');
    expect(() => manager.run("missing", "assignment")).toThrow('Agent "missing" not registered');
    expect(() => manager.cancel("missing")).not.toThrow();
    expect(manager.status()).toEqual([]);
  });

  it("rejects a stale context-only start and retains the normalized binding on active sessions", () => {
    const context = taskContext(persistDir, new Map());
    const staleContext = {
      ...context,
      taskBinding: { ...context.taskBinding!, generation: 2 },
    } as TaskExecutionContext;
    expect(() => manager.run("worker", "Run with stale context-only binding", { taskContext: staleContext })).toThrow(
      "Task managed start caller is no longer current",
    );
  });
});
