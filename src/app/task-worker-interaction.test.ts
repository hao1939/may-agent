import { describe, it } from "bun:test";
import { runTaskWorkerProbe } from "../../test/integration/fixtures/run-task-worker-probe.js";

// Each scenario owns a fresh parent process, workers and database.
describe("real Task worker interaction", () => {
  it.each([
    ["conversation", "handles human input on the same Task across worker and storage reopen"],
    ["delegation", "runs A and B through the common loop and returns B's result while A remains responsive"],
    ["nested", "returns C's facts through B to A using typed Task admission within one App"],
    ["nestedRecovery", "recovers C's durable input after parent-side SQLite contention"],
    ["nestedOnePlace", "returns C through B to A across real workers sharing one funded execution place"],
    // Several sequential waits are individually bounded at 10s in the probe.
  ])("%s: %s", (scenario) => runTaskWorkerProbe("./task-interaction-scenario.ts", scenario, 45_000), 50_000);
});
