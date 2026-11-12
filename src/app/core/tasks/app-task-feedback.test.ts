import { TaskBudgetAdmissionStore } from "../state/task-budget-admission.js";
import { TaskExecutionStore } from "../state/task-execution-store.js";
import { installTaskExecutionLimit } from "../state/task-execution-admission.js";
import { describe, expect, it, setSystemTime } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Type, defineApp, type TaskExecutor } from "@may-agent/sdk";
import { appInputFeedbackEvent } from "../inbox/input-result.js";
import { AppInboxHost } from "../inbox/app-inbox-host.js";
import { admitTaskInput } from "../state/inbox.js";
import { listAppInboxItems } from "../state/app-inbox-store.js";
import { createAppTaskCapability } from "./app-task-capability.js";
import { trackAppTaskConditionEventForTasks } from "./app-task-condition-tracker.js";
import {
  admitLoadedCanonicalAppTaskEvent,
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes as installCoreTaskRuntimes,
  getLoadedAppInputContract,
  previewLoadedCanonicalAppTaskEvent,
  readLoadedAppTaskInputResult,
  reconcileLoadedAppTaskOnce,
  recoverInstalledAppTasks,
} from "./app-task-runtime.js";
import { createAppTaskReadTool } from "../../app-task-read-tool.js";
import type { TaskAgentRunner } from "./execution.js";
import {
  claimObservedAppTask,
  completeAppTask,
  observeAppTaskIntent,
  recordAppTaskTrigger,
  appTaskContext,
} from "./app-task-reconciler.js";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { appTaskRuntimeTestSuite } from "../../../../test/fixtures/app-task-runtime.js";

const { admitTaskAppDependencies, eventBus, fixture, definition, options, loadedTaskConfig } =
  appTaskRuntimeTestSuite();

describe("caller feedback", () => {
  // Cross the event/history bounds once; attention modes share that storage path.
  it.each([
    [undefined, 54],
    ["next-wake", 3],
    ["immediate", 3],
  ] as const)(
    "retains progress with attention=%s across %i reports, then delivers failure and completion",
    async (progress, reports) => {
      const f = fixture();
      const persistDir = join(f.root, "state");
      let bus = eventBus();
      let host: AppInboxHost;
      let requestId = "";
      let workerCalls = 0;
      let stage: "progress" | "failure" | "done" = "progress";
      let loseFeedback = false;
      const callerInputs: Parameters<TaskExecutor>[0][] = [];
      const reviewAt = Date.now() + 60_000;
      const app = defineApp({
        ...definition(),
        task: ({ input }) => ({ kind: "desired", intent: {
          id: input.kind === "review" ? "work/caller" : "work/collector", parentId: "operations",
          outcome: "Collect the requested sample", acceptance: ["Return the sample"],
          executor: input.kind === "review" ? "caller" : "collector",
        } }),
      });
      const config = () => loadedTaskConfig(f);
      const install = async () => {
        await installCoreTaskRuntimes({
          ...options(f, bus), installControllers: false,
          appRegistrySnapshot: { id: "progress-interest", generation: 1, entries: [{ appDir: f.appDir, definition: app }] },
          executors: {
            caller: async (attempt) => {
              callerInputs.push(attempt);
              if (attempt.events.items.some(({ event }) => event.type === "app.dependency.updated" && event.data.status === "done"))
                return { state: "converged", summary: "Used returned sample", facts: ["sample:received"] };
              if (callerInputs.length === 1) {
                // Live declaration uses the same admission as a final result.
                await attempt.apply({
                  requests: [{ id: "sample", appId: "sample", input: { kind: "collect", data: {} } }],
                  conditions: [{ requestId: "sample", ...(progress ? { progress } : {}) }],
                });
                expect(config().resourceStore.readTaskConditions("work/caller")[0]?.spec.progress).toBe(progress ?? "next-wake");
                if (progress === "immediate") {
                  for (const choice of ["next-wake", "immediate", "next-wake", "immediate"] as const) {
                    await attempt.apply({ conditions: [{ requestId: "sample", progress: choice }] });
                    expect(config().resourceStore.readTaskConditions("work/caller")[0]?.spec.progress).toBe(choice);
                  }
                }
                return { state: "waiting", summary: "Await sample", facts: [], reviewAt };
              }
              // Omission of interest retains the saved choice on final admission.
              return { state: "waiting", summary: "Retained useful progress", facts: [], conditions: [{ requestId: "sample" }] };
            },
            collector: async () => {
              workerCalls++;
              if (stage === "done") return { state: "converged", summary: "Sample ready", facts: ["sample:ready"], result: { score: 0.92 } };
              if (stage === "failure") {
                if (progress === "immediate") throw new Error("Sample access failed");
                // Failure selection is independent of progress reporting.
                return { state: "incomplete", summary: "Sample access failed", facts: ["sample:access-failed"] };
              }
              return { state: "waiting", continue: true, report: true, summary: `Collected ${workerCalls} observations`,
                facts: [`observations:${workerCalls}`], result: { observations: workerCalls } };
            },
          },
        });
        host = new AppInboxHost({
          db: getDb(persistDir), apps: [app], attachTask: (input) => admitTaskInput(config(), input),
          readDependency: (input) => createAppTaskCapability({ bus }).readDependency({ ...input, appDir: f.appDir }),
          onRequestUpdated(item, result, status) {
            if (loseFeedback) throw new Error("Synthetic lost feedback");
            const event = appInputFeedbackEvent(item, result, status)!;
            return admitLoadedCanonicalAppTaskEvent({ bus, appId: "sample", event, intent: null,
              conditionTaskIds: previewLoadedCanonicalAppTaskEvent({ bus, appId: "sample", event }),
            })?.accepted;
          },
        });
        bus.subscribe((event) => {
          if (event.type !== "app.input.requested") return;
          requestId = String(event.data.requestId);
          const received = host.admit({ id: requestId, appId: "sample", source: { kind: "app", id: "sample" },
            input: event.data.input as { kind: string; data: unknown }, idempotencyKey: String(event.data.idempotencyKey) });
          host.recoverAdmission(received.item.id);
          return { accepted: true, by: "fixture-inbox", route: "direct" };
        });
      };
      const run = (taskId: string) => reconcileLoadedAppTaskOnce({ bus, appId: "sample", taskId,
        dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" } });
      const restart = async () => {
        host.close();
        await closeInstalledAppTaskRuntimes(bus);
        closeDb(persistDir);
        bus = eventBus();
        await install();
      };
      try {
        await install();
        host!.admit({ id: "original-ask", appId: "sample", source: { kind: "system", id: "fixture" }, input: { kind: "review", data: {} } });
        await run("work/caller");
        for (let revision = 1; revision <= reports; revision++) {
          loseFeedback = revision === Math.ceil(reports / 2);
          await run("work/collector");
          await host!.refreshTaskResults("sample", "work/collector");
          if (loseFeedback) {
            await restart();
            loseFeedback = false;
            await recoverInstalledAppTasks(bus);
          }
          await run("work/caller");
          expect(callerInputs).toHaveLength(progress === "immediate" ? revision + 1 : 1);
          expect(config().resourceStore.readTaskConditions("work/caller")[0]).toMatchObject({
            spec: { progress: progress ?? "next-wake" },
            status: { state: "false", observed: { state: "progress", reportRevision: revision, result: { observations: revision } } },
          });
        }
        const progressCalls = callerInputs.length - 1;
        expect(workerCalls).toBe(reports);
        // A deliberate review runs on time and receives retained progress after restart.
        await restart();
        setSystemTime(reviewAt + 1);
        await recoverInstalledAppTasks(bus);
        await run("work/caller");
        expect(callerInputs).toHaveLength(progressCalls + 2);
        expect(callerInputs.at(-1)?.waits.open[0]?.dependency?.reports?.progress).toMatchObject({
          state: "progress", reportRevision: reports, result: { observations: reports },
        });
        stage = "failure";
        loseFeedback = true;
        await run("work/collector");
        await host!.refreshTaskResults("sample", "work/collector");
        setSystemTime(config().resourceStore.readTask("work/collector")!.status.executionRetryAt! + 1);
        // Newer accepted progress must not overwrite the undelivered failure.
        stage = "progress";
        await run("work/collector");
        await host!.refreshTaskResults("sample", "work/collector");
        await restart();
        loseFeedback = false;
        await recoverInstalledAppTasks(bus);
        await run("work/caller");
        expect(callerInputs).toHaveLength(progressCalls + 3);
        expect(callerInputs.at(-1)?.events.items.some(({ event }) => event.data.status === "blocked")).toBe(true);
        expect(callerInputs.at(-1)?.waits.open[0]?.dependency?.reports).toMatchObject({
          failure: { state: "blocked", reportRevision: reports + 1 },
          progress: { state: "progress", reportRevision: reports + 2 },
        });
        const beforeRetry = callerInputs.length;
        stage = "failure";
        await run("work/collector");
        await host!.refreshTaskResults("sample", "work/collector");
        await recoverInstalledAppTasks(bus);
        await run("work/caller");
        expect(callerInputs).toHaveLength(beforeRetry);
        stage = "done";
        setSystemTime(config().resourceStore.readTask("work/collector")!.status.executionRetryAt! + 1);
        await run("work/collector");
        await host!.refreshTaskResults("sample", "work/collector");
        await run("work/caller");
        expect(callerInputs).toHaveLength(beforeRetry + 1);
        expect(host!.get(requestId)?.status).toBe("done");
        expect(config().resourceStore.readTask("work/caller")?.status.phase).toBe("converged");
      } finally { host!.close(); }
    },
  );
  it("reads the full installed input contract through tasks without starting target work", async () => {
    const f = fixture();
    const bus = eventBus();
    const inputSchema = Type.Object(
      {
        kind: Type.Literal("review"),
        data: Type.Object(
          {
            acceptance: Type.Array(Type.String(), { minItems: 1 }),
            assignment: Type.Optional(Type.Object({ agent: Type.String() })),
          },
          { additionalProperties: false },
        ),
      },
      { $defs: { label: Type.String({ minLength: 1 }) }, not: { required: ["unexpected"] } },
    );
    const target = defineApp({
      id: "reviewer",
      version: 1,
      agent: "reviewer",
      inputSchema,
      tasks: {},
      task: () => {
        throw new Error("Contract reads must not create work");
      },
    });
    const install = (app = target) =>
      installCoreTaskRuntimes({
        ...options(f, bus),
        installControllers: false,
        taskAppIds: ["sample"],
        appRegistrySnapshot: {
          id: "contracts",
          generation: 1,
          entries: [
            { appDir: f.appDir, definition: definition() },
            { appDir: join(f.projectsRoot, "reviewer.app"), definition: app },
          ],
        },
      });
    await install();
    const tool = createAppTaskReadTool({ bus, appId: () => "sample" });
    const result = await tool.execute("contract", { action: "contract", target: { appId: "reviewer.app" } });
    const content = result.content[0];
    if (content?.type !== "text") throw new Error("Expected contract text");
    expect(JSON.parse(content.text)).toEqual({ appId: "reviewer", agent: "reviewer", inputSchema, observations: [], taskReads: { workload: 1 } });
    const clone = getLoadedAppInputContract({ bus, appId: "reviewer" });
    clone.inputSchema.properties = {};
    expect(getLoadedAppInputContract({ bus, appId: "reviewer" }).inputSchema).toEqual(inputSchema);
    await install({ ...target, inputSchema: Type.Object({ kind: Type.Literal("new-review") }) });
    expect(getLoadedAppInputContract({ bus, appId: "reviewer" }).inputSchema).not.toEqual(inputSchema);
    expect(() => getLoadedAppInputContract({ bus, appId: "absent" })).toThrow("no installed Task input contract");

    await install({
      ...target,
      observers: [
        {
          id: "build",
          type: "build.state",
          description: "Read build state",
          intervalMs: 60_000,
          timeoutMs: 1000,
          inspect: async () => ({ state: "passed" }),
        },
      ],
    });
    const conditionReply = await tool.execute("condition", {
      action: "contract",
      target: { appId: "reviewer" },
      observation: { observerId: "build", id: "result", resource: "repo/42", expected: { state: "passed" } },
    });
    const conditionText = conditionReply.content[0];
    if (conditionText?.type !== "text") throw new Error("Expected condition text");
    expect(JSON.parse(conditionText.text).condition).toEqual({
      id: "result",
      type: "build.state",
      subject: "resource:repo/42",
      expected: { state: "passed", source: "app:reviewer:observer:build", timestamp: { gte: expect.any(Number) } },
      owner: "app:reviewer",
    });
    const missing = await tool.execute("condition-missing", {
      action: "contract",
      target: { appId: "reviewer" },
      observation: { observerId: "missing", id: "result", resource: "repo/42", expected: { state: "passed" } },
    });
    expect(missing.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("no installed observer") });
  });

  it("reads an exact accepted admission from a caller-only registry without starting target execution", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const workerDir = join(f.projectsRoot, "worker.app");
    mkdirSync(workerDir, { recursive: true });
    const worker = defineApp({
      id: "worker",
      version: 1,
      agent: "worker",
      tasks: {},
      inputSchema: Type.Object({ kind: Type.Literal("measure"), data: Type.Object({ sample: Type.String() }) }),
      task: () => ({
        kind: "desired",
        intent: { id: "measurement", parentId: "root", outcome: "Measure", acceptance: ["Verified"] },
      }),
    });
    const target = appTaskContext({
      appDir: workerDir,
      projectDir: workerDir,
      agent: "worker",
      maxConcurrent: 1,
      resourceStore: AppTaskResourceStore.fromDb(getDb(persistDir), "worker"),
    });
    target.resourceStore.bootstrapSnapshot(
      {
        project: "worker",
        project_lifecycle: "active",
        root_task_id: "root",
        groups: { root: { id: "root", parent_id: null } },
      },
      "fixture",
    );
    admitTaskInput(target, {
      appId: "worker",
      attachment: worker.task!({
        id: "original",
        source: { kind: "app", id: "sample" },
        input: { kind: "measure", data: { sample: "original" } },
      }),
      idempotencyKey: "task:original",
      inputContext: {
        id: "original",
        source: { kind: "app", id: "sample" },
        input: { kind: "measure", data: { sample: "original" } },
      },
    });
    const original = claimObservedAppTask(target, { taskId: "measurement", appAgent: "worker", handler: "auto" });
    if (original.kind !== "claimed") throw new Error("Expected original target claim");
    completeAppTask(target, original, { summary: "Original exact answer", result: { value: 42 } });
    admitTaskInput(target, {
      appId: "worker",
      attachment: { kind: "existing", taskId: "measurement" },
      idempotencyKey: "task:later",
      inputContext: {
        id: "later",
        source: { kind: "app", id: "another-caller" },
        input: { kind: "measure", data: { sample: "later" } },
      },
    });
    const later = claimObservedAppTask(target, { taskId: "measurement", appAgent: "worker", handler: "auto" });
    if (later.kind !== "claimed") throw new Error("Expected later target claim");
    completeAppTask(target, later, { summary: "Later answer", result: { value: 7 } });

    const { installed } = await installCoreTaskRuntimes({
      ...options(f, bus),
      installControllers: false,
      taskAppIds: ["sample"],
      appRegistrySnapshot: {
        id: "caller-only-exact-read",
        generation: 1,
        entries: [
          { appDir: f.appDir, definition: definition() },
          { appDir: workerDir, definition: worker },
        ],
      },
    });
    expect(installed.map((entry) => entry.id)).toEqual(["sample"]);
    const capability = createAppTaskCapability({ bus });
    expect(capability.get({ appId: "worker", taskId: "measurement" })?.result).toEqual({ value: 7 });
    expect(
      await capability.readDependency({
        appDir: workerDir,
        dependency: { kind: "task", id: "measurement" },
        admissionKey: "task:original",
      }),
    ).toMatchObject({ status: "done", summary: "Original exact answer", result: { value: 42 } });
    expect(
      await capability.readDependency({
        appDir: workerDir,
        dependency: { kind: "task", id: "missing" },
        admissionKey: "task:missing",
      }),
    ).toBeNull();
    expect(
      await capability.readDependency({
        appDir: join(f.projectsRoot, "absent.app"),
        dependency: { kind: "task", id: "measurement" },
        admissionKey: "task:original",
      }),
    ).toBeNull();
    expect(installed.map((entry) => entry.id)).toEqual(["sample"]);
  });

  it("recovers delegated creator after lost admission and revises across Apps from a caller-only runtime", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const worker = defineApp({
      id: "worker",
      version: 1,
      agent: "worker",
      tasks: {},
      inputSchema: Type.Object({ kind: Type.Literal("measure"), data: Type.Object({ source: Type.String() }) }),
      task: ({ input }) => ({
        kind: "desired",
        intent: {
          id: "measurement",
          parentId: "root",
          outcome: `Measure ${input.data.source}`,
          acceptance: ["Verified measurement"],
          input: input.data,
        },
      }),
    });
    const db = getDb(persistDir);
    const workerDir = join(f.projectsRoot, "worker.app");
    mkdirSync(workerDir, { recursive: true });
    const target = appTaskContext({
      appDir: workerDir,
      projectDir: workerDir,
      agent: "worker",
      maxConcurrent: 1,
      resourceStore: AppTaskResourceStore.fromDb(db, "worker"),
    });
    target.resourceStore.bootstrapSnapshot(
      {
        project: "worker",
        project_lifecycle: "active",
        root_task_id: "root",
        groups: { root: { id: "root", parent_id: null } },
      },
      "fixture",
    );
    const opts = {
      ...options(f, bus),
      installControllers: false,
      taskAppIds: ["sample"],
      appRegistrySnapshot: {
        id: "caller-only",
        generation: 1,
        entries: [
          { appDir: f.appDir, definition: definition() },
          { appDir: workerDir, definition: worker },
        ],
      },
    };
    const { installed } = await installCoreTaskRuntimes(opts);
    expect(installed.map((app) => app.id)).toEqual(["sample"]);
    const source = loadedTaskConfig(f);
    observeAppTaskIntent(source, {
      appAgent: "sample-owner",
      intent: {
        id: "parent",
        parentId: "operations",
        outcome: "Review measurements",
        acceptance: ["Measurements checked"],
      },
    });
    const claim = claimObservedAppTask(source, { taskId: "parent", appAgent: "sample-owner", handler: "auto" });
    if (claim.kind !== "claimed") throw new Error("Expected creator claim");
    // No subscriber or event writer accepts the notification. The saved admission
    // still carries the exact creator and can be recovered without that event.
    expect(() =>
      admitTaskAppDependencies({
        opts,
        descriptor: installed[0]!,
        claim,
        dependencies: [{ id: "measurement", appId: "worker", input: { kind: "measure", data: { source: "alpha" } } }],
      }),
    ).toThrow("neither admitted nor durably published");
    const host = new AppInboxHost({
      db,
      apps: [worker],
      attachTask: (input) => admitTaskInput(target, input),
      readDependency: (input) => createAppTaskCapability({ bus }).readDependency({ ...input, appDir: workerDir }),
      onRequestUpdated() {
        throw new Error("Lost revised-answer notification");
      },
    });
    try {
      await host.recoverAdmissions();
      expect(target.resourceStore.readTask("measurement")?.metadata.creator).toEqual({
        appId: "sample",
        taskId: "parent",
      });
      const tool = createAppTaskReadTool({
        bus,
        scope: () => ({
          appId: "sample",
          taskId: claim.taskId,
          generation: claim.generation,
          attemptId: claim.attemptId,
        }),
      });
      const saved = await tool.execute("cross-app-correction", {
        action: "update",
        target: { appId: "worker" },
        taskId: "measurement",
        expectedGeneration: 1,
        input: { kind: "measure", data: { source: "beta" } },
      });
      expect(JSON.parse((saved.content[0] as { text: string }).text)).toMatchObject({
        id: "measurement",
        generation: 2,
        outcome: "Measure beta",
        input: { source: "beta" },
      });
      expect(target.resourceStore.readTask("measurement")?.metadata.creator).toEqual({
        appId: "sample",
        taskId: "parent",
      });
      const originalInput = listAppInboxItems(db, { appId: "worker" })[0]!;
      expect(originalInput.input.data).toEqual({ source: "alpha" });
      await closeInstalledAppTaskRuntimes(bus);
      await installCoreTaskRuntimes({ ...opts, taskAppIds: ["sample", "worker"] });
      const next = claimObservedAppTask(target, { taskId: "measurement", appAgent: "worker", handler: "auto" });
      if (next.kind !== "claimed") throw new Error("Expected revised worker");
      expect(next.intent.input).toEqual({ source: "beta" });
      expect(next.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: expect.objectContaining({
              data: expect.objectContaining({
                request: expect.objectContaining({ input: { kind: "measure", data: { source: "beta" } } }),
              }),
            }),
          }),
        ]),
      );
      expect(completeAppTask(target, next, { summary: "Beta verified", result: { source: "beta" } }).status).toBe(
        "applied",
      );
      await host.recoverTaskResults();
      expect(host.get(originalInput.id)).toMatchObject({
        status: "done",
        result: { result: { source: "beta" } },
        input: { data: { source: "alpha" } },
      });
      // Creator disposition goes through the shipped tool, retaining the exact input answer.
      const closer = createAppTaskReadTool({ bus, scope: () => ({ appId: "sample", taskId: "parent",
        generation: claim.generation, attemptId: claim.attemptId }) });
      const resource = target.resourceStore.readTask("measurement")!;
      const request = { action: "close", target: { appId: "worker" }, taskId: "measurement",
        expectedGeneration: resource.metadata.generation, expectedResourceVersion: resource.metadata.resourceVersion,
        afterResult: next.attemptId, reason: "Owner consumed the verified measurement" };
      for (let replay = 0; replay < 2; replay++) {
        const closed = await closer.execute("close-measurement", request);
        expect(JSON.parse((closed.content[0] as { text: string }).text)).toMatchObject({
          status: "closed", closed: true, result: { source: "beta" },
        });
      }
      expect(host.get(originalInput.id)).toMatchObject({ status: "done", result: { result: { source: "beta" } } });
    } finally {
      host.close();
    }
  });

  it.each([{ onePlace: false }, { onePlace: true }])("composes three assignments through the same executor and return contract across restart (one-place budget=$onePlace)", async ({ onePlace }) => {
    const f = fixture();
    const persistDir = join(f.root, "state");
    let bus = eventBus();
    let host: AppInboxHost;
    const calls: string[] = [];
    const rootRef = { appId: "sample", taskId: "work/0" };
    const recipient = (agent: string) => ({ kind: "programmatic" as const, id: `fixture/${agent}` });
    const ready = Promise.withResolvers<void>();
    const yielded = Promise.withResolvers<void>();
    const agents: TaskAgentRunner = {
      available: () => true, prepare: async () => true, snapshot: () => agents,
      executionRecipient: recipient, role: agent => ({ agent, instructions: "Collect and review facts" }),
      execute: async () => { throw new Error("Code executor must own this fixture"); },
    };
    if (onePlace) {
      const db = getDb(persistDir);
      new TaskBudgetAdmissionStore(db).install({ appId: "sample", sponsor: { appId: "sample", agent: "sample-owner" },
        dailyCredits: 20, rootCredits: 20 });
      installTaskExecutionLimit(db, { kind: "host" }, 4);
      for (let level = 0; level < 3; level++)
        installTaskExecutionLimit(db, { kind: "agent", recipient: recipient(`role-${level}`) }, 1);
      installTaskExecutionLimit(db, { kind: "root", root: rootRef }, 1);
    }
    const occupied = () => new TaskExecutionStore(getDb(persistDir)).usage({ kind: "root", root: rootRef }).occupied;
    const charged = () => new TaskBudgetAdmissionStore(getDb(persistDir)).budget.view(rootRef, Date.now())?.rootCharged;
    const app = defineApp({
      ...definition(),
      task: ({ input }) => ({
        kind: "desired",
        intent: {
          id: `work/${(input.data as { level: number }).level}`,
          parentId: "operations",
          outcome: String(
            (input.data as { revision?: string }).revision ?? "Review and combine delegated measurements",
          ),
          acceptance: ["Return the measured value through each assigning caller"],
          input: input.data as Record<string, unknown>,
          executor: "measure",
          ...(onePlace ? { agent: `role-${(input.data as { level: number }).level}` } : {}),
        },
      }),
    });
    const install = async () => {
      await installCoreTaskRuntimes({
        ...options(f, bus),
        installControllers: false,
        ...(onePlace ? { agents } : {}),
        appRegistrySnapshot: {
          id: "assignment-roles",
          generation: 1,
          entries: [{ appDir: f.appDir, definition: app }],
        },
        executors: {
          measure: async (attempt) => {
            calls.push(attempt.task.id);
            if (onePlace) {
              expect(occupied()).toBe(1);
              expect(new TaskBudgetAdmissionStore(getDb(persistDir)).budget.binding({ appId: "sample", taskId: attempt.task.id })).toEqual(rootRef);
            }
            expect(attempt.task.agent).toBe(attempt.role.agent);
            expect((await attempt.read.contract("sample")).agent).toBe(app.agent);
            const level = Number(attempt.task.id.split("/").at(-1));
            const returned = attempt.events.items.find(
              ({ event }) => event.type === "app.dependency.updated" && event.data.status === "done",
            );
            if (returned) {
              const result = returned.event.data.result as { value: number; reviewedBy: number[] };
              return {
                state: "converged",
                summary: "Reviewed the delegated measurement",
                facts: ["measurement:7"],
                result: { value: result.value, reviewedBy: [...result.reviewedBy, level] },
              };
            }
            if (level === 2)
              return {
                state: "converged",
                summary: "Measured value",
                facts: ["measurement:7"],
                result: { value: 7, reviewedBy: [2] },
              };
            if (onePlace) {
              await attempt.apply({
                requests: [{ id: "measurement", appId: "sample", input: { kind: "measure", data: { level: level + 1 } } }],
                conditions: [{ requestId: "measurement" }],
              });
              if (level === 0) { ready.resolve(); await yielded.promise; }
              return { state: "waiting", summary: "Requested independent measurement", facts: [] };
            }
            return {
              state: "waiting",
              summary: "Requested independent measurement",
              facts: [],
              requests: [
                { id: "measurement", appId: "sample", input: { kind: "measure", data: { level: level + 1 } } },
              ], conditions: [{ requestId: "measurement", progress: "immediate" as const }],
            };
          },
        },
      });
      host = new AppInboxHost({
        db: getDb(persistDir),
        apps: [app],
        attachTask: (input) => admitTaskInput(loadedTaskConfig(f), input),
        readDependency: (input) => createAppTaskCapability({ bus }).readDependency({ ...input, appDir: f.appDir }),
        onRequestUpdated() {
          throw new Error("Synthetic lost notification");
        },
      });
      bus.subscribe((event) => {
        if (event.type !== "app.input.requested") return;
        const received = host.admit({
          id: String(event.data.requestId),
          appId: "sample",
          source: { kind: "app", id: "sample" },
          input: event.data.input as { kind: string; data: unknown },
          idempotencyKey: String(event.data.idempotencyKey),
        });
        host.recoverAdmission(received.item.id);
        return { accepted: true, by: "fixture", route: "direct" };
      });
    };
    const run = (level: number) =>
      reconcileLoadedAppTaskOnce({
        bus,
        appId: "sample",
        taskId: `work/${level}`,
        dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
      });
    try {
      await install();
      host!.admit({
        id: "original",
        appId: "sample",
        source: { kind: "human", id: "human" },
        input: { kind: "measure", data: { level: 0 } },
      });
      if (onePlace) {
        const parent = run(0);
        try {
          await ready.promise;
          const before = charged();
          expect(occupied()).toBe(1);
          await run(1);
          expect(calls).toEqual(["work/0"]);
          expect(charged()).toBe(before);
          expect(loadedTaskConfig(f).resourceStore.readTask("work/1")?.status.executionConstraint?.scope.kind).toBe("root");
        } finally { yielded.resolve(); await parent; }
        expect(occupied()).toBe(0);
        expect(loadedTaskConfig(f).resourceStore.readTask("work/1")?.status.executionConstraint).toBeUndefined();
      } else await run(0);
      await run(1);
      await run(2);
      expect(host!.get("original")?.result).toBeUndefined();
      expect(loadedTaskConfig(f).resourceStore.readTask("work/1")?.status.phase).toBe("waiting");
      host!.close();
      await closeInstalledAppTaskRuntimes(bus);
      closeDb(persistDir);
      bus = eventBus();
      await install();
      await host!.recoverTaskResults();
      await recoverInstalledAppTasks(bus);
      await run(1);
      expect(host!.get("original")?.result).toBeUndefined();
      await host!.recoverTaskResults();
      await recoverInstalledAppTasks(bus);
      await run(0);
      await host!.recoverTaskResults();
      expect(host!.get("original")?.result?.result).toEqual({ value: 7, reviewedBy: [2, 1, 0] });
      expect(calls).toEqual(["work/0", "work/1", "work/2", "work/1", "work/0"]);
      if (onePlace) { expect(occupied()).toBe(0); expect(charged()).toBe(8); }
      await host!.recoverTaskResults();
      await recoverInstalledAppTasks(bus);
      await run(0);
      expect(calls).toHaveLength(5);
      if (onePlace) { expect(occupied()).toBe(0); expect(charged()).toBe(8); }
      const revisionConfig = loadedTaskConfig(f);
      expect(revisionConfig.resourceStore.readTask("work/1")?.metadata.creator).toEqual({
        appId: "sample",
        taskId: "work/0",
      });
      expect(revisionConfig.resourceStore.readTask("work/2")?.metadata.creator).toEqual({
        appId: "sample",
        taskId: "work/1",
      });
      recordAppTaskTrigger(revisionConfig, "work/0", { type: "sample.refinement", source: "human", data: {} });
      const reviewer = claimObservedAppTask(revisionConfig, {
        taskId: "work/0",
        appAgent: "sample-owner",
        handler: "agent",
        ...(onePlace ? { execution: { recipient, lane: "background" as const } } : {}),
      });
      if (reviewer.kind !== "claimed") throw new Error("Expected caller review");
      const tool = createAppTaskReadTool({
        bus,
        scope: () => ({
          appId: "sample",
          taskId: reviewer.taskId,
          generation: reviewer.generation,
          attemptId: reviewer.attemptId,
        }),
      });
      const saved = await tool.execute("revise-child", {
        action: "update",
        taskId: "work/1",
        expectedGeneration: 1,
        input: { kind: "measure", data: { level: 1, revision: "Verify the additional measurement" } },
      });
      expect(JSON.parse((saved.content[0] as { text: string }).text)).toMatchObject({
        id: "work/1",
        generation: 2,
        outcome: "Verify the additional measurement",
        input: { level: 1, revision: "Verify the additional measurement" },
      });
      for (let level = 0; level < 3; level++)
        expect(loadedTaskConfig(f).resourceStore.isCancelled(`work/${level}`)).toBe(false);
    } finally {
      yielded.resolve();
      host!.close();
    }
  });

  it.each(["quiet", "incomplete-then-wait", "report-wait", "report-continue", "throw", "invalid", "throw-then-wait", "throw-then-report-retry"] as const)(
    "returns exact feedback and recovers the original answer (%s)",
    async (scenario) => {
      const f = fixture();
      const persistDir = join(f.root, "state");
      let bus = eventBus();
      let host: AppInboxHost;
      let requestId = "";
      let ready = false;
      let workerCalls = 0;
      const callerInputs: Parameters<TaskExecutor>[0][] = [];
      const reportSummary = "Please restore access; the worker is waiting for the access event.";
      const app = defineApp({
        ...definition(),
        // This feedback-ordering trial includes three failures before repair.
        tasks: { ...definition().tasks, maxConsecutiveFailures: 4 },
        task: ({ input }) => ({ kind: "desired", intent: {
          id: input.kind === "review" ? "work/caller" : "work/collector",
          parentId: "operations", outcome: "Return the requested sample",
          acceptance: ["Return the observed score"],
          executor: input.kind === "review" ? "caller" : "collector",
        } }),
      });
      const install = async () => {
        await installCoreTaskRuntimes({
          ...options(f, bus), installControllers: false,
          appRegistrySnapshot: { id: "caller-feedback-poc", generation: 1,
            entries: [{ appDir: f.appDir, definition: app }] },
          executors: {
            caller: async (attempt) => {
              callerInputs.push(attempt);
              const answer = attempt.events.items.find(({ event }) =>
                event.type === "app.dependency.updated" && event.data.status === "done");
              if (answer) return {
                state: "converged", summary: "Reviewed original sample", result: answer.event.data.result as Record<string, unknown>,
                facts: ["sample:one"],
              };
              return {
                state: "waiting", summary: "Waiting for the original sample", facts: [],
                ...(callerInputs.length === 1 ? {
                  requests: [{ id: "sample", appId: "sample", input: { kind: "collect", data: { sample: "one" } } }],
                  conditions: [{ requestId: "sample", progress: "immediate" as const }],
                } : {}),
              };
            },
            collector: async () => {
              workerCalls++;
              if (ready) return { state: "converged", summary: "Observed sample", result: { score: 0.92 }, facts: ["sample:one"] };
              if (scenario === "incomplete-then-wait" && workerCalls === 1)
                return { state: "incomplete", summary: reportSummary, facts: ["sample:access-denied"] };
              if (scenario === "throw" || ((scenario === "throw-then-wait" || scenario === "throw-then-report-retry") && workerCalls === 1))
                throw new Error("Synthetic provider connection failed");
              if (scenario === "throw-then-report-retry") return {
                state: "incomplete", summary: "Access is missing; please arrange it while I retry",
                facts: ["sample:access-denied"], ...(workerCalls === 2 ? { report: true as const } : {}),
              };
              if (scenario === "invalid") return {
                state: "converged", summary: "Untrusted result must not escape", facts: [],
                unexpectedField: true,
                actions: [{ kind: "unblock-task", taskId: "work/caller", expectedGeneration: 1, reason: "Invalid proposal" }],
              } as never;
              return {
                state: "waiting", summary: reportSummary, facts: ["sample:access-denied"],
                ...(scenario !== "quiet" && scenario !== "incomplete-then-wait" &&
                  !(scenario === "report-continue" && workerCalls > 1) ? { report: true as const } : {}),
                ...(scenario === "report-continue" && workerCalls === 1 ? { continue: true as const } : {}),
                conditions: [{ id: "sample-access", type: "sample.access.changed", subject: "resource:sample",
                  expected: { field: "available", equals: true }, owner: "app:sample" }],
              };
            },
          },
        });
        host = new AppInboxHost({
          db: getDb(persistDir), apps: [app],
          attachTask: (input) => admitTaskInput(loadedTaskConfig(f), input),
          readDependency: (input) => createAppTaskCapability({ bus }).readDependency({ ...input, appDir: f.appDir }),
          // Deliberately lose live feedback before publication. Recovery must
          // use saved input/attempt facts, not an event captured by the test.
          onRequestUpdated() { throw new Error("Synthetic lost notification"); },
        });
        bus.subscribe((event) => {
          if (event.type !== "app.input.requested") return;
          requestId = String(event.data.requestId);
          const received = host.admit({ id: requestId, appId: "sample", source: { kind: "app", id: "sample" },
            input: event.data.input as { kind: string; data: unknown }, idempotencyKey: String(event.data.idempotencyKey) });
          host.recoverAdmission(received.item.id);
          return { accepted: true, by: "fixture", route: "direct" };
        });
      };
      const run = (taskId: string) => reconcileLoadedAppTaskOnce({
        bus, appId: "sample", taskId,
        dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
      });
      const reopen = async () => {
        host.close();
        await closeInstalledAppTaskRuntimes(bus);
        closeDb(persistDir);
        bus = eventBus();
        await install();
      };
      try {
        await install();
        host!.admit({ id: "original-ask", appId: "sample", source: { kind: "system", id: "fixture" },
          input: { kind: "review", data: { sample: "one" } } });
        await run("work/caller");
        const callerBefore = loadedTaskConfig(f).resourceStore.readTask("work/caller")!;
        await run("work/collector");
        await host!.recoverTaskResults();
        const item = host!.get(requestId)!;
        const report = () => readLoadedAppTaskInputResult({ bus, appDir: f.appDir,
          taskId: "work/collector", admissionKey: item.taskAdmissionKey!, kind: "report" });
        const first = report();
        expect(item.status).toBe("handling");
        expect(readLoadedAppTaskInputResult({ bus, appDir: f.appDir,
          taskId: "work/collector", admissionKey: item.taskAdmissionKey! })).toBeNull();
        expect(loadedTaskConfig(f).resourceStore.readTask("work/caller")!.metadata).toEqual(callerBefore.metadata);
        if (scenario === "quiet") expect(first).toBeNull();
        else {
          expect(first).not.toBeNull();
          if (scenario === "report-wait" || scenario === "report-continue" || scenario === "incomplete-then-wait") {
            expect(first!.summary).toBe(reportSummary);
            expect(first!.state).toBe(scenario === "incomplete-then-wait" ? "incomplete" : "waiting");
          } else {
            expect(first!.summary).toContain("Execution failed");
            expect(first!.facts).toContain(`task-attempt:${first!.attemptId}`);
            expect(loadedTaskConfig(f).resourceStore.readAttempt(first!.attemptId)?.acceptedResult).toBeUndefined();
          }
        }
        await reopen();
        expect(report()).toEqual(first);
        await recoverInstalledAppTasks(bus);
        await run("work/caller");
        let expectedCalls = scenario === "quiet" ? 1 : 2;
        expect(callerInputs).toHaveLength(expectedCalls);
        if (scenario !== "quiet") {
          const feedback = callerInputs[1]!.events.items.find(({ event }) => event.type === "app.dependency.updated");
          expect(feedback?.event.data).toMatchObject({ id: requestId, status: first!.state === "waiting" ? "progress" : "blocked", summary: first!.summary });
          expect(callerInputs[1]!.waits.open[0]?.state).toBe("false");
        }
        if (scenario === "report-continue") {
          expect(loadedTaskConfig(f).resourceStore.readAttempt(first!.attemptId)?.acceptedResult)
            .toMatchObject({ state: "waiting", report: true, continue: true });
          expect(loadedTaskConfig(f).resourceStore.readTask("work/collector")?.status.phase).toBe("pending");
          await run("work/collector");
          await host!.recoverTaskResults();
          expect(report()).toEqual(first);
          expect(loadedTaskConfig(f).resourceStore.readTask("work/collector")?.status.phase).toBe("waiting");
        }
        if (scenario === "throw-then-wait" || scenario === "incomplete-then-wait" || scenario === "throw-then-report-retry") {
          setSystemTime(loadedTaskConfig(f).resourceStore.readTask("work/collector")!.status.executionRetryAt! + 1);
          await run("work/collector");
          await host!.recoverTaskResults();
          expect(loadedTaskConfig(f).resourceStore.readTask("work/collector")?.status.phase)
            .toBe(scenario === "throw-then-report-retry" ? "pending" : "waiting");
          if (scenario !== "incomplete-then-wait") {
            expect(report()?.summary).toBe(scenario === "throw-then-report-retry"
              ? "Access is missing; please arrange it while I retry" : reportSummary);
            expect(report()?.attemptId).not.toBe(first!.attemptId);
            expect(report()?.reportRevision).toBe(2);
            expect(loadedTaskConfig(f).resourceStore.readAttempt(first!.attemptId)?.acceptedResult).toBeUndefined();
            const selected = report();
            await reopen();
            expect(report()).toEqual(selected);
            await recoverInstalledAppTasks(bus);
            await run("work/caller");
            expectedCalls++;
            const feedback = callerInputs.at(-1)!.events.items.find(({ event }) => event.type === "app.dependency.updated");
            expect(feedback?.event.data).toMatchObject({ status: selected!.state === "waiting" ? "progress" : "blocked", summary: selected!.summary, reportAttemptId: selected!.attemptId });
            // A delayed old notification must not undo the newer observation
            // or wake the caller again after it already handled both reports.
            expect(trackAppTaskConditionEventForTasks(loadedTaskConfig(f),
              appInputFeedbackEvent(item, first!, "blocked")!, ["work/caller"])).toEqual([]);
            if (scenario === "throw-then-report-retry") {
              setSystemTime(loadedTaskConfig(f).resourceStore.readTask("work/collector")!.status.executionRetryAt! + 1);
              await run("work/collector");
              expect(report()).toEqual(selected);
              expect(loadedTaskConfig(f).resourceStore.readTask("work/collector")?.status.phase).toBe("pending");
            }
          } else expect(report()).toEqual(first);
        }
        for (let review = 0; review < 5; review++) {
          await host!.recoverTaskResults();
          await recoverInstalledAppTasks(bus);
          await run("work/caller");
        }
        expect(callerInputs).toHaveLength(expectedCalls);
        const beforeQuiet = workerCalls;
        if (scenario === "quiet" || scenario === "report-wait" || scenario === "report-continue" ||
          scenario === "throw-then-wait" || scenario === "incomplete-then-wait") {
          const start = Date.now();
          for (let tick = 1; tick <= 10; tick++) {
            setSystemTime(start + tick * 10_000);
            await recoverInstalledAppTasks(bus);
            await run("work/collector");
          }
          expect(workerCalls).toBe(beforeQuiet);
          const store = loadedTaskConfig(f).resourceStore;
          expect(store.readTaskConditions("work/collector").find((c) => c.metadata.id === "sample-access")?.status.state).not.toBe("true");
          trackAppTaskConditionEventForTasks(loadedTaskConfig(f), {
            type: "sample.access.changed", source: "fixture", data: { resource: "different", available: true },
          }, ["work/collector"]);
          await run("work/collector");
          expect(workerCalls).toBe(beforeQuiet);
          trackAppTaskConditionEventForTasks(loadedTaskConfig(f), {
            type: "sample.access.changed", source: "fixture", data: { resource: "sample", available: true },
          }, ["work/collector"]);
        } else {
          setSystemTime(loadedTaskConfig(f).resourceStore.readTask("work/collector")!.status.executionRetryAt! + 1);
        }
        ready = true;
        await run("work/collector");
        // The committed Task observation is a targeted level-triggered refresh.
        // It must consider this new exact answer even when an older report's
        // failed notification left the same input under retry pacing.
        await host!.refreshTaskResults("sample", "work/collector");
        await host!.recoverTaskResults();
        // onRequestUpdated always throws in this fixture. The exact answer is
        // nevertheless durable before the original caller considers it.
        expect(host!.get(requestId)).toMatchObject({
          status: "done",
          result: { summary: "Observed sample", result: { score: 0.92 } },
        });
        await recoverInstalledAppTasks(bus);
        await run("work/caller");
        await host!.recoverTaskResults();
        expect(callerInputs).toHaveLength(expectedCalls + 1);
        expect(workerCalls).toBe(beforeQuiet + 1);
        expect(host!.get("original-ask")?.result?.result).toEqual({ score: 0.92 });
        expect(host!.get(requestId)?.status).toBe("done");
        for (const id of ["work/caller", "work/collector"])
          expect(loadedTaskConfig(f).resourceStore.isCancelled(id)).toBe(false);
        const answer = host!.get("original-ask")!.result;
        await reopen();
        await host!.recoverTaskResults();
        await recoverInstalledAppTasks(bus);
        await run("work/caller");
        expect(callerInputs).toHaveLength(expectedCalls + 1);
        expect(host!.get("original-ask")?.result).toEqual(answer);
        console.info(JSON.stringify({ poc: "caller-feedback", scenario, workerCalls, callerCalls: callerInputs.length,
          reportRecovered: scenario !== "quiet", originalAnswer: answer?.result,
          changedReportDelivered: scenario === "throw-then-wait" || scenario === "throw-then-report-retry" }));
      } finally {
        host?.close();
      }
    },
  );
});
