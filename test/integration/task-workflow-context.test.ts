import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { createRuntimeAppRead } from "../../src/app/core/reads/app-read.js";
import { createTaskAgentRunner } from "../../src/app/adapters/executors/managed-agent.js";
import { runTaskAgent, runTaskExecutorAttempt } from "../../src/app/core/tasks/attempt-execution.js";
import { appTaskTestContext } from "../../src/app/core/tasks/app-task-test-support.js";
import {
  claimObservedAppTask,
  deferAppTask,
  observeAppTaskIntent,
} from "../../src/app/core/tasks/app-task-reconciler.js";
import type { AppTaskRuntimeDescriptor } from "../../src/app/core/tasks/runtime-definition.js";
import type { AppTaskRuntimeOptions } from "../../src/app/core/tasks/runtime-options.js";
import { getDb } from "../../src/lib/db/connection.js";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import type { AppEvent, TaskDetail } from "@may-agent/sdk/app";
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type } from "typebox";
import { EventBus } from "../../src/app/core/events/bus.js";
import { buildTools } from "../../src/app/loader/toolset-loader.js";
import { createAgentRun } from "@may-agent/sdk/runtime";
import { currentAgentSessionId } from "@may-agent/sdk/runtime";
import { SubagentManager } from "../../src/lib/manager.js";
import { closeDb } from "../../src/lib/db/connection.js";
import type { TaskExecutionContext } from "../../src/lib/task-execution-context.js";
import { createFinishTool } from "@may-agent/sdk/runtime";
import { fakeModel } from "../fixtures/model.js";

// Real loader/model tools and managed executions. Only the provider is synthetic.
const routes = ["agent", "workflow", "nested-workflow"] as const;
test.each(routes.flatMap((route) => (["feedback", "cancel"] as const).map((mode) => ({ route, mode }))))(
  "handoff shares Task context: $route / $mode",
  async ({ route, mode }) => {
    const root = mkdtempSync(join(tmpdir(), "may-task-workflow-"));
    const persistDir = join(root, ".state");
    const agentDir = join(root, "agents", "owner");
    mkdirSync(join(agentDir, "workflows"), { recursive: true });
    writeFileSync(
      join(agentDir, "workflows", "inspect.ts"),
      `
export const name = "inspect";
export const description = "Inspect with a specialist; input {prompt:string,data:{marker:string}}";
export async function execute(ctx) {
  const task = await ctx.read.tasks.get(ctx.reconciliation.taskId);
  const result = await ctx.call("global/worker", { prompt: "Inspect " + ctx.input.data.marker });
  await ctx.reviseTask({ appId: "worker", taskId: "child-" + ctx.input.data.marker, expectedGeneration: 1,
    input: { kind: "message", data: { marker: ctx.input.data.marker } } });
  return ctx.done("inspected", { marker: ctx.input.data.marker, task: task.id, root: ctx.workspace.root, result });
}`,
    );
    if (route === "nested-workflow") {
      writeFileSync(
        join(agentDir, "workflows", "delegate.ts"),
        readFileSync(join(agentDir, "workflows", "inspect.ts"), "utf8").replace(
          'name = "inspect"',
          'name = "delegate"',
        ),
      );
      writeFileSync(
        join(agentDir, "workflows", "inspect.ts"),
        `
export const name = "inspect";
export const description = "Nested contribution";
export async function execute(ctx) { return ctx.call("global/delegate", ctx.input); }
`,
      );
    }
    const model = fakeModel();
    const entered = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
    const release = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
    const listeners = new Map<string, Set<(event: AppEvent<Record<string, unknown>>, accept: () => void) => void>>();
    const seen = new Map<string, string>();
    const helperPrompts = new Map<string, string>();
    const helperModelContexts = new Map<string, string>();
    const revisions = new Map<string, unknown[]>();
    let accepted = 0;
    for (const marker of ["alpha", "beta"]) {
      entered.set(marker, Promise.withResolvers<void>());
      release.set(marker, Promise.withResolvers<void>());
      listeners.set(marker, new Set());
      revisions.set(marker, []);
    }
    const manager = new SubagentManager({
      persistDir,
      agentRunFactory: (config) => {
        let step = 0;
        const ownerTool = config.initialState!.tools!.find((tool) => tool.name === "agents");
        const owner = Boolean(ownerTool);
        return createAgentRun({
          ...config,
          streamFn: (_model, context) => {
            step++;
            const all = JSON.stringify(context.messages);
            const marker = all.includes("alpha") ? "alpha" : "beta";
            if (!owner) {
              helperPrompts.set(marker, config.initialState!.systemPrompt!);
              helperModelContexts.set(marker, all);
            }
            if (!owner && step > 1) seen.set(marker, all);
            const content: AssistantMessage["content"] =
              step === 1
                ? [
                    {
                      type: "toolCall",
                      id: "operation",
                      name: owner ? ownerTool!.name : "hold",
                      arguments: owner
                        ? route === "agent"
                          ? { action: "call", agent: "global/worker", input: { prompt: marker } }
                          : { action: "call", agent: "global/inspect", input: { prompt: "Inspect task context", data: { marker } } }
                        : { marker },
                    },
                  ]
                : step === 2
                  ? [
                      {
                        type: "toolCall",
                        id: "finish",
                        name: "finish",
                        arguments: {
                          status: "done",
                          summary: marker,
                          facts: ["Observed fixture"],
                          output: {
                            state: "converged",
                            summary: `Settled ${marker}`,
                            facts: [`settled:${marker}`],
                            result: { marker },
                          },
                        },
                      },
                    ]
                  : [{ type: "text", text: marker }];
            const message: AssistantMessage = {
              role: "assistant",
              api: model.api,
              provider: model.provider,
              model: model.id,
              content,
              stopReason: step <= 2 ? "toolUse" : "stop",
              timestamp: Date.now(),
              usage: {
                input: 0,
                output: 0,
                totalTokens: 0,
                cacheRead: 0,
                cacheWrite: 0,
                cost: { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0 },
              },
            };
            const stream = createAssistantMessageEventStream();
            stream.push({ type: "done", reason: step <= 2 ? "toolUse" : "stop", message });
            return stream;
          },
        });
      },
    });
    const bus = new EventBus();
    const tools = await buildTools(
      { name: "owner", tools: route === "agent" ? ["agents", "finish"] : ["finish"] } as never,
      {
      manager,
      bus,
      agentDir,
      agentsRoot: join(root, "agents"),
      projectsRoot: root,
      sharedRoot: root,
      projectRoot: root,
      persistDir,
      getAgentSessionId: () => "wrong-same-name-session",
      },
    );
    const loadedAgents = tools.find((tool) => tool.name === "agents")!;
    const loadedParameters = loadedAgents.parameters as any;
    expect(loadedParameters.anyOf).toHaveLength(2);
    expect(loadedParameters.anyOf[0].properties.action.const).toBe("list");
    expect(loadedParameters.anyOf[1].properties.action.const).toBe("call");
    expect(Object.keys(loadedParameters.anyOf[1].properties).sort()).toEqual(["action", "agent", "input", "options"]);
    manager.register({ name: "owner", description: "Owner", domain: "fixture", model, tools, agentDir });
    manager.register({
      name: "worker",
      description: "Worker",
      domain: "fixture",
      model,
      tools: [
        createFinishTool({ projectRoot: root }),
        {
          name: "hold",
          label: "Hold",
          description: "Controlled operation",
          parameters: Type.Object({ marker: Type.String() }),
          async execute(_id, args, signal) {
            const marker = (args as { marker: string }).marker;
            const sid = currentAgentSessionId("worker")!;
            expect(manager.activeSessions.get(sid)?.taskBinding?.taskId).toBe(marker);
            entered.get(marker)!.resolve();
            const stop = () => release.get(marker)!.resolve();
            signal?.addEventListener("abort", stop, { once: true });
            try {
              await release.get(marker)!.promise;
              signal?.throwIfAborted();
            } finally {
              signal?.removeEventListener("abort", stop);
            }
            return { content: [{ type: "text", text: marker }], details: {} };
          },
        },
      ],
    });
    AppTaskResourceStore.fromDb(getDb(persistDir), "fixture").bootstrapSnapshot(
      {
        project: "fixture",
        resources: Object.fromEntries(
          ["alpha", "beta"].map((marker) => [
            marker,
            {
              metadata: { id: marker, generation: 1, resourceVersion: 1 },
              spec: { parentId: "root", outcome: `Inspect ${marker}`, acceptance: ["Done"] },
              status: { phase: "running" as const, observedGeneration: 0, currentAttemptId: `attempt-${marker}` },
            },
          ]),
        ),
        attempts: Object.fromEntries(
          ["alpha", "beta"].map((marker) => [
            `attempt-${marker}`,
            {
              metadata: { id: `attempt-${marker}`, resourceVersion: 1 },
              taskId: marker,
              taskGeneration: 1,
              specHash: "hash",
              owner: "owner",
              handler: "agent:owner",
              runtimeId: "rt",
              state: "running" as const,
              reason: "event",
              startedAt: new Date().toISOString(),
            },
          ]),
        ),
      },
      "fixture",
    );
    const controller = new AbortController();
    const running = ["alpha", "beta"].map((marker) => {
      const task: TaskDetail = {
        id: marker,
        parentId: "root",
        generation: 1,
        resourceVersion: 1,
        status: "running",
        outcome: `Inspect ${marker}`,
        acceptance: ["Preserve correction, accepted result, and independent wait"],
        input: { correction: `assigned-correction-only-${marker}` },
        summary: `Accepted result only for ${marker}`,
        result: { revision: `accepted-${marker}` },
        facts: [`accepted-result-only-${marker}`],
        conditions: [
          {
            id: `independent-wait-only-${marker}`,
            type: "approval.observed",
            subject: `candidate:${marker}`,
            expected: true,
            owner: "human:reviewer",
            observation: { state: "unknown" },
          },
        ],
        acceptedEvidence: { available: false, maxPageSize: 8 },
      };
      const context = {
        taskBinding: { appId: "fixture", taskId: marker, generation: 1, attemptId: `attempt-${marker}` },
        recoveryOwner: "app-task",
        executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
        reconciliation: {
          task,
          appId: "fixture",
          taskId: marker,
          generation: 1,
          resourceVersion: 1,
          agent: "owner",
          owner: "owner",
          outcome: task.outcome,
          acceptance: task.acceptance,
          input: task.input,
          children: { live: [], completed: [] },
          waits: { open: [], note: "No waits" },
          taskSnapshot: { live: [], truncated: false },
          events: { items: [], truncated: false },
        },
        taskRead: { get: async () => structuredClone(task) },
        taskEmitter: { read: () => null, publish: () => 1, onEvent: () => () => {} },
        async reviseTask(change) {
          expect(change.taskId).toBe(`child-${marker}`);
          expect(change.input).toEqual({ kind: "message", data: { marker } });
          revisions.get(marker)!.push(change);
          return { kind: "observed", taskId: change.taskId, generation: 2, changed: true };
        },
        observeEvents(listener) {
          listeners.get(marker)!.add(listener);
          return () => {
            listeners.get(marker)!.delete(listener);
          };
        },
      } as TaskExecutionContext;
      const running = manager.callAgent("owner", marker, {
        taskContext: context,
        taskBinding: context.taskBinding,
        executionRoot: root,
        requireFinish: true,
        signal: controller.signal,
        timeout: 10_000,
      });
      return running;
    });
    try {
      await Promise.all([...entered.values()].map((p) => p.promise));
      for (const marker of ["alpha", "beta"]) {
        const owner = [...manager.activeSessions.values()].find(
          (s) => s.agentName === "owner" && s.taskBinding?.taskId === marker,
        )!;
        const worker = [...manager.activeSessions.values()].find(
          (s) => s.agentName === "worker" && s.taskBinding?.taskId === marker,
        )!;
        expect(worker.taskContext).toBe(owner.taskContext);
        expect(worker.taskContext?.detailRoot?.startsWith(join(persistDir, "task-context"))).toBe(true);
        const meta = JSON.parse(readFileSync(join(persistDir, "sessions", worker.sessionId, "meta.json"), "utf8"));
        expect(helperPrompts.get(marker)).toContain(join(persistDir, "sessions", worker.sessionId, "meta.json"));
        expect(helperPrompts.get(marker)).toContain("Work within the caller's assignment and authority");
        expect(helperPrompts.get(marker)).not.toContain("Task ownership");
        expect(meta.parentSessionId).toBe(owner.sessionId);
        expect(meta.task).not.toContain("Delegation Memo");
        if (route !== "agent") {
          const modelContext = helperModelContexts.get(marker)!;
          expect(modelContext).toContain(`assigned-correction-only-${marker}`);
          expect(modelContext).toContain(`accepted-${marker}`);
          expect(modelContext).toContain(`accepted-result-only-${marker}`);
          expect(modelContext).toContain(`independent-wait-only-${marker}`);
          const other = marker === "alpha" ? "beta" : "alpha";
          expect(modelContext).not.toContain(`assigned-correction-only-${other}`);
          expect(modelContext).not.toContain(`accepted-result-only-${other}`);
          expect(modelContext).not.toContain(`independent-wait-only-${other}`);
        }
      }
      expect(listeners.get("alpha")!.size).toBe(2);
      expect(listeners.get("beta")!.size).toBe(2);
      if (mode === "cancel") controller.abort(new Error("Owner cancelled"));
      else {
        for (const listener of listeners.get("alpha")!)
          listener({ type: "task.feedback", data: { instruction: "correction-only-alpha" } }, () => {
            accepted++;
          });
        release.get("alpha")!.resolve();
        release.get("beta")!.resolve();
      }
      const results = await Promise.allSettled(running);
      if (mode === "feedback") {
        expect(results.every((r) => r.status === "fulfilled" && r.value.status === "done")).toBe(true);
        expect(seen.get("alpha")).toContain("correction-only-alpha");
        expect(seen.get("beta")).not.toContain("correction-only-alpha");
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result.status !== "fulfilled") throw result.reason;
          expect(result.value.structuredResult).toEqual({
            state: "converged",
            summary: `Settled ${["alpha", "beta"][i]}`,
            facts: [`settled:${["alpha", "beta"][i]}`],
            result: { marker: ["alpha", "beta"][i] },
          });
          const reply = result.value.messages.find(
            (message) =>
              message.role === "toolResult" && message.toolName === "agents",
          );
          if (!reply || reply.role !== "toolResult") throw new Error("Missing handoff result");
          const text = reply.content.find((part) => part.type === "text");
          if (text?.type !== "text") throw new Error("Missing handoff result text");
          const returned = JSON.parse(text.text);
          expect(returned).toMatchObject({ status: "done" });
          expect(returned.kind).toBeUndefined();
          expect(returned.id).toBeTruthy();
          expect(route === "agent" ? returned.output.result.marker : returned.output.marker).toBe(["alpha", "beta"][i]);
          if (route !== "agent") {
            expect(returned.output.task).toBe(["alpha", "beta"][i]);
            expect(returned.output.result).toMatchObject({ status: "done" });
            expect(returned.output.result.kind).toBeUndefined();
          }
        }
      } else expect(results.every((r) => r.status === "rejected")).toBe(true);
      expect(accepted).toBe(0);
      for (const changes of revisions.values()) {
        expect(changes).toHaveLength(mode === "feedback" && route !== "agent" ? 1 : 0);
      }
      expect([...listeners.values()].every((rows) => rows.size === 0)).toBe(true);
      expect(manager.status()).toEqual([]);
    } finally {
      controller.abort();
      for (const item of release.values()) item.resolve();
      await Promise.allSettled(running);
      closeDb(persistDir);
      rmSync(root, { recursive: true, force: true });
    }
  },
  20_000,
);

test("scoped agents.call settles through Task admission without replacing retained input or Conditions", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-task-workflow-settlement-"));
  const appDir = join(root, "sample.app");
  const persistDir = join(root, ".state");
  const agentDir = join(root, "agents", "owner");
  mkdirSync(appDir, { recursive: true });
  mkdirSync(join(agentDir, "workflows"), { recursive: true });
  writeFileSync(
    join(agentDir, "workflows", "inspect.ts"),
    `
export const name = "inspect";
export const description = "Inspect retained Task state";
export async function execute(ctx) {
  const current = await ctx.read.tasks.get(ctx.reconciliation.taskId);
  return ctx.done("inspected", {
    marker: ctx.input.data.marker,
    correction: current.input.correction,
    condition: current.conditions[0].id,
  });
}
`,
  );
  const store = AppTaskResourceStore.fromDb(getDb(persistDir), "sample");
  const config = appTaskTestContext({
    appDir,
    agent: "owner",
    maxConcurrent: 1,
    resourceStore: store,
    tree: {
      project: "sample",
      project_lifecycle: "active",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
      tasks: {},
    },
  });
  const taskId = "work/inspect";
  const bus = new EventBus();
  const model = fakeModel();
  const manager = new SubagentManager({
    persistDir,
    agentRunFactory: (runner) => {
      let step = 0;
      return createAgentRun({
        ...runner,
        streamFn: (_model, context) => {
          step++;
          let procedureResult: { marker: string; correction: string; condition: string } | undefined;
          if (step === 2) {
            const reply = context.messages.findLast(
              (message) =>
                message.role === "toolResult" &&
                message.toolName === "agents" &&
                message.toolCallId === "inspect",
            );
            if (!reply || reply.role !== "toolResult") throw new Error("Missing agents.call result");
            expect(reply.isError).toBe(false);
            const text = reply.content.find((part) => part.type === "text");
            if (text?.type !== "text") throw new Error("Missing agents.call result text");
            const returned = JSON.parse(text.text);
            expect(returned).toMatchObject({
              status: "done",
              output: {
                marker: "accepted",
                correction: "keep-this-input",
                condition: "publication-approval",
              },
            });
            expect(returned.error).toBeUndefined();
            procedureResult = returned.output;
          }
          const content: AssistantMessage["content"] =
            step === 1
              ? [
                  {
                    type: "toolCall",
                    id: "inspect",
                    name: "agents",
                    arguments: { action: "call", agent: "global/inspect", input: { prompt: "Inspect retained state", data: { marker: "accepted" } } },
                  },
                ]
              : [
                  {
                    type: "toolCall",
                    id: "finish",
                    name: "finish",
                    arguments: {
                      status: "done",
                      summary: "Procedure result accepted",
                      facts: ["agents.call returned retained Task state"],
                      output: {
                        state: "waiting",
                        summary: "Procedure result settled; publication approval remains independent",
                        facts: ["procedure:inspect"],
                        result: procedureResult,
                      },
                    },
                  },
                ];
          const message: AssistantMessage = {
            role: "assistant",
            api: model.api,
            provider: model.provider,
            model: model.id,
            content,
            stopReason: "toolUse",
            timestamp: Date.now(),
            usage: {
              input: 0,
              output: 0,
              totalTokens: 0,
              cacheRead: 0,
              cacheWrite: 0,
              cost: { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0 },
            },
          };
          const stream = createAssistantMessageEventStream();
          stream.push({ type: "done", reason: "toolUse", message });
          return stream;
        },
      });
    },
  });
  const tools = await buildTools({ name: "owner", tools: [] } as never, {
    manager,
    bus,
    agentDir,
    agentsRoot: join(root, "agents"),
    projectsRoot: root,
    sharedRoot: root,
    projectRoot: root,
    persistDir,
  });
  manager.register({ name: "owner", description: "Owner", domain: "fixture", model, tools, agentDir });
  const descriptor = {
    id: "sample",
    appDir,
    projectDir: root,
    agent: "owner",
    resourceStore: store,
    app: { id: "sample", version: 1, agent: "owner", tasks: { maxConcurrent: 1 } },
  } as AppTaskRuntimeDescriptor;
  const opts: AppTaskRuntimeOptions = {
    bus,
    projectRoot: root,
    projectsRoot: root,
    agentsRoot: join(root, "agents"),
    sharedRoot: root,
    persistDir,
    agents: createTaskAgentRunner({ manager }),
  };
  try {
    observeAppTaskIntent(config, {
      appAgent: "owner",
      intent: {
        id: taskId,
        parentId: "root",
        agent: "owner",
        outcome: "Inspect a granted local procedure",
        acceptance: ["Settle the procedure result while retaining independent state"],
        input: { correction: "keep-this-input" },
      },
    });
    const initial = claimObservedAppTask(config, { taskId, appAgent: "owner", handler: "agent:owner" });
    if (initial.kind !== "claimed") throw new Error(`Initial claim failed: ${initial.kind}`);
    deferAppTask(config, initial, {
      disposition: "waiting",
      continue: true,
      summary: "Prepared for procedure inspection",
      conditions: [
        {
          id: "publication-approval",
          type: "approval.observed",
          subject: "publication:draft",
          expected: true,
          owner: "human:reviewer",
        },
      ],
    });
    const claim = claimObservedAppTask(config, { taskId, appAgent: "owner", handler: "agent:owner" });
    if (claim.kind !== "claimed") throw new Error(`Execution claim failed: ${claim.kind}`);
    const execution = {
      opts,
      descriptor,
      claim,
      executionPaths: { appDir, projectDir: root, workspaceDir: root },
      childContext: { live: [], completed: [] },
      taskSnapshot: { live: [], truncated: false },
    };
    const run = await runTaskExecutorAttempt({
      ...execution,
      execute: (attempt, taskEvents, acceptedLiveEventIds) =>
        runTaskAgent({ ...execution, attempt, taskEvents, acceptedLiveEventIds }),
    });
    expect(run.handlerResult).toMatchObject({
      state: "waiting",
      result: {
        marker: "accepted",
        correction: "keep-this-input",
        condition: "publication-approval",
      },
    });
    deferAppTask(config, claim, {
      ...run.handlerResult,
      disposition: "waiting",
      acceptedLiveEventIds: run.acceptedLiveEventIds,
    });
    const current = await createRuntimeAppRead({ getDb: () => store.db, taskStateConfig: config }).tasks.get(taskId, {
      acceptedEvidence: { limit: 8 },
    });
    expect(current?.input).toEqual({ correction: "keep-this-input" });
    expect(current?.result).toEqual({
      marker: "accepted",
      correction: "keep-this-input",
      condition: "publication-approval",
    });
    expect(current?.conditions).toEqual([
      expect.objectContaining({
        id: "publication-approval",
        observation: expect.objectContaining({ state: "unknown" }),
      }),
    ]);
    expect(
      current?.acceptedEvidence.page?.items.find((item) => item.attemptId === claim.attemptId)?.acceptedResult.result,
    ).toEqual({
      marker: "accepted",
      correction: "keep-this-input",
      condition: "publication-approval",
    });
  } finally {
    closeDb(persistDir);
    rmSync(root, { recursive: true, force: true });
  }
}, 15_000);
