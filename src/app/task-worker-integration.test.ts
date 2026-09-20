import { describe, it } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { runTaskWorkerProbe } from "../../test/integration/fixtures/run-task-worker-probe.js";

const execFileAsync = promisify(execFile);

// Exercise a real parent and its workers outside the test runner's reused VM.
// This keeps the parent-loss probe from touching another test's database or IPC.
describe("real Task worker boundary", () => {
  it.each([
    ["conversation", "handles human input on the same Task across worker and storage reopen"],
    ["delegation", "runs A and B through the common loop and returns B's result while A remains responsive"],
    ["nested", "returns C's facts through B to A using typed Task admission within one App"],
    ["nestedRecovery", "recovers C's durable input after parent-side SQLite contention"],
  ])("%s: %s", (scenario) => runTaskWorkerProbe("./task-interaction-scenario.ts", scenario), 20_000);

  it.each([
    ["parentLoss", "stops with its parent and recovers the same unfinished Task"],
    ["redoAfterParentLoss", "retains input and inspects an existing effect after the old worker exits"],
    ["restoredHandler", "retries a restored workflow in a due attempt without a repair pass"],
    ["restoredAgent", "uses a restored non-default agent on the same Task after backoff"],
    ["recoveryLeavesHandlerJudgmentToAttempt", "recovery preserves input while the next attempt checks current code"],
    ["pinnedSource", "pins workflow and shared definitions across reload"],
    ["appLocalHelper", "calls an App-local helper from the pinned catalog without loading unrelated agents"],
    ["rejectedDisable", "keeps accepted Apps in recovery and attempts after rejected disable reload"],
    ["inheritedAgent", "runs an inherited non-default agent"],
    ["liveControl", "receives feedback and cancels without duplicate Events"],
    ["ordinaryCommands", "keeps Bash and direct workflow commands outside the internal worker role"],
  ])("%s: %s", (scenario) => runTaskWorkerProbe("./task-worker-scenario.ts", scenario), 20_000);

  it(
    "runs ordinary commands from the production worker spawn in a compiled fixture",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "may-compiled-worker-"));
      const binary = join(root, "worker-probe");
      try {
        await execFileAsync(
          process.execPath,
          [
            "build",
            "--compile",
            fileURLToPath(
              new URL("../../test/integration/fixtures/task-worker-scenario.ts", import.meta.url),
            ),
            "--outfile",
            binary,
          ],
          { cwd: resolve(import.meta.dir, "../.."), encoding: "utf8", timeout: 30_000 },
        );
        await execFileAsync(binary, ["ordinaryCommands"], {
          cwd: resolve(import.meta.dir, "../.."),
          env: { ...process.env, MAY_TASK_ATTEMPT_CHILD: "1" },
          encoding: "utf8",
          timeout: 20_000,
        });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    55_000,
  );
});
