import { expect, test } from "bun:test";
import { buildSandbox } from "./lib/sandbox.js";
import { openSandboxDb, pollUntil } from "./lib/live-daemon.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";

test("ordinary observer reads Host facts and its App owns the resulting work", async () => {
  const sb = await buildSandbox({
    fixtureAgents: ["may"], fixtureProjects: ["sample-health.app"],
    fixtureWorkflows: { may: ["host-health-proof"] }, cronJson: { may: [] }, daemonArgs: ["--socket"],
  });
  try {
    await sb.daemonReady;
    const db = openSandboxDb(sb.dbPath);
    try {
      const accepted = await pollUntil(() => {
        const store = AppTaskResourceStore.activeFromDb(db, "sample-health");
        const id = store?.readTask("review")?.status.observedAttemptId;
        return id ? store!.readAttempt(id)?.acceptedResult : null;
      }, { timeoutMs: 10000, description: "ordinary observer to accepted App workflow" });
      expect(accepted).toMatchObject({ summary: "App inspected Host facts", facts: ["runtime-failures:0"] });
      const event = db.query("SELECT data FROM events WHERE event_type = 'sample.health.observed' ORDER BY id DESC LIMIT 1")
        .get() as { data: string };
      const snapshot = JSON.parse(event.data);
      expect(snapshot.coverage).toEqual({ retainedOnly: true, executionScope: "all" });
      expect(snapshot.executions.agents).toMatchObject({ running: 0, ended: 0, error: 0 });
      expect(snapshot.runtimeFailures).toEqual({ total: 0, byType: [], recent: [], truncated: false });
    } finally { db.close(); }
  } catch (error) {
    const db = openSandboxDb(sb.dbPath);
    let evidence: unknown;
    try { evidence = {
      attempts: db.query("SELECT attempt_json FROM app_task_attempts LIMIT 3").all(),
      failures: db.query("SELECT event_type, data FROM events WHERE event_type IN ('app.observer.failed', 'subscriber.failed') LIMIT 3").all(),
    }; } finally { db.close(); }
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${JSON.stringify(evidence)}\n${sb.getLogs()}`, { cause: error });
  } finally { await sb.close(); }
}, 20000);
