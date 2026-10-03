import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { fakeModel } from "../../test/fixtures/model.js";
import { createAgentRun } from "./agent-runner.js";
import { closeDb, getDb } from "./db/connection.js";
import { SubagentManager } from "./manager.js";

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

describe("manager session lifecycle", () => {
  let persistDir: string;
  let manager: SubagentManager;
  let holdReplies: boolean;
  let replyFailure: string | undefined;
  let started: ReturnType<typeof Promise.withResolvers<void>>;
  let requests: Array<{ model: string; systemPrompt: string; reply: () => void }>;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-manager-lifecycle-"));
    holdReplies = false;
    replyFailure = undefined;
    started = Promise.withResolvers<void>();
    requests = [];
    manager = new SubagentManager({
      persistDir,
      agentRunFactory: (config) =>
        createAgentRun({
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
            requests.push({ model: model.id, systemPrompt: context.systemPrompt ?? "", reply });
            started.resolve();
            if (!holdReplies) reply();
            return stream;
          },
        }),
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

  it("records persistent chat replies without recounting retained history on resume", async () => {
    const taskBinding = { appId: "example", taskId: "conversation", generation: 1, attemptId: "attempt-1" };
    const sessionId = manager.run("worker", "First chat input", { kind: "chat", autoClose: "never", taskBinding });
    const rows = () =>
      getDb(persistDir)
        .prepare(
          `SELECT app_id, task_id, attempt_id, outcome,
      json_extract(data, '$.totals.replies') AS replies,
      json_extract(data, '$.totals.input') AS input FROM execution_usage ORDER BY started_at, rowid`,
        )
        .all();
    await manager.waitForIdle(sessionId);
    expect(rows()).toEqual([
      { app_id: "example", task_id: "conversation", attempt_id: "attempt-1", outcome: null, replies: 1, input: 1 },
    ]);

    manager.send(sessionId, "Second chat input");
    await manager.waitForIdle(sessionId);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ outcome: null, replies: 2, input: 2 });
    manager.close(sessionId);
    expect(rows()[0]).toMatchObject({ outcome: "interrupted", replies: 2 });

    manager.resumeSession(sessionId, "New work after resume", {
      taskBinding: { ...taskBinding, attemptId: "attempt-2" },
    });
    await manager.waitForIdle(sessionId);
    expect(rows()).toHaveLength(2);
    expect(rows()[1]).toMatchObject({
      app_id: "example",
      task_id: "conversation",
      attempt_id: "attempt-2",
      outcome: null,
      replies: 1,
      input: 1,
    });
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
    const sessionId = manager.run("worker", "Chat before restart", { kind: "chat", autoClose: "never" });
    await manager.waitForIdle(sessionId);
    manager.close(sessionId);
    manager.resumeSession(sessionId, "Another invocation before restart");
    await manager.waitForIdle(sessionId);
    const rows = () =>
      getDb(persistDir)
        .prepare("SELECT id, outcome, duration_ms, updated_at, data FROM execution_usage ORDER BY started_at, rowid")
        .all();
    const before = rows();
    expect(before).toHaveLength(2);
    expect(before[0].outcome).toBe("interrupted");
    expect(before[1].outcome).toBeNull();
    expect(manager.resumeStaleSessions({ abort: true, kinds: ["chat"] }).interrupted).toHaveLength(0);
    expect(rows()).toEqual(before);

    // A new manager has no in-memory usage observer from the previous process.
    closeDb(persistDir);
    const recovered = new SubagentManager({ persistDir });
    expect(recovered.resumeStaleSessions({ abort: true, kinds: ["chat"] }).interrupted).toHaveLength(1);
    expect(rows()).toEqual([before[0], { ...before[1], outcome: "interrupted" }]);
    expect(before[1].duration_ms).toBeNull();
    expect(JSON.parse(before[1].data as string).totals.replies).toBe(1);
    recovered.resumeStaleSessions({ abort: true, kinds: ["chat"] });
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
});
