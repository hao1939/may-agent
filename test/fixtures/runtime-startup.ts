// Run only in a child process: module mocks must not affect other test files.
// Actual startup, inbox, registry, capacity and socket; external adapters and
// indefinite loops are stopped at their boundaries. No model call is made.
import assert from "node:assert/strict";
import { mock, spyOn } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeModel } from "./model.js";
import { closeAllDbs, getDb } from "../../src/lib/requests.js";
import { parseAppArgs } from "../../src/app/app-args.js";
import * as daemon from "../../src/app/daemon.js";
import * as inbox from "../../src/app/composition/app-inbox-runtime.js";
import * as interfaces from "../../src/app/interface-startup.js";
import * as background from "../../src/app/composition/background-startup.js";
import * as taskCapability from "../../src/app/core/tasks/app-task-capability.js";
import * as taskWorkers from "../../src/app/composition/workers/task-attempt-process.js";
import { HostMaintenance } from "../../src/app/adapters/maintenance/runtime.js";
import { getAgentMaintenance } from "../../src/app/agent-loader.js";
import * as agentLoader from "../../src/app/agent-loader.js";
import { DefinitionSourceReleaseStore } from "../../src/app/app-source-release.js";
import { AppRegistry } from "../../src/app/core/apps/registry.js";
import { discoverAppDefinitions } from "../../src/app/adapters/discovery/app-definitions.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { AppTaskController } from "../../src/app/core/tasks/controller.js";
import {
  attachLoadedAppTask,
  readLoadedAppTaskInputResult,
  closeInstalledAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} from "../../src/app/core/tasks/app-task-runtime.js";

const actualDaemon = { ...daemon };
const actualInbox = { ...inbox };
const actualInterfaces = { ...interfaces };
const actualBackground = { ...background };
const actualTaskCapability = { ...taskCapability };
const actualTaskWorkers = { ...taskWorkers };

const root = mkdtempSync(join(tmpdir(), "may-startup-"));
const mode = process.argv[2];
const tty = mode === "tty";
const noInterfaces = mode === "no-interfaces";
const schedulesEnabled = mode === "headless" || noInterfaces;
const startupJob = mode === "startup-job";
const activationFailure = mode === "activation-failure";
const reportingFailure = mode === "reporting-failure";
const workerPublication = mode === "worker-publication";
const identityReload = mode === "identity-reload";
const legacyAppId = "scout-knowledge-lib";
const canonicalAppId = "scout-lib";
const startupAppId = identityReload ? legacyAppId : "fixture";
let publicationPause:
  | {
      entered: ReturnType<typeof Promise.withResolvers<void>>;
      release: ReturnType<typeof Promise.withResolvers<void>>;
      reject: boolean;
    }
  | undefined;
let dispatchedSource: taskWorkers.TaskWorkerDefinitionSource | undefined;
const taskExecution = activationFailure || reportingFailure || noInterfaces || identityReload;
let reportingCalls = 0;
const agentNames = activationFailure ? ["may", "aux"] : ["may"];
const order: string[] = [];
let runtime: inbox.AppInboxRuntime | undefined;
let registry: Parameters<typeof inbox.startAppInboxRuntime>[0]["registry"] | undefined;
let socket: interfaces.InterfaceRuntime | undefined;
let interfaceOptions: interfaces.InterfaceStartupOptions | undefined;
let lifecycle: ReturnType<typeof daemon.createDaemonLifecycle> | undefined;
let stopTasks: (() => void) | undefined;
let sharedCapacity: Parameters<typeof daemon.prepareDaemonAgents>[0]["hostCapacity"];
let preparedOptions: Parameters<typeof daemon.prepareDaemonAgents>[0];
let failActivation = false;
const partiallyAttached: HostMaintenance[] = [];
let attemptFinished = Promise.withResolvers<void>();
let cleanupIdentityGate = () => {};
let cleanupIdentityRecovery = () => {};
Object.defineProperty(process.stdin, "isTTY", { value: tty });
process.env.MAY_HOST_MAX_CONCURRENT = "2";
process.env.MAY_DAEMON_QUIET = "1";

if (workerPublication) {
  mock.module("../../src/app/core/tasks/app-task-capability.js", () => ({
    ...actualTaskCapability,
    createAppTaskCapability: (options: Parameters<typeof taskCapability.createAppTaskCapability>[0]) => {
      const capability = actualTaskCapability.createAppTaskCapability(options);
      return {
        ...capability,
        prepareGeneration: async (input: Parameters<typeof capability.prepareGeneration>[0]) => {
          const result = await capability.prepareGeneration(input);
          // Hold yielding worker preparation before the synchronous publication
          // turn. A rejected preparation must never expose its source pair.
          const pause = publicationPause;
          if (pause) {
            pause.entered.resolve();
            await pause.release.promise;
            if (pause.reject) throw new Error("fixture rejects prepared generation");
          }
          return result;
        },
      };
    },
  }));
  mock.module("../../src/app/composition/workers/task-attempt-process.js", () => ({
    ...actualTaskWorkers,
    createTaskAttemptProcessExecutor: (options: Parameters<typeof taskWorkers.createTaskAttemptProcessExecutor>[0]) =>
      actualTaskWorkers.createTaskAttemptProcessExecutor({
        ...options,
        // Exercise actual dispatch and isolated App discovery. This probe reports
        // loaded App IDs; it does not claim to execute a domain Task.
        spawnWorker: (request) => {
          dispatchedSource = request.definitionSource;
          return spawn(
            process.execPath,
            [
              "-e",
              `
            import { AppRegistry } from ${JSON.stringify(new URL("../../src/app/core/apps/registry.ts", import.meta.url).href)};
            import { discoverAppDefinitions } from ${JSON.stringify(new URL("../../src/app/adapters/discovery/app-definitions.ts", import.meta.url).href)};
            const source = ${JSON.stringify(request.definitionSource)};
            const registry = new AppRegistry(discoverAppDefinitions(source.projectsRoot, ${JSON.stringify(join(root, "projects"))}, {}, source.appDirectories));
            await registry.reload();
            process.send({ kind: "result", dependentTaskIds: registry.entries().map(entry => entry.definition.id).sort() });
            process.disconnect();
          `,
            ],
            { stdio: ["ignore", "ignore", "inherit", "ipc"], serialization: "json" },
          );
        },
      }),
  }));
}

const subscribeToBus = HostMaintenance.prototype.subscribeToBus;
const closeCron = HostMaintenance.prototype.close;
const closedCrons = new Set<HostMaintenance>();
const retirement = spyOn(HostMaintenance.prototype, "close").mockImplementation(function () {
  closedCrons.add(this);
  closeCron.call(this);
});
const subscription = spyOn(HostMaintenance.prototype, "subscribeToBus").mockImplementation(function (bus) {
  assert.ok(order.includes("ingress"), "producers must not activate during definition loading");
  assert.ok(this.hasHandler("startup-probe"), "handlers must be prepared before their routes attach");
  order.push("triggers");
  subscribeToBus.call(this, bus);
  if (failActivation) {
    partiallyAttached.push(this);
    if (partiallyAttached.length === 2) throw new Error("fixture producer activation failed");
  }
});

mock.module("../../src/app/daemon.js", () => ({
  ...actualDaemon,
  prepareDaemonAgents: async (options: Parameters<typeof daemon.prepareDaemonAgents>[0]) => {
    assert.equal(options.taskRuntimeMode, "controllers");
    assert.equal(options.cronEnabled, schedulesEnabled);
    sharedCapacity = options.hostCapacity;
    preparedOptions = options;
    return actualDaemon.prepareDaemonAgents(
      taskExecution
        ? {
            ...options,
            // Real Task controller, workflow and persistence. Process transport is
            // covered separately; execute the bounded attempt locally in this fixture.
            executeTaskAttempt: async (input) => {
              const result = await reconcileLoadedAppTaskOnce({ ...input, bus: options.bus });
              attemptFinished.resolve();
              return result;
            },
            executeTaskRecovery: undefined,
          }
        : options,
    );
  },
  createDaemonLifecycle: (options: Parameters<typeof daemon.createDaemonLifecycle>[0]) => {
    stopTasks = options.beforeShutdown;
    lifecycle = actualDaemon.createDaemonLifecycle(options);
    return { ...lifecycle, installProcessHandlers() {} };
  },
  startInitialTask: async (options: Parameters<typeof daemon.startInitialTask>[0]) => {
    assert.equal(Boolean(options.interactiveMode), tty);
    if (startupJob) {
      const run = spyOn(options.manager, "run").mockReturnValue("fixture-startup");
      const wait = spyOn(options.manager, "waitForIdle").mockImplementation(async () => {
        assert.ok(order.includes("background"), "a pending startup job must not gate Task recovery");
        assert.ok(order.includes("recovered-work"), "inbox recovery must already be active");
        order.push("startup-job");
      });
      try {
        return await actualDaemon.startInitialTask(options);
      } finally {
        run.mockRestore();
        wait.mockRestore();
      }
    }
    return actualDaemon.startInitialTask(options);
  },
  runDaemonKeepalive: async () => {
    order.push("keepalive");
  },
  runInteractiveLoop: async () => {
    order.push("interactive");
  },
}));
mock.module("../../src/app/transport/console.js", () => ({
  attachConsoleUI: () => {
    order.push("console");
  },
}));
mock.module("../../src/app/transport/telegram.js", () => ({
  attachTelegramBot: () => {
    order.push("telegram");
    return { close() {} };
  },
}));
mock.module("../../src/app/composition/app-inbox-runtime.js", () => ({
  ...actualInbox,
  startAppInboxRuntime: async (options: Parameters<typeof inbox.startAppInboxRuntime>[0]) => {
    registry = options.registry;
    assert.equal(options.deferStart, true);
    assert.equal(options.schedulesEnabled, schedulesEnabled);
    assert.equal("hostCapacity" in options, false);
    const first = sharedCapacity!.tryAcquireForeground();
    const second = sharedCapacity!.tryAcquireForeground();
    assert.ok(first && second);
    assert.equal(sharedCapacity!.tryAcquireForeground(), null);
    first();
    second();
    runtime = await actualInbox.startAppInboxRuntime(options);
    order.push("routes");
    return {
      ...runtime,
      start: async () => {
        assert.ok(socket);
        assert.equal(existsSync(socket!.socketPath), !noInterfaces);
        order.push("recovered-work");
        await runtime!.start();
      },
    };
  },
}));
mock.module("../../src/app/interface-startup.js", () => ({
  ...actualInterfaces,
  startInterfaceRuntime: async (options: interfaces.InterfaceStartupOptions) => {
    interfaceOptions = options;
    assert.ok(runtime?.host.hasApp(startupAppId));
    assert.deepEqual(
      order.filter((step) => step !== "console"),
      ["routes", ...(noInterfaces ? [] : ["telegram"])],
    );
    socket = await actualInterfaces.startInterfaceRuntime(options);
    order.push("ingress");
    return socket;
  },
}));
// Startup-only modes observe ordering. The rollback mode also opens real Task
// controllers and executes a bounded workflow, without spawning model workers.
mock.module("../../src/app/composition/background-startup.js", () => ({
  ...actualBackground,
  startBackgroundRuntime: (options: background.BackgroundRuntimeOptions) => {
    order.push("background");
    if (taskExecution) actualBackground.startBackgroundRuntime(options);
  },
}));

try {
  for (const dir of ["agents/may/handlers", "shared", "projects/fixture.app"])
    mkdirSync(join(root, dir), { recursive: true });
  for (const agent of agentNames) {
    mkdirSync(join(root, "agents", agent, "handlers"), { recursive: true });
    writeFileSync(
      join(root, "agents", agent, "agent.json"),
      JSON.stringify({
        name: agent,
        description: "Startup fixture",
        domain: "test",
        model: "fixture",
        tools: ["cron"],
      }),
    );
    writeFileSync(join(root, "agents", agent, "AGENTS.md"), "Fixture agent.\n");
    writeFileSync(
      join(root, "agents", agent, "cron.json"),
      JSON.stringify([{ name: "startup-probe", handler: "startup-probe", on: ["fixture.changed"] }]),
    );
    writeFileSync(
      join(root, "agents", agent, "handlers/startup-probe.ts"),
      `export function create(ctx) { return async () => ctx.sdk.emit("fixture.handler-ran", { agent: ${JSON.stringify(agent)} }); }\n`,
    );
  }
  if (taskExecution) {
    mkdirSync(join(root, "projects/fixture.app/tasks"));
    writeFileSync(
      join(root, "projects/fixture.app/tasks/seed.json"),
      JSON.stringify({
        root_task_id: "fixture",
        groups: { fixture: { id: "fixture", parent_id: null, agent: "may", children: [] } },
      }),
    );
    mkdirSync(join(root, "agents/may/workflows"));
    writeFileSync(
      join(root, "agents/may/workflows/reload-probe.ts"),
      `
export const name = "reload-probe";
export const description = "Complete fixture work without a model.";
export async function execute(ctx) {
  globalThis.__mayReloadProbeStarted?.();
  await globalThis.__mayReloadProbeWait?.();
  return ctx.done("fixture result", { state: "converged", summary: "Task processing remains active", facts: ["fixture"] });
}`,
    );
  }
  const appPath = join(root, "projects/fixture.app/app.js");
  const appSource = (description: string, appId = startupAppId, previousIds: string[] = []) => `export default {
    id: ${JSON.stringify(appId)}, ${previousIds.length > 0 ? `previousIds: ${JSON.stringify(previousIds)}, ` : ""}version: 1, agent: "may", description: ${JSON.stringify(description)},
    inputSchema: { type: "object" }
    ${taskExecution ? ', workspace: { kind: "local", localPath: "." }, tasks: {}' : ""}
  };`;
  writeFileSync(appPath, appSource("before"));
  const { runAppRuntime } = await import("../../src/app/app-runtime.js");
  await runAppRuntime({
    ...(reportingFailure
      ? {
          reporting: {
            readMetric: async () => {
              throw new Error("fixture report unavailable");
            },
            readOutcomes: () => {
              throw new Error("fixture report unavailable");
            },
            syncDefinitions() {
              reportingCalls++;
              throw new Error("fixture report unavailable");
            },
          },
        }
      : {}),
    appArgs: parseAppArgs(
      [
        "bun",
        "may",
        ...(noInterfaces ? [] : ["--console", "--socket", "--telegram"]),
        ...(schedulesEnabled ? ["--cron"] : []),
        ...(startupJob ? ["--task", "fixture startup job"] : []),
      ],
      {},
    ),
    models: { fixture: fakeModel() },
    projectRoot: root,
    agentsRoot: join(root, "agents"),
    sharedRoot: join(root, "shared"),
    projectsRoot: join(root, "projects"),
    persistDir: join(root, "state"),
    instance: "fixture",
    instanceLabel: "fixture",
    processStartTime: Date.now(),
    writeIdentity() {},
  });
  assert.deepEqual(
    order,
    tty
      ? ["console", "routes", "telegram", "ingress", "triggers", "recovered-work", "background", "interactive"]
      : [
          "routes",
          ...(noInterfaces ? [] : ["telegram"]),
          "ingress",
          ...agentNames.map(() => "triggers"),
          "recovered-work",
          "background",
          ...(startupJob ? ["startup-job"] : []),
          "keepalive",
        ],
  );

  // The caller's actual reload callback, not a source-string assertion. The
  // registry/task transaction's rejection and rollback matrix lives with it.
  let legacyTaskId: string | undefined;
  let inFlightTaskId: string | undefined;
  let quiescenceEntered: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  let releaseInFlight: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  if (identityReload) {
    const { bus } = preparedOptions!;
    legacyTaskId = "work/legacy";
    attemptFinished = Promise.withResolvers<void>();
    const profiled = Promise.withResolvers<void>();
    const detach = bus.subscribe((event) => {
      if (
        event.type === "project.task.reconcile.profiled" &&
        (event.data as { taskId?: string }).taskId === legacyTaskId
      ) {
        profiled.resolve();
      }
    });
    attachLoadedAppTask({
      bus,
      appDir: join(root, "projects/fixture.app"),
      appId: legacyAppId,
      idempotencyKey: legacyTaskId,
      inputContext: {
        id: legacyTaskId,
        source: { kind: "human", id: "fixture" },
        input: { kind: "probe", data: {} },
      },
      attachment: {
        kind: "desired",
        intent: {
          id: legacyTaskId,
          parentId: "fixture",
          workflow: "reload-probe",
          outcome: "Verify App identity migration during reload",
          acceptance: ["Legacy Task remains readable under the canonical App id"],
        },
      },
    });
    await Promise.all([attemptFinished.promise, profiled.promise]);
    detach();
    assert.ok(interfaceOptions!.getAppTask?.(legacyAppId, legacyTaskId));

    const originalActivate = DefinitionSourceReleaseStore.prototype.activate;
    const rejectedPublication = spyOn(DefinitionSourceReleaseStore.prototype, "activate").mockImplementation(
      function (source) {
        const result = originalActivate.call(this, source);
        if (readFileSync(join(source.projectsRoot, "fixture.app/app.js"), "utf8").includes("rejected identity")) {
          throw new Error("fixture rejects renamed source publication");
        }
        return result;
      },
    );
    try {
      const beforeRename = registry!.snapshot();
      writeFileSync(appPath, appSource("rejected identity", canonicalAppId, [legacyAppId]));
      const rejected = await lifecycle!.handleReload();
      assert.equal(rejected.ok, false);
      assert.match(rejected.summary, /fixture rejects renamed source publication/);
      assert.equal(registry!.snapshot(), beforeRename);
      assert.ok(interfaceOptions!.getAppTask?.(legacyAppId, legacyTaskId));
      assert.throws(
        () => interfaceOptions!.getAppTask?.(canonicalAppId, legacyTaskId!),
        /App scout-lib has no loaded Task runtime/,
      );
      assert.deepEqual(
        getDb(join(root, "state")).prepare("SELECT app_id, task_id FROM app_tasks WHERE task_id = ?").all(legacyTaskId),
        [{ app_id: legacyAppId, task_id: legacyTaskId }],
        "a rejected generation must roll the identity migration back",
      );
    } finally {
      rejectedPublication.mockRestore();
    }

    inFlightTaskId = "work/in-flight";
    const workflowStarted = Promise.withResolvers<void>();
    releaseInFlight = Promise.withResolvers<void>();
    const fixtureGlobal = globalThis as typeof globalThis & {
      __mayReloadProbeStarted?: () => void;
      __mayReloadProbeWait?: () => Promise<void>;
    };
    fixtureGlobal.__mayReloadProbeStarted = () => workflowStarted.resolve();
    fixtureGlobal.__mayReloadProbeWait = () => releaseInFlight!.promise;
    quiescenceEntered = Promise.withResolvers<void>();
    const originalWhenIdle = AppTaskController.prototype.whenIdle;
    const quiescence = spyOn(AppTaskController.prototype, "whenIdle").mockImplementation(function () {
      quiescenceEntered!.resolve();
      return originalWhenIdle.call(this);
    });
    cleanupIdentityGate = () => {
      releaseInFlight?.resolve();
      delete fixtureGlobal.__mayReloadProbeStarted;
      delete fixtureGlobal.__mayReloadProbeWait;
      quiescence.mockRestore();
    };
    attachLoadedAppTask({
      bus,
      appDir: join(root, "projects/fixture.app"),
      appId: legacyAppId,
      idempotencyKey: inFlightTaskId,
      inputContext: {
        id: inFlightTaskId,
        source: { kind: "human", id: "fixture" },
        input: { kind: "probe", data: {} },
      },
      attachment: {
        kind: "desired",
        intent: {
          id: inFlightTaskId,
          parentId: "fixture",
          workflow: "reload-probe",
          outcome: "Finish work admitted before the App rename",
          acceptance: ["The in-flight result is accepted under the canonical App identity"],
        },
      },
    });
    await workflowStarted.promise;

    let recoveryQueries = 0;
    const originalListTaskIdsByPhase = AppTaskResourceStore.prototype.listTaskIdsByPhase;
    const rejectedRecovery = spyOn(AppTaskResourceStore.prototype, "listTaskIdsByPhase").mockImplementation(
      function (phases, limit) {
        const result = originalListTaskIdsByPhase.call(this, phases, limit);
        if (this.appId === canonicalAppId && ++recoveryQueries === 1) {
          bus.emit({
            type: "fixture.task.recovery.side-effect",
            source: "fixture",
            owner: "runtime",
            data: { appId: canonicalAppId },
          });
        } else if (this.appId === canonicalAppId && recoveryQueries === 2) {
          throw new Error("fixture rejects renamed task recovery after side effect");
        }
        return result;
      },
    );
    cleanupIdentityRecovery = () => rejectedRecovery.mockRestore();
  }
  writeFileSync(appPath, identityReload ? appSource("after", canonicalAppId, [legacyAppId]) : appSource("after"));
  assert.equal(registry!.entries()[0]?.definition.description, "before");
  const firstReloadPromise = lifecycle!.handleReload();
  if (identityReload) {
    await quiescenceEntered!.promise;
    assert.equal(registry!.entries()[0]?.definition.id, legacyAppId, "rename waits for the old attempt to finish");
    assert.deepEqual(
      getDb(join(root, "state")).prepare("SELECT app_id, task_id FROM app_tasks WHERE task_id = ?").all(inFlightTaskId),
      [{ app_id: legacyAppId, task_id: inFlightTaskId }],
      "identity migration must not run while an old-ID attempt is active",
    );
    releaseInFlight!.resolve();
  }
  const firstReload = await firstReloadPromise;
  cleanupIdentityGate();
  cleanupIdentityGate = () => {};
  assert.equal(firstReload.ok, true, firstReload.summary);
  assert.equal(
    subscription.mock.calls.length,
    agentNames.length * 2,
    "activation includes startup and the committed reload",
  );
  assert.equal(registry!.entries()[0]?.definition.description, "after");
  assert.ok(runtime!.host.hasApp(identityReload ? canonicalAppId : "fixture"));
  if (identityReload) {
    const canonicalTask = interfaceOptions!.getAppTask?.(canonicalAppId, legacyTaskId!);
    assert.ok(canonicalTask, "the migrated Task must be readable under the canonical App id");
    assert.deepEqual(
      interfaceOptions!.getAppTask?.(legacyAppId, legacyTaskId!),
      canonicalTask,
      "the previous App id remains a read alias for the canonical Task",
    );
    assert.equal(registry!.canonicalId(legacyAppId), canonicalAppId);
    assert.equal(
      registry!.entries().some((entry) => entry.definition.id === legacyAppId),
      false,
    );
    assert.deepEqual(
      getDb(join(root, "state")).prepare("SELECT app_id, task_id FROM app_tasks WHERE task_id = ?").all(legacyTaskId),
      [{ app_id: canonicalAppId, task_id: legacyTaskId }],
      "persistence must contain one canonical Task, not a second legacy resource",
    );
    const recoveryEvents = getDb(join(root, "state"))
      .prepare(
        "SELECT event_type, data FROM events WHERE event_type IN ('fixture.task.recovery.side-effect', 'handler.failed') ORDER BY id",
      )
      .all() as Array<{ event_type: string; data: string }>;
    assert.ok(
      recoveryEvents.some(({ event_type }) => event_type === "fixture.task.recovery.side-effect"),
      "the recovery side effect remains committed when later recovery work fails",
    );
    const recoveryFailure = recoveryEvents.find(({ event_type, data }) => {
      if (event_type !== "handler.failed") return false;
      const failure = JSON.parse(data) as { stage?: string; disposition?: string };
      return failure.stage === "task-recovery" && failure.disposition === "recovery-pending";
    });
    assert.ok(recoveryFailure, "post-commit recovery failure must emit a recovery-pending diagnostic");
    assert.match(JSON.parse(recoveryFailure.data).error, /fixture rejects renamed task recovery after side effect/);
    assert.equal(
      readLoadedAppTaskInputResult({
        bus: preparedOptions!.bus,
        appDir: join(root, "projects/fixture.app"),
        taskId: inFlightTaskId!,
        admissionKey: inFlightTaskId!,
      })?.state,
      "converged",
      "the attempt that began under the old id must finish before migration and remain accepted",
    );
  }
  const accepted = registry!.snapshot();
  writeFileSync(appPath, "export default { invalid: true };");
  assert.equal((await lifecycle!.handleReload()).ok, false);
  assert.equal(
    subscription.mock.calls.length,
    agentNames.length * 2,
    "rejected definitions must not activate",
  );
  assert.equal(registry!.snapshot(), accepted);
  assert.ok(runtime!.host.hasApp(identityReload ? canonicalAppId : "fixture"));
  if (mode === "overlapping-reloads" || mode === "overlapping-preparation") {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const queued = Promise.withResolvers<void>();
    const originalReload = registry!.reload.bind(registry);
    const originalPrepare = agentLoader.prepareAgentGeneration;
    const originalActivate = DefinitionSourceReleaseStore.prototype.activate;
    let reloadCount = 0;
    let prepareCount = 0;
    const reload = spyOn(registry!, "reload").mockImplementation((apply, discover) => {
      const index = ++reloadCount;
      if (index === 2) queued.resolve();
      return originalReload(async (snapshot) => {
        if (mode === "overlapping-reloads" && index === 1) {
          entered.resolve();
          await release.promise;
        }
        await apply?.(snapshot);
      }, discover);
    });
    const prepare = spyOn(agentLoader, "prepareAgentGeneration").mockImplementation(async (options) => {
      const result = await originalPrepare(options);
      if (mode === "overlapping-preparation" && ++prepareCount === 1) {
        entered.resolve();
        await release.promise;
      }
      return result;
    });
    const publication = spyOn(DefinitionSourceReleaseStore.prototype, "activate").mockImplementation(function (source) {
      const result = originalActivate.call(this, source);
      if (readFileSync(join(source.projectsRoot, "fixture.app/app.js"), "utf8").includes("rejected overlap")) {
        throw new Error("fixture rejects publication after source activation");
      }
      return result;
    });
    try {
      writeFileSync(appPath, appSource("accepted overlap"));
      const first = lifecycle!.handleReload();
      await entered.promise;
      writeFileSync(appPath, appSource("rejected overlap"));
      const second = lifecycle!.handleReload();
      if (mode === "overlapping-reloads") await queued.promise;
      else assert.equal((await second).ok, false);
      release.resolve();
      assert.equal((await first).ok, true);
      const failed = await second;
      assert.equal(failed.ok, false);
      assert.match(failed.summary, /fixture rejects publication after source activation/);
      assert.equal(registry!.snapshot().generation, accepted.generation + 1);
      assert.equal(registry!.entries()[0]?.definition.description, "accepted overlap");
      const activeSource = new DefinitionSourceReleaseStore(root, join(root, "state")).current()!;
      const workerRegistry = new AppRegistry(discoverAppDefinitions(activeSource.projectsRoot, join(root, "projects")));
      await workerRegistry.reload();
      assert.equal(
        workerRegistry.entries()[0]?.definition.description,
        "accepted overlap",
        "fresh workers must load the same source as the committed registry",
      );
    } finally {
      release.resolve();
      reload.mockRestore();
      prepare.mockRestore();
      publication.mockRestore();
    }
  }
  if (workerPublication) {
    const enabledDir = join(root, "projects/enabled.app");
    const excludedDir = join(root, "projects/excluded.app");
    mkdirSync(enabledDir, { recursive: true });
    mkdirSync(excludedDir, { recursive: true });
    writeFileSync(
      join(enabledDir, "app.js"),
      'export default { id: "enabled", version: 1, agent: "may", inputSchema: { type: "object" } };',
    );
    writeFileSync(join(excludedDir, "app.js"), 'throw new Error("excluded App must not import");');
    writeFileSync(join(excludedDir, ".disabled"), "");
    writeFileSync(appPath, appSource("worker publication"));
    const probe = () =>
      preparedOptions.executeTaskAttempt!({
        appId: "enabled",
        taskId: "probe",
        dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
      });
    for (const reject of [false, true]) {
      if (reject) writeFileSync(join(enabledDir, ".disabled"), "");
      const previousSource = new DefinitionSourceReleaseStore(root, join(root, "state")).current()!;
      // A marker-only change can reuse an immutable release. Rollback must
      // restore the selection even when the source ID itself does not change.
      const staging = reject
        ? spyOn(DefinitionSourceReleaseStore.prototype, "stage").mockReturnValue(previousSource)
        : undefined;
      const before = registry!.snapshot();
      const beforeProbe = await probe();
      publicationPause = { entered: Promise.withResolvers<void>(), release: Promise.withResolvers<void>(), reject };
      const reload = lifecycle!.handleReload();
      try {
        await publicationPause.entered.promise;
        assert.equal(registry!.snapshot(), before, "dispatch occurs before the public registry advances");
        // Changing the live marker after preparation cannot change this selection.
        rmSync(join(excludedDir, ".disabled"));
        assert.deepEqual(await probe(), beforeProbe, "preparation cannot expose the candidate worker source");
        assert.equal(
          dispatchedSource!.projectsRoot,
          new DefinitionSourceReleaseStore(root, join(root, "state")).current()!.projectsRoot,
        );
      } finally {
        writeFileSync(join(excludedDir, ".disabled"), "");
        publicationPause.release.resolve();
      }
      const result = await reload;
      staging?.mockRestore();
      publicationPause = undefined;
      assert.equal(result.ok, !reject);
      if (reject) {
        assert.match(result.summary, /fixture rejects prepared generation/);
        assert.equal(registry!.snapshot(), before);
        assert.equal(new DefinitionSourceReleaseStore(root, join(root, "state")).current()!.id, previousSource.id);
      }
      assert.deepEqual(await probe(), ["enabled", "fixture"], "workers use the complete accepted or restored pair");
    }
  }
  if (taskExecution && !identityReload) {
    const { bus, manager } = preparedOptions!;
    const acceptedState = (taskId: string) =>
      readLoadedAppTaskInputResult({
        bus,
        appDir: join(root, "projects/fixture.app"),
        taskId,
        admissionKey: taskId,
      })?.state;
    const runTask = async (taskId: string) => {
      attemptFinished = Promise.withResolvers<void>();
      const profiled = Promise.withResolvers<void>();
      const detach = bus.subscribe((event) => {
        if (event.type === "project.task.reconcile.profiled" && (event.data as { taskId?: string }).taskId === taskId) {
          profiled.resolve();
        }
      });
      const task = attachLoadedAppTask({
        bus,
        appDir: join(root, "projects/fixture.app"),
        appId: "fixture",
        idempotencyKey: taskId,
        inputContext: { id: taskId, source: { kind: "human", id: "fixture" }, input: { kind: "probe", data: {} } },
        attachment: {
          kind: "desired",
          intent: {
            id: taskId,
            parentId: "fixture",
            workflow: "reload-probe",
            outcome: "Verify reload preserves Task processing",
            acceptance: ["Fixture result accepted"],
          },
        },
      });
      await Promise.all([attemptFinished.promise, profiled.promise]);
      detach();
      assert.equal(acceptedState(task.taskId), "converged");
      return task;
    };
    const previousTask = await runTask("work/before");
    if (!activationFailure) {
      const before = reportingCalls;
      writeFileSync(appPath, appSource("reporting failure cannot reject this"));
      assert.equal((await lifecycle!.handleReload()).ok, true);
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (reportingFailure) assert.ok(reportingCalls > before, "the failing report must actually execute");
      assert.equal(registry!.entries()[0]?.definition.description, "reporting failure cannot reject this");
      assert.equal(acceptedState(previousTask.taskId), "converged");
      await runTask("work/after");
    } else {
      const previousCrons = new Map(getAgentMaintenance());
      const previousDefinitions = agentNames.map((name) => manager.getAgentDefinition(name));
      writeFileSync(appPath, appSource("must roll back"));
      failActivation = true;
      const failed = await lifecycle!.handleReload();
      failActivation = false;
      assert.equal(failed.ok, false);
      assert.equal(partiallyAttached.length, 2, "failure occurs after new producers actually attach");
      assert.equal(registry!.snapshot(), accepted);
      assert.equal(registry!.entries()[0]?.definition.description, "after");
      assert.deepEqual(
        agentNames.map((name) => manager.getAgentDefinition(name)),
        previousDefinitions,
      );
      for (const [name, cron] of previousCrons) {
        assert.equal(getAgentMaintenance().get(name), cron);
        assert.equal(closedCrons.has(cron), false, "rollback must not retire the previous generation");
      }
      for (const cron of partiallyAttached) assert.ok(closedCrons.has(cron), "partial replacements must be retired");
      const seen: string[] = [];
      let completed = 0;
      let settled = Promise.withResolvers<void>();
      const detach = bus.subscribe((event) => {
        if (event.type === "fixture.handler-ran") seen.push(String((event.data as { agent: string }).agent));
        if (event.type === "handler.completed" && (event.data as { handler?: string }).handler === "startup-probe") {
          if (++completed >= agentNames.length) settled.resolve();
        }
      });
      for (let i = 0; i < 2; i++) {
        completed = 0;
        settled = Promise.withResolvers<void>();
        bus.emit({ type: "fixture.changed", source: "fixture", owner: "agent:may", data: {} });
        await settled.promise;
        await Bun.sleep(0);
      }
      detach();
      assert.deepEqual(seen.sort(), [...agentNames, ...agentNames].sort());
      assert.equal(seen.length, 4, "only the two old producers handle each event, exactly once");
      assert.equal(acceptedState(previousTask.taskId), "converged", "accepted work survives rollback");
      await runTask("work/after");
    }
  }
  console.log("startup-contract-ok");
} finally {
  cleanupIdentityGate();
  cleanupIdentityRecovery();
  subscription.mockRestore();
  for (const cron of getAgentMaintenance().values()) cron.close();
  retirement.mockRestore();
  if (preparedOptions!) await closeInstalledAppTaskRuntimes(preparedOptions.bus);
  stopTasks?.();
  runtime?.close();
  socket?.socketUI.close();
  closeAllDbs();
  rmSync(root, { recursive: true, force: true });
}
