import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pollUntil, socketStatus } from "./lib/live-daemon.js";

function hasExited(pid: number): boolean {
  try {
    // A zombie has exited and cannot keep producing events or holding SQLite.
    return readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1]?.startsWith("Z") ?? false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

test.each(["parent killed", "parent pipe closed", "startup failure"] as const)(
  "sandbox lifetime and cleanup: %s",
  async (scenario) => {
    const modulePath = fileURLToPath(new URL("./lib/sandbox.ts", import.meta.url));
    const preload = fileURLToPath(new URL("./lib/daemon-lifetime.ts", import.meta.url));
    // --help cannot create a socket. Its short deadline exercises failure, not a
    // race between normal daemon startup and an artificially short timeout.
    const spec =
      scenario === "startup failure"
        ? { fixtureAgents: ["may"], daemonArgs: ["--help"], startupTimeoutMs: 100 }
        : { fixtureAgents: ["may"], daemonArgs: ["--socket"] };
    const parent = spawn(
      process.execPath,
      [
        "--preload",
        preload,
        "-e",
        `
      import { buildSandbox } from ${JSON.stringify(modulePath)};
      const sb = await buildSandbox(${JSON.stringify(spec)});
      console.log(JSON.stringify({ root: sb.root, pid: sb.daemonPid, socketPath: sb.socketPath }));
      try {
        await sb.daemonReady;
        console.log(JSON.stringify({ ready: true }));
      } catch (error) {
        console.log(JSON.stringify({ failed: String(error) }));
      }
      await new Promise(() => {});
    `,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "";
    let errors = "";
    let daemon: { root: string; pid: number; socketPath: string } | undefined;
    let readiness: { ready?: true; failed?: string } | undefined;
    // Retain cleanup identity as soon as it arrives, independently of readiness.
    parent.stdout.on("data", (chunk) => {
      output += chunk;
      let end: number;
      while ((end = output.indexOf("\n")) !== -1) {
        const message = JSON.parse(output.slice(0, end));
        output = output.slice(end + 1);
        if (message.root) daemon = message;
        else readiness = message;
      }
    });
    parent.stderr.on("data", (chunk) => {
      errors += chunk;
    });
    const parentExited = () => parent.exitCode !== null || parent.signalCode !== null;
    try {
      await pollUntil(() => daemon, { timeoutMs: 15_000, description: "sandbox cleanup identity" });
      expect(daemon!.pid).toBeGreaterThan(0);
      // The sandbox owns a 30s startup deadline; allow its result to arrive.
      const status = await pollUntil(
        () => {
          if (parentExited()) throw new Error(`Runner exited before readiness: ${errors}`);
          return readiness;
        },
        { timeoutMs: 35_000, description: "sandbox readiness result" },
      );
      if (scenario === "startup failure") {
        expect(status.failed).toContain("daemon socket not ready");
      } else {
        expect(status).toEqual({ ready: true });
        expect(await socketStatus(daemon!.socketPath)).toHaveProperty("type", "status");
        if (scenario === "parent killed") parent.kill("SIGKILL");
        else parent.stdin.end();
        await pollUntil(parentExited, { timeoutMs: 8000, description: "fixture helper exit" });
        await pollUntil(() => hasExited(daemon!.pid), { timeoutMs: 8000, description: "fixture daemon exit" });
      }
    } finally {
      if (!parentExited()) parent.kill("SIGKILL");
      await pollUntil(parentExited, { timeoutMs: 8000, description: "fixture helper cleanup" });
      if (daemon) {
        try {
          await pollUntil(() => hasExited(daemon!.pid), { timeoutMs: 8000, description: "fixture daemon cleanup" });
        } catch (error) {
          // Preserve bounded cleanup even when the lifetime assertion fails.
          if (!hasExited(daemon.pid)) process.kill(daemon.pid, "SIGKILL");
          await pollUntil(() => hasExited(daemon!.pid), { timeoutMs: 8000, description: "forced fixture daemon exit" });
          throw error;
        } finally {
          rmSync(daemon.root, { recursive: true, force: true });
        }
      }
    }
    expect(existsSync(daemon!.root)).toBe(false);
  },
  75_000,
);
