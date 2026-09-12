import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { Type, defineApp, type AppInputContext, type ConversationTurnResult } from "@may-agent/sdk";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { SubagentManager } from "../../../src/lib/manager.js";
import type { SubagentDefinition } from "../../../src/lib/types.js";
import { createAgentRun } from "../../../src/lib/agent-runner.js";
import { RESPONSES_STREAM_TERMINAL_ERROR } from "../../../src/lib/workflow-finish-recovery.js";
import { createModelRegistry } from "../../../src/app/model-registry.js";
import { EventBus, type AgentEvent } from "../../../src/app/core/events/bus.js";
import { DbWriter } from "../../../src/lib/db-writer.js";
import { getDb, closeDb } from "../../../src/lib/requests.js";
import { AppRegistry } from "../../../src/app/core/apps/registry.js";
import { HostCapacity } from "../../../src/app/core/scheduling/host-capacity.js";
import { createTaskExecutionBackends } from "../../../src/app/composition/task-execution.js";
import { startAppInboxRuntime } from "../../../src/app/composition/app-inbox-runtime.js";
import { createAppTaskCapability } from "../../../src/app/core/tasks/app-task-capability.js";
import { installAppTaskRuntimes, closeInstalledAppTaskRuntimes } from "../../../src/app/core/tasks/app-task-runtime.js";
import { AppTaskResourceStore } from "../../../src/app/core/state/app-task-resource-store.js";
import { listAppInboxItems } from "../../../src/app/core/state/app-inbox-store.js";
import { readAppConversationResource } from "../../../src/app/core/state/conversations.js";
import {
  readConversationRequest,
  listConversationRequests,
} from "../../../src/app/core/state/conversation-requests.js";
import { conversationTaskId } from "../../../src/app/core/state/conversation-task-turns.js";
import { appTaskContext, readAppTaskAdmissionOutcome } from "../../../src/app/core/tasks/app-task-reconciler.js";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const modelName = arg("--model");
const output = arg("--out");
const fault = arg("--fault");
const callerFeedback = fault === "caller-feedback";
const value = Number(arg("--value") ?? "0.92");
if (
  !process.argv.includes("--live") ||
  !modelName ||
  !output ||
  !["empty", "after-effect", "attempt-loss", "caller-feedback"].includes(fault ?? "") ||
  !Number.isFinite(value)
)
  throw Error(
    "Use --live --model NAME --out DIRECTORY --fault empty|after-effect|attempt-loss|caller-feedback [--value NUMBER]",
  );
const model = createModelRegistry()[modelName];
if (!model) throw Error("Selected model is not configured");
const outputRoot = resolve(output);
mkdirSync(outputRoot, { recursive: true });
const git = promisify(execFile);
const gitOptions = { cwd: resolve(import.meta.dirname, "../../.."), timeout: 5_000 };
const sourceRevision = (await git("git", ["rev-parse", "HEAD"], gitOptions)).stdout.trim();
const sourceDirty = Boolean((await git("git", ["status", "--porcelain"], gitOptions)).stdout.trim());
const sourcePatchHash = createHash("sha256")
  .update((await git("git", ["diff", "HEAD"], gitOptions)).stdout)
  .digest("hex");
const root = mkdtempSync(join(tmpdir(), "may-managed-conversation-"));
const appDir = join(root, "chat.app");
mkdirSync(appDir);
mkdirSync(join(root, "shared"));
const journal = join(root, "measurement.json");
writeFileSync(journal, JSON.stringify({ value, minimum: 0.9, records: [] }));
const readJournal = () =>
  JSON.parse(readFileSync(journal, "utf8")) as { value: number; minimum: number; records: number[] };
const definition = defineApp({
  id: "chat",
  version: 1,
  agent: "fixture-chat",
  requests: { mode: "agent" },
  inputSchema: Type.Object({ kind: Type.String(), data: Type.Object({}, { additionalProperties: true }) }),
});
const workerDir = join(root, "measurement.app");
const worker = defineApp({
  id: "measurement",
  version: 1,
  agent: "fixture-measure",
  inputSchema: Type.Object({ kind: Type.Literal("collect"), data: Type.Object({ request: Type.String() }) }),
  task: () => ({
    kind: "desired",
    intent: {
      id: "sample",
      parentId: "root",
      mode: "achieve",
      outcome: "Obtain the sample and compare it with the minimum",
      acceptance: ["Return the actual measurement and comparison, preserving unfinished work if access is missing"],
    },
  }),
  tasks: { subscriptions: [], resolve: () => null },
});
if (callerFeedback) {
  mkdirSync(join(workerDir, "tasks"), { recursive: true });
  writeFileSync(
    join(workerDir, "tasks", "seed.json"),
    JSON.stringify({ root_task_id: "root", groups: { root: { id: "root", parent_id: null } } }),
  );
}
let accessReady = !callerFeedback;
let deniedReads = 0;
let successfulReads = 0;
let injected = false;
let calls = 0;
let providerCalls = 0;
let notify: (() => void) | undefined;
let profileCount = 0;
const executions: Array<Record<string, unknown>> = [];
const contexts: AppInputContext[] = [];
let runtime: Awaited<ReturnType<typeof start>> | undefined;

async function start() {
  const bus = new EventBus();
  const db = getDb(root);
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const stopProfile = bus.listen((event) => {
    if (String(event.type) === "project.task.reconcile.profiled") {
      profileCount++;
      notify?.();
    }
  });
  const registry = new AppRegistry(async () => [
    { appDir, definition },
    ...(callerFeedback ? [{ appDir: workerDir, definition: worker }] : []),
  ]);
  await registry.reload();
  const manager = new SubagentManager({
    persistDir: root,
    projectRoot: root,
    bus,
    agentRunFactory(config) {
      const actual = config.streamFn!;
      return createAgentRun({
        ...config,
        streamFn(selected, context, options) {
          const inject =
            !injected && (fault === "empty" || (fault === "after-effect" && readJournal().records.length > 0));
          if (inject) {
            injected = true;
            const message: AssistantMessage = {
              role: "assistant",
              content: [],
              api: selected.api,
              provider: selected.provider,
              model: selected.id,
              usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
              },
              stopReason: fault === "empty" ? "stop" : "error",
              timestamp: Date.now(),
              ...(fault === "after-effect" ? { errorMessage: RESPONSES_STREAM_TERMINAL_ERROR } : {}),
            };
            const stream = createAssistantMessageEventStream();
            if (message.stopReason === "error") stream.push({ type: "error", reason: "error", error: message });
            else stream.push({ type: "done", reason: "stop", message });
            return stream;
          }
          if (++providerCalls > (callerFeedback ? 24 : 12)) throw Error("Fixture model-call allowance exhausted");
          return actual(selected, context, options);
        },
      });
    },
  });
  const agent: SubagentDefinition = {
    name: "fixture-chat",
    description: "Discuss and perform synthetic measurement work",
    domain: "fixture",
    model,
    apiKey: model.apiKey,
    projectRoot: root,
    workspace: root,
    timeoutMs: 90_000,
    systemPrompt: callerFeedback
      ? "Help the human with the assigned measurement work. Only claim verified results and preserve unresolved requests."
      : "Use current observations to help with the assigned measurement work. Only claim verified results. Inspect committed records before repeating effects. Choose how to make progress within the assignment; its assigning owner decides whether to revise or withdraw it.",
    tools: [
      {
        name: "measurement",
        label: "Measurement service",
        description: callerFeedback
          ? "Read the current measurement and its applicable minimum."
          : "Read the current measurement, minimum and all committed records, or record a verified value. Each record call creates another record; inspect existing records when their state matters.",
        parameters: callerFeedback
          ? Type.Object({ action: Type.Literal("read") }, { additionalProperties: false })
          : Type.Union([
              Type.Object({ action: Type.Literal("read") }, { additionalProperties: false }),
              Type.Object({ action: Type.Literal("record"), value: Type.Number() }, { additionalProperties: false }),
            ]),
        async execute(_id, raw) {
          const command = raw as { action: "read" | "record"; value?: number };
          const state = readJournal();
          if (!accessReady) {
            deniedReads++;
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    available: false,
                    error:
                      "Access denied; no sample was obtained. Only the human requester can restore source permissions. The measurement App can read but cannot change permissions.",
                  }),
                },
              ],
              details: undefined,
            };
          }
          if (command.action === "read") successfulReads++;
          if (command.action === "record") {
            if (callerFeedback) throw Error("This trial offers only measurement reads");
            if (command.value !== state.value) throw Error("Only the observed measurement can be recorded");
            state.records.push(command.value);
            writeFileSync(journal, JSON.stringify(state));
          }
          return { content: [{ type: "text", text: JSON.stringify(state) }], details: undefined };
        },
      },
    ],
  };
  manager.register({ ...agent, ...(callerFeedback ? { tools: [] } : {}) });
  if (callerFeedback)
    manager.register({
      ...agent,
      name: "fixture-measure",
      systemPrompt:
        "Obtain the requested measurement and comparison. A missing prerequisite does not finish that assignment. If caller action is needed, explain it and wait rather than polling. Source access changes are reported as measurement.access.changed with resource=sample and ready=true. Use the measurement tool for facts, including who can repair a denied read. Only claim what was measured.",
    });
  const call = manager.callAgentDefinition.bind(manager);
  manager.callAgentDefinition = async (agent, prompt, options) => {
    if (++calls > (callerFeedback ? 8 : 3)) throw Error("Fixture attempt allowance exhausted");
    console.log(JSON.stringify({ event: "managed-attempt", attempt: calls }));
    const context = prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/);
    if (context) contexts.push(JSON.parse(context[1]!));
    const result = await call(agent, prompt, options);
    executions.push({
      sessionId: result.sessionId,
      status: result.status,
      duration: result.duration,
      taskBinding: options?.taskBinding,
      decision: result.structuredResult,
      tools: result.messages.flatMap((message) =>
        message.role === "assistant"
          ? message.content.flatMap((block) =>
              block.type === "toolCall" ? [{ name: block.name, arguments: block.arguments }] : [],
            )
          : [],
      ),
      usage: result.messages.flatMap((message) => (message.role === "assistant" ? [message.usage] : [])),
      modelSteps: result.messages.filter((message) => message.role === "assistant").length,
      toolErrors: result.messages.filter((message) => message.role === "toolResult" && message.isError).length,
    });
    if (fault === "attempt-loss" && !injected && readJournal().records.length > 0) {
      injected = true;
      throw Error("Synthetic loss after managed execution returned; no result was accepted");
    }
    return result;
  };
  const hostCapacity = new HostCapacity(1);
  await installAppTaskRuntimes({
    projectRoot: root,
    projectsRoot: root,
    persistDir: root,
    bus,
    hostCapacity,
    appRegistrySnapshot: registry.snapshot(),
    ...createTaskExecutionBackends({ manager, bus, persistDir: root }),
  });
  const tasks = createAppTaskCapability({ bus });
  const ingress = await startAppInboxRuntime({
    registry,
    db,
    bus,
    persistDir: root,
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
    bus,
    db,
    async close() {
      ingress.close();
      await closeInstalledAppTaskRuntimes(bus);
      stopProfile();
      closeDb(root);
    },
  };
}

/** Same managed boundary, with a real model choosing report/wait and human replies. */
async function trialCallerFeedback() {
  const waitFor = async (ready: () => boolean) => {
    while (!ready())
      await new Promise<void>((done) => {
        notify = done;
      });
    notify = undefined;
  };
  const store = () => AppTaskResourceStore.activeFromDb(runtime!.db, worker.id)!;
  const context = () =>
    appTaskContext({
      appDir: workerDir,
      projectDir: workerDir,
      agent: worker.agent!,
      maxConcurrent: 1,
      resourceStore: store(),
    });
  let topicId: string | undefined;
  const requests = () => listConversationRequests(runtime!.db, "chat", "primary", topicId);
  const publishHuman = (id: string, text: string) =>
    runtime!.bus.emit({
      type: "conversation.message.created",
      source: "fixture",
      owner: "human:fixture",
      data: {
        appId: "chat",
        conversationId: "primary",
        author: { kind: "human", id: "caller" },
        text,
        idempotencyKey: id,
      },
    });
  publishHuman(
    "measurement-ask",
    "Ask the measurement App to obtain the sample and compare it with the minimum. Keep this request open until you can tell me the actual result. Let me know if I need to help.",
  );
  await waitFor(() => Boolean(store()?.readTask("sample")?.status.observedAttemptId));
  const first = store().readAttempt(store().readTask("sample")!.status.observedAttemptId!)!;
  if (first.acceptedResult?.state !== "waiting" || !first.acceptedResult.report || deniedReads < 1)
    throw Error("Agent did not report and wait after encountering denied access");
  await waitFor(() =>
    listAppInboxItems(runtime!.db, { appId: "chat" }).some(
      (item) =>
        item.input.kind === "task-outcome" &&
        item.status === "done" &&
        (item.input.data as { attemptId?: string }).attemptId === first.metadata.id,
    ),
  );
  const before = readAppConversationResource(runtime!.db, "chat", "primary");
  topicId = before.topics?.[0]?.id;
  const open = requests();
  const help = before.messages.filter((message) => message.author.kind === "agent").at(-1)?.text ?? "";
  if (!open.length || open.some((request) => request.status !== "open") || !/access/i.test(help))
    throw Error("Conversation did not communicate the access problem while retaining the original request");
  const original = listAppInboxItems(runtime!.db, { appId: "chat" }).find((item) => item.source.kind === "human")!;
  const key = `conversation-follow-up:chat:${original.id}`;
  if (readAppTaskAdmissionOutcome(context(), "sample", key)) throw Error("Report was misclassified as an answer");
  const requestIds = open.map((request) => request.id).sort();
  const callsBeforeReopen = calls;
  await runtime!.close();
  runtime = await start();
  if (store().readAttempt(first.metadata.id)?.acceptedResult?.summary !== first.acceptedResult.summary)
    throw Error("Report changed across storage reopen");
  accessReady = true;
  publishHuman("source-repaired", "Source access is restored. Please continue the same measurement request.");
  runtime.bus.emit({
    type: "measurement.access.changed",
    source: "fixture-source",
    owner: "app:measurement",
    target: { appId: worker.id, taskId: "sample" },
    data: { resource: "sample", ready: true },
  } as unknown as AgentEvent);
  await waitFor(
    () =>
      Boolean(readAppTaskAdmissionOutcome(context(), "sample", key)) &&
      requests().length > 0 &&
      requests().every((request) => request.status === "closed") &&
      listAppInboxItems(runtime!.db, { appId: "chat" }).every((item) => item.status === "done"),
  );
  const answer = readAppTaskAdmissionOutcome(context(), "sample", key)!;
  if (successfulReads < 1 || readJournal().records.length !== 0)
    throw Error("Expected a real measurement read and no unrelated write");
  const conversation = readAppConversationResource(runtime.db, "chat", "primary");
  const finalResponse = conversation.messages.filter((message) => message.author.kind === "agent").at(-1)?.text ?? "";
  if (
    !finalResponse.includes(String(value)) ||
    JSON.stringify(
      requests()
        .map((request) => request.id)
        .sort(),
    ) !== JSON.stringify(requestIds)
  )
    throw Error("Final response or original request identity was lost");
  const finalRequests = requests();
  if (finalRequests.some((request) => request.closure?.disposition !== "fulfilled"))
    throw Error("Request was closed without fulfillment");
  await runtime.close();
  runtime = await start();
  const retained = readAppTaskAdmissionOutcome(context(), "sample", key);
  if (
    JSON.stringify(retained) !== JSON.stringify(answer) ||
    store().isCancelled("sample") ||
    runtime.db.prepare("SELECT count(*) AS count FROM app_tasks WHERE app_id = ?").get(worker.id)!.count !== 1
  )
    throw Error("Original answer or worker identity did not survive reopen");
  return {
    passed: true,
    judgmentReviewRequired:
      "Inspect who must act in the help reply and whether the final comparison is correct; mechanical passage alone does not score these judgments.",
    help,
    finalResponse,
    requestIds,
    finalRequests,
    waitingReportAttempt: first.metadata.id,
    originalAnswer: answer,
    deniedReads,
    successfulReads,
    dispatchProfiles: profileCount,
    taskAttempts: runtime.db.prepare("SELECT count(*) AS count FROM app_task_attempts").get()!.count,
    conversationAttempts: calls,
    workerAttempts: runtime.db
      .prepare("SELECT count(*) AS count FROM app_task_attempts WHERE app_id = ?")
      .get(worker.id)!.count,
    callsBeforeReopen,
    expectedMeetsMinimum: value >= 0.9,
  };
}
let passed = false;
let failure: string | undefined;
let report: Record<string, unknown> = {};
const startedAt = Date.now();
let timeout: ReturnType<typeof setTimeout> | undefined;
try {
  await Promise.race([
    (async () => {
      runtime = await start();
      if (callerFeedback) {
        report = await trialCallerFeedback();
        passed = true;
        return;
      }
      runtime.bus.emit({
        type: "conversation.message.created",
        source: "fixture",
        owner: "human:fixture",
        data: {
          appId: "chat",
          conversationId: "primary",
          author: { kind: "human", id: "caller" },
          text: "Check the sample against the minimum. Record the verified value once and tell me the result.",
          idempotencyKey: "measurement-ask",
        },
      });
      for (let attempt = 0; attempt < 3; attempt++) {
        while (profileCount <= attempt)
          await new Promise<void>((resolveStep) => {
            notify = resolveStep;
          });
        notify = undefined;
        const items = listAppInboxItems(runtime.db, { appId: "chat" });
        if (items[0]?.status === "done") break;
        if (fault === "attempt-loss" && attempt === 0) {
          await runtime.close();
          runtime = await start();
        }
      }
      const conversation = readAppConversationResource(runtime.db, "chat", "primary");
      const taskId = conversationTaskId("chat", "primary");
      const store = AppTaskResourceStore.activeFromDb(runtime.db, "chat")!;
      const records = readJournal().records;
      const previousAttempt = contexts[1]?.previousAttempt;
      const response = conversation.messages.filter((message) => message.author.kind === "agent").at(-1)?.text ?? "";
      const items = listAppInboxItems(runtime.db, { appId: "chat" });
      const task = store.readTask(taskId)!;
      const accepted = task.status.result?.conversation as ConversationTurnResult | undefined;
      const requests = (accepted?.requestUpdates ?? []).map((update) =>
        readConversationRequest(runtime!.db, "chat", "primary", update.id),
      );
      const taskCount = runtime.db
        .prepare("SELECT count(*) AS count FROM app_tasks WHERE app_id = ?")
        .get("chat")!.count;
      passed =
        injected &&
        records.length === 1 &&
        records[0] === value &&
        response.includes(String(value)) &&
        items.length === 1 &&
        items[0]?.status === "done" &&
        !store.isCancelled(taskId) &&
        items[0]?.executionTaskId === taskId &&
        taskCount === 1 &&
        requests.every((request) => request !== null) &&
        store.nextDueAt() === null &&
        store.listRecoveryCandidates().items.length === 0 &&
        (fault !== "attempt-loss" ||
          (calls === 2 &&
            previousAttempt?.sessionId === executions[0]?.sessionId &&
            previousAttempt?.state === "failed"));
      const callsBeforeQuiet = calls;
      runtime.bus.emit({
        type: "conversation.supervision.review",
        source: "fixture-timer",
        data: { project: "chat", limit: 1 },
      } as unknown as AgentEvent);
      await new Promise<void>((done) => setImmediate(done));
      passed &&= calls === callsBeforeQuiet;
      report = {
        passed,
        expectedMeetsMinimum: value >= 0.9,
        records,
        response,
        items: items.map((item) => ({ id: item.id, status: item.status, executionTaskId: item.executionTaskId })),
        requests,
        task,
        taskCount,
        attemptCount: profileCount,
        injected,
      };
    })(),
    new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(Error("Fixture total time allowance exhausted")), 180_000);
    }),
  ]);
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  if (timeout) clearTimeout(timeout);
  await runtime?.close();
  const result = {
    sourceRevision,
    sourceDirty,
    sourcePatchHash,
    fault,
    model: modelName,
    value,
    root,
    durationMs: Date.now() - startedAt,
    passed: passed && !failure,
    failure,
    calls,
    providerCalls,
    report,
    contexts,
    executions,
  };
  writeFileSync(join(outputRoot, "report.json"), JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({ passed: result.passed, fault, calls, providerCalls, reportPath: join(outputRoot, "report.json") }),
  );
  if (!result.passed) process.exitCode = 1;
}
