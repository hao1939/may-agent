// Run only in a child process: module mocks must not affect other test files.
// Actual startup, inbox, registry, capacity and socket; external adapters and
// indefinite loops are stopped at their boundaries. No model call is made.
import assert from "node:assert/strict";
import { mock, spyOn } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeModel } from "./model.js";
import { closeAllDbs } from "../../src/lib/requests.js";
import { parseAppArgs } from "../../src/app/app-args.js";
import * as daemon from "../../src/app/daemon.js";
import * as inbox from "../../src/app/app-inbox-runtime.js";
import * as interfaces from "../../src/app/interface-startup.js";
import * as background from "../../src/app/composition/background-startup.js";
import { Cron } from "../../src/app/cron.js";
import { getAgentCrons } from "../../src/app/agent-loader.js";

const actualDaemon = { ...daemon };
const actualInbox = { ...inbox };
const actualInterfaces = { ...interfaces };
const actualBackground = { ...background };

const root = mkdtempSync(join(tmpdir(), "may-startup-"));
const mode = process.argv[2];
const tty = mode === "tty";
const schedulesEnabled = mode === "headless";
const startupJob = mode === "startup-job";
const order: string[] = [];
let runtime: inbox.AppInboxRuntime | undefined;
let registry: Parameters<typeof inbox.startAppInboxRuntime>[0]["registry"] | undefined;
let socket: interfaces.InterfaceRuntime | undefined;
let lifecycle: ReturnType<typeof daemon.createDaemonLifecycle> | undefined;
let stopTasks: (() => void) | undefined;
let sharedCapacity: Parameters<typeof daemon.prepareDaemonAgents>[0]["hostCapacity"];
Object.defineProperty(process.stdin, "isTTY", { value: tty });
process.env.MAY_HOST_MAX_CONCURRENT = "2";
process.env.MAY_DAEMON_QUIET = "1";

const subscribeToBus = Cron.prototype.subscribeToBus;
const subscription = spyOn(Cron.prototype, "subscribeToBus").mockImplementation(function (bus) {
  assert.ok(order.includes("ingress"), "producers must not activate during definition loading");
  assert.ok(this.hasHandler("startup-probe"), "handlers must be prepared before their routes attach");
  order.push("triggers");
  return subscribeToBus.call(this, bus);
});

mock.module("../../src/app/daemon.js", () => ({
  ...actualDaemon,
  prepareDaemonAgents: async (options: Parameters<typeof daemon.prepareDaemonAgents>[0]) => {
    assert.equal(options.taskRuntimeMode, "controllers");
    assert.equal(options.cronEnabled, schedulesEnabled);
    sharedCapacity = options.hostCapacity;
    return actualDaemon.prepareDaemonAgents(options);
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
mock.module("../../src/app/app-inbox-runtime.js", () => ({
  ...actualInbox,
  startAppInboxRuntime: async (options: Parameters<typeof inbox.startAppInboxRuntime>[0]) => {
    registry = options.registry;
    assert.equal(options.deferStart, true);
    assert.equal(options.schedulesEnabled, schedulesEnabled);
    assert.equal(options.maxConcurrentRequests, 2);
    assert.equal(options.hostCapacity, sharedCapacity);
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
        assert.ok(socket && existsSync(socket.socketPath));
        order.push("recovered-work");
        await runtime!.start();
      },
    };
  },
}));
mock.module("../../src/app/interface-startup.js", () => ({
  ...actualInterfaces,
  startInterfaceRuntime: async (options: interfaces.InterfaceStartupOptions) => {
    assert.ok(runtime?.host.hasApp("fixture"));
    assert.deepEqual(
      order.filter((step) => step !== "console"),
      ["routes", "telegram"],
    );
    socket = await actualInterfaces.startInterfaceRuntime(options);
    order.push("ingress");
    return socket;
  },
}));
// Background recovery has its own pending/rejected-recovery probe. Here observe the
// ordering of the caller without starting recurring timers or Task workers.
mock.module("../../src/app/composition/background-startup.js", () => ({
  ...actualBackground,
  startBackgroundRuntime: () => {
    order.push("background");
  },
}));

try {
  for (const dir of ["agents/may/handlers", "shared", "projects/fixture.app"])
    mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(
    join(root, "agents/may/agent.json"),
    JSON.stringify({
      name: "may",
      description: "Startup fixture",
      domain: "test",
      model: "fixture",
      tools: ["cron"],
    }),
  );
  writeFileSync(join(root, "agents/may/AGENTS.md"), "Fixture agent; no task is started.\n");
  writeFileSync(
    join(root, "agents/may/cron.json"),
    JSON.stringify([{ name: "startup-probe", handler: "startup-probe", on: ["fixture.changed"] }]),
  );
  writeFileSync(
    join(root, "agents/may/handlers/startup-probe.ts"),
    "export function create() { return async () => {}; }\n",
  );
  const appPath = join(root, "projects/fixture.app/app.js");
  const appSource = (description: string) => `export default {
    id: "fixture", version: 1, agent: "may", description: ${JSON.stringify(description)},
    inputSchema: { type: "object" }
  };`;
  writeFileSync(appPath, appSource("before"));
  const { runAppRuntime } = await import("../../src/app/app-runtime.js");
  await runAppRuntime({
    appArgs: parseAppArgs(
      [
        "bun",
        "may",
        "--console",
        "--socket",
        "--telegram",
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
          "telegram",
          "ingress",
          "triggers",
          "recovered-work",
          "background",
          ...(startupJob ? ["startup-job"] : []),
          "keepalive",
        ],
  );

  // The caller's actual reload callback, not a source-string assertion. The
  // registry/task transaction's rejection and rollback matrix lives with it.
  writeFileSync(appPath, appSource("after"));
  assert.equal(registry!.entries()[0]?.definition.description, "before");
  assert.equal((await lifecycle!.handleReload()).ok, true);
  assert.equal(subscription.mock.calls.length, 2, "one activation at startup and one for the committed reload");
  assert.equal(registry!.entries()[0]?.definition.description, "after");
  assert.ok(runtime!.host.hasApp("fixture"));
  const accepted = registry!.snapshot();
  writeFileSync(appPath, "export default { invalid: true };");
  assert.equal((await lifecycle!.handleReload()).ok, false);
  assert.equal(subscription.mock.calls.length, 2, "rejected definitions must not activate");
  assert.equal(registry!.snapshot(), accepted);
  assert.ok(runtime!.host.hasApp("fixture"));
  console.log("startup-contract-ok");
} finally {
  subscription.mockRestore();
  for (const cron of getAgentCrons().values()) cron.close();
  stopTasks?.();
  runtime?.close();
  socket?.socketUI.close();
  closeAllDbs();
  rmSync(root, { recursive: true, force: true });
}
