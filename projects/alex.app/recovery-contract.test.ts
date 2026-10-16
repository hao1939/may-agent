import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type } from "@may-agent/sdk";
import {
  createAssistantMessageEventStream,
  type ToolCall,
} from "../may-agent/node_modules/@earendil-works/pi-ai/dist/index.js";
import {
  prepareAgentExecution,
  executePreparedAgent,
} from "../may-agent/src/lib/agent-execution.ts";
import { createFinishTool } from "../may-agent/src/lib/tools/lifecycle.ts";
import { createWorkflowTool } from "../may-agent/src/lib/workflow-tool.ts";
import { closeDb, getDb } from "../may-agent/src/lib/requests.ts";
import { DbWriter } from "../may-agent/src/lib/db-writer.ts";
import { AppRegistry } from "../may-agent/src/app/core/apps/registry.ts";
import { EventBus } from "../may-agent/src/app/core/events/bus.ts";
import { HostCapacity } from "../may-agent/src/app/core/scheduling/host-capacity.ts";
import { AppTaskResourceStore } from "../may-agent/src/app/core/state/app-task-resource-store.ts";
import { createAppInboxItem } from "../may-agent/src/app/core/state/app-inbox-store.ts";
import {
  createAppEventAdmissionPlan,
  getAppEventAdmissionPlan,
} from "../may-agent/src/app/core/state/app-event-admission-store.ts";
import { createAppTaskCapability } from "../may-agent/src/app/core/tasks/app-task-capability.ts";
import {
  installAppTaskRuntimes,
  closeInstalledAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} from "../may-agent/src/app/core/tasks/app-task-runtime.ts";
import { createTaskWorkflowRunner } from "../may-agent/src/app/adapters/executors/workflow.ts";
import type { TaskAgentRunner } from "../may-agent/src/app/core/tasks/execution.ts";
import { makeTaskRetryDue } from "../may-agent/src/app/core/tasks/app-task-test-support.ts";
import { startAppInboxRuntime } from "../may-agent/src/app/composition/app-inbox-runtime.ts";
import { fakeModel } from "../may-agent/test/fixtures/model.ts";
import alex, { RUNTIME_PATTERN_AUDIT_TASK_ID } from "./app.ts";
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

// Real App routing/admission/settlement, manual dispatch and no external model calls.
async function runtime(execute: TaskAgentRunner["execute"]) {
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
  const definition = {
    ...alex,
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
        workflows: createTaskWorkflowRunner({ manager: {} as never, bus }),
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
    async restart() {
      inbox.close();
      const closing = closeInstalledAppTaskRuntimes(bus);
      start.resolve();
      await closing;
      closeDb(root);
      db = getDb(root);
      bus = new EventBus();
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
          tools: [createFinishTool({ agentName: "evaluator", projectRoot: root, persistDir: root })],
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
      const tool = createWorkflowTool({
        manager: {} as never,
        workflowDir: join(f.root, "workflows"),
        agentName: "alex",
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
              agentName: "alex",
              projectRoot: f.root,
              persistDir: f.root,
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
                action: "run",
                name: "read-report",
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

test("selector setup failure reaches one executable owner Task and preserves the failed Task across restart", async () => {
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
    expect(f.inbox.host.get(original.id)?.input).toEqual(input);
    expect(f.inbox.host.get(original.id)?.waitingOn?.id).toBe(taskId);
    expect(
      f.db.prepare("SELECT task_id FROM app_tasks WHERE app_id = 'alex' ORDER BY task_id").all(),
    ).toEqual([{ task_id: "runtime/selector-recovery" }, { task_id: taskId }]);
  } finally {
    await f.close();
  }
});

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
