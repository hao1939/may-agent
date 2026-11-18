import { AppTaskResourceStore } from "../app/core/state/app-task-resource-store.js";
import {
  createAssistantMessageEventStream,
  getCurrentSystemPrompt,
  getCurrentTools,
  type AssistantMessage,
} from "@earendil-works/pi-ai";
import type { TaskDetail } from "@may-agent/sdk/app";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeModel } from "../../test/fixtures/model.js";
import { markStaleSession } from "../../test/fixtures/stale-session.js";
import { EventBus } from "../app/core/events/bus.js";
import { createAgentRun } from "@may-agent/sdk/runtime";
import historicalTranscripts from "../../test/fixtures/pre-migration-finish-transcripts.json";
import { agentExecutionResult } from "./agent-execution.js";
import { closeDb, getDb } from "./db/connection.js";
import { SubagentManager, type RunOptions } from "./manager.js";
import { appendSessionMessage, readActiveSessionProcessId } from "./persistence.js";
import type { TaskExecutionContext } from "./task-execution-context.js";
import type { SubagentDefinition } from "@may-agent/sdk/runtime";

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
  let neverFinish: Set<string>;
  let started: ReturnType<typeof Promise.withResolvers<void>>;
  let requests: Array<{ model: string; systemPrompt: string; prompt: string; reply: () => void }>;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-manager-lifecycle-"));
    holdReplies = false;
    replyFailure = undefined;
    neverFinish = new Set();
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
              const requiresFinish = getCurrentTools(context.messages).some((tool) => tool.name === "finish");
              const message: AssistantMessage = {
                role: "assistant",
                api: model.api,
                provider: model.provider,
                model: model.id,
                content: requiresFinish && !neverFinish.has(model.id)
                  ? [{
                      type: "toolCall",
                      id: `finish-${model.id}`,
                      name: "finish",
                      arguments: {
                        status: "done",
                        summary: `Reply from ${model.id}`,
                        output: { model: model.id },
                        facts: ["finish committed"],
                      },
                    }]
                  : [{ type: "text", text: `Reply from ${model.id}` }],
                stopReason: replyFailure ? "error" : requiresFinish && !neverFinish.has(model.id) ? "toolUse" : "stop",
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

  it.each(["caller-only-guide", "review-guide"] as const)(
    "canonical call treats leading $%s as delegated text",
    async (name) => {
      manager.register(skilledWorker());
      holdReplies = true;
      const caller = manager.run("worker", "Coordinate the review");
      await started.promise;
      holdReplies = false;
      const prompt = `$${name} Review the patch`;
      const response = await manager.createAgentsTool({ getCallerSessionId: () => caller }).execute(
        "delegate",
        { action: "call", agent: "global/worker", input: { prompt } },
        new AbortController().signal,
      );
      const result = JSON.parse((response.content[0] as { text: string }).text);
      expect(result).toEqual({ id: expect.any(String), status: "done", summary: "Reply from worker", output: { model: "worker" }, facts: ["finish committed"] });
      expect(requests[1].prompt).toContain(prompt);
      expect(requests[1].prompt).not.toContain(skill.content);
    },
  );

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

  it("delivers an internal helper correction into its next model request without starting another execution", async () => {
    manager.register(skilledWorker());
    holdReplies = true;
    const caller = manager.run("worker", "Coordinate the review");
    await started.promise;
    started = Promise.withResolvers<void>();
    const helperResult = manager.callAgentDefinition(
      manager.getAgentDefinition("global/worker")!,
      "Inspect the candidate",
      { parentSessionId: caller, source: "agents.call", parseSkillCommand: false },
    );
    await started.promise;
    const helperId = manager.status().find((session) => session.parentSessionId === caller)?.sessionId;
    expect(helperId).toBeString();
    const correction = "$review-guide Preserve the patch and use the available search tool";
    manager.followUpHelper(helperId!, correction, caller);
    expect(manager.status()).toHaveLength(2);
    holdReplies = false;
    requests[1].reply();
    expect(await helperResult).toMatchObject({ sessionId: helperId, status: "done" });
    expect(requests).toHaveLength(3);
    expect(requests[2].prompt).toContain(correction);
    expect(requests[2].prompt).not.toContain(skill.content);
    expect(JSON.stringify(manager.progress(helperId!))).toContain(correction);
    expect(() => manager.followUpHelper(helperId!, "Too late", caller)).toThrow("live helper");
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

  it("canonical call executes the Task's captured helper after registry replacement", async () => {
    const captured = { ...definition("captured"), name: "helper" };
    manager.register(captured);
    const context = taskContext(persistDir, new Map([["global/helper", captured]]));
    holdReplies = true;
    const caller = manager.run("worker", "Coordinate the review", { taskContext: context });
    await started.promise;
    const tool = manager.createAgentsTool({ getCallerSessionId: () => caller });
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
      const response = await tool.execute(
        "delegate",
        { action: "call", agent: "global/helper", input: { prompt: "Inspect the candidate" } },
        new AbortController().signal,
      );
      const result = JSON.parse((response.content[0] as { text: string }).text);
      const childId = result.id as string;
      expect(result).toEqual({ id: expect.any(String), status: "done", summary: "Reply from captured", output: { model: "captured" }, facts: ["finish committed"] });
      expect(manager.result(childId)).toMatchObject({
        sessionId: childId,
        status: "done",
        lastAssistantText: "Reply from captured",
      });
      expect(requests.at(-1)).toMatchObject({
        model: "captured",
        systemPrompt: expect.stringContaining("Instructions for captured"),
      });
    }
  });

  it("returns the real canonical child id when a provider ignores one bounded finish correction", async () => {
    const unfinished = { ...definition("never-finish"), name: "unfinished" };
    neverFinish.add(unfinished.model.id);
    manager.register(unfinished);
    holdReplies = true;
    const caller = manager.run("worker", "Coordinate the review");
    await started.promise;
    holdReplies = false;

    const response = await manager.createAgentsTool({ getCallerSessionId: () => caller }).execute(
      "delegate",
      { action: "call", agent: "global/unfinished", input: { prompt: "Return a canonical report" } },
      new AbortController().signal,
    );
    const result = JSON.parse((response.content[0] as { text: string }).text);
    const childId = result.id as string;

    expect(result).toEqual({
      id: expect.any(String),
      status: "error",
      summary: "Workflow agent step ended without calling finish() after one corrective prompt",
    });
    const childResult = manager.result(childId);
    expect(childResult).toMatchObject({ sessionId: childId, status: "error" });
    expect(childResult.finishResult).toBeNull();
    expect(childResult.structuredResult).toBeUndefined();
    const childRequests = requests.filter((request) => request.model === unfinished.model.id);
    expect(childRequests).toHaveLength(2);
    expect(childRequests[1]!.prompt).toContain("Call finish() now");
  });

  it("retains the captured helper's exact App-qualified identity after registry replacement", async () => {
    const captured = { ...definition("private"), name: "helper", appLocal: true, projectId: "another-app" };
    manager.register(captured);
    const context = taskContext(persistDir, new Map([["another-app/helper", captured]]));
    holdReplies = true;
    const caller = manager.run("worker", "Coordinate the review", { taskContext: context });
    await started.promise;
    const tool = manager.createAgentsTool({ getCallerSessionId: () => caller });
    manager.register({ ...definition("replacement"), name: "helper" });
    holdReplies = false;

    const missingResponse = await tool.execute(
      "delegate-missing",
      { action: "call", agent: "global/helper", input: { prompt: "Do not change namespaces" } },
      new AbortController().signal,
    );
    expect(JSON.parse((missingResponse.content[0] as { text: string }).text)).toEqual({
      status: "error",
      summary: "Callable target not found: global/helper",
    });

    const response = await tool.execute(
      "delegate",
      { action: "call", agent: "another-app/helper", input: { prompt: "Inspect the candidate" } },
      new AbortController().signal,
    );
    const result = JSON.parse((response.content[0] as { text: string }).text);
    const childId = result.id as string;
    expect(result).toEqual({ id: expect.any(String), status: "done", summary: "Reply from private", output: { model: "private" }, facts: ["finish committed"] });
    expect(manager.result(childId)).toMatchObject({ sessionId: childId, status: "done" });
    expect(requests.at(-1)).toMatchObject({
      model: "private",
      systemPrompt: expect.stringContaining("Instructions for private"),
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

  it("restores pre-migration finish output, evidence, and noncompletion dispositions", () => {
    const restore = (
      sessionId: string,
      messages: unknown[],
      status: "done" | "error" | "interrupted" = "done",
    ) => {
      manager.registryStore.saveSession(sessionId, {
        agent: "worker",
        task: "Historical fixture",
        status,
        startedAt: 1,
        endedAt: 2,
        ...(status === "error" ? { error: "Historical runtime error" } : {}),
      });
      for (const message of messages) appendSessionMessage(persistDir, sessionId, message as never);
      return agentExecutionResult(manager.result(sessionId));
    };

    expect(restore("legacy-success", historicalTranscripts.successWithFalseOutput)).toMatchObject({
      status: "done",
      summary: "Historical success",
      output: false,
      facts: {
        deliverables: [{ path: "report.md", description: "Historical report" }],
        verification_facts: ["Historical check passed"],
      },
    });
    expect(restore("legacy-partial", historicalTranscripts.partialWithNullOutput)).toMatchObject({
      status: "blocked",
      summary: "Historical work remains",
      output: null,
      facts: {
        blockers: [{ reason: "External review pending", context: "The saved work is not complete" }],
        verification_evidence: ["Historical draft retained"],
      },
    });
    expect(restore("legacy-blocked-evidence", historicalTranscripts.blockedWithEvidenceOnly)).toMatchObject({
      status: "blocked",
      summary: "Historical review remains",
      facts: {
        verification_facts: ["Historical source checks passed"],
        verification_evidence: ["Historical candidate retained"],
        next_steps: ["Obtain external review"],
      },
    });
    expect(restore("legacy-failure", historicalTranscripts.failure)).toMatchObject({
      status: "error",
      summary: "Historical verification failed",
      output: { passed: false },
      facts: { verification_facts: ["Historical test exited 1"] },
    });
    expect(restore("legacy-runtime-error", historicalTranscripts.partialWithNullOutput, "error")).toMatchObject({
      status: "error",
      summary: "Historical runtime error",
      output: null,
    });
    expect(restore("legacy-interrupted", historicalTranscripts.successWithFalseOutput, "interrupted")).toMatchObject({
      status: "interrupted",
      summary: "Historical success",
      output: false,
    });
  });

  it("retains usage when a managed execution fails", async () => {
    replyFailure = "Synthetic provider failure";
    const sessionId = manager.run("worker", "Fail this input");
    expect(await manager.waitFor(sessionId)).toMatchObject({ status: "error", error: replyFailure });
    expect(
      getDb(persistDir)
        .prepare(
          `SELECT task_id, outcome,
      json_extract(data, '$.totals.replies') AS replies FROM execution_usage`,
        )
        .all(),
    ).toEqual([{ task_id: null, outcome: "error", replies: 1 }]);
  });

  it.each([{ kind: "chat" }, { autoClose: "never" }, { autoClose: "immediate" }, { autoClose: undefined }])(
    "rejects retired managed start options before dispatch: %j",
    (options) => {
      const opts = { sessionId: "retired-start", ...options } as RunOptions;
      expect(() => manager.run("worker", "Do not dispatch", opts)).toThrow(/persistent chat|autoClose/);
      expect(manager.hasActiveSession(opts.sessionId!)).toBe(false);
      expect(manager.registry.getSession(opts.sessionId!)).toBeNull();
      expect(requests).toEqual([]);
    },
  );

  it("keeps an exited parked chat idle across restart and never returns it as done", async () => {
    const sessionId = "historical-idle";
    const history = { agent: "worker", task: "Old turn", kind: "chat", status: "idle", startedAt: 1 } as const;
    manager.registry.saveSession(sessionId, { ...history, autoClose: "never" });
    getDb(persistDir).prepare(
      "INSERT INTO sessions (sessionId, agent, task, kind, status, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(sessionId, history.agent, history.task, history.kind, history.status, history.startedAt);
    markStaleSession(persistDir, sessionId);
    closeDb(persistDir);
    const recovered = new SubagentManager({ persistDir });
    for (let replay = 0; replay < 2; replay++) {
      expect(recovered.cleanupStaleSessions().interrupted).toEqual([]);
      expect(recovered.registry.getSession(sessionId)).toMatchObject(history);
      expect(getDb(persistDir).prepare("SELECT kind, status, endedAt FROM sessions WHERE sessionId = ?").get(sessionId))
        .toEqual({ kind: "chat", status: "idle", endedAt: null });
      expect(recovered.getSessionSummary(sessionId)).toMatchObject({ status: "idle" });
      expect(recovered.hasActiveSession(sessionId)).toBe(false);
      expect(readActiveSessionProcessId(persistDir, sessionId)).toBeNull();
      await expect(recovered.waitFor(sessionId)).rejects.toThrow("historical idle");
    }
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
