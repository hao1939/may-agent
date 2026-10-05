import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pollUntil, socketStatus } from "./lib/live-daemon.js";

test("a real sandbox daemon stops when its runner is killed before cleanup", async () => {
  const modulePath = fileURLToPath(new URL("./lib/sandbox.ts", import.meta.url));
  const parent = spawn(
    process.execPath,
    [
      "-e",
      `
    import { buildSandbox } from ${JSON.stringify(modulePath)};
    const sb = await buildSandbox({ fixtureAgents: ["may"], daemonArgs: ["--socket"] });
    await sb.daemonReady;
    console.log(JSON.stringify({ root: sb.root, pid: sb.daemonPid, socketPath: sb.socketPath }));
    await new Promise(() => {});
  `,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  let errors = "";
  parent.stdout.on("data", (chunk) => {
    output += chunk;
  });
  parent.stderr.on("data", (chunk) => {
    errors += chunk;
  });
  let daemon: { root: string; pid: number; socketPath: string } | undefined;
  let daemonExited = false;
  try {
    daemon = await pollUntil(
      () => {
        if (parent.exitCode !== null) throw new Error(`Runner exited: ${errors}`);
        try {
          return JSON.parse(output.trim()) as typeof daemon;
        } catch {
          return undefined;
        }
      },
      { timeoutMs: 15_000, description: "sandbox ready under its parent" },
    );
    expect(daemon?.pid).toBeGreaterThan(0);
    expect(await socketStatus(daemon!.socketPath)).toHaveProperty("type", "status");
    const exited = new Promise<void>((resolve) => parent.once("exit", () => resolve()));
    parent.kill("SIGKILL");
    await exited;
    await pollUntil(
      () => {
        try {
          // A zombie has exited and cannot keep producing events or holding SQLite.
          return readFileSync(`/proc/${daemon!.pid}/stat`, "utf8").split(") ")[1]?.startsWith("Z");
        } catch {
          return true;
        }
      },
      { timeoutMs: 8000, description: "orphan fixture daemon exit" },
    );
    daemonExited = true;
  } finally {
    if (parent.exitCode === null && parent.signalCode === null) parent.kill("SIGKILL");
    if (daemon) {
      if (!daemonExited) {
        try {
          process.kill(daemon.pid, "SIGKILL");
        } catch {
          /* already reaped */
        }
      }
      rmSync(daemon.root, { recursive: true, force: true });
    }
  }
}, 30_000);
