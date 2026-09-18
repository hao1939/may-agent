import { describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const probe = fileURLToPath(new URL("../../test/fixtures/task-worker-role-probe.ts", import.meta.url));
type ProbeResult = {
  connected: boolean;
  worker: boolean;
  entryError: string | null;
  dbError: string | null;
  initialized: boolean;
  tableNames: string[];
  waits: number[];
  retryAttempts: number;
  legacyMarker: string | null;
};

async function runProbe(scenario: string, ipc: boolean): Promise<ProbeResult> {
  const root = mkdtempSync(join(tmpdir(), "may-worker-role-"));
  const child = spawn(process.execPath, [probe, scenario, root], {
    env: { ...process.env, MAY_TASK_ATTEMPT_CHILD: "1" },
    stdio: ipc ? ["ignore", "pipe", "pipe", "ipc"] : ["ignore", "pipe", "pipe"],
    serialization: "json",
  });
  let stdout = "";
  let stderr = "";
  let received: ProbeResult | undefined;
  child.stdout?.on("data", (chunk) => (stdout += chunk.toString()));
  child.stderr?.on("data", (chunk) => (stderr += chunk.toString()));
  if (ipc) child.once("message", (value) => (received = value as ProbeResult));
  const closed = new Promise<number | null>((resolve) => child.once("close", resolve));
  const failed = new Promise<never>((_, reject) => child.once("error", reject));
  const waitUntil = async <T>(pending: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(`${scenario} ${label} exceeded ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  };
  let reaped = false;
  try {
    const exit = await waitUntil(Promise.race([closed, failed]), 3_000, "execution");
    reaped = true;
    if (exit !== 0) throw new Error(`${scenario} exited with ${exit}: ${stderr}`);
    if (ipc && !received) throw new Error(`${scenario} closed without an IPC result`);
    return received ?? (JSON.parse(stdout) as ProbeResult);
  } finally {
    if (!reaped) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      await waitUntil(closed, 1_000, "cleanup");
    }
    rmSync(root, { recursive: true, force: true });
  }
}

describe("Task worker process role", () => {
  it("ignores a stale marker in an ordinary process", async () => {
    const result = await runProbe("ordinary", false);
    expect(result).toMatchObject({ connected: false, worker: false, initialized: true, legacyMarker: "1" });
    expect(result.waits).toEqual([5, 10, 20, 40, 80, 160, 320, 640]);
    expect(result.retryAttempts).toBe(9);
  });

  it("requires parent IPC before entry and does not partially enter", async () => {
    const result = await runProbe("entry-without-parent", false);
    expect(result.worker).toBe(false);
    expect(result.entryError).toBe("Task worker mode requires its parent IPC connection");
    expect(result.initialized).toBe(true);
    expect(result.waits).toEqual([5, 10, 20, 40, 80, 160, 320, 640]);
    expect(result.retryAttempts).toBe(9);
  });

  it("does not infer worker role from IPC alone", async () => {
    const result = await runProbe("ordinary-with-ipc", true);
    expect(result).toMatchObject({ connected: true, worker: false, initialized: true });
    expect(result.waits).toEqual([5, 10, 20, 40, 80, 160, 320, 640]);
    expect(result.retryAttempts).toBe(9);
  });

  it("refuses missing schema and selects worker retry pacing after entry", async () => {
    const result = await runProbe("worker-missing", true);
    expect(result.worker).toBe(true);
    expect(result.dbError).toBe("Task worker requires an initialized Host database");
    expect(result.tableNames).toEqual([]);
    expect(result.waits).toEqual([250, 500, 1_000, 2_000]);
    expect(result.retryAttempts).toBe(5);
  });

  it("reuses initialized ownership without running schema initialization", async () => {
    const result = await runProbe("worker-initialized", true);
    expect(result).toMatchObject({ worker: true, dbError: null, initialized: true });
    expect(result.tableNames).toEqual(["app_tasks", "events"]);
    expect(result.waits).toEqual([250, 500, 1_000, 2_000]);
    expect(result.retryAttempts).toBe(5);
  });
});
