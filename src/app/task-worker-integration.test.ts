import { describe, it } from "bun:test";
import { runTaskWorkerProbe } from "../../test/integration/fixtures/run-task-worker-probe.js";

// Exercise a real parent and its workers outside the test runner's reused VM.
// This keeps the parent-loss probe from touching another test's database or IPC.
describe("real Task worker boundary", () => {
  it.each([
    ["parentLoss", "stops with its parent and recovers the same unfinished Task"],
    ["restoredHandler", "repairs an unavailable binding without running it in the recovery process"],
    ["restoredAgent", "recovers a restored non-default agent without executing it"],
    ["recoverySourceRace", "rejects availability from a release replaced during inspection"],
    ["pinnedSource", "pins workflow and shared definitions across reload"],
    ["inheritedAgent", "runs an inherited non-default agent"],
    ["liveControl", "receives feedback and cancels without duplicate Events"],
  ])("%s: %s", (scenario) => runTaskWorkerProbe("./task-worker-scenario.ts", scenario), 20_000);
});
