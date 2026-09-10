import { describe, it } from "bun:test";
import { runTaskWorkerProbe } from "../../../../test/integration/fixtures/run-task-worker-probe.js";

describe("isolated Task attempt process", () => {
  it.each([
    ["requestParsing", "validates the exact Task and dispatch context"],
    ["sourceCapture", "captures the published definition before spawning"],
    ["eventRelay", "relays persisted events and dependent Task identities"],
    ["liveInput", "forwards only exact persisted input without echoes"],
    ["parentResponsive", "keeps the parent responsive during CPU-heavy work"],
    ["relayBatches", "yields between bounded event batches"],
    ["concurrentRelays", "shares relay turns across concurrent workers"],
    ["workerFailure", "surfaces failure without another Task"],
    ["abruptExit", "settles an abruptly lost worker instead of holding capacity"],
    ["missingResult", "rejects a clean exit without an accepted result"],
    ["workerChurn", "preserves IPC across concurrent worker churn and garbage collection"],
    ["recovery", "uses the same process protocol for recovery"],
  ])("%s: %s", (scenario) => runTaskWorkerProbe("./task-attempt-protocol.ts", scenario), 20_000);
});
