/** Experiment wiring only: ordinary Task mechanics, not a learning controller. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineApp, Type, type Condition } from "@may-agent/sdk";
import { EventBus, type AgentEvent } from "../../src/app/core/events/bus.js";
import { AppRegistry } from "../../src/app/core/apps/registry.js";
import { HostCapacity } from "../../src/app/core/scheduling/host-capacity.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { installAppTaskRuntimes, closeInstalledAppTaskRuntimes } from "../../src/app/core/tasks/app-task-runtime.js";
import { createAppTaskCapability } from "../../src/app/core/tasks/app-task-capability.js";
import { createTaskExecutionBackends } from "../../src/app/composition/task-execution.js";
import { startAppInboxRuntime } from "../../src/app/composition/app-inbox-runtime.js";
import { listAppInboxItems } from "../../src/app/core/state/app-inbox-store.js";
import { attachEventPersistence } from "../../src/app/daemon-events.js";
import { SubagentManager } from "../../src/lib/manager.js";
import { createAgentRun } from "../../src/lib/agent-runner.js";
import { getDb, closeDb } from "../../src/lib/requests.js";
import { prepareAgentExecution, type DirectAgentExecutionResult } from "../../src/lib/agent-execution.js";
import { fixtureGit } from "./conversation-adoption-tools.js";
import { runTrial, type ImprovementRunner } from "./agent-operated-improvement.js";

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
  details: undefined,
});
const condition: Condition = {
  id: "activation-window",
  type: "fixture.activation.ready",
  subject: "id:guidance-window",
  expected: { field: "ready", equals: true },
  owner: "service:fixture",
  reviewAfterMs: 3_600_000,
};

export function taskImprover(withdraw = false): ImprovementRunner {
  return async ({ definition, objective, root, live }) => {
    // Separate state from the temporary source daemon; only this Task runtime is restarted.
    const work = join(root, "improvement-runtime");
    const appDir = join(work, "lab.app");
    const persistDir = join(work, ".state");
    mkdirSync(join(appDir, "tasks"), { recursive: true });
    writeFileSync(
      join(appDir, "tasks/seed.json"),
      JSON.stringify({
        root_task_id: "root",
        groups: { root: { id: "root", parent_id: null } },
      }),
    );
    const journalPath = join(work, "fixture-controls.json");
    type Controls = {
      ready: boolean;
      allowedCommit?: string;
      attempts: number;
      providerCalls: number;
      activations: number;
    };
    const read = () => JSON.parse(readFileSync(journalPath, "utf8")) as Controls;
    const change = (patch: Partial<Controls>) => writeFileSync(journalPath, JSON.stringify({ ...read(), ...patch }));
    writeFileSync(journalPath, JSON.stringify({ ready: false, attempts: 0, providerCalls: 0, activations: 0 }));
    const report: Record<string, unknown> = {
      live,
      withdraw,
      restarted: false,
      passed: false,
      events: [],
      executions: [],
      harnessSha256: createHash("sha256")
        .update(readFileSync(import.meta.filename))
        .digest("hex"),
    };
    const results: DirectAgentExecutionResult[] = [];
    const save = () =>
      writeFileSync(join(root, "task-trial.json"), JSON.stringify(report, null, 2).split(root).join("<fixture-root>"));
    const app = defineApp({
      id: "lab",
      version: 1,
      agent: definition.name,
      workspace: { kind: "local", localPath: "." },
      inputSchema: Type.Object({ kind: Type.Literal("improve"), data: Type.Object({}) }),
      tasks: {
        maxConcurrent: 1,
        validateCondition: (value) =>
          value.type === condition.type && value.subject === condition.subject ? null : "has no fixture producer",
      },
      task: () => ({
        kind: "desired",
        intent: {
          id: "improve-guidance",
          parentId: "root",
          mode: "achieve",
          outcome: objective,
          acceptance: [
            "A fresh target uses the committed active revision and answers correctly; report remaining uncertainty",
          ],
        },
      }),
    });
    const tools = definition.tools!.map((tool) =>
      tool.name !== "definition_source"
        ? // Standard coding-tool names are deliberately rebound to each Task workspace.
          // These cross-target fixture capabilities must keep their constrained adapters.
          ["read", "write"].includes(tool.name)
          ? { ...tool, name: `fixture_${tool.name}` }
          : tool
        : {
            ...tool,
            description:
              tool.description +
              " This fixture has an external activation window. Status reports its readiness and exact observable Condition. A closed window cannot be opened by the agent; wait for its fact instead of polling.",
            async execute(id: string, input: unknown, signal?: AbortSignal) {
              signal?.throwIfAborted();
              const action = (input as { action: string }).action;
              const state = read();
              if (action === "reload") {
                if (!state.ready)
                  return text({
                    state: "waiting",
                    message: "Activation window is closed; no reload submitted.",
                    condition,
                  });
                assert.equal(
                  await fixtureGit(root, ["rev-parse", "HEAD"]),
                  state.allowedCommit,
                  "Window does not authorize a different candidate revision",
                );
                change({ activations: state.activations + 1 });
              }
              const result = await tool.execute(id, input, signal);
              const content = result.content.find((item) => item.type === "text");
              assert(content?.type === "text");
              return text({ ...JSON.parse(content.text), activationWindow: read().ready, condition });
            },
          },
    );
    const scoped = prepareAgentExecution({
      definition: { ...definition, tools },
      projectRoot: work,
      executionRoot: appDir,
      task: objective,
      sessionId: "capability-preflight",
    }).tools;
    assert(!scoped.some((tool) => ["read", "write"].includes(tool.name)));
    const reader = scoped.find((tool) => tool.name === "fixture_read")!;
    const writer = scoped.find((tool) => tool.name === "fixture_write")!;
    assert(reader && writer);
    await reader.execute("allowed", { path: "evidence/accepted-policy.json" });
    await assert.rejects(reader.execute("denied", { path: "improvement-runtime/fixture-controls.json" }));
    await assert.rejects(writer.execute("denied", { path: "evidence/accepted-policy.json", content: "{}" }));
    report.scopedToolsAfterPreparation = true;
    const profiledAttempts = new Set<string>();
    let notify: (() => void) | undefined;
    async function start() {
      const bus = new EventBus();
      const db = getDb(persistDir);
      attachEventPersistence({ bus, persistDir });
      bus.listen((event) => {
        const observed = event as unknown as { type: string; data?: { attemptId?: string } };
        if (observed.type.startsWith("project.task.")) {
          (report.events as unknown[]).push(observed);
        }
        if (observed.type === "project.task.reconcile.profiled" && observed.data?.attemptId) {
          // Recovery also profiles no-op checks of a still-waiting Task. They are
          // not completed model attempts and must not satisfy this barrier.
          profiledAttempts.add(observed.data.attemptId);
          notify?.();
        }
      });
      const registry = new AppRegistry(async () => [{ appDir, definition: app }]);
      await registry.reload();
      const manager = new SubagentManager({
        persistDir,
        projectRoot: work,
        bus,
        agentRunFactory(config) {
          return createAgentRun({
            ...config,
            streamFn(selected, context, options) {
              const used = read().providerCalls + 1;
              change({ providerCalls: used });
              if (used > 40) throw Error("Fixture improver provider allowance exhausted (retained across reopen)");
              return config.streamFn!(selected, context, options);
            },
          });
        },
      });
      manager.register({ ...definition, tools, projectRoot: work, workspace: work, timeoutMs: 300_000 });
      const originalWait = manager.waitFor.bind(manager);
      manager.waitFor = async (sessionId) => {
        const began = Date.now();
        const result = await originalWait(sessionId);
        const recorded: DirectAgentExecutionResult = {
          ...result,
          messages: manager.progress(sessionId, 1000),
          durationMs: Date.now() - began,
        };
        results.push(recorded);
        (report.executions as unknown[]).push({ sessionId, ...recorded });
        save();
        return result;
      };
      const backends = createTaskExecutionBackends({ manager, bus, persistDir });
      const agents = backends.agents!;
      // Scripted preflight replaces judgment only. Live mode uses the shipped managed agent adapter.
      const wrapped = {
        ...agents,
        snapshot() {
          return this;
        },
        async execute(input: Parameters<typeof agents.execute>[0]) {
          const number = read().attempts + 1;
          change({ attempts: number });
          if (number > 2) throw Error("Trial permits two attempts; no hidden retry");
          console.log(JSON.stringify({ event: "improvement-attempt", number, live }));
          // The Task adapter supplies its own timeout; registration alone does
          // not override that value. Apply the experiment's tighter bound here.
          if (live) return agents.execute({ ...input, executionTimeoutMs: 300_000 });
          return {
            runId: null,
            handlerResult: {
              state: number === 1 ? ("waiting" as const) : ("converged" as const),
              summary: "Scripted lifecycle check, not model evidence",
              evidence: ["fixture"],
              actions: [],
              ...(number === 1
                ? { conditions: [condition], result: { checkpoint: "candidate saved" } }
                : { result: { accepted: true } }),
            },
          };
        },
      };
      await installAppTaskRuntimes({
        projectRoot: work,
        projectsRoot: work,
        persistDir,
        bus,
        hostCapacity: new HostCapacity(1),
        appRegistrySnapshot: registry.snapshot(),
        ...backends,
        agents: wrapped,
      });
      const tasks = createAppTaskCapability({ bus });
      const ingress = await startAppInboxRuntime({
        registry,
        db,
        bus,
        persistDir,
        schedulesEnabled: false,
        attachTask: tasks.attach,
        readDependency: tasks.readDependency,
        admitConversation: tasks.admitConversation,
        admitConversationChange: tasks.admitConversationChange,
        stopConversationTurn: tasks.stopTurn,
        admitTaskEvent: (input) => tasks.admitEvent(input),
        hasTaskTarget: (input) => tasks.has(input),
        previewTaskEvent: (input) => tasks.previewEvent(input),
        previewTaskEventRoutes: (input) => tasks.previewEventRoutes(input),
      });
      return {
        db,
        bus,
        tasks,
        store: AppTaskResourceStore.activeFromDb(db, "lab")!,
        async close() {
          ingress.close();
          await closeInstalledAppTaskRuntimes(bus);
          closeDb(persistDir);
        },
      };
    }
    async function profiled(count: number) {
      const deadline = Date.now() + 330_000;
      while (profiledAttempts.size < count) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => {
              notify = undefined;
              reject(Error("Task attempt deadline exceeded"));
            },
            Math.max(1, deadline - Date.now()),
          );
          notify = () => {
            clearTimeout(timer);
            resolve();
          };
        });
      }
      notify = undefined;
    }
    let runtime: Awaited<ReturnType<typeof start>> | undefined;
    try {
      runtime = await start();
      runtime.bus.emit({
        type: "app.input.requested",
        source: "fixture-owner",
        owner: "human:fixture",
        data: {
          appId: "lab",
          idempotencyKey: "improvement-ask",
          input: { kind: "improve", data: {} },
        },
      });
      await profiled(1);
      const task = runtime.store.readTask("improve-guidance")!;
      report.beforeRestart = task;
      const first = runtime.store.readAttempt(task.status.observedAttemptId!)!;
      report.firstAttempt = first;
      assert.equal(
        first.acceptedResult?.state,
        "waiting",
        "Agent must save a real wait instead of polling or claiming success",
      );
      const candidate = await fixtureGit(root, ["rev-parse", "HEAD"]);
      const before = read();
      assert.equal(before.activations, 0);
      await runtime.close();
      runtime = undefined;
      runtime = await start();
      report.restarted = true;
      assert.equal(read().attempts, before.attempts, "Restart must not bypass the pending wait");
      const reopened = runtime.store.readTask("improve-guidance")!;
      report.afterRestart = reopened;
      assert.equal(reopened.metadata.generation, task.metadata.generation);
      assert.equal(reopened.status.observedAttemptId, task.status.observedAttemptId);
      assert.deepEqual(reopened.status.result, task.status.result);
      if (!live) {
        // Exercise a real redundant wake while the Condition is still open.
        // Its profiling record must not satisfy the next attempt's barrier.
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            stop();
            reject(Error("Expected a no-op wait check"));
          }, 10_000);
          const stop = runtime!.bus.listen((event) => {
            const observed = event as unknown as { type: string; data?: { reason?: string } };
            if (observed.type !== "project.task.reconcile.skipped" || observed.data?.reason !== "conditions-open")
              return;
            clearTimeout(timer);
            stop();
            resolve();
          });
          runtime!.tasks.wake({ appId: "lab", taskIds: ["improve-guidance"] });
        });
        assert.equal(read().attempts, 1);
        report.noopWaitCheck = true;
      }
      if (withdraw) {
        report.withdrawal = runtime.tasks.cancel({
          appId: "lab",
          taskId: "improve-guidance",
          expectedGeneration: reopened.metadata.generation,
          expectedResourceVersion: reopened.metadata.resourceVersion,
          reason: "Fixture owner withdraws improvement before the activation window opens",
          controlKey: "withdraw",
        });
        assert(runtime.store.isCancelled("improve-guidance"));
      }
      change({ ready: !withdraw, allowedCommit: candidate });
      const wake = {
        type: condition.type,
        source: "fixture-window",
        owner: "service:fixture",
        data: { id: "guidance-window", ready: true },
      } as unknown as AgentEvent;
      report.wake = wake;
      runtime.bus.emit(wake);
      if (withdraw) {
        report.lateTargetedWake =
          runtime.tasks.admitEvent({ appId: "lab", intent: null, targetedTaskId: "improve-guidance", event: wake }) ??
          null;
        assert.equal(report.lateTargetedWake, null, "Withdrawn work must reject a late targeted wake");
        await runtime.close();
        runtime = undefined;
        runtime = await start();
        assert(runtime.store.isCancelled("improve-guidance"));
        assert.equal(read().attempts, 1);
        assert.equal(read().activations, 0);
      } else {
        await profiled(2);
        const finished = runtime.store.readTask("improve-guidance")!;
        report.finalTask = finished;
        assert.equal(runtime.store.readAttempt(finished.status.observedAttemptId!)?.acceptedResult?.state, "converged");
        assert.equal(finished.metadata.generation, task.metadata.generation);
        assert.notEqual(finished.status.observedAttemptId, task.status.observedAttemptId);
        assert(!runtime.store.isCancelled("improve-guidance"), "An accepted outcome must not close its Task");
        assert.equal(runtime.store.nextDueAt(), null);
        report.inputs = listAppInboxItems(runtime.db, { appId: "lab" });
        assert.equal((report.inputs as unknown[]).length, 1, "Resume must not manufacture another ask");
        const input = listAppInboxItems(runtime.db, { appId: "lab" })[0]!;
        assert.equal(input.status, "done");
        assert.deepEqual(input.waitingOn, { kind: "task", id: "improve-guidance" });
        const admission = runtime.store.readTaskContext({ taskIds: [], admissionIds: [`task:${input.id}`] })
          .appTaskAdmissions?.[`task:${input.id}`];
        report.admission = admission;
        assert.equal(
          admission?.resultAttemptId,
          finished.status.observedAttemptId,
          "The original input must name the exact accepted second attempt",
        );
        assert.equal(
          runtime.db.prepare("SELECT count(*) AS count FROM app_tasks WHERE app_id = ?").get("lab")!.count,
          1,
        );
        report.ownerClosure = runtime.tasks.cancel({
          appId: "lab",
          taskId: "improve-guidance",
          expectedGeneration: finished.metadata.generation,
          expectedResourceVersion: finished.metadata.resourceVersion,
          reason: "Fixture owner accepts the bounded mechanism result",
          controlKey: "accept-and-close",
        });
        assert(runtime.store.isCancelled("improve-guidance"));
      }
      report.controls = read();
      report.passed = true;
      if (!live || withdraw) return undefined;
      const last = results.at(-1)!;
      return {
        ...last,
        attemptCount: results.length,
        messages: results.flatMap((result) => result.messages),
        durationMs: results.reduce((sum, result) => sum + result.durationMs, 0),
      };
    } catch (error) {
      report.error = String(error);
      throw error;
    } finally {
      report.controls = read();
      try {
        await runtime?.close();
      } finally {
        save();
      }
    }
  };
}

if (import.meta.main)
  await runTrial(process.argv.includes("--live"), taskImprover(process.argv.includes("--withdraw")));
