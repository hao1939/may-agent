import { expect, setSystemTime, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, type AppDefinition, type AppTaskInput } from "@may-agent/sdk";
import { SubagentManager } from "../may-agent/src/lib/manager.ts";
import {
  createAssistantMessageEventStream,
  type ToolCall,
} from "../may-agent/node_modules/@earendil-works/pi-ai/dist/index.js";
import {
  prepareAgentExecution,
  executePreparedAgent,
} from "../may-agent/src/lib/agent-execution.ts";
import { createFinishTool } from "../may-agent/packages/sdk/src/runtime/lib/tools/lifecycle.ts";
import { createWriteTool } from "../may-agent/packages/sdk/src/runtime/lib/tools/write.ts";
import { closeDb, getDb } from "../may-agent/src/lib/db/connection.ts";
import { DbWriter } from "../may-agent/src/lib/db-writer.ts";
import { AppRegistry } from "../may-agent/src/app/core/apps/registry.ts";
import { EventBus } from "../may-agent/src/app/core/events/bus.ts";
import { HostCapacity } from "../may-agent/src/app/core/scheduling/host-capacity.ts";
import { AppTaskResourceStore } from "../may-agent/src/app/core/state/app-task-resource-store.ts";
import { createAppInboxItem, listAppInboxItems } from "../may-agent/src/app/core/state/app-inbox-store.ts";
import {
  createAppEventAdmissionPlan,
  getAppEventAdmissionPlan,
} from "../may-agent/src/app/core/state/app-event-admission-store.ts";
import { createAppTaskCapability } from "../may-agent/src/app/core/tasks/app-task-capability.ts";
import {
  installAppTaskRuntimes,
  cancelLoadedAppTask,
  closeInstalledAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} from "../may-agent/src/app/core/tasks/app-task-runtime.ts";
import { createTaskWorkflowRunner } from "../may-agent/src/app/adapters/executors/workflow.ts";
import type { TaskAgentRunner } from "../may-agent/src/app/core/tasks/execution.ts";
import { makeTaskRetryDue } from "../may-agent/src/app/core/tasks/app-task-test-support.ts";
import { startAppInboxRuntime } from "../may-agent/src/app/composition/app-inbox-runtime.ts";
import { fakeModel } from "../may-agent/test/fixtures/model.ts";
import alex, { RUNTIME_PATTERN_AUDIT_TASK_ID, taskInputForEvent } from "./app.ts";
import { isAlexOperationalRecoveryTask } from "./task-completion.ts";
import { workloadReviewPolicy, workloadReviewTask, WORKLOAD_REVIEW_INTERVAL_MS, WORKLOAD_REVIEW_TASK_ID } from "./workload-review-policy.ts";
import {
  evaluationJudgmentSchema,
  readNewJudgment,
} from "./agents/evaluator/workflows/lib/evaluation-judgment.ts";
import {
  hashReport,
  markTaskReportPublished,
  renderTaskReportMarkdown,
  resolveTaskReportPath,
  taskReportPaths,
  writeImmutable,
} from "./agents/evaluator/workflows/lib/task-report-store.ts";

// Real App routing/admission/settlement; explicit start enables ordinary timers.
// Agent decisions are scripted and no external models are called.
async function runtime(execute: TaskAgentRunner["execute"], beforeReconcile?: (taskId: string) => Promise<void>,
  options: { definition?: AppDefinition; manager?: SubagentManager; setup?: (appDir: string) => void } = {}) {
  const root = mkdtempSync(join(tmpdir(), "alex-recovery-"));
  const appDir = join(root, "alex.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks/seed.json"),
    JSON.stringify({
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    }),
  );
  options.setup?.(appDir);
  let definition = {
    ...(options.definition ?? alex),
    workspace: undefined,
    schedules: [],
    metrics: [],
  };
  const registry = new AppRegistry(async () => [{ appDir, definition }]);
  await registry.reload();
  let bus = new EventBus();
  let db = getDb(root);
  let inbox: Awaited<ReturnType<typeof startAppInboxRuntime>>;
  let store: AppTaskResourceStore;
  let start = Promise.withResolvers<void>();
  const agents: TaskAgentRunner = {
    available: () => true,
    prepare: async () => true,
    role: (agent) => ({
      agent,
      instructions: "Handle the original obligation and exact failure.",
    }),
    snapshot: () => agents,
    execute,
  };
  const open = async () => {
    start = Promise.withResolvers<void>();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    await installAppTaskRuntimes(
      {
        projectRoot: root,
        projectsRoot: root,
        persistDir: root,
        agentsRoot: join(root, "agents"),
        sharedRoot: join(root, "shared"),
        bus,
        appRegistrySnapshot: registry.snapshot(),
        hostCapacity: new HostCapacity(3),
        startAfter: start.promise,
        agents,
        ...(beforeReconcile ? { executeAttempt: async (request: Omit<Parameters<typeof reconcileLoadedAppTaskOnce>[0], "bus">) => {
          await beforeReconcile(request.taskId);
          return reconcileLoadedAppTaskOnce({ bus, ...request });
        } } : {}),
        workflows: createTaskWorkflowRunner({ manager: options.manager ?? {} as never, bus }),
      },
      { deferRecovery: true },
    );
    store = AppTaskResourceStore.activeFromDb(db, "alex")!;
    const capability = createAppTaskCapability({ bus });
    inbox = await startAppInboxRuntime({
      db,
      bus,
      registry,
      persistDir: root,
      schedulesEnabled: false,
      attachTask: capability.attach,
      readDependency: capability.readDependency,
      admitConversation: capability.admitConversation,
      admitTaskEvent: capability.admitEvent,
      hasTaskTarget: capability.has,
      previewTaskEvent: capability.previewEvent,
      previewTaskEventRoutes: capability.previewEventRoutes,
    });
  };
  await open();
  return {
    root,
    get store() {
      return store;
    },
    get inbox() {
      return inbox;
    },
    get db() {
      return db;
    },
    get bus() {
      return bus;
    },
    start() {
      start.resolve();
    },
    admit(id: string, input: { kind: string; data: unknown }) {
      return inbox.host.admit({
        id,
        appId: "alex",
        source: { kind: "app", id: "may" },
        input,
      }).item;
    },
    run(taskId: string) {
      return reconcileLoadedAppTaskOnce({
        bus,
        appId: "alex",
        taskId,
        dispatch: {
          lane: "normal",
          enqueuedAt: Date.now(),
          startedAt: Date.now(),
          readyWaitMs: 0,
        },
      });
    },
    async restart(nextDefinition?: AppDefinition) {
      inbox.close();
      const closing = closeInstalledAppTaskRuntimes(bus);
      start.resolve();
      await closing;
      closeDb(root);
      db = getDb(root);
      bus = new EventBus();
      if (nextDefinition) {
        definition = { ...nextDefinition, workspace: undefined, schedules: [], metrics: [] };
        await registry.reload();
      }
      await open();
    },
    async close() {
      inbox.close();
      const closing = closeInstalledAppTaskRuntimes(bus);
      start.resolve();
      await closing;
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function retainedReport(root: string) {
  const paths = taskReportPaths("may", "goal/original", "abc", "task-outcome-v2");
  const payload = {
    version: 1,
    rubricVersion: "task-outcome-v2",
    sourceRevision: "fixture",
    disposition: "assessed",
    createdAt: 1,
    subject: { appId: "may", taskId: "goal/original", evidenceHash: "abc" },
    evidence: {},
    evaluator: { executionId: "s_original", cost: "unknown" },
    judgment: {
      disposition: "assessed",
      summary: "No deployment verification was retained.",
      responsibility: "The original owner must verify deployment.",
      findings: [],
      verification: [],
      delivery: "Unverified",
    },
  };
  const json = resolveTaskReportPath(root, paths.jsonPath);
  const markdown = resolveTaskReportPath(root, paths.markdownPath);
  writeImmutable(json, JSON.stringify(payload) + "\n");
  writeImmutable(markdown, renderTaskReportMarkdown(payload)!);
  const publication = {
    appId: "may",
    taskId: "goal/original",
    evidenceHash: "abc",
    executionId: "s_original",
    report: paths.markdownPath,
    facts: paths.jsonPath,
    jsonHash: hashReport(json),
    markdownHash: hashReport(markdown),
  };
  markTaskReportPublished(root, {
    ...publication,
    jsonPath: paths.jsonPath,
    markdownPath: paths.markdownPath,
    jsonSha256: publication.jsonHash,
    markdownSha256: publication.markdownHash,
  });
  return { publication, json, markdown };
}

test.each(["", "The existing repair already owns this concern."])(
  "the real finish validator accepts a no-action explanation in one reply: %j",
  async (message) => {
    const root = mkdtempSync(join(tmpdir(), "alex-no-action-"));
    const judgment = {
      disposition: "assessed" as const,
      summary: "The recovered outcome is supported by the supplied evidence.",
      responsibility: "The existing owner retains the repair.",
      delivery: "Assessment returned without another owner request.",
      followUp: { kind: "none" as const, message },
    };
    let replies = 0;
    try {
      const prepared = prepareAgentExecution({
        definition: {
          name: "evaluator", description: "Offline report acceptance trial", domain: "tests",
          systemPrompt: "Assess the supplied evidence.", model: fakeModel(),
          tools: [createFinishTool({ projectRoot: root })],
        },
        projectRoot: root, sessionId: "no-action-explanation", task: "Return the assessment.",
        requireFinish: true, outputSchema: JSON.parse(JSON.stringify(evaluationJudgmentSchema)),
      });
      prepared.runner.streamFn = () => {
        replies++;
        expect(replies).toBe(1);
        const stream = createAssistantMessageEventStream();
        stream.push({
          type: "done", reason: "toolUse", message: {
            role: "assistant", content: [{ type: "toolCall", id: "finish-one", name: "finish",
              arguments: { status: "success", summary: "Assessment returned.", result: judgment } }],
            api: "openai-responses", provider: "synthetic", model: "fixture",
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            stopReason: "toolUse", timestamp: Date.now(),
          },
        });
        return stream;
      };
      const result = await executePreparedAgent(prepared, { timeoutMs: 10_000 });
      expect(result.status).toBe("done");
      expect(replies).toBe(1);
      expect(result.structuredResult).toEqual(judgment);
      expect(readNewJudgment(result.structuredResult)).toEqual(judgment);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test.each(["readable", "unfamiliar", "unreadable"] as const)(
  "%s retained evidence reaches the existing owner through the real workflow/agent loop",
  async (mode) => {
    let calls = 0;
    let replies = 0;
    let feedback: { status: string; summary: string } | undefined;
    let originalTask = "";
    const f = await runtime(async ({ attempt }) => {
      calls++;
      expect(attempt.task.id).toBe(originalTask);
      expect(attempt.task.input).toMatchObject({
        data: { context: { publication, originalEvidence: before[0]!.toString() } },
      });
      const manager = new SubagentManager({ persistDir: join(f.root, ".state") });
      const alexDef = {
        name: "alex",
        description: "Offline recovery trial",
        domain: "tests",
        systemPrompt: "Consider the exact supplied evidence and failure; preserve uncertainty.",
        model: fakeModel(),
        tools: [],
        agentDir: f.root,
      };
      manager.register(alexDef);
      manager.activeSessions.set(attempt.attemptId, {
        definition: alexDef,
      } as never);
      const tool = manager.createAgentsTool({
        getCallerAgentName: () => "alex",
        getCallerSessionId: () => attempt.attemptId,
      });
      const prepared = prepareAgentExecution({
        definition: {
          name: "alex",
          description: "Offline recovery trial",
          domain: "tests",
          systemPrompt: "Consider the exact supplied evidence and failure; preserve uncertainty.",
          model: {
            ...fakeModel(),
            api: "openai-responses",
            provider: "synthetic",
            id: "fixture",
            contextWindow: 100000,
            maxTokens: 4000,
          },
          tools: [
            tool,
            createFinishTool({
              projectRoot: f.root,
            }),
          ],
        },
        projectRoot: f.root,
        sessionId: attempt.attemptId,
        task: JSON.stringify(attempt.task.input),
        requireFinish: true,
        outputSchema: JSON.parse(JSON.stringify(evaluationJudgmentSchema)),
      });
      prepared.runner.streamFn = (_model, context) => {
        replies++;
        expect(replies).toBeLessThanOrEqual(2);
        // Original content/reference remain accessible after the reader's failure.
        expect(JSON.stringify(context.messages)).toContain(
          "No deployment verification was retained.",
        );
        const arguments_: ToolCall["arguments"] =
          replies === 1
            ? {
                action: "call",
                agent: "read-report",
                input: { operation: "read-publication", publication },
              }
            : {
                status: "success",
                summary: "Interpretation returned with its limits.",
                result: judgment,
              };
        if (replies === 2) {
          const result = context.messages.findLast((message) => message.role === "toolResult");
          expect(result).toBeDefined();
          feedback = JSON.parse(
            result!.content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join(""),
          );
          expect(feedback!.status).toBe(mode === "readable" ? "done" : "blocked");
          if (mode === "unfamiliar")
            expect(feedback!.summary).toContain(
              "purpose, rubric, and validity identity do not match",
            );
          if (mode === "unreadable")
            expect(feedback!.summary).toContain("published report integrity check failed");
          expect(JSON.stringify(context.messages)).toContain(publication.facts);
        }
        const stream = createAssistantMessageEventStream();
        stream.push({
          type: "done",
          reason: "toolUse",
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: `call-${replies}`,
                name: replies === 1 ? tool.name : "finish",
                arguments: arguments_,
              },
            ],
            api: "openai-responses",
            provider: "synthetic",
            model: "fixture",
            stopReason: "toolUse",
            timestamp: Date.now(),
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0,
              },
            },
          },
        });
        return stream;
      };
      const result = await executePreparedAgent(prepared, { timeoutMs: 10000 });
      expect(result.status).toBe("done");
      expect(readNewJudgment(result.structuredResult)).toEqual(judgment);
      return {
        runId: attempt.attemptId,
        handlerResult: {
          state: "converged",
          summary: judgment.summary,
          result: judgment,
          facts: [],
          actions: [],
        },
      };
    });
    const saved = retainedReport(f.root);
    const publication = {
      ...saved.publication,
      ...(mode === "unfamiliar" ? { rubricVersion: "retained-unknown-rubric" } : {}),
    };
    if (mode === "unreadable") writeFileSync(saved.json, "{broken retained bytes");
    const before = [readFileSync(saved.json), readFileSync(saved.markdown)];
    const judgment = {
      disposition: "insufficient-evidence",
      summary: "No deployment verification was retained.",
      responsibility: "The original owner must verify deployment.",
      delivery: "Interpretation returned; deployment remains unverified.",
      followUp: { kind: "none" },
    } as const;
    try {
      const workflowDir = join(f.root, "workflows");
      mkdirSync(workflowDir);
      writeFileSync(
        join(workflowDir, "read-report.ts"),
        `import { readEvaluationReports } from ${JSON.stringify(join(import.meta.dir, "agents/evaluator/workflows/evaluation-report-reader.ts"))};\nexport const name="read-report"; export const description="Read original evidence"; export const execute=ctx=>readEvaluationReports(ctx, ${JSON.stringify(f.root)});\n`,
      );
      const item = f.admit("interpret", {
        kind: "message",
        data: {
          message: "Interpret the retained report and disclose its limits.",
          context: {
            publication,
            originalEvidence: before[0]!.toString(),
            originalText: judgment.summary,
          },
        },
      });
      if (!item.waitingOn) throw new Error(JSON.stringify(item));
      originalTask = item.waitingOn!.id;
      await f.run(originalTask);
      expect(calls).toBe(1);
      expect(replies).toBe(2);
      expect(f.store.readTask(originalTask)?.status.phase).toBe("converged");
      await f.inbox.host.refreshTaskResults("alex", originalTask);
      expect(f.inbox.host.get(item.id)?.status).toBe("done");
      expect(readFileSync(saved.json)).toEqual(before[0]);
      expect(readFileSync(saved.markdown)).toEqual(before[1]);
      await f.restart();
      await f.run(originalTask);
      expect(calls).toBe(1);
      expect(
        f.db.prepare("SELECT count(*) AS n FROM app_task_admissions WHERE app_id = 'alex'").get(),
      ).toEqual({ n: 1 });
    } finally {
      await f.close();
    }
  },
);

test("selector failure and exhaustion reach the same owner Task across restart", async () => {
  const considered: unknown[] = [];
  const f = await runtime(async ({ attempt }) => {
    expect(attempt.task.id).toBe("runtime/selector-recovery");
    considered.push(structuredClone(attempt.events));
    return {
      runId: attempt.attemptId,
      handlerResult: {
        state: "waiting",
        continue: true,
        summary: "Exact setup failure considered; repair remains unverified.",
        facts: [],
        actions: [],
      },
    };
  });
  try {
    const input = {
      kind: "automatic-review",
      data: { reason: "fixture", cursor: "preserve-me" },
    };
    const original = f.admit("selector", input);
    if (!original.waitingOn) throw new Error(JSON.stringify(original));
    const taskId = "runtime/task-outcome-selector";
    await f.run(taskId);
    expect(f.store.readTask(taskId)?.status.summary).toContain(
      'Workflow "task-outcome-selector" not found',
    );
    for (let i = 0; i < 100 && !f.store.readTask("runtime/selector-recovery"); i++)
      await Bun.sleep(10);
    expect(f.store.readTask("runtime/selector-recovery")).not.toBeNull();
    await f.run("runtime/selector-recovery");
    expect(considered).toHaveLength(1);
    expect(considered).toMatchObject([
      {
        items: [
          {
            event: {
              data: {
                request: {
                  input: {
                    data: {
                      context: {
                        selectorFailure: {
                          summary: 'Workflow "task-outcome-selector" not found.',
                          input,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    ]);
    expect(JSON.stringify(considered)).toContain(taskId);
    await f.restart();
    makeTaskRetryDue(f.store, taskId);
    await f.run(taskId);
    for (let i = 0; i < 100; i++) {
      const count = f.db
        .prepare(
          "SELECT count(*) AS n FROM app_task_admissions WHERE app_id = 'alex' AND json_extract(admission_json, '$.taskId') = 'runtime/selector-recovery'",
        )
        .get() as { n: number };
      if (count.n === 2) break;
      await Bun.sleep(10);
    }
    expect(
      f.db
        .prepare(
          "SELECT count(*) AS n FROM app_task_admissions WHERE app_id = 'alex' AND json_extract(admission_json, '$.taskId') = 'runtime/selector-recovery'",
        )
        .get(),
    ).toEqual({ n: 2 });
    await f.run("runtime/selector-recovery");
    expect(considered).toHaveLength(2);
    expect(considered[1]).toMatchObject({
      items: [
        {
          event: {
            data: {
              request: {
                input: {
                  data: { context: { selectorFailure: { taskId, input } } },
                },
              },
            },
          },
        },
      ],
    });
    // The third real setup failure exhausts Host retries. Its final fact must
    // reach the same recovery assignment even if earlier failures were handled.
    makeTaskRetryDue(f.store, taskId);
    await f.run(taskId);
    expect(f.store.readTask(taskId)?.status.phase).toBe("attention");
    for (let i = 0; i < 100; i++) {
      const count = f.db.prepare(
        "SELECT count(*) AS n FROM app_task_admissions WHERE app_id = 'alex' AND json_extract(admission_json, '$.taskId') = 'runtime/selector-recovery'",
      ).get() as { n: number };
      if (count.n === 3) break;
      await Bun.sleep(10);
    }
    expect(f.db.prepare(
      "SELECT count(*) AS n FROM app_task_admissions WHERE app_id = 'alex' AND json_extract(admission_json, '$.taskId') = 'runtime/selector-recovery'",
    ).get()).toEqual({ n: 3 });
    await f.run("runtime/selector-recovery");
    expect(considered).toHaveLength(3);
    expect(considered[2]).toMatchObject({ items: [{ event: { data: { request: { input: {
      data: { context: { selectorFailure: {
        taskId, input, disposition: "exhausted",
        summary: expect.stringContaining("Automatic retries exhausted"),
      } } },
    } } } } }] });
    expect(f.store.readTask("runtime/selector-recovery")?.metadata.generation).toBe(1);
    await f.restart();
    await f.run(taskId);
    expect(f.store.readTask(taskId)?.status.phase).toBe("attention");
    expect(f.inbox.host.get(original.id)?.status).not.toBe("done");
    expect(f.inbox.host.get(original.id)?.input).toEqual(input);
    expect(f.inbox.host.get(original.id)?.waitingOn?.id).toBe(taskId);
    expect(
      f.db.prepare("SELECT task_id FROM app_tasks WHERE app_id = 'alex' ORDER BY task_id").all(),
    ).toEqual([{ task_id: "runtime/selector-recovery" }, { task_id: taskId }]);
  } finally {
    await f.close();
  }
});

test("controller recovery finishes each incident and accepts later failures on the same route after restart", async () => {
  const enabled = process.env.EVALUATION_AUTO_REVIEW_ENABLED;
  process.env.EVALUATION_AUTO_REVIEW_ENABLED = "false";
  let repeatedFailure = Promise.withResolvers<void>();
  let cycle = 1;
  let failureBaseline = 0;
  let originalCalls = 0;
  let recoveryCalls = 0;
  let originalTaskId = "";
  let recoveryTaskId = "";
  let repairs = 0;
  const failures: Record<string, unknown>[] = [];
  const f = await runtime(async ({ attempt }) => {
    const access = join(f.root, "sample-access.ready");
    if (attempt.task.id === originalTaskId) {
      originalCalls++;
      expect(readFileSync(access, "utf8")).toBe("ready\n");
      const sample = Number(readFileSync(join(f.root, "sample.txt"), "utf8"));
      return { runId: attempt.attemptId, handlerResult: {
        state: "converged", summary: `Verified original sample ${sample}`, facts: ["access:verified"], actions: [], result: { sample },
      } };
    }
    recoveryCalls++;
    recoveryTaskId ||= attempt.task.id;
    expect(attempt.task.id).toBe(recoveryTaskId);
    expect(recoveryTaskId).toStartWith("runtime/recovery/alex-input-controller-original-");
    const returned = attempt.events.items.find(({ event }) => event.type === "app.dependency.updated" && event.data.status === "done");
    if (returned) {
      expect(returned.event.data).toMatchObject({ taskId: originalTaskId, result: { sample: 42 * cycle } });
      return { runId: attempt.attemptId, handlerResult: {
        state: "converged", summary: `Verified the original work returned sample ${42 * cycle}`, facts: ["original:verified"], actions: [],
        // A mistaken cycle-close recommendation must not disable later notices.
        result: { taskDisposition: { kind: "close", reason: "The current repair is verified." } },
      } };
    }
    if (!existsSync(access)) {
      // Hold the scripted investigation at a causal boundary so the real
      // controller can report a second failure while Alex is already running.
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([repeatedFailure.promise, new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Missing repeated controller failure")), 3000);
        })]);
      } finally { clearTimeout(timeout); }
      expect(failures.length - failureBaseline).toBeGreaterThanOrEqual(2);
      expect(originalCalls).toBe(cycle - 1);
      await createWriteTool(f.root).execute("restore-access", { path: access, content: "ready\n" }, attempt.signal);
      expect(readFileSync(access, "utf8")).toBe("ready\n");
      repairs++;
    }
    return { runId: attempt.attemptId, handlerResult: {
      state: "waiting", summary: "Access restored; the original result remains owed", facts: ["access:restored"], actions: [],
      requests: [{ id: `verify-original-${cycle}`, appId: "alex", taskId: originalTaskId,
        input: { kind: "message", data: { message: "Return the original verified sample after access restoration." } } }],
      conditions: [{ requestId: `verify-original-${cycle}` }],
    } };
  }, async taskId => {
    if (taskId === originalTaskId && !existsSync(join(f.root, "sample-access.ready")))
      throw new Error("Fixture access prerequisite unavailable before Task claim");
  });
  const subscribe = () => f.bus.subscribe(event => {
    if (event.type !== "handler.failed" || event.source !== "app-task-controller" || event.data.taskId !== originalTaskId) return;
    failures.push(event.data);
    if (failures.length === failureBaseline + 2) repeatedFailure.resolve();
  });
  let unsubscribe = subscribe();
  try {
    writeFileSync(join(f.root, "sample.txt"), "42\n");
    const original = f.admit("controller-original", { kind: "message", data: { message: "Read and return the original sample." } });
    originalTaskId = original.waitingOn!.id;
    f.start();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && (f.store.readTask(recoveryTaskId)?.status.phase !== "converged" ||
      f.inbox.host.get(original.id)?.status !== "done")) await Bun.sleep(10);
    expect(recoveryTaskId).not.toBe("");
    expect(failures.length).toBeGreaterThanOrEqual(2);
    expect(failures.every(failure => failure.willRetry === true && failure.disposition === "retry-scheduled")).toBe(true);
    expect(repairs).toBe(1);
    expect(f.store.readTask(originalTaskId)).toMatchObject({
      metadata: { generation: 1 }, status: { phase: "converged", result: { sample: 42 } },
    });
    expect(f.inbox.host.get(original.id)).toMatchObject({ status: "done", result: { result: { sample: 42 } } });
    expect(f.store.readTask(recoveryTaskId)?.status.phase).toBe("converged");
    expect(f.store.listTaskIds({ limit: 10 }).sort()).toEqual([originalTaskId, recoveryTaskId].sort());
    const notices = listAppInboxItems(f.db, { appId: "alex", limit: 100 }).filter(item => item.originEventId &&
      (item.input.data as { context?: { taskRecovery?: unknown } }).context?.taskRecovery);
    expect(notices).toHaveLength(failures.length);
    expect(notices.every(item => item.waitingOn?.id === recoveryTaskId)).toBe(true);
    expect(f.db.prepare("SELECT count(*) AS n FROM events WHERE event_type = 'app.task.retry.requested'").get()).toEqual({ n: 0 });
    expect(notices.every(item => item.status === "done")).toBe(true);
    expect(f.store.readCancellation(recoveryTaskId)).toBeNull();
    const firstRepairAttempt = f.store.readTask(recoveryTaskId)?.status.observedAttemptId;
    const quietCalls = recoveryCalls;
    await f.run(recoveryTaskId);
    expect(recoveryCalls).toBe(quietCalls);

    // Complete the first incident, restart, then fail a genuinely new input on
    // the same original Task. No synthetic failure event or recovery wake.
    unsubscribe();
    await f.restart();
    cycle++;
    failureBaseline = failures.length;
    repeatedFailure = Promise.withResolvers<void>();
    unsubscribe = subscribe();
    rmSync(join(f.root, "sample-access.ready"));
    writeFileSync(join(f.root, "sample.txt"), "84\n");
    const laterRequest = { id: "controller-later", appId: "alex", targetTaskId: originalTaskId,
      source: { kind: "app" as const, id: "may" },
      input: { kind: "message", data: { message: "Return the new verified sample on the same assignment." } } };
    const later = f.inbox.host.admit(laterRequest).item;
    expect(later.waitingOn?.id).toBe(originalTaskId);
    f.start();
    const laterDeadline = Date.now() + 5000;
    while (Date.now() < laterDeadline && (repairs !== 2 ||
      f.store.readTask(recoveryTaskId)?.status.phase !== "converged" ||
      f.inbox.host.get(later.id)?.status !== "done")) await Bun.sleep(10);
    expect(repairs).toBe(2);
    expect(originalCalls).toBe(2);
    expect(f.inbox.host.get(later.id)).toMatchObject({ status: "done", result: { result: { sample: 84 } } });
    expect(f.inbox.host.get(original.id)).toMatchObject({ status: "done", result: { result: { sample: 42 } } });
    expect(f.store.readTask(recoveryTaskId)).toMatchObject({ metadata: { generation: 1 }, status: { phase: "converged" } });
    expect(f.store.readTask(recoveryTaskId)?.status.observedAttemptId).not.toBe(firstRepairAttempt);
    expect(f.store.readCancellation(recoveryTaskId)).toBeNull();
    expect(f.store.listTaskIds({ limit: 10 }).sort()).toEqual([originalTaskId, recoveryTaskId].sort());
    const laterNotices = listAppInboxItems(f.db, { appId: "alex", limit: 100 }).filter(item => item.originEventId &&
      (item.input.data as { context?: { taskRecovery?: unknown } }).context?.taskRecovery);
    expect(laterNotices).toHaveLength(failures.length);
    expect(laterNotices.every(item => item.waitingOn?.id === recoveryTaskId && item.status === "done")).toBe(true);
    const completedCalls = recoveryCalls;
    await f.run(recoveryTaskId);
    expect(recoveryCalls).toBe(completedCalls);
    expect(f.inbox.host.admit(laterRequest).item.status).toBe("done");

  } finally {
    unsubscribe();
    await f.close();
    if (enabled === undefined) delete process.env.EVALUATION_AUTO_REVIEW_ENABLED;
    else process.env.EVALUATION_AUTO_REVIEW_ENABLED = enabled;
  }
}, 15_000);

test("new failure notices adopt clarified recovery requirements once, preserving prior receipts and the original obligation", async () => {
  for (const selector of [false, true]) {
    const legacyDefinition: AppDefinition = { ...alex, task: admitted => {
      const mapped = alex.task!(admitted);
      if (mapped.kind !== "desired" || !isAlexOperationalRecoveryTask("alex", mapped.intent.id)) return mapped;
      const subject = mapped.intent.input as { appId: string; taskId: string };
      return { ...mapped, intent: { ...mapped.intent,
        outcome: selector
          ? "Restore automatic review selection and verify the declared workflow works, or escalate the remaining blocker to May."
          : `Diagnose and recover ${subject.appId}/${subject.taskId} within authorized scope, or escalate the remaining blocker to May.`,
        acceptance: selector ? [
          "Read current selector evidence and account for each admitted failure notice.",
          "Preserve original Task inputs, selection cursor and independent reviewer allowances.",
          "Return verified recovery evidence or the exact remaining blocker to the affected Task and assigning owner.",
        ] : [
          "Read current Task evidence and account for each admitted exhaustion or controller-failure notice.",
          "Preserve original Task identity, generation, inputs and caller return links; repair prerequisites within authorized scope and verify recovery on the original Task, or escalate any unresolved domain or human blocker to May.",
        ],
      } };
    } };
    let cycles = 0;
    const f = await runtime(async ({ attempt }) => {
      expect(isAlexOperationalRecoveryTask("alex", attempt.task.id)).toBe(true);
      cycles++;
      return { runId: attempt.attemptId, handlerResult: {
        state: "converged", summary: "Recorded the scoped notice disposition; independent original work remains owed.",
        facts: ["The exact notice was accounted for."], actions: [], result: { cycle: cycles },
      } };
    }, undefined, { definition: legacyDefinition });
    try {
      const original = f.admit("original", selector
        ? { kind: "automatic-review", data: {} }
        : { kind: "message", data: { message: "The original outcome remains owed." } });
      const originalTaskId = original.waitingOn!.id;
      const input = taskInputForEvent({ type: "handler.failed", source: "app-task-controller",
        data: { appId: "alex", taskId: originalTaskId, stage: "task-reconciliation", willRetry: true },
      } as never)!;
      const first = f.admit("legacy-notice", input);
      const recoveryTaskId = first.waitingOn!.id;
      await f.run(recoveryTaskId);
      await f.inbox.host.refreshTaskResults("alex", recoveryTaskId);
      const firstReply = f.inbox.host.get(first.id);
      expect(firstReply).toMatchObject({ status: "done", result: { result: { cycle: 1 } } });
      const before = f.store.readTask(recoveryTaskId)!;
      const accepted = f.store.readAttempt(before.status.observedAttemptId!)!;
      const originalBefore = f.store.readTask(originalTaskId);
      await f.restart(alex);
      expect(f.store.readTask(recoveryTaskId)).toEqual(before);
      const next = f.admit("current-notice", input);
      expect(next.waitingOn?.id).toBe(recoveryTaskId);
      expect(f.store.readTask(recoveryTaskId)?.metadata.generation).toBe(2);
      expect(f.store.readAttempt(accepted.metadata.id)?.acceptedResult).toEqual(accepted.acceptedResult);
      expect(f.admit("legacy-notice", input)).toEqual(firstReply!);
      await f.run(recoveryTaskId);
      await f.inbox.host.refreshTaskResults("alex", recoveryTaskId);
      expect(f.inbox.host.get(next.id)).toMatchObject({ status: "done", result: { result: { cycle: 2 } } });
      expect(f.inbox.host.get(first.id)).toEqual(firstReply);
      const later = f.admit("later-notice", input);
      expect(later.waitingOn?.id).toBe(recoveryTaskId);
      expect(f.store.readTask(recoveryTaskId)?.metadata.generation).toBe(2);
      expect(f.store.readAttempt(accepted.metadata.id)?.acceptedResult).toEqual(accepted.acceptedResult);
      expect(f.store.readTask(originalTaskId)).toEqual(originalBefore);
      expect(f.inbox.host.get(original.id)?.status).toBe("handling");
      expect(f.store.readCancellation(recoveryTaskId)).toBeNull();
      expect(f.store.listTaskIds({ limit: 10 }).sort()).toEqual([originalTaskId, recoveryTaskId].sort());
      expect(cycles).toBe(2);
    } finally { await f.close(); }
  }
});

test("repair before exhaustion lets Host resume the real selector automatically", async () => {
  const enabled = process.env.EVALUATION_AUTO_REVIEW_ENABLED;
  process.env.EVALUATION_AUTO_REVIEW_ENABLED = "false";
  let calls = 0;
  let repairedAt = 0;
  const taskId = "runtime/task-outcome-selector";
  const input = { kind: "automatic-review", data: { reason: "fixture" } };
  const f = await runtime(async ({ attempt }) => {
    expect(attempt.task.id).toBe("runtime/selector-recovery");
    calls++;
    if (calls === 1) {
      expect(JSON.stringify(attempt.events)).toContain('Workflow \\"task-outcome-selector\\" not found');
      expect(f.store.readTask(taskId)?.status.phase).toBe("pending");
      const retryAt = f.store.readTask(taskId)?.status.executionRetryAt;
      expect(retryAt).toBeGreaterThan(Date.now());
      // The scripted owner invokes an actual tool to restore the real workflow.
      // The harness never repairs it from outside the agent execution.
      const source = join(import.meta.dir, "agents/evaluator/workflows/task-outcome-selector.ts");
      const repaired = join(f.root, "agents/evaluator/workflows/task-outcome-selector.ts");
      await createWriteTool(f.root).execute("restore-selector", {
        path: repaired,
        content: `export { name, description, execute } from ${JSON.stringify(source)};\n`,
      }, attempt.signal);
      expect(readFileSync(repaired, "utf8")).toContain(source);
      repairedAt = Date.now();
      expect(f.store.readTask(taskId)?.status.executionRetryAt).toBe(retryAt);
      return { runId: attempt.attemptId, handlerResult: {
        state: "waiting", summary: "Workflow restored; waiting for its actual result.", facts: [], actions: [],
        requests: [{ id: "verify-selector", appId: "alex", taskId, input }],
        conditions: [{ requestId: "verify-selector" }],
      } };
    }
    expect(calls).toBe(2);
    expect(f.store.readTask(taskId)?.status.phase).toBe("converged");
    expect(f.store.readTask(taskId)?.status.summary).toContain("disabled");
    return { runId: attempt.attemptId, handlerResult: {
      state: "converged", summary: "Verified the declared selector runs and preserves the disabled sampling policy.",
      facts: ["Original selector returned its own result"], actions: [],
    } };
  });
  try {
    const original = f.admit("selector-auto-resume", input);
    expect(original.waitingOn?.id).toBe(taskId);
    f.start();
    const deadline = Date.now() + 65_000;
    while (Date.now() < deadline && f.store.readTask("runtime/selector-recovery")?.status.phase !== "converged")
      await Bun.sleep(50);
    expect(calls).toBe(2);
    expect(repairedAt).toBeGreaterThan(0);
    expect(Date.now() - repairedAt).toBeGreaterThan(20_000);
    await f.inbox.host.refreshTaskResults("alex", taskId);
    await f.inbox.host.refreshTaskResults("alex", "runtime/selector-recovery");
    expect(f.inbox.host.get(original.id)?.status).toBe("done");
    expect(f.store.readTask(taskId)?.metadata.generation).toBe(1);
    expect(f.store.readTask(taskId)?.status.summary).toContain("disabled");
    expect(f.store.readTask("runtime/selector-recovery")?.status.phase).toBe("converged");
    expect(f.db.prepare(
      "SELECT count(*) AS n FROM events WHERE event_type = 'app.task.retry.requested'",
    ).get()).toEqual({ n: 0 });
  } finally {
    await f.close();
    if (enabled === undefined) delete process.env.EVALUATION_AUTO_REVIEW_ENABLED;
    else process.env.EVALUATION_AUTO_REVIEW_ENABLED = enabled;
  }
}, 75_000);

test("a rejected typed request reaches its existing caller's next attempt with the original evidence", async () => {
  const invalid = {
    kind: "review-task-outcome",
    data: {
      appId: "may",
      taskId: "goal/original",
      subjectGeneration: "old-format",
    },
  };
  const considered: unknown[] = [];
  let calls = 0;
  const f = await runtime(async ({ attempt }) => {
    calls++;
    if (calls === 1)
      return {
        runId: attempt.attemptId,
        handlerResult: {
          state: "waiting",
          summary: "Request the retained review",
          facts: [],
          actions: [],
          requests: [{ id: "review-original", appId: "alex", input: invalid }],
          conditions: [{ requestId: "review-original" }],
        },
      };
    considered.push(
      structuredClone({
        previousAttempt: attempt.previousAttempt,
        input: attempt.task.input,
        events: attempt.events,
      }),
    );
    return {
      runId: attempt.attemptId,
      handlerResult: {
        state: "waiting",
        continue: true,
        summary: "Admission rejection considered; original review remains unresolved.",
        facts: [],
        actions: [],
      },
    };
  });
  try {
    const original = f.admit("caller", {
      kind: "message",
      data: {
        message: "Obtain the retained review",
        context: { original: invalid },
      },
    });
    const taskId = original.waitingOn!.id;
    await f.run(taskId);
    expect(f.store.readTask(taskId)?.status.summary).toContain("Invalid input");
    makeTaskRetryDue(f.store, taskId);
    await f.run(taskId);
    expect(calls).toBe(2);
    expect(considered).toMatchObject([
      {
        input: { data: { context: { original: invalid } } },
        previousAttempt: {
          summary: expect.stringContaining("Invalid input"),
        },
      },
    ]);
    expect(f.inbox.host.get(original.id)?.status).toBe("handling");
    expect(f.store.readTask(taskId)?.status.phase).toBe("pending");
    expect(f.db.prepare("SELECT count(*) AS n FROM app_tasks WHERE app_id = 'alex'").get()).toEqual(
      { n: 1 },
    );
  } finally {
    await f.close();
  }
});

test("an owner consumes its contribution after restart, closes it and returns the verified result to the original input", async () => {
  let ownerTask = "";
  let contributionTask = "";
  let contributionAttempt = "";
  let ownerCalls = 0;
  let contributionCalls = 0;
  const input = { kind: "message", data: { message: "Return the verified total from the saved batch." } };
  const f = await runtime(async ({ attempt }) => {
    if (attempt.task.id === ownerTask) {
      ownerCalls++;
      if (ownerCalls === 1) return {
        runId: attempt.attemptId,
        handlerResult: { state: "waiting", summary: "The batch result remains owed.", facts: [], actions: [],
          requests: [{ id: "batch-count", appId: "alex", input: { kind: "message",
            data: { message: "Calculate the saved batch total and retain its artifact." } } }],
          conditions: [{ requestId: "batch-count" }],
        },
      };
      const created = await attempt.read.tasks.created!({ limit: 5 });
      expect(created.items.map(item => item.taskId)).toEqual([contributionTask]);
      const returned = await attempt.read.tasks.get(contributionTask);
      expect(returned).toMatchObject({ creator: { appId: "alex", taskId: ownerTask },
        acceptedAttempt: { id: contributionAttempt }, result: { total: 600, rows: 3 } });
      if (!returned?.resourceVersion || !returned.acceptedAttempt) throw new Error("Accepted contribution unavailable");
      expect(JSON.parse(readFileSync(join(f.root, "batch-result.json"), "utf8"))).toEqual({ total: 600, rows: 3 });
      const closed = await attempt.closeTask({ appId: "alex", taskId: returned.id,
        expectedGeneration: returned.generation, expectedResourceVersion: returned.resourceVersion,
        afterResult: returned.acceptedAttempt.id, reason: "Consumed the verified finite batch result." });
      expect(closed.status).toBe("closed");
      expect((await attempt.read.tasks.created!()).items).toEqual([]);
      return {
        runId: attempt.attemptId,
        handlerResult: { state: "converged", summary: "The saved batch total is 600 across three rows.",
          response: "Verified total: 600 across three rows.", facts: ["Saved result independently read back."], actions: [],
          result: { total: 600, rows: 3, taskDisposition: { kind: "close", reason: "The original batch result was returned." } },
        },
      };
    }
    contributionCalls++;
    contributionTask = attempt.task.id;
    contributionAttempt = attempt.attemptId;
    const amounts = JSON.parse(readFileSync(join(f.root, "batch.json"), "utf8")) as number[];
    const result = { total: amounts.reduce((sum, amount) => sum + amount, 0), rows: amounts.length };
    writeFileSync(join(f.root, "batch-result.json"), JSON.stringify(result));
    return { runId: attempt.attemptId,
      handlerResult: { state: "converged", summary: "Saved the finite batch result.", facts: [], actions: [], result } };
  });
  try {
    writeFileSync(join(f.root, "batch.json"), JSON.stringify([100, 200, 300]));
    const original = f.admit("batch-caller", input);
    ownerTask = original.waitingOn!.id;
    await f.run(ownerTask);
    expect(f.inbox.host.get(original.id)?.status).toBe("handling");
    const request = listAppInboxItems(f.db, { appId: "alex", limit: 10 })
      .find(item => item.creator?.appId === "alex" && item.creator.taskId === ownerTask);
    if (!request?.waitingOn) throw new Error("Contribution request unavailable");
    await f.run(request.waitingOn.id);
    await f.inbox.host.refreshTaskResults("alex", contributionTask);
    expect(f.store.readCancellation(contributionTask)).toBeNull();
    expect(f.inbox.host.get(original.id)?.status).toBe("handling");
    await f.restart();
    await f.run(ownerTask);
    await f.inbox.host.refreshTaskResults("alex", ownerTask);
    const delivered = f.inbox.host.get(original.id);
    if (!delivered) throw new Error("Original input unavailable after result delivery");
    expect(delivered).toMatchObject({ status: "done", result: { response: "Verified total: 600 across three rows.",
      result: { total: 600, rows: 3 } } });
    expect(f.store.readCancellation(contributionTask)).not.toBeNull();
    expect(f.store.readCancellation(ownerTask)).not.toBeNull();
    expect(f.admit("batch-caller", input)).toEqual(delivered);
    await f.run(ownerTask);
    expect(ownerCalls).toBe(2);
    expect(contributionCalls).toBe(1);
    expect(f.db.prepare("SELECT count(*) AS n FROM app_tasks WHERE app_id='alex'").get()).toEqual({ n: 2 });
  } finally { await f.close(); }
});

test("addressed workload advice survives restart without replacing the owner's obligation or granting closure authority", async () => {
  let ownerTask = "";
  let requesterTask = "";
  let ownerCalls = 0;
  let requesterCalls = 0;
  const advice = { decision: "reconsider", reason: "Shared execution is busy; the required total remains owed.",
    nextStep: "Defer the optional parallel cross-check and retain the original delivery." };
  const f = await runtime(async ({ attempt }) => {
    if (attempt.task.id === ownerTask) {
      ownerCalls++;
      if (ownerCalls === 1) return { runId: attempt.attemptId, handlerResult: {
        state: "waiting", summary: "The required total awaits its saved batch.", facts: [], actions: [],
        reviewAt: Date.now() + 3_600_000,
      } };
      const notice = attempt.events.items.find(({ event }) => event.type === "app.task.requested" &&
        ((event.data.request as AppTaskInput)?.input.data as { context?: { workloadAdvice?: unknown } })?.context?.workloadAdvice);
      if (!notice) throw new Error("The exact addressed workload advice was not delivered");
      const request = notice.event.data.request as AppTaskInput;
      const inputKey = attempt.events.inputs?.find(input => input.id === request.id)?.key;
      if (!inputKey) throw new Error("The advice has no admitted input key");
      expect(request.input.data).toMatchObject({ context: { workloadAdvice: advice } });
      writeFileSync(join(f.root, "method.json"), JSON.stringify({ optionalCrossCheck: "deferred", requiredTotal: "owed" }));
      // Answer only this notification. The original delivery still has its own wait.
      return { runId: attempt.attemptId, handlerResult: {
        state: "converged", summary: "Deferred optional fanout; original delivery remains owed.",
        response: "Method adjusted; the required total is still owed.", inputKeys: [inputKey],
        facts: ["Optional fanout deferred on the existing assignment."], actions: [],
        result: { optionalCrossCheck: "deferred", requiredTotal: "owed" },
      } };
    }
    expect(attempt.task.id).toBe(requesterTask);
    requesterCalls++;
    const feedback = attempt.events.items.find(({ event }) =>
      event.type === "app.dependency.updated" && event.data.status === "done");
    if (feedback) {
      expect(feedback.event.data).toMatchObject({ taskId: ownerTask,
        result: { optionalCrossCheck: "deferred", requiredTotal: "owed" } });
      return { runId: attempt.attemptId, handlerResult: {
        state: "converged", summary: "The existing owner acknowledged its method decision.", facts: [], actions: [],
      } };
    }
    const current = await attempt.read.tasks.get(ownerTask);
    if (!current?.resourceVersion || !current.acceptedAttempt) throw new Error("Current owner evidence unavailable");
    await expect(attempt.closeTask({ appId: "alex", taskId: ownerTask,
      expectedGeneration: current.generation, expectedResourceVersion: current.resourceVersion,
      afterResult: current.acceptedAttempt.id, reason: "Workload notification grants no creator authority." }))
      .rejects.toThrow("recorded creator");
    return { runId: attempt.attemptId, handlerResult: {
      state: "waiting", summary: "Ask the existing owner for a bounded method decision.", facts: [], actions: [],
      requests: [{ id: "workload-method", appId: "alex", taskId: ownerTask,
        input: { kind: "message", data: { message: "Judge this workload advice against your current assignment.",
          context: { workloadAdvice: advice } } } }], conditions: [{ requestId: "workload-method" }],
    } };
  });
  try {
    const original = f.admit("workload-original", { kind: "message", data: { message: "Return the required saved batch total." } });
    ownerTask = original.waitingOn!.id;
    await f.run(ownerTask);
    requesterTask = f.admit("workload-requester", { kind: "message", data: { message: "Ask the existing owner to reconsider optional fanout." } }).waitingOn!.id;
    await f.run(requesterTask);
    const notices = () => listAppInboxItems(f.db, { appId: "alex", limit: 10 }).filter(item => item.targetTaskId === ownerTask);
    expect(notices()).toHaveLength(1);
    const noticeId = notices()[0]!.id;
    expect(notices()[0]).toMatchObject({ status: "handling", creator: { appId: "alex", taskId: requesterTask },
      waitingOn: { id: ownerTask } });
    await f.restart();
    await f.run(ownerTask);
    await f.inbox.host.refreshTaskResults("alex", ownerTask);
    expect(JSON.parse(readFileSync(join(f.root, "method.json"), "utf8"))).toEqual({ optionalCrossCheck: "deferred", requiredTotal: "owed" });
    expect(f.store.readTask(ownerTask)?.status.summary).toBe("Deferred optional fanout; original delivery remains owed.");
    expect(f.inbox.host.get(noticeId)).toMatchObject({ status: "done", result: { response: "Method adjusted; the required total is still owed." } });
    expect(f.inbox.host.get(original.id)?.status).toBe("handling");
    expect(f.store.readCancellation(ownerTask)).toBeNull();
    expect(f.store.readTask(ownerTask)?.status.phase).toBe("waiting");
    expect(f.store.readTask(ownerTask)?.status.inputWaits?.[original.taskAdmissionKey!])
      .toMatchObject({ reviewAt: expect.any(Number) });
    expect(f.store.readTask(ownerTask)?.metadata.generation).toBe(1);
    await f.restart();
    await f.run(requesterTask);
    expect(requesterCalls).toBe(2);
    expect(ownerCalls).toBe(2);
    expect(notices()).toHaveLength(1);
    expect(f.store.listTaskIds({ limit: 10 }).sort()).toEqual([ownerTask, requesterTask].sort());
  } finally { await f.close(); }
});

test.each(["closed", "missing"] as const)("workload advice to a %s owner returns failure without creating replacement work", async target => {
  let ownerTask = "missing-owner";
  let requesterTask = "";
  let requesterCalls = 0;
  const f = await runtime(async ({ attempt }) => {
    if (attempt.task.id === ownerTask) return { runId: attempt.attemptId, handlerResult: {
      state: "converged", summary: "The finite original assignment is fulfilled.", facts: ["Original outcome verified."], actions: [],
      result: { taskDisposition: { kind: "close", reason: "The finite original assignment is fulfilled." } },
    } };
    expect(attempt.task.id).toBe(requesterTask);
    requesterCalls++;
    if (requesterCalls > 1) {
      expect(JSON.stringify(attempt.events)).toMatch(/closed|does not exist|not found/);
      return { runId: attempt.attemptId, handlerResult: { state: "waiting", reviewAt: Date.now() + 3_600_000,
        summary: "The advice was not applied; an exact current owner must be identified.", facts: [], actions: [],
      } };
    }
    return { runId: attempt.attemptId, handlerResult: {
      state: "waiting", summary: "Ask the exact existing owner to reconsider.", facts: [], actions: [],
      requests: [{ id: "workload-method", appId: "alex", taskId: ownerTask,
        input: { kind: "message", data: { message: "Reconsider optional fanout within your existing assignment." } } }],
      conditions: [{ requestId: "workload-method" }],
    } };
  });
  try {
    if (target === "closed") {
      ownerTask = f.admit("ended-owner", { kind: "message", data: { message: "Return the original finite result." } }).waitingOn!.id;
      await f.run(ownerTask);
      expect(f.store.readCancellation(ownerTask)).not.toBeNull();
    }
    const original = f.admit("failed-workload-handoff", { kind: "message", data: { message: "Notify the owner; retain any failed delivery for a decision." } });
    requesterTask = original.waitingOn!.id;
    await f.run(requesterTask);
    const notices = listAppInboxItems(f.db, { appId: "alex", limit: 10 }).filter(item => item.targetTaskId === ownerTask);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ status: "done", result: { summary: expect.stringMatching(/closed|does not exist|not found/) } });
    await f.restart();
    await f.run(requesterTask);
    expect(requesterCalls).toBe(2);
    expect(f.inbox.host.get(original.id)?.status).toBe("handling");
    expect(f.store.listTaskIds({ limit: 10 }).sort()).toEqual(
      (target === "closed" ? [ownerTask, requesterTask] : [requesterTask]).sort());
    expect(f.store.readTask(requesterTask)?.status.reviewAt).toBeGreaterThan(Date.now());
  } finally { await f.close(); }
});

test.each(["restart", "during-review", "withdrawn", "cancelled-target"] as const)("the actual opted-in workload workflow preserves its owner handoff through %s", async mode => {
  const enabled = process.env.ALEX_WORKLOAD_REVIEW_ENABLED;
  const notifications = process.env.ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS;
  process.env.ALEX_WORKLOAD_REVIEW_ENABLED = "true";
  process.env.ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS = "true";
  let ownerTask = "";
  let ownerCalls = 0;
  let helperCalls = 0;
  let whileReviewing: (() => Promise<void>) | undefined;
  const policy = workloadReviewPolicy();
  // The default App was already imported by this suite. Compose the enabled
  // fixture with its real policy/mapping; subprocess checks verify env loading.
  const definition: AppDefinition = { ...alex,
    task: admitted => admitted.input.kind === "workload-review" ? workloadReviewTask(admitted, policy.enabled) : alex.task!(admitted),
    tasks: { ...alex.tasks, coordination: policy.coordination },
  };
  const manager = { callAgent: async () => {
    helperCalls++;
    await whileReviewing?.();
    const result = { decision: "reconsider", taskId: ownerTask,
      reason: "The required delivery remains owed.", nextStep: "Defer the optional parallel cross-check." };
    return { sessionId: "scripted-workload-helper", status: "done", messages: [], duration: "0", outputDir: "",
      lastAssistantText: null, finishResult: { status: "success", summary: "One method recommendation.", result }, structuredResult: result };
  } } as unknown as SubagentManager;
  const f = await runtime(async ({ attempt }) => {
    expect(attempt.task.id).toBe(ownerTask);
    ownerCalls++;
    if (ownerCalls === 1) return { runId: attempt.attemptId, handlerResult: {
      state: "waiting", summary: "Await the required saved batch.", facts: [], actions: [], reviewAt: Date.now() + 3_600_000,
    } };
    const input = attempt.events.inputs?.find(item => item.source.kind === "app" && item.source.id === "alex");
    if (!input) throw new Error("The owner notification has no admitted identity");
    return { runId: attempt.attemptId, handlerResult: {
      state: "converged", summary: "Deferred the optional cross-check; required total still owed.",
      response: "Optional cross-check deferred; the original delivery remains owed.", inputKeys: [input.key],
      facts: ["The method decision was recorded on the original assignment."], actions: [],
      result: { optionalCrossCheck: "deferred", requiredTotal: "owed" },
    } };
  }, undefined, { definition, manager, setup: appDir => {
    const workflows = join(appDir, "agents/alex/workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(join(appDir, "agents/alex/agent.json"), JSON.stringify({ name: "alex" }));
    copyFileSync(new URL("./agents/alex/workflows/workload-review.ts", import.meta.url), join(workflows, "workload-review.ts"));
    copyFileSync(new URL("./workload-review-policy.ts", import.meta.url), join(appDir, "workload-review-policy.ts"));
    symlinkSync(new URL("../../node_modules", import.meta.url).pathname, join(appDir, "node_modules"), "dir");
  } });
  try {
    const original = f.admit("notified-original", { kind: "message", data: { message: "Return the required batch total." } });
    ownerTask = original.waitingOn!.id;
    await f.run(ownerTask);
    expect(f.admit("review-for-owner", { kind: "workload-review", data: {} }).waitingOn?.id).toBe(WORKLOAD_REVIEW_TASK_ID);
    await f.run(WORKLOAD_REVIEW_TASK_ID);
    expect(f.store.readTask(WORKLOAD_REVIEW_TASK_ID)?.status.phase).toBe("waiting");
    const notices = () => listAppInboxItems(f.db, { appId: "alex", limit: 10 }).filter(item => item.targetTaskId === ownerTask);
    expect(notices()).toHaveLength(1);
    expect(f.store.readTask(WORKLOAD_REVIEW_TASK_ID)?.status.result).toHaveProperty("workloadOwnerNotificationId");
    await f.restart();
    const ownerReturns = async () => {
      await f.run(ownerTask);
      await f.inbox.host.refreshTaskResults("alex", ownerTask);
      if (mode === "during-review") {
        const deadline = performance.now() + 2000;
        while (!f.store.readTaskConditions(WORKLOAD_REVIEW_TASK_ID).some(condition => condition.status.state === "true")) {
          if (performance.now() > deadline) throw new Error("Owner completion did not reach its live caller Condition");
          await Bun.sleep(5);
        }
      }
    };
    if (mode === "during-review") {
      setSystemTime(Date.now() + WORKLOAD_REVIEW_INTERVAL_MS);
      whileReviewing = ownerReturns;
      f.admit("next-workload-slot", { kind: "workload-review", data: {} });
      await f.run(WORKLOAD_REVIEW_TASK_ID);
      whileReviewing = undefined;
      expect(helperCalls).toBe(2);
      expect(ownerCalls).toBe(2);
      expect(f.store.readTask(WORKLOAD_REVIEW_TASK_ID)?.status.summary).toBe("Workload advice retained; no Task changes or new work were applied.");
      expect(f.store.readTask(WORKLOAD_REVIEW_TASK_ID)?.status.conditionIds ?? []).toEqual([]);
    } else if (mode === "cancelled-target") {
      const current = f.store.readTask(ownerTask)!;
      cancelLoadedAppTask({ bus: f.bus, appId: "alex", taskId: ownerTask,
        expectedGeneration: current.metadata.generation, expectedResourceVersion: current.metadata.resourceVersion,
        reason: "Fixture creator withdrew the original delivery before advice was considered.", decision: "app-policy" });
      await f.inbox.host.refreshTaskResults("alex", ownerTask);
    } else {
      if (mode === "withdrawn") process.env.ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS = "false";
      await ownerReturns();
    }
    await f.run(WORKLOAD_REVIEW_TASK_ID);
    const feedback = f.store.readTask(WORKLOAD_REVIEW_TASK_ID)?.status.result?.workloadOwnerFeedback;
    expect(feedback).toMatchObject({ requestId: notices()[0]!.id, status: "done" });
    if (mode === "cancelled-target") {
      expect(feedback).toMatchObject({ summary: expect.stringMatching(/closed|cancelled|withdrew/) });
      expect(f.store.readCancellation(ownerTask)).not.toBeNull();
    } else {
      expect(feedback).toMatchObject({ response: "Optional cross-check deferred; the original delivery remains owed." });
      expect(f.inbox.host.get(original.id)?.status).toBe("handling");
      expect(f.store.readCancellation(ownerTask)).toBeNull();
    }
    expect(helperCalls).toBe(mode === "during-review" ? 2 : 1);
    expect(ownerCalls).toBe(mode === "cancelled-target" ? 1 : 2);
    expect(f.store.listTaskIds({ limit: 10 }).sort()).toEqual([ownerTask, WORKLOAD_REVIEW_TASK_ID].sort());
    expect(notices()).toHaveLength(1);
  } finally {
    setSystemTime();
    await f.close();
    if (enabled === undefined) delete process.env.ALEX_WORKLOAD_REVIEW_ENABLED;
    else process.env.ALEX_WORKLOAD_REVIEW_ENABLED = enabled;
    if (notifications === undefined) delete process.env.ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS;
    else process.env.ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS = notifications;
  }
});

test("incompatible input is rejected before a Task and a retained pending input reports its exact rejection", async () => {
  let executed = 0;
  const f = await runtime(async () => {
    executed++;
    throw new Error("Denied input must not execute");
  });
  try {
    const input = {
      kind: "review-task-outcome",
      data: {
        appId: "may",
        taskId: "goal/original",
        subjectGeneration: "old-format",
      },
    };
    expect(() => f.admit("invalid", input)).toThrow("Invalid input for App alex");
    expect(f.inbox.host.get("invalid")).toBeNull();
    // Persisted input from an older schema must stay identifiable, not be
    // silently converted into an ordinary agent request during recovery.
    createAppInboxItem(f.db, {
      id: "retained",
      appId: "alex",
      source: { kind: "app", id: "may" },
      input,
    });
    await f.inbox.host.recoverAdmissions();
    const retained = f.inbox.host.get("retained")!;
    expect(retained.input).toEqual(input);
    expect(retained.source).toEqual({ kind: "app", id: "may" });
    expect(retained.waitingOn).toBeUndefined();
    expect(JSON.stringify(retained)).toContain("Invalid input for App alex");
    expect(executed).toBe(0);
    expect(f.db.prepare("SELECT count(*) AS n FROM app_tasks WHERE app_id = 'alex'").get()).toEqual(
      { n: 0 },
    );
  } finally {
    await f.close();
  }
});

test("pending old input prevents an incompatible schema replacement; its stable envelope stays usable", async () => {
  const f = await runtime(async () => {
    throw new Error("Reload trial must not execute work");
  });
  try {
    const input = {
      kind: "message",
      data: {
        message: "Interpret retained evidence",
        context: { report: "original.json", format: "unknown" },
      },
    };
    f.db
      .prepare(
        "INSERT INTO events (id, event_type, data, timestamp) VALUES (900, 'fixture.retained', '{}', 1000)",
      )
      .run();
    const saved = createAppEventAdmissionPlan(f.db, {
      eventId: 900,
      registrySnapshotId: "fixture-old",
      registryGeneration: 1,
      routes: [
        {
          appId: "alex",
          kind: "inbox",
          routeId: "retained",
          input,
          conditionTaskIds: [],
        },
      ],
    });
    expect(() =>
      f.inbox.host.replaceApps([
        {
          ...alex,
          schedules: [],
          inputSchema: Type.Object({
            kind: Type.Literal("message"),
            data: Type.Object({
              message: Type.String(),
              newRequiredField: Type.String(),
            }),
          }),
        },
      ]),
    ).toThrow("input schema incompatible with pending event admission commands");
    expect(getAppEventAdmissionPlan(f.db, saved.eventId)).toEqual(saved);
    expect(() => f.inbox.host.replaceApps([alex])).not.toThrow();
    expect(() => f.inbox.host.assertAcceptsInput("alex", input)).not.toThrow();
    expect(getAppEventAdmissionPlan(f.db, saved.eventId)).toEqual(saved);
  } finally {
    await f.close();
  }
});

test("standing audit retains dispositions and targets existing repair work without replaying requests", async () => {
  const schedule = alex.schedules!.find(({ id }) => id === "runtime-pattern-audit-six-hourly")!;
  const input = schedule.input;
  if (!input) throw new Error("Standing audit input is missing");
  let auditCalls = 0;
  let ownerCalls = 0;
  let ownerTask = "";
  const considered: unknown[] = [];
  const f = await runtime(async ({ attempt }) => {
    if (attempt.task.id === ownerTask) {
      ownerCalls++;
      considered.push(structuredClone(attempt.events));
      return {
        runId: attempt.attemptId,
        handlerResult: {
          state: "converged",
          summary: "Existing repair owner considered the supplied evidence.",
          facts: [], actions: [],
        },
      };
    }
    expect(attempt.task.id).toBe(RUNTIME_PATTERN_AUDIT_TASK_ID);
    auditCalls++;
    expect(auditCalls).toBeLessThanOrEqual(3);
    if (auditCalls > 1) {
      expect(attempt.previousAttempt?.acceptedResult?.result).toMatchObject({
        cut: auditCalls - 1,
        disposition: auditCalls === 2 ? "transient-no-change" : "existing-owner-requested",
      });
    }
    // Scripted policy choices; the real runtime owns their retention and delivery.
    const newlyActionable = auditCalls === 2;
    return {
      runId: attempt.attemptId,
      handlerResult: {
        state: "converged",
        summary: newlyActionable ? "Repeated corrections merit existing-owner attention." : "Retain the finding without another request.",
        facts: ["The corrected contribution remains successful."],
        actions: [],
        result: {
          cut: auditCalls,
          disposition: auditCalls === 1 ? "transient-no-change" : newlyActionable ? "existing-owner-requested" : "unchanged-no-request",
          correctionCount: auditCalls === 1 ? 1 : 4,
          outcome: "success",
          existingOwner: ownerTask,
        },
        ...(newlyActionable ? { requests: [{
          id: "recurring-correction-evidence",
          appId: "alex",
          taskId: ownerTask,
          input: { kind: "message", data: {
            message: "Consider recurring-correction evidence within this existing repair.",
            context: { recovered: true, correctionCount: 4 },
          } },
        }] } : {}),
      },
    };
  });
  try {
    ownerTask = f.admit("existing-repair", {
      kind: "message", data: { message: "Own the demonstrated correction repair." },
    }).waitingOn!.id;
    await f.run(ownerTask);
    for (let slot = 1; slot <= 3; slot++) {
      const item = f.admit(`audit-slot-${slot}`, input);
      expect(item.waitingOn?.id).toBe(RUNTIME_PATTERN_AUDIT_TASK_ID);
      await f.run(RUNTIME_PATTERN_AUDIT_TASK_ID);
      expect(f.store.readTask(RUNTIME_PATTERN_AUDIT_TASK_ID)?.status.phase).toBe("converged");
      if (slot === 2) {
        await f.run(ownerTask);
        expect(ownerCalls).toBe(2);
        expect(JSON.stringify(considered[1])).toContain("recurring-correction evidence");
        await f.inbox.host.refreshTaskResults("alex", ownerTask);
      }
      await f.restart();
    }
    f.admit("audit-slot-3", input);
    await f.run(RUNTIME_PATTERN_AUDIT_TASK_ID);
    expect(auditCalls).toBe(3);
    expect(ownerCalls).toBe(2);
    expect(f.store.readTask(RUNTIME_PATTERN_AUDIT_TASK_ID)?.status.result).toMatchObject({
      cut: 3, disposition: "unchanged-no-request", outcome: "success",
    });
    expect(f.db.prepare("SELECT task_id FROM app_tasks WHERE app_id='alex' ORDER BY task_id").all())
      .toEqual([{ task_id: ownerTask }, { task_id: RUNTIME_PATTERN_AUDIT_TASK_ID }]);
    expect(f.db.prepare("SELECT count(*) AS n FROM app_inbox_items WHERE app_id='alex' AND target_task_id=?").get(ownerTask))
      .toEqual({ n: 1 });
  } finally {
    await f.close();
  }
});
