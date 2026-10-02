import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { usageReply } from "../../../test/fixtures/execution-usage.js";
import { fakeModel } from "../../../test/fixtures/model.js";
import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, conversationTurnResultSchema, defineApp, type AppInputContext } from "@may-agent/sdk";
import { Check } from "typebox/value";
import { executePreparedAgent, prepareAgentExecution } from "../../lib/agent-execution.js";
import { openDatabase, type SqliteDb } from "../../lib/db.js";
import { applyDbSchema } from "../../lib/db/schema.js";
import type { SubagentManager } from "../../lib/index.js";
import type { CallOptions, SubagentDefinition } from "../../lib/types.js";
import { createReadTool } from "../../lib/tools/read.js";
import { createEditTool } from "../../lib/tools/edit.js";
import { createWriteTool } from "../../lib/tools/write.js";
import { createBashTool } from "../../lib/tools/bash.js";
import { createFinishTool } from "../../lib/tools/lifecycle.js";
import type { AppRegistry } from "../core/apps/registry.js";
import { createConversationAgentResolver } from "./turn-agent.js";
import type { AppInputResolver } from "../core/tasks/execution.js";
import { readAppConversationResource, readConversationContext } from "../core/state/conversations.js";
import { applyConversationRequestUpdates, readConversationRequest } from "../core/state/conversation-requests.js";
import { getDb, closeDb } from "../../lib/requests.js";
import { EventBus } from "../core/events/bus.js";
import { createTaskExecutionBackends } from "../composition/task-execution.js";
import { createAppTaskCapability } from "../core/tasks/app-task-capability.js";
import {
  installAppTaskRuntimes,
  closeInstalledAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} from "../core/tasks/app-task-runtime.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
import { getAppInboxItem } from "../core/state/app-inbox-store.js";

const input = (kind: string) => Type.Object({ kind: Type.Literal(kind), data: Type.Object({ text: Type.String() }) });
const may = defineApp({
  id: "may",
  version: 1,
  agent: "may",
  inputSchema: Type.Union([input("message"), input("goal")]),
  conversation: { mode: "agent", inputKinds: ["message"] },
  task: (request) => ({ kind: "existing", taskId: request.id }),
  tasks: {},
});
const owner = defineApp({
  id: "owner",
  version: 1,
  agent: "owner",
  inputSchema: input("work"),
  task: (request) => ({ kind: "existing", taskId: request.id }),
  tasks: {},
});
const request: AppInputContext = {
  id: "turn-1",
  source: { kind: "human", id: "human-1" },
  input: { kind: "message", data: { text: "Review the options" } },
};
const answer = { summary: "Answered", response: "Here are the options.", topic: { kind: "none" } };
describe("conversational attempt contract", () => {
  const databases: SqliteDb[] = [];
  const roots: string[] = [];
  const runtimes: EventBus[] = [];
  afterEach(async () => {
    for (const bus of runtimes.splice(0)) await closeInstalledAppTaskRuntimes(bus);
    setSystemTime();
    databases.splice(0).forEach((db) => db.close());
    roots.splice(0).forEach((root) => {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    });
  });

  async function taskRuntime(root: string, manager: SubagentManager, frontend = may) {
    const bus = new EventBus();
    runtimes.push(bus);
    const entries = [frontend, owner].map((definition) => {
      const appDir = join(root, `${definition.id}.app`);
      mkdirSync(appDir, { recursive: true });
      return { appDir, definition };
    });
    const db = getDb(root);
    await installAppTaskRuntimes(
      {
        projectRoot: root,
        projectsRoot: root,
        persistDir: root,
        bus,
        installControllers: false,
        appRegistrySnapshot: { id: "turn-tool-loop", generation: 1, entries },
        conversations: createTaskExecutionBackends({ manager, bus }).conversations,
      },
      { deferRecovery: true },
    );
    return {
      bus,
      db,
      store: AppTaskResourceStore.activeFromDb(db, frontend.id)!,
      admit: createAppTaskCapability({ bus }).admitConversation,
      run: (taskId: string) =>
        reconcileLoadedAppTaskOnce({
          bus,
          appId: frontend.id,
          taskId,
          dispatch: { lane: "human", enqueuedAt: Date.now(), startedAt: Date.now(), readyWaitMs: 0 },
        }),
    };
  }

  async function attempt(
    current = request,
    app = may,
    execution: Omit<Parameters<AppInputResolver>[0]["execution"], "outputSchema" | "readContext"> & {
      readContext?: Parameters<AppInputResolver>[0]["execution"]["readContext"];
      outputSchema?: Parameters<AppInputResolver>[0]["execution"]["outputSchema"];
    } = {
      signal: new AbortController().signal,
      sessionStarted: () => {},
      taskBinding: { appId: app.id, taskId: "conversation", generation: 1, attemptId: "attempt" },
    },
  ) {
    const db = openDatabase(":memory:");
    databases.push(db);
    applyDbSchema(db);
    let captured: { definition: SubagentDefinition; prompt: string; options: CallOptions } | undefined;
    const calls: Array<{ prompt: string; options: CallOptions }> = [];
    const manager = {
      getAgentDefinition: () => ({ name: "may", tools: [] }) as unknown as SubagentDefinition,
      callAgentDefinition: async (_definition: SubagentDefinition, prompt: string, options: CallOptions) => {
        captured = { definition: _definition, prompt, options };
        calls.push(captured);
        return { status: "done", structuredResult: answer };
      },
    } as unknown as SubagentManager;
    const registry = {
      snapshot: () => ({ entries: [app, owner].map((definition) => ({ appDir: definition.id, definition })) }),
    } as unknown as AppRegistry;
    const resolve = createConversationAgentResolver({ manager, registry });
    expect(
      await resolve({
        app,
        inputContext: current,
        execution: {
          outputSchema: conversationTurnResultSchema,
          readContext: (query) => readConversationContext(db, app.id, "chat", query),
          ...execution,
        },
      }),
    ).toEqual(answer);
    return { ...captured!, db, resolve, calls };
  }

  it("keeps a Task-owned Conversation session under that Task's recovery authority", async () => {
    const taskBinding = { appId: may.id, taskId: "conversation", generation: 1, attemptId: "attempt" };
    const { options } = await attempt(request, may, {
      signal: new AbortController().signal, sessionStarted: () => {}, taskBinding,
    });
    expect(options).toMatchObject({ recoveryOwner: "app-task-reconciler", taskBinding });
  });

  it.each([false, true])("presents each admitted input once, independently of reply routing (batch: %s)", async (batch) => {
    const report = {
      id: "report-input", source: { kind: "system" as const, id: "report-source" },
      input: { kind: "message", data: { text: "A separate review report arrived." } },
    };
    const inputs = batch ? [report, request] : [request];
    const conversation = {
      id: "chat", owner: "may", messages: [],
      requests: [{ id: "earlier-ask", revision: 1, scope: "Compare the options", status: "open" as const,
        createdAt: 1, updatedAt: 1 }],
    };
    const current = { ...request, conversation, ...(batch ? { inputs } : {}) };
    const before = structuredClone(current);
    const { prompt } = await attempt(current);
    const presented = JSON.parse(prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!);
    expect(presented.inputs).toEqual(inputs);
    expect(presented.replyTo).toEqual({ id: request.id, source: request.source });
    expect(presented.conversation).toEqual(conversation);
    expect(prompt.split(request.input.data.text)).toHaveLength(2);
    expect(presented.input).toBeUndefined();
    expect(current).toEqual(before);
  });

  it.each([undefined, { id: "other", owner: "foreign", messages: [] }])(
    "scoped reads work with omitted or misleading presentation (%j)",
    async (conversation) => {
      const current = { ...request, conversation };
      const { db, definition, options } = await attempt(current);
      for (let i = 0; i < 13; i++)
        applyConversationRequestUpdates(db, {
          appId: may.id,
          conversationId: "chat",
          updateKey: `accept-${i}`,
          now: i,
          updates: [
            {
              id: `ask-${String(i).padStart(2, "0")}`,
              expectedRevision: 0,
              scope: "s".repeat(2000),
              disposition: "open",
            },
          ],
        });
      applyConversationRequestUpdates(db, {
        appId: may.id,
        conversationId: "other",
        updateKey: "private",
        now: 1,
        updates: [{ id: "private", expectedRevision: 0, scope: "Other Conversation", disposition: "open" }],
      });
      const tool = definition.tools.find((tool) => tool.name === "conversation_context")!;
      const read = async (input: unknown) => {
        const output = await tool.execute("lookup", input);
        const content = output.content[0];
        if (content.type !== "text") throw new Error("expected text");
        return JSON.parse(content.text);
      };
      const page = await read({ action: "requests" });
      expect(page).toHaveLength(12);
      expect(page[0].scopePreview).toHaveLength(160);
      expect(await read({ action: "requests", afterId: page.at(-1).id })).toHaveLength(1);
      expect((await read({ action: "request", id: "ask-12" })).scope).toHaveLength(2000);
      expect(await read({ action: "request", id: "private" })).toBeNull();
      expect(
        Check(options.outputSchema!, {
          ...answer,
          requestUpdates: [{ id: "ask", expectedRevision: -1, scope: "scope", disposition: "open" }],
        }),
      ).toBe(false);
    },
  );

  it("an aborted Conversation execution cannot use its still-current Request capability", async () => {
    const controller = new AbortController();
    let writes = 0;
    const { definition } = await attempt(request, may, {
      signal: controller.signal,
      sessionStarted() {},
      taskBinding: { appId: may.id, taskId: "conversation", generation: 1, attemptId: "attempt" },
      updateRequest(change) {
        writes++;
        return {
          id: change.id,
          revision: change.expectedRevision + 1,
          scope: change.scope,
          status: "open",
          taskRefs: [],
        };
      },
    });
    const tool = definition.tools.find((tool) => tool.name === "conversation_request")!;
    expect(Check(tool.parameters, { id: "ask", expectedRevision: 1, inputIds: ["current-input"] })).toBe(true);
    expect(Check(tool.parameters, { id: "ask", expectedRevision: 0, scope: "Compare", disposition: "fulfilled" })).toBe(
      false,
    );
    expect(Check(tool.parameters, { id: "ask", expectedRevision: 0, scope: "Compare", conversationId: "other" })).toBe(
      false,
    );
    controller.abort(new Error("Execution was stopped"));
    await expect(tool.execute("late", { id: "ask", expectedRevision: 0, scope: "Compare" })).rejects.toThrow(
      "Execution was stopped",
    );
    expect(writes).toBe(0);
  });

  it("passes the supplied result contract to execution without deriving policy from context", async () => {
    const outputSchema = Type.Object({ response: Type.String() });
    const execution = {
      outputSchema, signal: new AbortController().signal, sessionStarted() {},
      taskBinding: { appId: may.id, taskId: "conversation", generation: 1, attemptId: "attempt" },
    };
    for (const source of [{ kind: "human" as const, id: "ask" }, { kind: "system" as const, id: "tick" }]) {
      const { options } = await attempt({ ...request, source, humanRequested: true }, may, execution);
      expect(options.outputSchema).toBe(outputSchema);
    }
  });

  it("offers one handoff schema, using the public Conversation contract", async () => {
    const { options } = await attempt();
    const schema = options.outputSchema!;
    expect(Check(schema, answer)).toBe(true);
    const waiting = { ...answer, dependencies: [{ id: "child", appId: "owner", input: { kind: "work", data: {} } }] };
    expect(Check(schema, waiting)).toBe(false);
    expect(Check(conversationTurnResultSchema, waiting)).toBe(false);
    expect(Check(schema, { ...answer, dependencies: [] })).toBe(false);
    expect(options).toMatchObject({
      requireFinish: true,
      toolPolicy: "app-agent-full",
      recoveryOwner: "app-task-reconciler",
    });
    expect(Check(schema, {
      ...answer,
      followUp: {
        appId: "owner",
        outcome: "This ignored outer assignment must be rejected",
        acceptance: ["Do not silently drop requirements"],
        input: { kind: "work", data: {} },
      },
    })).toBe(false);
    // Schema narrowing must retain ordinary feedback and cancellation contracts.
    expect(
      Check(schema, {
        ...answer,
        followUp: {
          appId: "owner",
          input: { kind: "work", data: {} },
          task: { appId: "owner", taskId: "work-1" },
        },
      }),
    ).toBe(true);
    expect(
      Check(schema, {
        ...answer,
        taskControls: [{ kind: "cancel", appId: "owner", taskId: "work-1", reason: "Human asked" }],
      }),
    ).toBe(true);
  });

  it.each([
    ["explicit inputs", may],
    ["all inputs", { ...may, conversation: { mode: "agent" as const }, task: undefined, tasks: undefined }],
  ] as const)("rejects child-wait effects without admitting child work (%s)", async (_kind, frontend) => {
    const root = mkdtempSync(join(tmpdir(), "may-invalid-turn-"));
    roots.push(root);
    const manager = {
      getAgentDefinition: () => ({ name: "may", tools: [] }),
      callAgentDefinition: async () => ({
        status: "done",
        structuredResult: {
          ...answer,
          topic: { kind: "new", title: "Review" },
          dependencies: [{ id: "child", appId: "owner", input: { kind: "work", data: { text: "Review" } } }],
        },
      }),
    } as unknown as SubagentManager;
    const host = await taskRuntime(root, manager, frontend);
    const { db } = host;
    const admitted = host.admit({ ...request, appId: may.id, conversationId: "may:primary", conversationSequence: 1 });
    await host.run(admitted.taskId);
    expect(host.store.readTask(admitted.taskId)?.status).toMatchObject({
      phase: "pending",
      executionFailures: 1,
      executionRetryAt: expect.any(Number),
      summary: expect.stringContaining("Invalid Conversation decision"),
    });
    expect(getAppInboxItem(db, request.id)?.status).not.toBe("done");
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_tasks").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT id FROM app_inbox_items WHERE parent_id = ?").all(request.id)).toEqual([]);
    expect(readAppConversationResource(db, may.id, "may:primary").topics).toEqual([]);
  });

  it.each(["Topic", "Request"] as const)(
    "corrects an unavailable %s before finish in the same invocation",
    async (kind) => {
      const root = mkdtempSync(join(tmpdir(), "conversation-finish-feedback-"));
      roots.push(root);
      const db = getDb(root);
      applyConversationRequestUpdates(db, {
        appId: "may",
        conversationId: "may:primary",
        updateKey: "history",
        now: 1,
        messageId: "old-answer",
        updates: [{ id: "old", expectedRevision: 0, scope: "Earlier ask", disposition: "fulfilled", reason: "Done" }],
      });
      const definition: SubagentDefinition = {
        name: "may",
        description: "Fixture",
        domain: "tests",
        systemPrompt: "Answer the current ask",
        projectRoot: root,
        model: fakeModel(),
        tools: [createFinishTool({ agentName: "may", projectRoot: root })],
      };
      const corrected = {
        ...answer,
        requestUpdates: [
          {
            id: "current",
            expectedRevision: 1,
            disposition: "fulfilled",
            reason: "Compared the requested options",
          },
        ],
      };
      const invalid = {
        ...corrected,
        topic: kind === "Topic" ? { kind: "existing", id: "absent" } : { kind: "new", title: "Review" },
        ...(kind === "Request"
          ? { followUp: { appId: "owner", requestId: "old", input: { kind: "work", data: { text: "Review" } } } }
          : {}),
      };
      const finish = (result: unknown) => ({
        name: "finish",
        arguments: {
          status: "success",
          summary: "Compared options",
          verification_facts: ["Fixture comparison"],
          result,
        },
      });
      const steps = [
        { name: "conversation_request", arguments: { id: "current", expectedRevision: 0, scope: "Compare options" } },
        finish(invalid),
        finish(corrected),
      ];
      const feedback: string[] = [];
      let calls = 0;
      let modelSteps = 0;
      let beforeCorrection: unknown;
      const manager = {
        getAgentDefinition: () => definition,
        callAgentDefinition: async (agent: SubagentDefinition, prompt: string, options: CallOptions) => {
          calls++;
          const prepared = prepareAgentExecution({
            ...options,
            definition: agent,
            projectRoot: root,
            sessionId: "correction",
            task: prompt,
          });
          prepared.runner.streamFn = () => {
            const next = steps[modelSteps++];
            if (modelSteps === 3) beforeCorrection = readConversationRequest(db, "may", "may:primary", "current");
            const message = usageReply({
              content: next ? [{ type: "toolCall", id: `step-${modelSteps}`, ...next }] : [],
              stopReason: next ? "toolUse" : "stop",
            });
            const stream = createAssistantMessageEventStream();
            stream.push({ type: "done", reason: next ? "toolUse" : "stop", message });
            return stream;
          };
          return executePreparedAgent(prepared, {
            timeoutMs: 5_000,
            onObservation(event) {
              if (event.type === "tool_execution_end" && event.toolName === "finish")
                feedback.push(JSON.stringify(event.result));
            },
          });
        },
      } as unknown as SubagentManager;
      let host = await taskRuntime(root, manager);
      const input = { ...request, appId: "may", conversationId: "may:primary", conversationSequence: 1 };
      const admitted = host.admit(input);
      await host.run(admitted.taskId);
      expect(calls).toBe(1);
      expect(modelSteps).toBe(3);
      expect(feedback).toHaveLength(2);
      expect(feedback[0]).toContain(kind === "Topic" ? "unavailable Topic" : "open accepted Request");
      expect(beforeCorrection).toMatchObject({ status: "open", revision: 1 });
      expect(getAppInboxItem(db, request.id)).toMatchObject({
        status: "done",
        result: { response: corrected.response },
      });
      expect(readConversationRequest(db, "may", "may:primary", "current")).toMatchObject({
        status: "closed",
        revision: 2,
      });
      expect(db.prepare("SELECT COUNT(*) AS count FROM app_task_attempts").get()).toEqual({ count: 1 });
      expect(db.prepare("SELECT COUNT(*) AS count FROM app_tasks").get()).toEqual({ count: 1 });
      expect(readAppConversationResource(db, "may", "may:primary").topics).toEqual([]);
      await closeInstalledAppTaskRuntimes(host.bus);
      closeDb(root);
      host = await taskRuntime(root, manager);
      host.admit(input);
      await host.run(admitted.taskId);
      expect(calls).toBe(1);
      expect(getAppInboxItem(host.db, request.id)?.status).toBe("done");
    },
  );

  it.each(["done", "interrupted", "budget-exhausted"] as const)(
    "repairs a tool failure within one Turn and retains work after executor %s",
    async (status) => {
      const root = mkdtempSync(join(tmpdir(), "may-direct-work-"));
      roots.push(root);
      writeFileSync(join(root, "note.txt"), "A small typo: teh.\n");
      const db = getDb(root);
      const definition: SubagentDefinition = {
        name: "may",
        description: "Direct work fixture",
        domain: "tests",
        systemPrompt: "Use only the authorized fixture files.",
        projectRoot: root,
        model: fakeModel(),
        tools: [
          createReadTool(root),
          createEditTool(root),
          createWriteTool(root),
          createBashTool(root),
          createFinishTool({ agentName: "may", projectRoot: root }),
          ...["background_exec", "checkpoint", "cron", "message"].map((name) => ({
            name,
            label: name,
            description: name,
            parameters: Type.Object({}),
            execute: async () => {
              throw new Error(`Unexpected lifecycle tool: ${name}`);
            },
          })),
        ],
      };
      let calls = 0;
      applyConversationRequestUpdates(db, {
        appId: "may", conversationId: "may:primary", updateKey: "earlier-accepted-ask", now: 1,
        updates: [{ id: "typo", expectedRevision: 0, scope: "Fix and verify the typo", disposition: "open" }],
      });
      const decision = { ...answer, summary: "Corrected and verified note.txt", response: "Fixed the typo.",
        requestUpdates: [{ id: "typo", expectedRevision: 1, scope: "Fix and verify the typo", disposition: "fulfilled", reason: "Exact content verified" }],
      };
      const executionFailure = status === "budget-exhausted" ? "Fixture execution budget exhausted" : "Fixture interrupted after editing";
      // Script the model's choices, but use the real resolver, tool policy,
      // file tools, shell, and request persistence. No model service is used.
      const manager = {
        getAgentDefinition: () => definition,
        callAgentDefinition: async (agent: SubagentDefinition, prompt: string, options: CallOptions) => {
          calls += 1;
          if (calls > 1) {
            const context = JSON.parse(prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!);
            expect(context.previousAttempt).toMatchObject({
              state: "failed",
              summary: expect.stringContaining(executionFailure),
            });
          }
          const prepared = prepareAgentExecution({
            ...options,
            definition: agent,
            projectRoot: root,
            sessionId: "direct-work",
            task: prompt,
          });
          expect(prepared.tools.map((tool) => tool.name)).toEqual([
            "read",
            "edit",
            "write",
            "bash",
            "finish",
            "conversation_context",
            "conversation_request",
          ]);
          expect(prepared.runner.beforeToolCall).toBeFunction();
          const steps = [
            { name: "read", arguments: { path: "note.txt" } },
            { name: "edit", arguments: { path: "note.txt", oldText: "teh", newText: "THE" } },
            { name: "write", arguments: { path: "result.txt", content: "Corrected the typo.\n" } },
            { name: "bash", arguments: { command: 'test "$(cat note.txt)" = "A small typo: the."', timeout: 5 } },
            { name: "edit", arguments: { path: "note.txt", oldText: "THE", newText: "the" } },
            { name: "bash", arguments: { command: 'test "$(cat note.txt)" = "A small typo: the." && test -s result.txt', timeout: 5 } },
            { name: "finish", arguments: {
              status: "success", summary: decision.summary,
              verification_facts: ["The repaired file passed the exact content check"],
              result: decision,
            } },
          ];
          if (calls > 1) steps.splice(1, 4); // Read and verify retained effects; do not repeat the writes.
          // The previous settlement bug ended the execution on this invalid
          // result. The normal finish validator must leave it able to correct.
          const validFinish = steps.at(-1)!;
          steps.splice(steps.length - 1, 0, {
            ...validFinish,
            arguments: { ...validFinish.arguments, result: { ...decision, response: undefined } },
          });
          let step = 0;
          let modelSteps = 0;
          const toolOutcomes: Array<{ name: string; failed: boolean }> = [];
          prepared.runner.streamFn = (model) => {
            const call = steps[step++];
            const message: AssistantMessage = {
              role: "assistant",
              content: call ? [{ type: "toolCall", id: `step-${step}`, ...call }] : [{ type: "text", text: "Verified." }],
              api: model.api, provider: model.provider, model: model.id,
              usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
              stopReason: call ? "toolUse" : "stop", timestamp: step,
            };
            const stream = createAssistantMessageEventStream();
            stream.push({ type: "done", reason: call ? "toolUse" : "stop", message });
            return stream;
          };
          const execution = await executePreparedAgent(prepared, {
            timeoutMs: 5_000,
            onObservation: (event) => {
              if (event.type === "turn_start") modelSteps++;
              if (event.type === "tool_execution_end") toolOutcomes.push({ name: event.toolName, failed: event.isError });
            },
          });
          expect(execution.error).toBeUndefined();
          expect(execution.structuredResult).toEqual(decision);
          expect(modelSteps).toBe(steps.length);
          expect(toolOutcomes).toEqual(
            steps.map((call, index) => ({ name: call.name, failed: (calls === 1 && index === 3) || index === steps.length - 2 })),
          );
          expect(readFileSync(join(root, "note.txt"), "utf8")).toBe("A small typo: the.\n");
          expect(Check(options.outputSchema!, decision)).toBe(true);

          return {
            ...execution,
            // Inject executor terminal statuses independently of its proposed
            // result: a failed or exhausted execution cannot fulfill the ask.
            status: calls > 1 ? "done" : status === "budget-exhausted" ? "error" : status,
            ...(calls === 1 && status !== "done" ? { error: executionFailure } : {}),
          };
        },
      } as unknown as SubagentManager;
      let host = await taskRuntime(root, manager);
      const input = {
        ...request,
        input: { kind: "message", data: { text: "Fix and verify the typo in note.txt" } },
        appId: "may",
        conversationId: "may:primary",
        conversationSequence: 1,
      };
      const admitted = host.admit(input);
      await host.run(admitted.taskId);
      expect(calls).toBe(1);
      expect(db.prepare("SELECT id FROM app_inbox_items WHERE parent_id = ?").all(request.id)).toEqual([]);
      expect(db.prepare("SELECT COUNT(*) AS count FROM app_tasks").get()).toEqual({ count: 1 });
      if (status !== "done") {
        expect(readConversationRequest(db, "may", "may:primary", "typo")?.status).toBe("open");
        expect(host.store.readTask(admitted.taskId)?.status).toMatchObject({
          phase: "pending",
          executionFailures: 1,
          summary: expect.stringContaining(executionFailure),
        });
        expect(getAppInboxItem(db, request.id)?.status).not.toBe("done");
        expect(readAppConversationResource(db, "may", "may:primary").messages).toEqual([
          expect.objectContaining({ author: { kind: "human", id: "human-1" }, text: input.input.data.text }),
        ]);
        const due = host.store.nextDueAt()!;
        await closeInstalledAppTaskRuntimes(host.bus);
        closeDb(root);
        host = await taskRuntime(root, manager);
        setSystemTime(new Date(due));
        await host.run(admitted.taskId);
      }
      expect(calls).toBe(status === "done" ? 1 : 2);
      expect(readConversationRequest(host.db, "may", "may:primary", "typo")?.status).toBe("closed");
      expect(getAppInboxItem(host.db, request.id)).toMatchObject({
        status: "done",
        result: { response: decision.response },
      });
      // Duplicate delivery and reopening the Host must not repeat accepted work.
      await closeInstalledAppTaskRuntimes(host.bus);
      closeDb(root);
      const reopened = await taskRuntime(root, manager);
      reopened.admit(input);
      await reopened.run(admitted.taskId);
      expect(calls).toBe(status === "done" ? 1 : 2);
      expect(getAppInboxItem(reopened.db, request.id)?.result?.response).toBe(decision.response);
      expect(readAppConversationResource(reopened.db, "may", "may:primary").messages).toEqual([
        expect.objectContaining({ author: { kind: "human", id: "human-1" }, text: input.input.data.text }),
        expect.objectContaining({ author: { kind: "agent", id: "may" }, text: decision.response }),
      ]);
      expect(reopened.store.isCancelled(admitted.taskId)).toBe(false);
    },
  );

  it("supplies text and structured App inputs for ordinary Task handoffs", async () => {
    const { prompt } = await attempt();
    const catalog = JSON.parse(prompt.split("## Installed Apps\n```json\n")[1].split("\n```")[0]);
    expect(
      catalog
        .find((entry: { appId: string }) => entry.appId === "may")
        ?.inputs.map((entry: { kind: string }) => entry.kind),
    ).toEqual(["goal", "message"]);
    expect(
      catalog
        .find((entry: { appId: string }) => entry.appId === "owner")
        ?.inputs.map((entry: { kind: string }) => entry.kind),
    ).toEqual(["work"]);
  });

  it("uses the same turn contract for an App without its own Task capability", async () => {
    const frontend = { ...may, conversation: { mode: "agent" as const }, task: undefined, tasks: undefined };
    const { prompt, options } = await attempt(request, frontend);
    expect(options.outputSchema).toBe(conversationTurnResultSchema);
    expect(options.toolPolicy).toBe("app-agent-full");
    const catalog = JSON.parse(prompt.split("## Installed Apps\n```json\n")[1].split("\n```")[0]);
    expect(catalog.map((entry: { appId: string }) => entry.appId)).toEqual(["owner"]);
  });
});
