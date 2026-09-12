import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { fakeModel } from "../../../test/fixtures/model.js";
import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, appRequestAgentResultSchema, defineApp, type AppInputContext } from "@may-agent/sdk";
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
import type { AppInputResolver } from "./turn-agent.js";
import { readAppConversationResource } from "../core/state/conversations.js";
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
    execution: Parameters<AppInputResolver>[0]["execution"] = {
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
    const resolve = createConversationAgentResolver({ manager, registry, db });
    expect(await resolve({ app, inputContext: current, execution })).toEqual(answer);
    return { ...captured!, db, resolve, calls };
  }

  it("keeps a Task-owned Conversation session under that Task's recovery authority", async () => {
    const taskBinding = { appId: may.id, taskId: "conversation", generation: 1, attemptId: "attempt" };
    const { options } = await attempt(request, may, {
      signal: new AbortController().signal, sessionStarted: () => {}, taskBinding,
    });
    expect(options).toMatchObject({ recoveryOwner: "app-task-reconciler", taskBinding });
  });

  it("retrieves omitted asks by exact identity and pages without crossing Conversations", async () => {
    const current = { ...request, conversation: { id: "chat", owner: may.id, messages: [] } };
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
  });

  it("offers one handoff schema, using the public Conversation contract", async () => {
    const { prompt, options } = await attempt();
    const schema = options.outputSchema!;
    expect(Check(schema, answer)).toBe(true);
    const waiting = { ...answer, dependencies: [{ id: "child", appId: "owner", input: { kind: "work", data: {} } }] };
    expect(Check(schema, waiting)).toBe(false);
    expect(Check(appRequestAgentResultSchema, waiting)).toBe(false);
    expect(Check(schema, { ...answer, dependencies: [] })).toBe(false);
    expect(prompt).toContain("The current Turn finishes after the handoff is admitted");
    expect(prompt).toContain("The Request remains open until its scope is resolved and explained");
    expect(prompt).not.toContain("Choose dependency appId");
    expect(options).toMatchObject({
      requireFinish: true,
      toolPolicy: "app-agent-full",
      recoveryOwner: "app-task-reconciler",
    });
    // Schema narrowing must retain ordinary feedback and cancellation contracts.
    expect(
      Check(schema, {
        ...answer,
        followUp: {
          outcome: "Review",
          acceptance: ["Verified"],
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

  it("allows useful direct work without making tool use or App availability a handoff requirement", async () => {
    const { prompt } = await attempt();
    expect(prompt).toContain("investigate, edit, and verify directly");
    expect(prompt).toContain("background continuation, later steering, or restart-safe coordination");
    expect(prompt).toContain("Creating a Task is not delegation");
    expect(prompt).toContain("Do not hand off just because an App has a matching name");
    expect(prompt).toContain("Inspect current state before changing it or retrying an interrupted action");
    expect(prompt).toContain("does not by itself authorize a Task effect");
    expect(prompt).not.toContain("only when this App is genuinely the best owner");
  });

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
            steps.map((call, index) => ({ name: call.name, failed: calls === 1 && index === 3 })),
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

  it("supplies May's own durable input contract without offering recursive conversation input", async () => {
    const { prompt } = await attempt();
    const catalog = JSON.parse(prompt.split("## Installed Apps\n```json\n")[1].split("\n```")[0]);
    expect(
      catalog
        .find((entry: { appId: string }) => entry.appId === "may")
        ?.inputs.map((entry: { kind: string }) => entry.kind),
    ).toEqual(["goal"]);
    expect(
      catalog
        .find((entry: { appId: string }) => entry.appId === "owner")
        ?.inputs.map((entry: { kind: string }) => entry.kind),
    ).toEqual(["work"]);
  });

  it("uses the same turn contract for an App without its own Task capability", async () => {
    const frontend = { ...may, conversation: { mode: "agent" as const }, task: undefined, tasks: undefined };
    const { prompt, options } = await attempt(request, frontend);
    expect(options.outputSchema).toBe(appRequestAgentResultSchema);
    expect(options.toolPolicy).toBe("app-agent-full");
    expect(prompt).toContain("Do not return dependencies");
    const catalog = JSON.parse(prompt.split("## Installed Apps\n```json\n")[1].split("\n```")[0]);
    expect(catalog.map((entry: { appId: string }) => entry.appId)).toEqual(["owner"]);
  });
});
