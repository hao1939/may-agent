import { describe, it } from "bun:test";
import { runTaskWorkerProbe } from "../../test/integration/fixtures/run-task-worker-probe.js";

// Exercise a real parent and its workers outside the test runner's reused VM.
// In-runner repeated abrupt exits exposed premature descriptor closures; this also
// keeps the parent-loss probe from touching another test's database or pipes.
describe("real Task worker boundary", () => {
  it.each([
    ["parentLoss", "stops with its parent and recovers the same unfinished Task"],
    ["pinnedSource", "pins workflow and shared definitions across reload"],
    ["inheritedAgent", "runs an inherited non-default agent"],
    ["liveControl", "receives feedback and cancels without duplicate Events"],
  ])("%s: %s", (scenario) => runTaskWorkerProbe("./task-worker-scenario.ts", scenario), 20_000);
});
