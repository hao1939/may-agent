import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attachControlSocket } from "../../packages/control/src/server.js";
import { daemonSocketPath } from "../../packages/control/src/client.js";
import { cliSend } from "../../src/app/cli-send.js";
import { parseAppArgs } from "../../src/app/app-args.js";
import { observeDaemonLiveness } from "../../src/app/modes/maintenance.js";
import { runEmitMode } from "../../src/app/modes/emit.js";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

test("web-only CLI forwards its selected agent through to HTTP and the control socket", async () => {
  const root = mkdtempSync(join(tmpdir(), "web-only-routing-"));
  const control = await attachControlSocket({
    socketPath: daemonSocketPath(root, { instance: "web-test", interfaceAgent: "helper" }),
    agentName: "helper", instance: "web-test", getSessionId: () => "fixture",
    getStatus: () => ({ sessions: [], activeWork: false }),
    emitEvent: () => {}, subscribeEvents: () => () => {},
  });
  const child = spawn(process.execPath, [fileURLToPath(new URL("../../src/app/may.ts", import.meta.url)), "--web", "--agent", "helper"], {
    env: { ...process.env, APP_ROOT: root, PROJECT_ROOT: root, STATE_DIR: root,
      WEB_PORT: "0", AGENT: "unused-env-agent", DAEMON_AGENT: "unused-legacy",
      INSTANCE: "web-test", DAEMON_INSTANCE: "web-test" },
    stdio: ["ignore", "pipe", "pipe"], timeout: 10_000,
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
])("send, emit and liveness use the runtime's selected socket: %j", async (identity) => {
  const root = mkdtempSync(join(tmpdir(), "interface-routing-"));
  const env = { ...identity, DAEMON_INSTANCE: "test", INSTANCE: "other",
    CONVERSATION_APP: "support", CONVERSATION_ID: "retained-room" };
  const saved = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const published: unknown[] = [];
  const control = await attachControlSocket({
    socketPath: daemonSocketPath(root, { instance: "test", interfaceAgent: "helper" }),
    agentName: "helper", instance: "test", getSessionId: () => "fixture",
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
    expect(await cliSend({ agent: "helper", message: "Review the result", persistDir: root, agentsRoot: root })).toBe(true);
    expect(published[0]).toMatchObject({ type: "app.input.requested", target: { appId: "support" },
      data: { conversationId: "retained-room", input: { kind: "message", data: { message: "Review the result" } } } });
    expect(await observeDaemonLiveness(root)).toEqual({ responsive: true, activeWork: false });
    const args = parseAppArgs([], process.env);
    await runEmitMode({ mode: { event: "fixture.observed" }, persistDir: root,
      interfaceAgent: args.interfaceAgent, instanceLabel: "other", daemonInstance: process.env.DAEMON_INSTANCE,
      retry: { maxAttempts: 1 }, writeReceipt: () => {} });
    expect(published[1]).toMatchObject({ type: "fixture.observed" });
  } finally {
    control.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
