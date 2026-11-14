import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attachControlSocket } from "../../packages/control/src/server.js";
import { daemonSocketPath } from "../../packages/control/src/client.js";
import { parseAppArgs } from "../../src/app/app-args.js";
import { observeDaemonLiveness } from "../../src/app/modes/maintenance.js";
import { runEmitMode } from "../../src/app/modes/emit.js";
import { spawnFixtureProcess } from "../fixtures/owned-process.js";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { closeDb, getDb } from "../../src/lib/db/connection.js";

const cli = fileURLToPath(new URL("../../src/app/may.ts", import.meta.url));

function cliEnv(root: string) {
  return { ...process.env, APP_ROOT: root, PROJECT_ROOT: root, STATE_DIR: root,
    AGENT: "unused-env", DAEMON_AGENT: "unused-legacy", INSTANCE: "other", DAEMON_INSTANCE: "test",
    CONVERSATION_APP: "support", CONVERSATION_ID: "retained-room" };
}

test("maintenance CLI probes its selected daemon even when environment identities differ", async () => {
  const root = mkdtempSync(join(tmpdir(), "maintenance-binding-"));
  getDb(root);
  closeDb(root);
  const observed = Promise.withResolvers<void>();
  const control = await attachControlSocket({
    socketPath: daemonSocketPath(root, { instance: "test", interfaceAgent: "helper" }),
    agentName: "helper", instance: "test",
    getStatus: () => { observed.resolve(); return { sessions: [], activeWork: false }; },
    emitEvent: () => {}, subscribeEvents: () => () => {},
  });
  const preload = join(root, "probe-clock.js");
  // Exercise the real CLI and recurring-probe wiring without the two-minute
  // startup grace. Run only one probe, so a failing regression cannot trigger
  // the supervisor's six-failure restart threshold.
  writeFileSync(preload, `
    const schedule = globalThis.setInterval;
    const now = Date.now;
    let offset = 0;
    Date.now = () => now() + offset;
    globalThis.setInterval = (callback, ms, ...args) => {
      if (ms !== 30000) return schedule(callback, ms, ...args);
      const timer = schedule(() => {
        clearInterval(timer);
        offset = 121000;
        callback(...args);
      }, 10);
      return timer;
    };
  `);
  const child = spawnFixtureProcess(["--preload", preload, cli, "--maintenance", "--agent", "helper"], {
    env: cliEnv(root), timeout: 10_000,
  });
  const exited = new Promise<number | null>((resolve) => child.once("close", resolve));
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  try {
    await Promise.race([observed.promise, exited.then(code => {
      throw new Error(`Maintenance exited before probing helper (${code}): ${output}`);
    })]);
    child.kill();
    expect(await exited).toBe(0);
  } finally {
    child.kill();
    await exited;
    control.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 15_000);

test("web-only CLI forwards its selected agent through to HTTP and the control socket", async () => {
  const root = mkdtempSync(join(tmpdir(), "web-only-routing-"));
  const control = await attachControlSocket({
    socketPath: daemonSocketPath(root, { instance: "web-test", interfaceAgent: "helper" }),
    agentName: "helper", instance: "web-test",
    getStatus: () => ({ sessions: [], activeWork: false }),
    emitEvent: () => {}, subscribeEvents: () => () => {},
  });
  const child = spawnFixtureProcess([fileURLToPath(new URL("../../src/app/may.ts", import.meta.url)), "--web", "--agent", "helper"], {
    env: { ...process.env, APP_ROOT: root, PROJECT_ROOT: root, STATE_DIR: root,
      WEB_PORT: "0", AGENT: "unused-env-agent", DAEMON_AGENT: "unused-legacy",
      INSTANCE: "web-test", DAEMON_INSTANCE: "web-test" },
    timeout: 10_000,
  });
  let output = "";
  child.stderr.on("data", chunk => { output += chunk.toString(); });
  const closed = once(child, "close");
  try {
    const port = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", code => reject(new Error(`Web-only exited (${code}): ${output}`)));
      child.stdout.on("data", chunk => {
        output += chunk.toString();
        const match = output.match(/Dashboard running on http:\/\/localhost:(\d+)/);
        if (match) resolve(Number(match[1]));
      });
    });
    const base = `http://127.0.0.1:${port}`;
    expect(await (await fetch(`${base}/api/interface`)).json()).toMatchObject({ agent: "helper" });
    expect(await (await fetch(`${base}/api/readiness`)).json()).toMatchObject({ ready: true,
      socketPath: daemonSocketPath(root, { instance: "web-test", interfaceAgent: "helper" }) });
  } finally {
    child.kill("SIGKILL");
    await closed;
    control.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 15_000);

test.each([
  { AGENT: "helper", DAEMON_AGENT: undefined },
  { AGENT: "helper", DAEMON_AGENT: "unused-legacy" },
  { AGENT: undefined, DAEMON_AGENT: "helper" },
])("emit and liveness use the runtime's selected socket: %j", async (identity) => {
  const root = mkdtempSync(join(tmpdir(), "interface-routing-"));
  const env = { ...identity, DAEMON_INSTANCE: "test", INSTANCE: "other",
    CONVERSATION_APP: "support", CONVERSATION_ID: "retained-room" };
  const saved = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const published: unknown[] = [];
  const control = await attachControlSocket({
    socketPath: daemonSocketPath(root, { instance: "test", interfaceAgent: "helper" }),
    agentName: "helper", instance: "test",
    getStatus: () => ({ sessions: [], activeWork: false }),
    emitEvent: event => { published.push(event); return { eventId: published.length }; },
    subscribeEvents: () => () => {},
    publishEvent: event => {
      published.push(event);
      return { eventId: published.length, eventType: event.type, delivery: "accepted" };
    },
  });
  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    const args = parseAppArgs([], process.env);
    const socketPath = daemonSocketPath(root, { instance: "test", interfaceAgent: args.humanInterface.agent });
    expect(await observeDaemonLiveness(root, socketPath)).toEqual({ responsive: true, activeWork: false });
    await runEmitMode({ mode: { event: "fixture.observed" }, persistDir: root,
      interfaceAgent: args.humanInterface.agent, instanceLabel: "other", daemonInstance: process.env.DAEMON_INSTANCE,
      retry: { maxAttempts: 1 }, writeReceipt: () => {} });
    expect(published[0]).toMatchObject({ type: "fixture.observed" });
  } finally {
    control.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
