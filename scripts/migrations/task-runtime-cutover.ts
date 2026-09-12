/**
 * Real old-daemon -> offline conversion -> candidate-daemon trial.
 * Temporary state and a local scripted provider only; no installed App or model.
 * bun scripts/migrations/task-runtime-cutover.ts --legacy-source OLD_HOST --out REPORT_DIR
 */
import assert from "node:assert/strict";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { AddressInfo } from "node:net";
import type { AppDefinition, AppInputContext, ConversationTurnResult } from "@may-agent/sdk";
import { getDb, closeDb } from "../../src/lib/requests.js";
import { stateTransaction } from "../../src/lib/db/transaction.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { migrateTaskCompletionReceipts } from "../../src/app/core/state/task-receipt-cutover.js";
import { migrateOpenTaskState } from "../../src/app/core/state/task-state-cutover.js";
import { migrateConversationInputs } from "../../src/app/core/state/conversation-cutover.js";
import { getAppInboxItem } from "../../src/app/core/state/app-inbox-store.js";
import { readConversationRequest } from "../../src/app/core/state/conversation-requests.js";
import { readAppConversationResource } from "../../src/app/core/state/conversations.js";
import { appTaskContext, closeAppTask } from "../../src/app/core/tasks/app-task-reconciler.js";
import type { AppTaskResource } from "../../src/app/core/tasks/app-task-state.js";
import { openSandboxDb, pollUntil, socketEmit, socketStatus } from "../../test/e2e/lib/live-daemon.js";

const arg = (name: string) => process.argv[process.argv.indexOf(name) + 1];
assert(
  process.argv.includes("--legacy-source") && process.argv.includes("--out"),
  "Use --legacy-source OLD_HOST --out REPORT_DIR",
);
const source = resolve(arg("--legacy-source")!);
const output = resolve(arg("--out")!);
const candidate = fileURLToPath(new URL("../../", import.meta.url));
mkdirSync(output, { recursive: true });
const exec = promisify(execFile);
const revision = async (cwd: string) => ({
  commit: (await exec("git", ["rev-parse", "HEAD"], { cwd })).stdout.trim(),
  dirty: Boolean((await exec("git", ["status", "--porcelain"], { cwd })).stdout.trim()),
});
const sources = { old: await revision(source), candidate: await revision(candidate) };
assert.equal(sources.old.dirty, false, "Old source must be a clean checkout");
// The inbox execution API is retired in the candidate. Use the actual old
// writer's fence to prove that its former lease cannot write after conversion.
const { assertAppInboxClaim } = await import(
  pathToFileURL(join(source, "src/app/core/state/app-inbox-store.ts")).href
);
const { buildSandbox } = (await import(
  pathToFileURL(join(source, "test/e2e/lib/sandbox.ts")).href
)) as typeof import("../../test/e2e/lib/sandbox.js");
let stage: "old" | "candidate" = "old";
let providerError: unknown;
const calls: Array<{ stage: string; context: AppInputContext }> = [];
const server = createServer(async (request, response) => {
  try {
    let body = "";
    for await (const chunk of request) body += chunk.toString();
    assert.equal(request.url, "/chat/completions");
    const payload = JSON.parse(body) as {
      messages: Array<{ role: string; content: string | Array<{ text?: string }> }>;
    };
    const prompt = payload.messages
      .flatMap((message) =>
        typeof message.content === "string"
          ? [message.content]
          : (message.content ?? []).map((part) => part.text ?? ""),
      )
      .find((text) => text.includes("## Input and context"));
    assert(prompt, "Expected the shipped input context");
    const context = JSON.parse(prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!) as AppInputContext;
    assert(!payload.messages.some((message) => message.role === "tool"), "Unexpected model repair call");
    calls.push({ stage, context });
    assert(calls.length <= 4, "Unexpected extra model execution");
    if (stage === "old" && calls.length === 2) return; // Hold real inbox execution until its daemon exits.
    const existing = context.conversation?.requests?.find((item) => item.id === "review");
    const answer: ConversationTurnResult =
      stage === "old"
        ? {
            summary: "Accepted the review",
            response: "I will return the review here.",
            topic: { kind: "new", title: "Review" },
            requestUpdates: [{ id: "review", expectedRevision: 0, scope: "Review the sample", disposition: "open" }],
          }
        : {
            summary: "Returned the review",
            response:
              existing?.status === "open"
                ? "The review survived the upgrade."
                : "The same Task is ready for new input.",
            topic: { kind: "none" },
            ...(existing?.status === "open"
              ? {
                  requestUpdates: [
                    {
                      id: existing.id,
                      expectedRevision: existing.revision,
                      scope: existing.scope,
                      disposition: "fulfilled" as const,
                      reason: "Returned the fixture review",
                    },
                  ],
                }
              : {}),
          };
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    const chunk = (delta: unknown, finish: string | null) =>
      response.write(
        `data: ${JSON.stringify({
          id: `reply-${calls.length}`,
          object: "chat.completion.chunk",
          created: 0,
          model: "gemini-3.1-pro-preview",
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`,
      );
    chunk(
      {
        role: "assistant",
        tool_calls: [
          {
            index: 0,
            id: `finish-${calls.length}`,
            type: "function",
            function: {
              name: "finish",
              arguments: JSON.stringify({
                status: "success",
                summary: answer.summary,
                verification_facts: ["Synthetic cutover input"],
                result: answer,
              }),
            },
          },
        ],
      },
      null,
    );
    chunk({}, "tool_calls");
    response.end("data: [DONE]\n\n");
  } catch (error) {
    providerError ??= error;
    response.writeHead(500).end("Invalid fixture provider request");
  }
});
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const modelUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const sb = await buildSandbox({
  fixtureAgents: ["may"],
  cronJson: { may: [] },
  daemonArgs: ["--socket"],
  env: {
    MODEL_BASE_URL: modelUrl,
    MODEL_API_KEY: "fixture-only",
    MAY_HOST_MAX_CONCURRENT: "4",
    MAY_POC_CUTOVER_HOLD: "1",
  },
});
let current: ChildProcess | undefined;
let currentLog = "";
const oldProcesses: Array<{ pid: number; start: string }> = [];
function identity(pid: number) {
  try {
    const fields = readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1]!.split(" ");
    return { state: fields[0], start: fields[19]! };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
const alive = (process: { pid: number; start: string }) => {
  const seen = identity(process.pid);
  return seen?.start === process.start && seen.state !== "Z";
};
const waitFor = <T>(
  predicate: () => T | null | false | undefined | Promise<T | null | false | undefined>,
  description: string,
) =>
  pollUntil(
    () => {
      if (providerError) throw providerError;
      return predicate();
    },
    { timeoutMs: 15000, intervalMs: 50, description },
  );
const publish = (event: Record<string, unknown>) => socketEmit(sb.socketPath, "publish", { event });
const message = (key: string, text: string) =>
  publish({
    type: "conversation.message.created",
    target: { appId: "may" },
    data: {
      appId: "may",
      conversationId: "may:primary",
      author: { kind: "human", id: "fixture" },
      text,
      idempotencyKey: key,
    },
  });
const appDir = join(sb.projectsRoot, "may.app");
try {
  await sb.daemonReady;
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  mkdirSync(join(sb.agentsRoot, "may", "workflows"), { recursive: true });
  writeFileSync(
    join(sb.agentsRoot, "may", "agent.json"),
    JSON.stringify({
      name: "may",
      description: "Cutover fixture",
      domain: "test",
      model: "gemini-3.1-pro-preview",
      tools: [],
    }),
  );
  writeFileSync(
    join(appDir, "tasks/seed.json"),
    JSON.stringify({ root_task_id: "root", groups: { root: { id: "root", parent_id: null } } }),
  );
  const definition = `export default {
    id: "may", version: 1, agent: "may", inputSchema: { type: "object" },
    workspace: { kind: "local", localPath: "." }, conversation: { mode: "agent", inputKinds: ["message"] },
    tasks: { maxConcurrent: 2 },
    task(input) { const supervisor = input.input.kind === "supervise"; return { kind: "desired", intent: {
      id: supervisor ? "conversation/follow-up" : "measurement", parentId: "root", mode: supervisor ? "maintain" : "achieve",
      outcome: supervisor ? "Return linked results" : "Measure the sample", acceptance: ["Fixture facts retained"],
      workflow: "cutover-probe", input: { supervisor }
    } }; }
  };`;
  writeFileSync(join(appDir, "app.js"), definition);
  writeFileSync(
    join(sb.agentsRoot, "may/workflows/cutover-probe.ts"),
    `
    import { writeFileSync } from "node:fs";
    import { join } from "node:path";
    export const name = "cutover-probe";
    export const description = "Hold real work across an offline upgrade";
    export async function execute(ctx) {
      writeFileSync(join(ctx.workspace.root, ctx.input.supervisor ? "supervisor-worker.json" : "measurement-worker.json"),
        JSON.stringify({ pid: process.pid, held: process.env.MAY_POC_CUTOVER_HOLD === "1" }));
      if (process.env.MAY_POC_CUTOVER_HOLD === "1") await new Promise(() => {});
      if (ctx.input.supervisor) throw new Error("Retired supervisor executed");
      return ctx.done("Measured", { state: "converged", summary: "Measurement is 17", result: { value: 17 }, facts: ["fixture:17"] });
    }
  `,
  );
  assert.equal(
    ((await publish({ type: "runtime.reload.requested", data: { reason: "install fixture" } })) as { type: string })
      .type,
    "ok",
  );
  await waitFor(() => sb.getLogs().includes("[reload]"), "old fixture App reload");
  assert.equal(((await message("accepted", "Review the sample")) as { type: string }).type, "ok");
  const oldDb = openSandboxDb(sb.dbPath);
  const inbox = (): Record<string, unknown>[] =>
    oldDb.prepare("SELECT * FROM app_inbox_items WHERE app_id = 'may' ORDER BY created_at, id").all() as Record<
      string,
      unknown
    >[];
  const tasks = (): Record<string, unknown>[] =>
    oldDb.prepare("SELECT * FROM app_tasks WHERE app_id = 'may'").all() as Record<string, unknown>[];
  let originalReply: Record<string, unknown>;
  let originalInput: Record<string, unknown>;
  let originalMeasurement: AppTaskResource;
  try {
    originalReply = await waitFor(
      () => inbox().find((row) => row.result && row.status === "done"),
      "accepted old reply",
    );
    for (const kind of ["measure", "supervise"])
      assert.equal(
        (
          (await publish({
            type: "app.input.requested",
            target: { appId: "may" },
            idempotencyKey: kind,
            data: { input: { kind, data: {} } },
          })) as { type: string }
        ).type,
        "ok",
      );
    await waitFor(
      () =>
        tasks().filter((row) => row.phase === "running").length === 2 &&
        existsSync(join(appDir, "measurement-worker.json")) &&
        existsSync(join(appDir, "supervisor-worker.json")),
      "two real old workflow workers",
    );
    assert.equal(((await message("unfinished", "Continue the accepted review")) as { type: string }).type, "ok");
    await waitFor(() => calls.length === 2, "held old inbox execution");
    originalInput = inbox().find((row) => row.status === "handling" && row.lease_owner)!;
    assert(originalInput, "Old inbox execution must hold a real claim");
    assert(Number(originalInput.lease_expires_at) > Date.now(), "Capture the live old inbox claim");
    originalMeasurement = JSON.parse(String(tasks().find((row) => row.task_id === "measurement")!.resource_json));
    // Stop the parent from spawning more workers while taking its final process census.
    process.kill(sb.daemonPid!, "SIGSTOP");
    await waitFor(() => identity(sb.daemonPid!)?.state === "T", "old daemon stopped before process census");
    // Capture the actual daemon's descendants, including admission workers.
    const rows = (await exec("ps", ["-eo", "pid=,ppid="])).stdout
      .trim()
      .split("\n")
      .map((line) => line.trim().split(/\s+/).map(Number));
    const owned = new Set([sb.daemonPid!]);
    for (let previous = -1; previous !== owned.size;) {
      previous = owned.size;
      for (const [pid, parent] of rows) if (owned.has(parent!)) owned.add(pid!);
    }
    for (const pid of owned) {
      const seen = identity(pid);
      if (seen && seen.state !== "Z") oldProcesses.push({ pid, start: seen.start });
    }
    for (const name of ["measurement", "supervisor"]) {
      const witness = JSON.parse(readFileSync(join(appDir, `${name}-worker.json`), "utf8"));
      assert(
        oldProcesses.some((entry) => entry.pid === witness.pid),
        "Executing worker must be owned by the old daemon",
      );
    }
    process.kill(sb.daemonPid!, "SIGKILL");
    await waitFor(() => oldProcesses.every((entry) => !alive(entry)), "old daemon and every observed child exit");
  } finally {
    oldDb.close();
  }

  // No candidate execution exists before the offline transaction. Expired leases alone are insufficient.
  const db = getDb(sb.stateDir);
  let executionTaskId: string;
  try {
    const store = AppTaskResourceStore.fromDb(db, "may");
    const config = appTaskContext({ appDir, projectDir: appDir, resourceStore: store, agent: "may", maxConcurrent: 2 });
    const app = (await import(pathToFileURL(join(appDir, "app.js")).href)).default as AppDefinition;
    executionTaskId = stateTransaction(db, () => {
      migrateTaskCompletionReceipts(config, { oldRuntimeStopped: true });
      migrateOpenTaskState(config, { oldRuntimeStopped: true });
      const converted = migrateConversationInputs(config, {
        app,
        conversationId: "may:primary",
        oldRuntimeStopped: true,
      });
      const supervisor = store.readTask("conversation/follow-up")!;
      closeAppTask(config, {
        appId: "may",
        taskId: supervisor.metadata.id,
        expectedGeneration: supervisor.metadata.generation,
        expectedResourceVersion: supervisor.metadata.resourceVersion,
        reason: "Owner moved result handling to the shared Task loop",
      });
      assert.equal(converted.migrated, 2);
      assert.equal(converted.pending, 1);
      return converted.taskId;
    });
    assert.throws(
      () =>
        assertAppInboxClaim(
          db,
          {
            item: getAppInboxItem(db, String(originalInput!.id))!,
            owner: String(originalInput!.lease_owner),
            generation: Number(originalInput!.lease_generation),
          },
          Number(originalInput!.lease_expires_at) - 1,
        ),
      /claim is stale/,
    );
    assert.equal(getAppInboxItem(db, String(originalReply!.id))?.result?.response, "I will return the review here.");
    assert.equal(readConversationRequest(db, "may", "may:primary", "review")?.status, "open");
    assert.equal(store.readCancellation("conversation/follow-up")?.kind, "closed");
    assert(store.readTask("measurement"), "Independent work survives supervisor retirement");
  } finally {
    closeDb(sb.stateDir);
  }

  writeFileSync(
    join(appDir, "app.js"),
    definition.replace(
      'const supervisor = input.input.kind === "supervise";',
      'if (input.input.kind === "supervise") throw new Error("Supervisor declaration removed"); const supervisor = false;',
    ),
  );
  stage = "candidate";
  current = spawn(process.execPath, [join(candidate, "src/app/may.ts"), "--socket"], {
    cwd: candidate,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      APP_ROOT: sb.root,
      PROJECT_ROOT: sb.root,
      AGENTS_ROOT: sb.agentsRoot,
      PROJECTS_ROOT: sb.projectsRoot,
      SHARED_ROOT: join(sb.root, "shared"),
      STATE_DIR: sb.stateDir,
      INSTANCE: sb.instance,
      DAEMON_INSTANCE: sb.instance,
      AGENT: "may",
      DAEMON_AGENT: "may",
      MODEL_BASE_URL: modelUrl,
      MODEL_API_KEY: "fixture-only",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_CHAT_ID: "",
      MAY_POC_CUTOVER_HOLD: "0",
      MAY_HOST_MAX_CONCURRENT: "4",
    },
  });
  current.stdout!.on("data", (chunk) => {
    currentLog += chunk;
  });
  current.stderr!.on("data", (chunk) => {
    currentLog += chunk;
  });
  await waitFor(() => socketStatus(sb.socketPath), "candidate socket");
  const currentDb = getDb(sb.stateDir);
  try {
    await waitFor(
      () => getAppInboxItem(currentDb, String(originalInput!.id))?.status === "done",
      "original input answered by the Task",
    );
    assert.equal(getAppInboxItem(currentDb, String(originalInput!.id))?.executionTaskId, executionTaskId!);
    assert.equal(readConversationRequest(currentDb, "may", "may:primary", "review")?.status, "closed");
    const store = AppTaskResourceStore.fromDb(currentDb, "may");
    await waitFor(() => store.readTask("measurement")?.status.observedAttemptId, "measurement result after cutover");
    const measured = store.readTask("measurement")!;
    assert.equal(measured.metadata.generation, originalMeasurement!.metadata.generation);
    assert.notEqual(measured.status.observedAttemptId, originalMeasurement!.status.currentAttemptId);
    assert.equal(store.readAttempt(originalMeasurement!.status.currentAttemptId!)?.state, "interrupted");
    assert.equal(store.readAttempt(measured.status.observedAttemptId!)?.acceptedResult?.result?.value, 17);
    assert.equal(store.isCancelled("measurement"), false);
    assert.equal(store.isCancelled(executionTaskId!), false);
    assert.equal(JSON.parse(readFileSync(join(appDir, "supervisor-worker.json"), "utf8")).held, true);
    assert.equal(calls.filter((call) => call.stage === "candidate").length, 1);
    assert.equal(((await message("fresh", "Are you still available?")) as { type: string }).type, "ok");
    await waitFor(
      () =>
        readAppConversationResource(currentDb, "may", "may:primary").messages.some(
          (item) => item.text === "The same Task is ready for new input.",
        ),
      "fresh input uses the same Task",
    );
    assert.equal(calls.length, 4);
    assert.equal(
      currentDb
        .prepare(
          "SELECT COUNT(DISTINCT execution_task_id) AS count FROM app_inbox_items WHERE app_id = 'may' AND execution_task_id IS NOT NULL",
        )
        .get()?.count,
      1,
    );
    assert.equal(
      currentDb
        .prepare(
          "SELECT COUNT(*) AS count FROM app_inbox_items WHERE execution_task_id IS NOT NULL AND lease_owner IS NOT NULL",
        )
        .get()?.count,
      0,
    );
    assert.equal(
      readAppConversationResource(currentDb, "may", "may:primary").messages.filter(
        (item) => item.text === "I will return the review here.",
      ).length,
      1,
    );
    assert.equal(providerError, undefined);
    const report = {
      passed: true,
      sources,
      oldProcessesExited: oldProcesses.length,
      historicalReplies: 1,
      continuedInput: true,
      continuedMeasurement: 17,
      retiredSupervisor: true,
      taskExecutionOwners: 1,
      taskStillOpen: true,
      freshInput: true,
      providerCalls: calls.length,
      realModelCalls: 0,
    };
    writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally {
    closeDb(sb.stateDir);
  }
} catch (error) {
  throw providerError ?? error;
} finally {
  writeFileSync(join(output, "old-daemon.log"), sb.getLogs());
  writeFileSync(join(output, "candidate-daemon.log"), currentLog);
  if (current && current.exitCode === null && current.signalCode === null) {
    const stopped = new Promise<void>((done) => current!.once("close", () => done()));
    current.kill("SIGTERM");
    const force = setTimeout(() => current!.kill("SIGKILL"), 3000);
    await stopped;
    clearTimeout(force);
  }
  for (const entry of oldProcesses) if (alive(entry)) process.kill(entry.pid, "SIGKILL");
  await sb.close();
  server.closeAllConnections();
  await new Promise<void>((done) => server.close(() => done()));
}
