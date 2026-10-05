import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnFixtureProcess } from "../fixtures/owned-process.js";
import { pollUntil } from "../e2e/lib/live-daemon.js";

function hasExited(pid: number): boolean {
  try {
    return readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1]?.startsWith("Z") ?? false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

test.each(["killed", "pipe closed"] as const)(
  "HTTP fixture exits when its runner is %s",
  async (scenario) => {
    const root = mkdtempSync(join(tmpdir(), "may-http-lifetime-"));
    const launcher = fileURLToPath(new URL("../fixtures/owned-process.ts", import.meta.url));
    const server = fileURLToPath(new URL("../../src/app/http/server.ts", import.meta.url));
    const parent = spawnFixtureProcess(
      [
        "-e",
        `
    import { spawnFixtureProcess } from ${JSON.stringify(launcher)};
    const child = spawnFixtureProcess([${JSON.stringify(server)}, '--state-dir', ${JSON.stringify(root)}, '--port', '0']);
    console.log(JSON.stringify({ pid: child.pid }));
    let logs = ''; let ready = false;
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.stdout.on('data', chunk => {
      logs += chunk.toString();
      const port = logs.match(/url:\\s+http:\\/\\/localhost:(\\d+)/)?.[1];
      if (port && !ready) { ready = true; console.log(JSON.stringify({ port: Number(port) })); }
    });
  `,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          PROJECT_ROOT: root,
          PROJECTS_ROOT: root,
          AGENTS_ROOT: root,
          SHARED_ROOT: root,
          MAY_PERSIST_DIR: root,
          AGENT: "fixture",
          CONVERSATION_APP: "fixture",
          CONVERSATION_ID: "fixture",
        },
      },
    );
    let pid: number | undefined;
    let port: number | undefined;
    let output = "";
    let errors = "";
    parent.stdout.on("data", (chunk) => {
      output += chunk;
      let end: number;
      while ((end = output.indexOf("\n")) !== -1) {
        const message = JSON.parse(output.slice(0, end));
        output = output.slice(end + 1);
        if (message.pid) pid = message.pid;
        if (message.port) port = message.port;
      }
    });
    parent.stderr.on("data", (chunk) => {
      errors += chunk;
    });
    const parentExited = () => parent.exitCode !== null || parent.signalCode !== null;
    try {
      await pollUntil(
        () => {
          if (parentExited()) throw new Error(`Fixture runner exited before readiness: ${errors}`);
          return pid && port;
        },
        { timeoutMs: 15_000, description: "HTTP fixture readiness" },
      );
      const url = `http://127.0.0.1:${port}/api/interface`;
      expect((await fetch(url, { signal: AbortSignal.timeout(2000) })).status).toBe(200);
      if (scenario === "killed") parent.kill("SIGKILL");
      else parent.stdin.end();
      await pollUntil(parentExited, { timeoutMs: 8000, description: "fixture runner exit" });
      await pollUntil(() => hasExited(pid!), { timeoutMs: 8000, description: "HTTP fixture exit" });
      await expect(fetch(url, { signal: AbortSignal.timeout(2000) })).rejects.toThrow();
    } finally {
      if (!parentExited()) parent.kill("SIGKILL");
      try {
        await pollUntil(parentExited, { timeoutMs: 8000, description: "fixture runner cleanup" });
        if (pid) {
          // Cleanup must not satisfy the preceding lifetime assertion.
          if (!hasExited(pid)) process.kill(pid, "SIGKILL");
          await pollUntil(() => hasExited(pid!), { timeoutMs: 8000, description: "HTTP fixture cleanup" });
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  },
  45_000,
);
