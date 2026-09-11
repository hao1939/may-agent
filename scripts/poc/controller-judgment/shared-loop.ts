import assert from "node:assert/strict";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { AppRegistry } from "../../../src/app/core/apps/registry.js";
import { discoverAppDefinitions } from "../../../src/app/adapters/discovery/app-definitions.js";
import { EventBus, type AgentEvent } from "../../../src/app/core/events/bus.js";
import { HostCapacity } from "../../../src/app/core/scheduling/host-capacity.js";
import { AppTaskResourceStore } from "../../../src/app/core/state/app-task-resource-store.js";
import { getAppInboxItem, listAppInboxItems } from "../../../src/app/core/state/app-inbox-store.js";
import { readAppConversationResource } from "../../../src/app/core/state/conversations.js";
import {
  listConversationRequests,
  readConversationRequest,
} from "../../../src/app/core/state/conversation-requests.js";
import {
  conversationTaskId,
  listPendingConversationTaskChanges,
} from "../../../src/app/core/state/conversation-task-turns.js";
import { createAppTaskCapability } from "../../../src/app/core/tasks/app-task-capability.js";
import {
  installAppTaskRuntimes,
  closeInstalledAppTaskRuntimes,
  readLoadedAppTaskInputResult,
} from "../../../src/app/core/tasks/app-task-runtime.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "../../../src/app/composition/app-inbox-runtime.js";
import {
  createTaskAttemptProcessExecutor,
  runTaskAttemptWorker,
  parseTaskAttemptProcessRequest,
} from "../../../src/app/composition/workers/task-attempt-process.js";
import { attachEventPersistence } from "../../../src/app/daemon-events.js";
import { createModelRegistry } from "../../../src/app/model-registry.js";
import { closeDb, getDb } from "../../../src/lib/requests.js";
import { listSessionIds, readSessionMessages, readSessionMeta } from "../../../src/lib/persistence.js";

const arg = (name: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const roots = (root: string) => ({
  projectRoot: root,
  projectsRoot: join(root, "projects"),
  sharedRoot: join(root, "shared"),
  persistDir: join(root, ".state"),
});
if (process.argv.includes("--worker")) {
  await runTaskAttemptWorker({
    request: parseTaskAttemptProcessRequest(arg("--request")!),
    roots: roots(arg("--root")!),
    models: createModelRegistry(),
  });
  process.exit(0);
}

const appRoot = arg("--app-root");
const modelName = arg("--model");
const out = arg("--out");
const value = Number(arg("--value") ?? "0.92");
const nested = process.argv.includes("--nested");
if (!process.argv.includes("--live") || !appRoot || !modelName || !out || !Number.isFinite(value))
  throw Error("Use --live --app-root APP_CHECKOUT --model MODEL --out DIRECTORY [--value NUMBER] [--nested]");
assert(createModelRegistry()[modelName], "Selected model must be configured");
const hostRoot = resolve(import.meta.dir, "../../..");
const output = resolve(out);
const root = mkdtempSync(join(tmpdir(), "may-shared-loop-"));
const paths = roots(root);
mkdirSync(output, { recursive: true });
const git = promisify(execFile);
const revision = async (cwd: string) => ({
  revision: (await git("git", ["rev-parse", "HEAD"], { cwd, timeout: 5_000 })).stdout.trim(),
  dirty: Boolean((await git("git", ["status", "--porcelain"], { cwd, timeout: 5_000 })).stdout.trim()),
});
const sources = { host: await revision(hostRoot), app: await revision(resolve(appRoot)) };
const copied: Record<string, string> = {};
for (const name of [
  "projects/may.app/app.ts",
  "projects/may.app/project.json",
  "projects/may.app/tasks/seed.json",
  "agents/may/AGENTS.md",
  "shared/common-sense.md",
]) {
  const destination = join(root, name);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(appRoot, name), destination);
  copied[name] = createHash("sha256").update(readFileSync(destination)).digest("hex");
}
// Keep App policy and role text intact. The trial exposes local coding and finish
// tools only, so it cannot invoke another installed App or CLI delegation.
const agentConfig = JSON.parse(readFileSync(join(appRoot, "agents/may/agent.json"), "utf8"));
writeFileSync(
  join(root, "agents/may/agent.json"),
  JSON.stringify({ ...agentConfig, model: modelName, tools: ["coding", "finish"] }),
);
mkdirSync(join(root, "shared/skills"), { recursive: true });
symlinkSync(join(hostRoot, "node_modules"), join(root, "node_modules"));

const measurementRequested = Promise.withResolvers<void>();
const releaseMeasurement = Promise.withResolvers<void>();
let measurementReads = 0;
const source = createServer(async (_request, response) => {
  measurementReads++;
  measurementRequested.resolve();
  await releaseMeasurement.promise;
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ sample: "trial", value, minimum: 0.9, evidence: "instrument:trial" }));
});
await new Promise<void>((resolveListen, reject) => {
  source.once("error", reject);
  source.listen(0, "127.0.0.1", resolveListen);
});
const sourceUrl = `http://127.0.0.1:${(source.address() as AddressInfo).port}/measurement`;
let bus = new EventBus();
let db = getDb(paths.persistDir);
let ingress: AppInboxRuntime | undefined;
let dispatches = 0;
const children: Array<{ child: ChildProcess; closed: Promise<void> }> = [];
const events: Array<{ at: number; event: AgentEvent }> = [];
const startedAt = Date.now();
const start = async () => {
  attachEventPersistence({ bus, persistDir: paths.persistDir });
  bus.listen((event) => {
    events.push({ at: Date.now() - startedAt, event });
    if (
      ["project.task.reconcile.started", "project.task.reconciled", "handler.failed", "conversation.updated"].includes(
        event.type,
      )
    )
      console.log(JSON.stringify({ elapsedMs: Date.now() - startedAt, type: event.type, taskId: event.data?.taskId }));
  });
  const registry = new AppRegistry(discoverAppDefinitions(paths.projectsRoot));
  await registry.reload();
  const hostCapacity = new HostCapacity(2);
  const executeAttempt = createTaskAttemptProcessExecutor({
    bus,
    timeoutMs: 180_000,
    spawnWorker(request) {
      if (++dispatches > (nested ? 10 : 8)) throw Error("Trial dispatch allowance exhausted");
      const child = spawn(
        process.execPath,
        [fileURLToPath(import.meta.url), "--worker", "--root", root, "--request", JSON.stringify(request)],
        {
          cwd: root,
          env: { ...process.env, MAY_TASK_ATTEMPT_CHILD: "1" },
          stdio: ["ignore", "pipe", "pipe", "ipc"],
          serialization: "json",
        },
      );
      children.push({ child, closed: new Promise<void>((done) => child.once("close", () => done())) });
      const log: string[] = [];
      child.stdout!.on("data", (chunk) => log.push(chunk.toString()));
      child.stderr!.on("data", (chunk) => log.push(chunk.toString()));
      const number = dispatches;
      child.once("close", () => writeFileSync(join(output, `worker-${number}.log`), log.join("")));
      return child;
    },
  });
  await installAppTaskRuntimes(
    { ...paths, bus, hostCapacity, appRegistry: registry, executeAttempt },
    { deferRecovery: true },
  );
  const tasks = createAppTaskCapability({ bus });
  ingress = await startAppInboxRuntime({
    registry,
    db,
    bus,
    persistDir: paths.persistDir,
    hostCapacity,
    conversationAppId: "may",
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
};
const publish = (id: string, text: string) =>
  bus.emit({
    type: "conversation.message.created",
    source: "fixture",
    owner: "human:fixture",
    data: {
      appId: "may",
      conversationId: "may:primary",
      author: { kind: "human", id: "caller" },
      text,
      idempotencyKey: id,
    },
  });
const nextEvent = (matches: (event: AgentEvent) => boolean) =>
  new Promise<void>((done) => {
    const stop = bus.listen((event) => {
      if (matches(event)) {
        stop();
        done();
      }
    });
  });
const store = () => AppTaskResourceStore.activeFromDb(db, "may")!;
const conversation = () => readAppConversationResource(db, "may", "may:primary");
const answerCount = () => conversation().messages.filter((message) => message.author.kind === "agent").length;
let failure: string | undefined;
let report: Record<string, unknown> = {};
let timer: ReturnType<typeof setTimeout> | undefined;
try {
  await Promise.race([
    (async () => {
      await start();
      publish(
        "measurement",
        nested
          ? `Please arrange a background review of the sample at ${sourceUrl} against a 0.90 minimum. Have the reviewer obtain the measurement from a separate worker, then assess that worker's returned evidence. Report the conclusion to me. The source may take some time to answer; keep our discussion available while they work.`
          : `Please check the sample at ${sourceUrl} in the background and tell me whether it meets the 0.90 minimum. The source may take some time to answer; keep our discussion available while it runs.`,
      );
      await measurementRequested.promise;
      const taskA = conversationTaskId("may", "may:primary");
      const ask = listConversationRequests(db, "may", "may:primary").find((request) => request.taskRefs.length > 0);
      assert(ask, "The accepted ask must remain linked to the actual background Task");
      const taskB = ask.taskRefs[0]!.taskId;
      const taskC = nested
        ? Object.keys(store().readSnapshot().resources!).find((id) => id !== taskA && id !== taskB)
        : undefined;
      if (nested) assert(taskC, "The reviewer must delegate the independent measurement to a third Task");
      const expectedTaskIds = [taskA, taskB, ...(taskC ? [taskC] : [])].sort();
      const measurementAdmission = taskC
        ? listAppInboxItems(db, { appId: "may" }).find((item) => item.waitingOn?.id === taskC)
        : undefined;
      if (nested)
        assert(measurementAdmission?.taskAdmissionKey, "Code must retain the reviewer's exact measurement input");
      assert.equal(store().readTask(taskC ?? taskB)?.status.phase, "running");
      assert.equal(ask.status, "open");
      const priorAnswers = answerCount();
      const discussed = nextEvent((event) => event.type === "conversation.updated" && answerCount() > priorAnswers);
      publish(
        "discussion",
        "While that runs, explain why one sample alone may not be enough for a decision. Just discuss it with me.",
      );
      await discussed;
      if (nested) assert.equal(store().readTask(taskB)?.status.conditionIds?.length, 1);
      assert.equal(store().readTask(taskC ?? taskB)?.status.phase, "running");
      assert.equal(readConversationRequest(db, "may", "may:primary", ask.id)?.status, "open");
      const discussion = conversation()
        .messages.filter((message) => message.author.kind === "agent")
        .at(-1)!;
      const returned = nextEvent(
        (event) =>
          event.type === "conversation.updated" &&
          readConversationRequest(db, "may", "may:primary", ask.id)?.status === "closed",
      );
      releaseMeasurement.resolve();
      await returned;
      const fulfilled = readConversationRequest(db, "may", "may:primary", ask.id)!;
      assert.equal(fulfilled.closure?.disposition, "fulfilled");
      const reply = conversation().messages.find((message) => message.id === fulfilled.closure!.messageId)!;
      assert(reply.text.includes(String(value)), "The final reply must contain the observed measurement");
      assert.equal(conversation().messages.find((message) => message.id === discussion.id)?.text, discussion.text);
      const tasks = store().readSnapshot().resources!;
      assert.deepEqual(Object.keys(tasks).sort(), expectedTaskIds);
      for (const id of expectedTaskIds) assert.equal(store().isCancelled(id), false);
      const childOutcome = store().readAttempt(tasks[taskB]!.status.observedAttemptId!)!;
      assert.equal(childOutcome.acceptedResult?.state, "converged");
      const measurementOutcome = taskC ? store().readAttempt(tasks[taskC]!.status.observedAttemptId!)! : undefined;
      const measurementInput = measurementAdmission ? getAppInboxItem(db, measurementAdmission.id) : undefined;
      if (taskC) {
        assert.equal(measurementOutcome?.acceptedResult?.state, "converged");
        assert.equal(measurementInput?.status, "done");
        const exact = readLoadedAppTaskInputResult({
          bus,
          appDir: join(root, "projects/may.app"),
          taskId: taskC,
          admissionKey: measurementAdmission!.taskAdmissionKey!,
        });
        assert.equal(exact?.attemptId, measurementOutcome!.metadata.id);
        assert.deepEqual(measurementInput?.result?.result, exact?.result);
      }
      const resultInput = listAppInboxItems(db, { appId: "may" }).find(
        (item) =>
          item.input.kind === "task-outcome" &&
          (item.input.data as { attemptId?: string }).attemptId === childOutcome.metadata.id,
      );
      assert.equal((resultInput?.input.data as { attemptId?: string })?.attemptId, childOutcome.metadata.id);
      assert.equal(listPendingConversationTaskChanges(db, "may").length, 0);
      ingress!.close();
      await closeInstalledAppTaskRuntimes(bus);
      closeDb(paths.persistDir);
      db = getDb(paths.persistDir);
      bus = new EventBus();
      await start();
      const beforeReopenReply = answerCount();
      const resumed = nextEvent((event) => event.type === "conversation.updated" && answerCount() > beforeReopenReply);
      publish("reopen", "Remind me of the sample result and the limitation we discussed.");
      await resumed;
      const reopenedInput = listAppInboxItems(db, { appId: "may" }).find(
        (item) =>
          item.source.kind === "human" &&
          (item.input.data as { message?: string }).message ===
            "Remind me of the sample result and the limitation we discussed.",
      );
      assert.equal(reopenedInput?.status, "done", "Reopen must execute and settle the new input");
      assert(
        reopenedInput?.result?.response?.includes(String(value)),
        "The reopened reply must recall the observed value",
      );
      assert.deepEqual(Object.keys(store().readSnapshot().resources!).sort(), expectedTaskIds);
      report = {
        taskA,
        taskB,
        taskC,
        ask: fulfilled,
        childOutcome,
        measurementOutcome,
        measurementInput,
        discussion: discussion.text,
        reply: reply.text,
        resumedReply: conversation()
          .messages.filter((message) => message.author.kind === "agent")
          .at(-1)?.text,
        inputs: listAppInboxItems(db, { appId: "may" }),
        measurementReads,
      };
    })(),
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(Error("Trial total time allowance exhausted")), 360_000);
    }),
  ]);
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  if (timer) clearTimeout(timer);
  releaseMeasurement.resolve();
  ingress?.close();
  for (const { child } of children) if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  await Promise.all(children.map(({ closed }) => closed));
  await closeInstalledAppTaskRuntimes(bus);
  source.closeAllConnections();
  await new Promise<void>((done) => source.close(() => done()));
  const sessions = listSessionIds(paths.persistDir).map((sessionId) => {
    const messages = readSessionMessages(paths.persistDir, sessionId);
    return {
      sessionId,
      meta: readSessionMeta(paths.persistDir, sessionId),
      modelSteps: messages.filter((message) => message.role === "assistant").length,
      toolErrors: messages.filter((message) => message.role === "toolResult" && message.isError).length,
      usage: messages.flatMap((message) => (message.role === "assistant" ? [message.usage] : [])),
      tools: messages.flatMap((message) =>
        message.role === "assistant"
          ? message.content.flatMap((block) =>
              block.type === "toolCall" ? [{ name: block.name, arguments: block.arguments }] : [],
            )
          : [],
      ),
    };
  });
  const result = {
    passed: !failure,
    failure,
    sources,
    copied,
    model: modelName,
    value,
    nested,
    root,
    durationMs: Date.now() - startedAt,
    dispatches,
    toolPresets: ["coding", "finish"],
    report,
    sessions,
    events,
  };
  writeFileSync(join(output, "report.json"), JSON.stringify(result, null, 2));
  closeDb(paths.persistDir);
  console.log(JSON.stringify({ passed: result.passed, failure, dispatches, reportPath: join(output, "report.json") }));
  if (failure) process.exitCode = 1;
}
