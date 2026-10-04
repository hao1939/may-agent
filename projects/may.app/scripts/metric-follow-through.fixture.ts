// Real Host composition; only agent judgment and metric sample production are scripted.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defineApp,
  type Condition,
  type ConversationTurnResult,
  type TaskExecutor,
} from "@may-agent/sdk";
import { AppRegistry } from "../../may-agent/src/app/core/apps/registry.js";
import {
  EventBus,
  type AgentEvent,
} from "../../may-agent/src/app/core/events/bus.js";
import { HostCapacity } from "../../may-agent/src/app/core/scheduling/host-capacity.js";
import { createAppTaskCapability } from "../../may-agent/src/app/core/tasks/app-task-capability.js";
import { startAppInboxRuntime } from "../../may-agent/src/app/composition/app-inbox-runtime.js";
import { prepareConversationTaskTurn } from "../../may-agent/src/app/composition/conversation-task-turn.js";
import { createAppTaskReadTool } from "../../may-agent/src/app/app-task-read-tool.js";
import { DbWriter } from "../../may-agent/src/lib/db-writer.js";
import { getDb, closeDb } from "../../may-agent/src/lib/requests.js";
import { createMetricService } from "../../may-agent/src/lib/metrics.js";
import { readMetricEvidence } from "../../may-agent/src/app/adapters/reporting/metric-evidence.js";
import { readConversationRequest } from "../../may-agent/src/app/core/state/conversation-requests.js";
import mayApp, { taskForMayInput } from "../app.js";
import type { MetricEvidence } from "../../alex.app/agents/evaluator/workflows/lib/metric-evidence.js";
import {
  metricReviewHandoff,
  type MetricReview,
} from "../metric-follow-through.js";
import { createMetricEvidenceObserver } from "../watchers/metric-evidence.js";
import { execute as followThrough } from "../agents/may/workflows/metric-follow-through.js";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import type { TaskAttempt, TaskReconcileResult } from "@may-agent/sdk";

export function handoffDecision(
  review: MetricReview,
  task?: { appId: string; taskId: string },
) {
  return metricReviewHandoff(review, {
    response:
      "I will verify the requested metric recovery against fresh evidence.",
    topic: { kind: "new", title: "Metric follow-through" },
    requestUpdates: [
      {
        id: "metric-concern",
        expectedRevision: 0,
        scope: "Review the metric concern",
        disposition: "open",
        reason: "Follow-through remains owed",
      },
    ],
    requestId: "metric-concern",
    task,
  });
}

export async function executeReview(
  attempt: TaskAttempt,
  judge: (prompt: string) => Promise<MetricReview>,
): Promise<TaskReconcileResult> {
  const task = attempt.task;
  const ctx = createTestAppWorkflowContext({
    input: task.input,
    signal: attempt.signal,
    reconciliation: {
      appId: attempt.appId,
      taskId: task.id,
      task,
      generation: task.generation,
      resourceVersion: attempt.resourceVersion,
      agent: attempt.role.agent,
      owner: attempt.role.agent,
      outcome: task.outcome,
      acceptance: task.acceptance,
      input: task.input,
      children: attempt.children,
      waits: attempt.waits,
      previousAttempt: attempt.previousAttempt,
      taskSnapshot: { live: [], truncated: false },
      events: attempt.events,
    },
    callAgent: (async (_agent: string, prompt: string) => ({
      id: "scripted-review",
      kind: "agent",
      status: "done",
      summary: "Reviewed",
      output: await judge(prompt),
    })) as never,
  });
  const result = await followThrough(ctx);
  if (!result.output) throw new Error(result.summary);
  return result.output as TaskReconcileResult;
}

export async function until(
  predicate: () => boolean,
  label: string,
  timeout = 5_000,
) {
  const deadline = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

export async function fixture(execute: TaskExecutor) {
  const root = mkdtempSync(join(tmpdir(), "metric-follow-through-"));
  const appDir = join(root, "may.app");
  const persistDir = join(root, "state");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks/seed.json"),
    JSON.stringify({
      root_task_id: "may",
      groups: { may: { id: "may", parent_id: null } },
    }),
  );
  let db = getDb(persistDir);
  let bus: EventBus;
  let tasks: ReturnType<typeof createAppTaskCapability>;
  let runtime: Awaited<ReturnType<typeof startAppInboxRuntime>>;
  let reads = 0;
  let readFails = false;
  let publicationFails = false;
  let clockOffset = 0;
  let conversation: ConversationTurnResult | undefined;
  let conversationCalls = 0;
  let conversationReturns = 0;
  const attempts: Array<{ id: string; taskId: string; events: string[] }> = [];
  const metrics = createMetricService({ getDb: () => db });
  const metricId = "poc.unresolved-recovery";
  metrics.define({
    id: metricId,
    type: "gauge",
    owner: "may",
    threshold: 1,
    alertOp: ">",
    measureInterval: 60_000,
  });
  metrics.record(metricId, 3, { measuredAt: Date.now() - 1, sampleSize: 3 });
  const alertId = metrics.evaluate(metricId)[0]!.alertId!;
  if (!alertId) throw new Error("Fixture must create a real breach episode");
  const subject = { metricId, alertId };
  const detector = createMetricEvidenceObserver(async (id, end, alert) => {
    reads++;
    if (readFails) throw new Error("Fixture metric reader unavailable");
    return readMetricEvidence(db, id, {
      end,
      windowMs: 3_600_000,
      alertId: alert,
    }) as MetricEvidence;
  });

  async function open() {
    db = getDb(persistDir);
    bus = new EventBus();
    const writer = new DbWriter(persistDir);
    bus.setPersistenceSubscriber((event) => {
      if (
        publicationFails &&
        (event.type === detector.type ||
          String(event.type) === "repair.finished")
      )
        throw new Error("Fixture publication unavailable");
      return writer.handler(event);
    });
    bus.setDeliveryRecorder(writer.recordDelivery);
    const app = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: mayApp.inputSchema,
      tasks: { maxConcurrent: 1 },
      conversation: {
        mode: "agent",
        inputKinds: ["message"],
        conversationId: "poc",
      },
      observers: [detector],
      task(input) {
        const mapped = taskForMayInput(input);
        if (mapped.kind !== "desired") return mapped;
        // Only the executor is substituted: the real App owns input meaning/identity.
        return {
          ...mapped,
          intent: {
            ...mapped.intent,
            workflow: undefined,
            executor: "metric-poc",
          },
        };
      },
    });
    const registry = new AppRegistry(async () => [{ appDir, definition: app }]);
    await registry.reload();
    tasks = createAppTaskCapability({
      bus,
      runtime: {
        bus,
        projectsRoot: root,
        projectRoot: root,
        persistDir,
        hostCapacity: new HostCapacity(1),
        executors: {
          "metric-poc": async (attempt) => {
            attempts.push({
              id: attempt.attemptId,
              taskId: attempt.task.id,
              events: attempt.events.items.map(({ event }) => event.type),
            });
            return execute(attempt);
          },
        },
        conversations: {
          execute: (input) =>
            prepareConversationTaskTurn({
              ...input,
              resolveConversationInput: async ({ inputContext }) => {
                if (inputContext.source.kind === "system") {
                  conversationReturns++;
                  const request = readConversationRequest(
                    db,
                    "may",
                    "poc",
                    "metric-concern",
                  )!;
                  return {
                    summary: "Retained the new Task evidence for owner review",
                    topic: { kind: "none" },
                    requestUpdates: [
                      {
                        id: request.id,
                        expectedRevision: request.revision,
                        disposition: "open",
                        reason:
                          "Metric evidence alone does not settle the original requirement",
                      },
                    ],
                  };
                }
                conversationCalls++;
                if (!conversation)
                  throw new Error("No scripted Conversation decision");
                return conversation;
              },
            }),
        },
      },
    });
    await tasks.publishGeneration({
      snapshot: registry.snapshot(),
      definitionSource: { projectsRoot: root },
      publish() {},
    });
    runtime = await startAppInboxRuntime({
      registry,
      db,
      bus,
      persistDir,
      schedulesEnabled: false,
      scanIntervalMs: 3_600_000,
      now: () => Date.now() + clockOffset,
      attachTask: tasks.attach,
      readDependency: tasks.readDependency,
      admitTaskEvent: tasks.admitEvent,
      admitConversationChange: tasks.admitConversationChange,
      previewTaskEventRoutes: tasks.previewEventRoutes,
      hasTaskTarget: tasks.has,
      wakeAdmittedTasks: tasks.wake,
      observerContext: () => ({
        read: {} as never,
        log: {} as never,
        workspace: { appRoot: appDir, projectRoot: root },
      }),
    });
    await until(
      () => Boolean(runtime.observerHealth("may")[0]?.lastCompletedAt),
      "initial observer scan",
    );
  }
  await open();
  return {
    subject,
    attempts,
    get reads() {
      return reads;
    },
    get db() {
      return db;
    },
    get tasks() {
      return tasks;
    },
    get conversationCalls() {
      return conversationCalls;
    },
    get conversationReturns() {
      return conversationReturns;
    },
    set readFails(value: boolean) {
      readFails = value;
    },
    set publicationFails(value: boolean) {
      publicationFails = value;
    },
    get(id: string) {
      return tasks.get({ appId: "may", taskId: id });
    },
    evidence() {
      return readMetricEvidence(db, metricId, {
        end: Date.now(),
        windowMs: 3_600_000,
        alertId,
      }) as MetricEvidence;
    },
    decisions() {
      return db
        .prepare(
          "SELECT app_id, task_id, attempt_id, data FROM metric_dispositions ORDER BY timestamp, attempt_id",
        )
        .all()
        .map((row) => ({ ...row, decision: JSON.parse(String(row.data)) }));
    },
    request() {
      return readConversationRequest(db, "may", "poc", "metric-concern");
    },
    record(value: number, measuredAt = Date.now() - 1) {
      metrics.record(metricId, value, { measuredAt, sampleSize: value });
      return metrics.evaluate(metricId)[0];
    },
    publishRepair() {
      bus.emit({
        type: "repair.finished",
        source: "test:repair",
        owner: "app:may",
        data: { request: "verification", done: true },
      } as unknown as AgentEvent);
    },
    publishRecovery(alert = alertId) {
      bus.emit({
        type: "metric.recovered",
        source: "runtime:metric-source-measurement",
        owner: "app:may",
        data: { metricId, alertId: alert },
      });
    },
    publishApproval() {
      bus.emit({
        type: "approval.granted",
        source: "test:human",
        owner: "app:may",
        data: { decision: "implementation", approved: true },
      } as unknown as AgentEvent);
    },
    publishTaskUpdate(id: string) {
      bus.emit({
        type: "test.task.updated",
        source: "test:task-update",
        owner: "app:may",
        target: { appId: "may", taskId: id },
        data: { revision: 1 },
      } as unknown as AgentEvent);
    },
    async condition(
      reviewAfterMs = 3_600_000,
      expected: Record<string, unknown> = {
        field: "value",
        equals: 0,
        freshness: "fresh",
      },
    ): Promise<Condition> {
      const reply = await createAppTaskReadTool({
        bus,
        appId: () => "may",
      }).execute("poc-condition", {
        action: "contract",
        target: { appId: "may" },
        observation: {
          observerId: detector.id,
          id: "recovery-observation",
          resource: metricId,
          expected,
          reviewAfterMs,
        },
      });
      const text = reply.content[0];
      if (text?.type !== "text")
        throw new Error("Condition tool returned no text");
      const parsed = JSON.parse(text.text);
      if (!parsed.condition) throw new Error(JSON.stringify(parsed));
      return parsed.condition;
    },
    async attach(id: string, inputData: Record<string, unknown> = {}) {
      return tasks.attach({
        appId: "may",
        appDir,
        idempotencyKey: `poc:${id}`,
        attachment: (() => {
          const attachment = taskForMayInput({
            id,
            source: { kind: "human", id: "fixture" },
            input: {
              kind: "goal",
              data: {
                outcome: "Review the metric concern",
                acceptance: ["Evidence reviewed"],
                ...inputData,
              },
            },
          });
          if (attachment.kind !== "desired")
            throw new Error("Expected desired Task");
          return {
            ...attachment,
            intent: {
              ...attachment.intent,
              id,
              workflow: undefined,
              executor: "metric-poc",
            },
          };
        })(),
        inputContext: {
          id,
          source: { kind: "human", id: "poc-tester" },
          input: {
            kind: "goal",
            data: {
              outcome: "Review the metric concern",
              acceptance: ["Evidence reviewed"],
              ...inputData,
            },
          },
        },
      });
    },
    async handoff(decision: ConversationTurnResult) {
      conversation = decision;
      return tasks.admitConversation({
        id: "poc-message",
        appId: "may",
        conversationId: "poc",
        conversationSequence: 1,
        source: { kind: "human", id: "poc-tester" },
        input: {
          kind: "message",
          data: { message: "Follow the metric concern" },
        },
      });
    },
    async poll() {
      const before = runtime.observerHealth("may")[0]?.lastCompletedAt;
      clockOffset += detector.intervalMs;
      runtime.scanNow();
      await until(
        () => runtime.observerHealth("may")[0]?.lastCompletedAt !== before,
        "scheduled observation slot",
      );
    },
    async restart() {
      runtime.close();
      await tasks.close();
      closeDb(persistDir);
      await open();
    },
    async close() {
      runtime.close();
      await tasks.close();
      closeDb(persistDir);
      rmSync(root, { recursive: true, force: true });
    },
  };
}
