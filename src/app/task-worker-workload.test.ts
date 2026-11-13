import { describe, it } from "bun:test";
import { runTaskWorkerProbe } from "../../test/integration/fixtures/run-task-worker-probe.js";

// These scenarios share policy contracts, never a live runtime or database.
describe("real Task worker workload admission", () => {
  it.each([
    ["coordination", "runs shared coordination with an installed timeout ceiling in a real worker"],
    ["workloadFeedback", "projects bounded parent and App capacity into an isolated worker attempt"],
  ])("%s: %s", (scenario) => runTaskWorkerProbe("./task-worker-scenario.ts", scenario), 20_000);
});
