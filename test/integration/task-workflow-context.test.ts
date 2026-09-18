import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Type, createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { createAgentRun } from "../../src/lib/agent-runner.js";
import { SubagentManager } from "../../src/lib/manager.js";
import { currentAgentSessionId } from "../../src/lib/agent-session-context.js";
import { buildTools } from "../../src/app/loader/toolset-loader.js";
import { EventBus } from "../../src/app/core/events/bus.js";
import { closeDb } from "../../src/lib/requests.js";
import type { TaskExecutionContext } from "../../src/lib/task-execution-context.js";
import type { AppEvent } from "@may-agent/sdk";
import { fakeModel } from "../fixtures/model.js";
import { createFinishTool } from "../../src/lib/tools/lifecycle.js";

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
export const description = "Inspect with a specialist; input {marker:string}";
export async function execute(ctx) {
  const task = await ctx.read.tasks.get(ctx.reconciliation.taskId);
  const result = await ctx.agents.call("worker", ctx.input.marker);
  await ctx.reviseTask({ appId: "worker", taskId: "child-" + ctx.input.marker, expectedGeneration: 1,
    input: { kind: "message", data: { marker: ctx.input.marker } } });
  return ctx.done("inspected", { marker: ctx.input.marker, task: task.id, root: ctx.workspace.root, taskFile: ctx.workspace.taskFile, result });
}`,
    );
    if (route === "nested-workflow") {
      writeFileSync(join(agentDir, "workflows", "delegate.ts"), readFileSync(join(agentDir, "workflows", "inspect.ts"), "utf8").replace('name = "inspect"', 'name = "delegate"'));
      writeFileSync(join(agentDir, "workflows", "inspect.ts"), `
export const name = "inspect";
export const description = "Nested contribution";
export async function execute(ctx) { return ctx.workflows.run("delegate", ctx.input); }
`);
    }
    const model = fakeModel();
    const entered = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
    const release = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
    const listeners = new Map<string, Set<(event: AppEvent<Record<string, unknown>>, accept: () => void) => void>>();
    const seen = new Map<string, string>();
    const helperPrompts = new Map<string, string>();
    const taskFiles = new Map<string, string>();
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
        const owner = config.initialState!.tools!.some((tool) => tool.name === "workflow");
        return createAgentRun({
          ...config,
          streamFn: (_model, context) => {
            step++;
            const all = JSON.stringify(context.messages);
            const marker = all.includes("alpha") ? "alpha" : "beta";
            if (!owner) helperPrompts.set(marker, config.initialState!.systemPrompt!);
            if (!owner && step > 1) seen.set(marker, all);
            const content: AssistantMessage["content"] =
              step === 1
                ? [
                    {
                      type: "toolCall",
                      id: "operation",
                      name: owner ? route === "agent" ? "agents" : "workflow" : "hold",
                      arguments: owner ? route === "agent" ? { action: "call", agent: "worker", task: marker }
                        : { action: "run", name: "inspect", input: { marker } } : { marker },
                    },
                  ]
                : step === 2
                  ? [
                      {
                        type: "toolCall",
                        id: "finish",
                        name: "finish",
                        arguments: {
                          status: "success",
                          summary: marker,
                          verification_facts: ["Observed fixture"],
                          result: { marker },
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
    const tools = await buildTools({ name: "owner", tools: ["workflow", "agents", "finish"] } as never, {
      manager,
      bus,
      agentDir,
      agentsRoot: join(root, "agents"),
      projectsRoot: root,
      sharedRoot: root,
      projectRoot: root,
      persistDir,
      cronEnabled: false,
      getAgentSessionId: () => "wrong-same-name-session",
      getAgentMaintenance: () => new Map(),
      addCleanup: () => {},
    });
    manager.register({ name: "owner", description: "Owner", domain: "fixture", model, tools });
    manager.register({
      name: "worker",
      description: "Worker",
      domain: "fixture",
      model,
      tools: [
        createFinishTool({ agentName: "worker", projectRoot: root, persistDir }),
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
    const controller = new AbortController();
    const running = ["alpha", "beta"].map((marker) => {
      const context = {
        taskBinding: { appId: "fixture", taskId: marker, generation: 1, attemptId: `attempt-${marker}` },
        recoveryOwner: "app-task",
        executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
        reconciliation: { taskId: marker, input: { omitted: `only-${marker}` }, events: { items: [], truncated: false } },
        taskRead: { get: async (id: string) => ({ id }) },
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
      const brief = context.workspaceBrief;
      if (!brief || !("taskFile" in brief)) throw new Error("Missing Task entry");
      taskFiles.set(marker, brief.taskFile);
      return running;
    });
    try {
      await Promise.all([...entered.values()].map((p) => p.promise));
      for (const marker of ["alpha", "beta"]) {
        const owner = [...manager.activeSessions.values()].find((s) => s.agentName === "owner" && s.taskBinding?.taskId === marker)!;
        const worker = [...manager.activeSessions.values()].find((s) => s.agentName === "worker" && s.taskBinding?.taskId === marker)!;
        expect(worker.taskContext).toBe(owner.taskContext);
        const meta = JSON.parse(readFileSync(join(persistDir, "sessions", worker.sessionId, "meta.json"), "utf8"));
        expect(helperPrompts.get(marker)).toContain("## Assigned contribution");
        expect(helperPrompts.get(marker)).toContain("does not assign you the entire Task");
        expect(meta.parentSessionId).toBe(owner.sessionId);
        expect(meta.task).toContain(taskFiles.get(marker)!);
        expect(meta.task).not.toContain("Delegation Memo");
        const snapshot = JSON.parse(readFileSync(join(dirname(taskFiles.get(marker)!), "context.json"), "utf8"));
        expect(snapshot.reconciliation.input.omitted).toBe(`only-${marker}`);
      }
      expect(taskFiles.get("alpha")).not.toBe(taskFiles.get("beta"));
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
          const reply = result.value.messages.find((message) => message.role === "toolResult" && message.toolName === (route === "agent" ? "agents" : "workflow"));
          if (!reply || reply.role !== "toolResult") throw new Error("Missing handoff result");
          const text = reply.content.find((part) => part.type === "text");
          if (text?.type !== "text") throw new Error("Missing handoff result text");
          const returned = JSON.parse(text.text);
          expect(returned).toMatchObject({ kind: route === "agent" ? "agent" : "workflow", status: "done" });
          expect(returned.id).toBeTruthy();
          expect(returned.output.marker).toBe(["alpha", "beta"][i]);
          if (route !== "agent") {
            expect(returned.output.task).toBe(["alpha", "beta"][i]);
            expect(returned.output.taskFile).toBe(taskFiles.get(["alpha", "beta"][i])!);
            expect(returned.output.result).toMatchObject({ kind: "agent", status: "done" });
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
