import { describe, it } from "bun:test";
import { runTaskWorkerProbe } from "../../test/integration/fixtures/run-task-worker-probe.js";

// Each scenario owns a fresh parent process, workers and database.
describe("real Task worker interaction", () => {
  it.each([
    ["conversation", "handles human input on the same Task across worker and storage reopen"],
    ["delegation", "runs A and B through the common loop and returns B's result while A remains responsive"],
    [
      "unblock",
      "returns a worker blocker to the caller, routes its decision to the same Task, and fulfills the refined human request",
    ],
    ["nested", "returns C's facts through B to A using typed Task admission within one App"],
    ["nestedRecovery", "recovers C's durable input after parent-side SQLite contention"],
    // Existing phases use 10s watchdogs; unblock shares one 40s observation budget.
  ])("%s: %s", (scenario) => runTaskWorkerProbe("./task-interaction-scenario.ts", scenario, 45_000), 50_000);
});
