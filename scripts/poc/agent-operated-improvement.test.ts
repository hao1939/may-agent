import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

test("agent-operated trial preflight confines edits and distinguishes saving from activation", async () => {
  let root: string | undefined;
  let stdout = "";
  const trial = promisify(execFile)("bun", [join(import.meta.dirname, "agent-operated-improvement.ts")], {
    // Own both the harness and daemon so timeout/failure cannot orphan either.
    detached: true,
    timeout: 330_000,
  });
  trial.child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString();
    root ??= stdout.match(/(?:^|\n)Experiment artifacts: ([^\r\n]+)\r?\n/)?.[1];
  });
  try {
    await trial;
    expect(root?.startsWith(join(tmpdir(), "may-e2e-"))).toBe(true);
    const result = JSON.parse(readFileSync(join(root!, "results.json"), "utf8"));
    expect(result.executions).toBe(0);
    expect(result.checks.failure).toBeUndefined();
    expect(result.checks.preflight).toEqual({
      confinedWrites: true,
      committedNotActive: true,
      rejectedBeforeAdmission: true,
      realReloadRecovered: true,
      modelExecutions: 0,
      compactEvidence: true,
    });
  } finally {
    try {
      if (trial.child.pid) process.kill(-trial.child.pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    } finally {
      if (root?.startsWith(join(tmpdir(), "may-e2e-"))) rmSync(root, { recursive: true, force: true });
    }
  }
}, 340_000);
