import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../../src/lib/requests.js";
import { AppTaskResourceStore } from "../../../src/app/app-task-resource-store.js";
import { DefinitionSourceReleaseStore } from "../../../src/app/app-source-release.js";
import { appTaskContext, cancelAppTask } from "../../../src/app/app-task-reconciler.js";
import { attachEventPersistence } from "../../../src/app/daemon-events.js";
import { EventBus } from "../../../src/app/event-bus.js";
import {
  createTaskAttemptProcessExecutor,
  createTaskRecoveryProcessExecutor,
  type TaskAttemptProcessRequest,
} from "../../../src/app/task-attempt-process.js";

const roots: string[] = [];
const children: Array<{ child: ChildProcess; closed: Promise<void> }> = [];
async function cleanup() {
  await Promise.all(
    children.splice(0).map(async ({ child, closed }) => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      // A failed test must close its pipes before removing the worker's database.
      for (const pipe of child.stdio) pipe?.destroy();
      await closed;
    }),
  );
  for (const root of roots.splice(0)) {
    closeDb(join(root, ".state"));
    rmSync(root, { recursive: true, force: true });
  }
}

function fixture(agent: string, wait = false, workflow = true) {
  const root = mkdtempSync(join(tmpdir(), "may-task-worker-"));
  roots.push(root);
  const appDir = join(root, "projects", "sample.app");
  const persistDir = join(root, ".state");
  mkdirSync(join(root, "agents"), { recursive: true });
  mkdirSync(join(root, "shared", "skills"), { recursive: true });
  writeFileSync(join(root, "shared", "common-sense.md"), "Use fixture evidence only.\n");
  mkdirSync(appDir, { recursive: true });
  writeFileSync(
    join(appDir, "app.ts"),
    `export default {
    id: "sample", version: 1, agent: "owner", inputSchema: { type: "object" },
    workspace: { kind: "local", localPath: "." }, tasks: { maxConcurrent: 1 }
  };`,
  );
  for (const name of ["owner", "specialist"]) {
    const dir = join(appDir, "agents", name);
    mkdirSync(join(dir, "workflows"), { recursive: true });
    writeFileSync(
      join(dir, "agent.json"),
      JSON.stringify({
        name,
        description: "Deterministic worker fixture",
        domain: "test",
        model: "test",
        tools: [],
      }),
    );
    writeFileSync(join(dir, "AGENTS.md"), "Run only the declared fixture workflow.\n");
    writeFileSync(
      join(dir, "workflows", "probe.ts"),
      `
      export const name = "probe";
      export const description = "Deterministic process-boundary probe";
      export async function execute(ctx) {
        if (!ctx.input.wait) return ctx.done("done", {
          state: "converged", summary: "completed by " + ctx.reconciliation.agent, evidence: []
        });
        const feedback = new Promise(resolve => ctx.events.onEvent(event => {
          if (event.type === "worker.feedback") resolve();
        }));
        const target = { appId: "sample", taskId: "work/one" };
        await ctx.events.emit({ localKey: "ready", type: "worker.ready", target, data: {} });
        await feedback;
        await ctx.events.emit({ localKey: "feedback-seen", type: "worker.feedback.seen", target, data: {} });
        return new Promise(() => {}); // The Host's cancellation signal must end this bounded attempt.
      }
    `,
    );
  }
  const db = getDb(persistDir);
  const store = AppTaskResourceStore.fromDb(db, "sample");
  store.bootstrapSnapshot(
    {
      root_task_id: "root",
      project: "sample",
      project_lifecycle: "active",
      groups: { root: { id: "root", parent_id: null, owner: agent } },
      resources: {
        "work/one": {
          metadata: { id: "work/one", generation: 1, resourceVersion: 1 },
          spec: {
            parentId: "root",
            mode: "achieve",
            outcome: "Probe the worker boundary",
            acceptance: ["Fixture evidence"],
            ...(workflow ? { workflow: "probe" } : {}),
            input: { wait },
          },
          status: { phase: "pending", observedGeneration: 0, updatedAt: new Date().toISOString() },
        },
      },
    },
    "worker-fixture",
  );
  const bus = new EventBus();
  attachEventPersistence({ bus, persistDir });
  const request: TaskAttemptProcessRequest = {
    appId: "sample",
    taskId: "work/one",
    dispatch: { enqueuedAt: Date.now(), startedAt: Date.now(), readyWaitMs: 0, lane: "normal" },
  };
  return { root, appDir, persistDir, db, store, bus, request, child: undefined as ChildProcess | undefined };
}

function run(f: ReturnType<typeof fixture>, recovery = false, onOutput?: (output: string) => void): Promise<unknown> {
  let diagnostics = "";
  const worker = recovery ? "runTaskRecoveryWorker" : "runTaskAttemptWorker";
  const workerOptions = {
    bus: f.bus,
    timeoutMs: 5_000,
    spawnWorker: () => {
      const child = spawn(
        process.execPath,
        [
          "-e",
          `
        const { ${worker} } = await import(${JSON.stringify(new URL("../../../src/app/task-attempt-process.ts", import.meta.url).href)});
        await ${worker}({
          request: ${JSON.stringify(f.request)},
          roots: ${JSON.stringify({ projectRoot: f.root, projectsRoot: join(f.root, "projects"), sharedRoot: join(f.root, "shared"), persistDir: f.persistDir })},
          models: { test: { id: "test", name: "test", provider: "test", api: "openai-completions", apiKey: "fixture-only", baseUrl: "http://127.0.0.1:1", contextWindow: 8192, maxTokens: 1024, input: ["text"], cost: {} } }
        });
        process.exit(0);
      `,
        ],
        {
          cwd: f.root,
          env: { ...process.env, MAY_TASK_ATTEMPT_CHILD: "1" },
          stdio: ["ignore", "pipe", "pipe", "ipc"],
          serialization: "json",
        },
      );
      f.child = child;
      children.push({
        child,
        closed: new Promise<void>((resolveClosed) => child.once("close", () => resolveClosed())),
      });
      child.stdout?.on("data", (chunk) => {
        diagnostics += chunk.toString();
        onOutput?.(diagnostics);
      });
      child.stderr?.on("data", (chunk) => {
        diagnostics += chunk.toString();
      });
      return child;
    },
  };
  const execution = recovery
    ? createTaskRecoveryProcessExecutor(workerOptions)()
    : createTaskAttemptProcessExecutor(workerOptions)(f.request);
  return execution.catch((error) => {
    throw new Error(
      `${worker}: ${error}\n${diagnostics}\nChild: pid=${f.child?.pid}, exit=${f.child?.exitCode}, signal=${f.child?.signalCode}`,
    );
  });
}

const scenarios: Record<string, () => Promise<void>> = {
  async restoredAgent() {
    const f = fixture("specialist", false, false);
    const agentDir = join(f.appDir, "agents", "specialist");
    const savedDir = join(f.root, "saved-specialist");
    renameSync(agentDir, savedDir);
    await run(f);
    const task = f.store.readTask("work/one")!;
    assert.equal(task.status.phase, "attention");
    const before = f.store.readTaskContext({ taskIds: ["work/one"] });
    const attempt = Object.values(before.attempts ?? {})[0];
    assert.equal(attempt?.handler, "agent:specialist");
    assert.equal(attempt?.failureReason, "HandlerUnavailable");
    await run(f, true);
    assert.deepEqual(f.store.readTaskContext({ taskIds: ["work/one"] }), before);

    renameSync(savedDir, agentDir);
    const releases = new DefinitionSourceReleaseStore(f.root, f.persistDir);
    releases.activate(releases.stage());
    await run(f, true);
    assert.equal(f.store.readTask("work/one")?.status.phase, "pending");
    assert.equal(f.store.readTask("work/one")?.metadata.generation, task.metadata.generation);
    assert.deepEqual(f.store.readTaskContext({ taskIds: ["work/one"] }).attempts, before.attempts);
    assert.equal(f.store.readReceipt("work/one"), null);
    await run(f, true);
    assert.deepEqual(f.store.readTaskContext({ taskIds: ["work/one"] }).attempts, before.attempts);
    assert.equal(
      f.db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'project.task.handler.recovered'").get()
        ?.count,
      1,
    );
  },

  async recoverySourceRace() {
    const f = fixture("owner");
    const path = join(f.appDir, "agents", "owner", "workflows", "probe.ts");
    rmSync(path);
    await run(f);
    const before = f.store.readTaskContext({ taskIds: ["work/one"] });
    assert.equal(before.resources?.["work/one"]?.status.phase, "attention");
    const gate = join(f.root, "release-inspection");
    writeFileSync(
      path,
      `
import { watch, existsSync } from "node:fs";
await new Promise(resolve => {
  const watcher = watch(${JSON.stringify(f.root)}, () => {
    if (existsSync(${JSON.stringify(gate)})) { watcher.close(); resolve(); }
  });
  console.log("fixture-inspecting-restored-handler");
});
export const name = "probe";
export const description = "An inspection paused across source replacement";
export async function execute() { throw new Error("Recovery must not execute work"); }
`,
    );
    const releases = new DefinitionSourceReleaseStore(f.root, f.persistDir);
    releases.activate(releases.stage());
    // The next committed source removes the handler again while the child is
    // awaiting inspection of the earlier, repaired release.
    rmSync(path);
    const replacement = releases.stage();
    let replaced = false;
    await run(f, true, (output) => {
      if (replaced || !output.includes("fixture-inspecting-restored-handler")) return;
      replaced = true;
      releases.activate(replacement);
      writeFileSync(gate, "continue");
    });
    assert.equal(replaced, true, "the race must cross the real workflow inspection");
    assert.deepEqual(f.store.readTaskContext({ taskIds: ["work/one"] }), before);
    assert.equal(
      f.db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'project.task.handler.recovered'").get()
        ?.count,
      0,
    );
    await run(f, true);
    assert.deepEqual(f.store.readTaskContext({ taskIds: ["work/one"] }), before);
    writeFileSync(
      path,
      `export const name = "probe";
export const description = "Currently repaired handler";
export async function execute(ctx) {
  return ctx.done("verified", { state: "converged", summary: "current handler ran", evidence: [] });
}`,
    );
    releases.activate(releases.stage());
    await run(f, true);
    assert.equal(f.store.readTask("work/one")?.status.phase, "pending");
    await run(f);
    assert.equal(f.store.readReceipt("work/one")?.summary, "current handler ran");
  },

  async restoredHandler() {
    const f = fixture("owner");
    const path = join(f.appDir, "agents", "owner", "workflows", "probe.ts");
    rmSync(path);
    await run(f);
    const task = f.store.readTask("work/one")!;
    assert.equal(task.status.phase, "attention");
    const attempts = f.store.readTaskContext({ taskIds: ["work/one"] }).attempts;
    assert.equal(Object.values(attempts ?? {})[0]?.failureReason, "HandlerUnavailable");

    writeFileSync(
      path,
      `export const name = "probe";
export const description = "Repaired worker binding";
export async function execute(ctx) {
  return ctx.done("verified", { state: "converged", summary: "repaired workflow ran", evidence: [] });
}`,
    );
    const releases = new DefinitionSourceReleaseStore(f.root, f.persistDir);
    releases.activate(releases.stage());
    await run(f, true);
    assert.equal(f.store.readTask("work/one")?.status.phase, "pending");
    assert.equal(f.store.readTask("work/one")?.metadata.generation, task.metadata.generation);
    assert(f.store.listRecoveryCandidates().items.some(({ taskId }) => taskId === "work/one"));
    assert.equal(f.store.readReceipt("work/one"), null);
    assert.deepEqual(f.store.readTaskContext({ taskIds: ["work/one"] }).attempts, attempts);
    await run(f, true);
    assert.deepEqual(f.store.readTaskContext({ taskIds: ["work/one"] }).attempts, attempts);
    assert.equal(
      f.db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'project.task.handler.recovered'").get()
        ?.count,
      1,
    );

    await run(f);
    assert.equal(f.store.readReceipt("work/one")?.summary, "repaired workflow ran");
    assert.equal(f.store.readReceipt("work/one")?.metadata.generation, task.metadata.generation);
  },

  async parentLoss() {
    const f = fixture("owner", true);
    f.bus.subscribe((event) => {
      if (event.type === "worker.ready") f.child!.disconnect();
    });
    await assert.rejects(run(f), /code 143/);
    const attemptId = f.store.readTask("work/one")!.status.currentAttemptId!;
    assert.equal(f.store.readReceipt("work/one"), null);
    await run(f, true);
    assert.equal(f.store.readTask("work/one")?.status.phase, "pending");
    assert.equal(f.store.readAttempt(attemptId)?.state, "interrupted");
    assert(f.store.listRecoveryCandidates().items.some(({ taskId }) => taskId === "work/one"));
  },

  async pinnedSource() {
    const f = fixture("owner");
    writeFileSync(
      join(f.appDir, "agents", "owner", "workflows", "probe.ts"),
      `
      import { readFileSync } from "node:fs";
      export const name = "probe";
      export const description = "Captured workflow and shared definitions";
      export async function execute(ctx) {
        return ctx.done("done", {
          state: "converged",
          summary: "original workflow: " + readFileSync(new URL("../../../../../shared/common-sense.md", import.meta.url), "utf8").trim(),
          evidence: []
        });
      }
    `,
    );
    const releases = new DefinitionSourceReleaseStore(f.root, f.persistDir);
    const first = releases.ensureCurrent();
    f.request.definitionSource = first;
    writeFileSync(join(f.root, "shared", "common-sense.md"), "replacement shared definitions\n");
    writeFileSync(
      join(f.appDir, "agents", "owner", "workflows", "probe.ts"),
      `
      export const name = "probe";
      export const description = "Replacement source";
      export async function execute(ctx) {
        return ctx.done("new", { state: "converged", summary: "new source", evidence: [] });
      }
    `,
    );
    releases.activate(releases.stage());
    await run(f);
    assert.equal(f.store.readReceipt("work/one")?.summary, "original workflow: Use fixture evidence only.");
  },

  async inheritedAgent() {
    const f = fixture("specialist");
    await run(f);
    assert.equal(f.store.readTask("work/one"), null);
    assert.equal(f.store.readReceipt("work/one")?.summary, "completed by specialist");
  },

  async liveControl() {
    const f = fixture("owner", true);
    let ready!: () => void;
    let feedback!: () => void;
    const readyEvent = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const feedbackEvent = new Promise<void>((resolve) => {
      feedback = resolve;
    });
    f.bus.subscribe((event) => {
      if (event.type === "worker.ready") ready();
      if (event.type === "worker.feedback.seen") feedback();
    });
    const execution = run(f);
    const prematureExit = execution.then(() => {
      throw new Error("Worker exited before the control probe");
    });
    await Promise.race([readyEvent, prematureExit]);
    const target = { appId: "sample", taskId: "work/one" };
    f.bus.emit({
      type: "worker.feedback",
      source: "test",
      owner: "app:sample",
      target,
      data: { text: "Keep the same Task" },
    });
    await Promise.race([feedbackEvent, prematureExit]);
    const task = f.store.readTask("work/one")!;
    const result = cancelAppTask(
      appTaskContext({
        appDir: f.appDir,
        projectDir: f.appDir,
        agent: "owner",
        maxConcurrent: 1,
        resourceStore: f.store,
      }),
      {
        ...target,
        expectedGeneration: task.metadata.generation,
        expectedResourceVersion: task.metadata.resourceVersion,
        reason: "Fixture cancellation",
      },
    );
    f.bus.emit({
      type: "app.task.cancelled",
      source: "app-task-reconciler",
      owner: "human:operator",
      target,
      data: { attemptId: result.cancelledAttemptId, reason: "Fixture cancellation" },
    });
    await execution;
    assert.equal(f.store.readReceipt("work/one"), null);
    assert(f.store.readCancellation("work/one"));
    assert.deepEqual(
      f.db
        .prepare(
          "SELECT event_type, COUNT(*) AS count FROM events WHERE event_type IN ('worker.feedback', 'worker.feedback.seen', 'app.task.cancelled') GROUP BY event_type ORDER BY event_type",
        )
        .all(),
      [
        { event_type: "app.task.cancelled", count: 1 },
        { event_type: "worker.feedback", count: 1 },
        { event_type: "worker.feedback.seen", count: 1 },
      ],
    );
  },
};

export async function runScenario(name: string): Promise<void> {
  const scenario = scenarios[name];
  assert(scenario, "Expected a known Task worker scenario");
  try {
    await scenario();
  } finally {
    await cleanup();
  }
}

if (import.meta.main) await runScenario(process.argv[2]);
