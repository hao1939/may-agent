// Run only in a child process: module mocks must not affect other test files.
// Actual startup, inbox, registry, capacity and socket; external adapters and
// indefinite loops are stopped at their boundaries. No model call is made.
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeModel } from "./model.js";
import { closeAllDbs } from "../../src/lib/requests.js";
import { parseAppArgs } from "../../src/app/app-args.js";
import * as daemon from "../../src/app/daemon.js";
import * as inbox from "../../src/app/app-inbox-runtime.js";
import * as interfaces from "../../src/app/interface-startup.js";

const actualDaemon = { ...daemon };
const actualInbox = { ...inbox };
const actualInterfaces = { ...interfaces };

const root = mkdtempSync(join(tmpdir(), "may-startup-"));
const mode = process.argv[2];
const tty = mode === "tty";
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

mock.module("../../src/app/daemon.js", () => ({
  ...actualDaemon,
  prepareDaemonAgents: async (options: Parameters<typeof daemon.prepareDaemonAgents>[0]) => {
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
// Cron recovery has its own pending/rejected-recovery probe. Here observe the
// ordering of the caller without starting recurring timers or Task workers.
mock.module("../../src/app/cron-startup.js", () => ({
  startCronRuntime: async () => {
    order.push("cron");
  },
}));

try {
  for (const dir of ["agents/may", "shared", "projects/fixture.app"]) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(
    join(root, "agents/may/agent.json"),
    JSON.stringify({
      name: "may",
      description: "Startup fixture",
      domain: "test",
      model: "fixture",
      tools: [],
    }),
  );
  writeFileSync(join(root, "agents/may/AGENTS.md"), "Fixture agent; no task is started.\n");
  const appPath = join(root, "projects/fixture.app/app.js");
  const appSource = (description: string) => `export default {
    id: "fixture", version: 1, agent: "may", description: ${JSON.stringify(description)},
    inputSchema: { type: "object" }
  };`;
  writeFileSync(appPath, appSource("before"));
  const { runAppRuntime } = await import("../../src/app/app-runtime.js");
  await runAppRuntime({
    appArgs: parseAppArgs(["bun", "may", "--console", "--socket", "--telegram", ...(tty ? [] : ["--cron"])], {}),
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
      ? ["console", "routes", "telegram", "ingress", "recovered-work", "interactive"]
      : ["routes", "telegram", "ingress", "recovered-work", "cron", "keepalive"],
  );

  // The caller's actual reload callback, not a source-string assertion. The
  // registry/task transaction's rejection and rollback matrix lives with it.
  writeFileSync(appPath, appSource("after"));
  assert.equal(registry!.entries()[0]?.definition.description, "before");
  assert.equal((await lifecycle!.handleReload()).ok, true);
  assert.equal(registry!.entries()[0]?.definition.description, "after");
  assert.ok(runtime!.host.hasApp("fixture"));
  const accepted = registry!.snapshot();
  writeFileSync(appPath, "export default { invalid: true };");
  assert.equal((await lifecycle!.handleReload()).ok, false);
  assert.equal(registry!.snapshot(), accepted);
  assert.ok(runtime!.host.hasApp("fixture"));
  console.log("startup-contract-ok");
} finally {
  stopTasks?.();
  runtime?.close();
  socket?.socketUI.close();
  closeAllDbs();
  rmSync(root, { recursive: true, force: true });
}
