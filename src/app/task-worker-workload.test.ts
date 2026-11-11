import { describe, it } from "bun:test";
import { runTaskWorkerProbe } from "../../test/integration/fixtures/run-task-worker-probe.js";

// These scenarios share policy contracts, never a live runtime or database.
describe("real Task worker workload admission", () => {
  it.each([
    ["coordination", "runs shared coordination with an installed timeout ceiling in a real worker"],
    ["protectedCoordination", "runs protected coordination across the worker boundary with exhausted ordinary funding"],
    ["sharedCoordination", "can make its bounded model judgment when ordinary shared execution is full"],
    [
      "freshWorkloadState",
      "starts from exclusively published policy and funds protected workflow/helper execution before ordinary admission",
    ],
    [
      "withdrawnWorkloadState",
      "observes offline withdrawal across workflow and managed helper execution without new charges",
    ],
    ["workloadFeedback", "preserves parent capacity and queue observations in real workflow attempts"],
  ])("%s: %s", (scenario) => runTaskWorkerProbe("./task-worker-scenario.ts", scenario), 20_000);
});
