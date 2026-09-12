import { describe, it } from "bun:test";
import { runTaskWorkerProbe } from "../../test/integration/fixtures/run-task-worker-probe.js";

// Exercise a real parent and its workers outside the test runner's reused VM.
// This keeps the parent-loss probe from touching another test's database or IPC.
describe("real Task worker boundary", () => {
  it.each([
    ["conversation", "handles human input on the same Task across worker and storage reopen"],
    ["delegation", "runs A and B through the common loop and returns B's result while A remains responsive"],
    ["nested", "returns C's evidence through B to A using typed Task admission within one App"],
  ])("%s: %s", (scenario) => runTaskWorkerProbe("./task-interaction-scenario.ts", scenario), 20_000);

  it.each([
    ["parentLoss", "stops with its parent and recovers the same unfinished Task"],
    ["redoAfterParentLoss", "retains input and inspects an existing effect after the old worker exits"],
    ["restoredHandler", "retries a restored workflow in a due attempt without a repair pass"],
    ["restoredAgent", "uses a restored non-default agent on the same Task after backoff"],
    ["recoveryLeavesHandlerJudgmentToAttempt", "recovery preserves input while the next attempt checks current code"],
    ["pinnedSource", "pins workflow and shared definitions across reload"],
    ["rejectedDisable", "keeps accepted Apps in recovery and attempts after rejected disable reload"],
    ["inheritedAgent", "runs an inherited non-default agent"],
    ["liveControl", "receives feedback and cancels without duplicate Events"],
  ])("%s: %s", (scenario) => runTaskWorkerProbe("./task-worker-scenario.ts", scenario), 20_000);
});
