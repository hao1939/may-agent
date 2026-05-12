import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { create } from "../agents/may/handlers/closed-loop-steward.ts";
import { closeDb, getDb } from "../src/lib/requests.js";
import { createQueryService } from "../src/lib/query-service.js";

describe("closed-loop-steward", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      closeDb(dir);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function setup() {
    const root = join(tmpdir(), `closed-loop-steward-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const agentsRoot = join(root, "agents");
    tempDirs.push(root);
    mkdirSync(join(agentsRoot, "arc"), { recursive: true });
    writeFileSync(join(agentsRoot, "arc", "agent.json"), JSON.stringify({ name: "arc" }));
    mkdirSync(join(agentsRoot, "may"), { recursive: true });
    writeFileSync(join(agentsRoot, "may", "agent.json"), JSON.stringify({ name: "may" }));

    const db = getDb(root);
    const logs: string[] = [];
    const runs: Array<{ agent: string; task: string; source?: string }> = [];
    const workflows: Array<{ name: string; task: string; source?: string; runId?: string }> = [];
    const events: Array<{ type: string; data: Record<string, unknown> }> = [];
    const query = createQueryService({ getDb: () => db });
    const handler = create({
      sdk: {
        paths: { root, agents: agentsRoot },
        getDb: () => db,
        query,
        log: (_level: string, msg: string) => logs.push(msg),
        emit: (type: string, data: Record<string, unknown>) => { events.push({ type, data }); },
        runAgent: async (agent: string, task: string, opts?: { source?: string }) => {
          runs.push({ agent, task, source: opts?.source });
          return { sessionId: "s_steward", status: "done" };
        },
        runWorkflow: async (name: string, task: string, opts?: { source?: string }) => {
          const runId = `wr_${name}_${workflows.length}`;
          workflows.push({ name, task, source: opts?.source, runId });
          return { status: "done", summary: "triaged", runId };
        },
      },
    } as any, { handlerConfig: { lookbackMs: 60 * 60_000 } } as any);

    return { db, handler, logs, runs, workflows, events };
  }

  it("skips when there is no open alert or recent delivery failure", async () => {
    const { handler, logs, runs, workflows } = setup();

    await handler();

    expect(runs).toEqual([]);
    expect(workflows).toEqual([]);
    expect(logs.some((msg) => msg.includes("no open metric alerts"))).toBe(true);
  });

  it("builds live context for open alerts and failed deliveries", async () => {
    const { db, handler, runs, workflows } = setup();
    const now = Date.now();
    const alertCreated = now - 15 * 60_000;

    db.run(
      "INSERT INTO metrics (id, name, owner, current, threshold, target, priority, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["arc.quality", "Arc quality", "arc", 0.4, 0.8, 0.95, "P1", now],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["arc.quality", "threshold", "quality below threshold", alertCreated],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, source, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["s_owner_action", "arc", "investigate", "done", "heartbeat-arc", alertCreated + 60_000, alertCreated + 120_000],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "message.delivery_failed",
        "evaluator",
        "may",
        JSON.stringify({ from: "evaluator", to: "functions.message", reason: "Unknown message target", content: "please handle", priority: "P2" }),
        now - 5 * 60_000,
      ],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "metric.alert_judged",
        "metric-alert-triage",
        "arc",
        JSON.stringify({
          alertId: 1,
          metricId: "arc.quality",
          owner: "arc",
          operation: "fix_root_cause",
          evidence: "handler bug reproduced and fixed",
          ownerSessionId: "s_owner_action",
        }),
        now - 2 * 60_000,
      ],
    );

    await handler();

    // The handler dispatches both triage (via runWorkflow metric-alert-triage)
    // and the main steward run (via runWorkflow closed-loop-steward).
    // Find the main steward workflow dispatch:
    const stewardWorkflow = workflows.find((w) => w.name === "closed-loop-steward");
    expect(stewardWorkflow).toBeDefined();
    expect(stewardWorkflow!.task).toContain("metric=arc.quality");
    expect(stewardWorkflow!.task).toContain("owner=arc");
    expect(stewardWorkflow!.task).toContain("s_owner_action:done:heartbeat-arc");
    expect(stewardWorkflow!.task).toContain("latest judgment: operation=fix_root_cause");
    expect(stewardWorkflow!.task).toContain("session=s_owner_action");
    expect(stewardWorkflow!.task).toContain("message.delivery_failed");
    expect(stewardWorkflow!.task).toContain("to=functions.message");
    expect(stewardWorkflow!.task).toContain("Do not create a project for this cron itself");
    expect(stewardWorkflow!.task).toContain("metric.alert_judged");
    expect(stewardWorkflow!.task).toContain("workflow-collected live evidence");
    expect(stewardWorkflow!.task).toContain("Use query_db only when the context is missing or internally inconsistent");
    expect(stewardWorkflow!.task).toContain("PRAGMA table_info");
  });

  it("routes unjudged P1 alerts through metric-alert-triage itself", async () => {
    const { db, handler, workflows, logs } = setup();
    const now = Date.now();

    db.run(
      "INSERT INTO metrics (id, name, owner, current, threshold, target, priority, alert_op, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["arc.quality", "Arc quality", "arc", 0.4, 0.8, 0.95, "P1", "<", now],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["arc.quality", "threshold", "quality below threshold", now - 2 * 60 * 60_000],
    );

    await handler();

    const triageWorkflow = workflows.find((w) => w.name === "metric-alert-triage");
    expect(triageWorkflow).toBeDefined();
    expect(triageWorkflow!.source).toBe("arc");
    expect(triageWorkflow!.task).toContain("missing metric.alert_judged event");
    expect(triageWorkflow!.task).toContain('"metricId": "arc.quality"');
    // When all alerts are routed to triage and no delivery failures remain,
    // the handler skips the main steward dispatch.
    const stewardWorkflow = workflows.find((w) => w.name === "closed-loop-steward");
    expect(stewardWorkflow).toBeUndefined();
  });

  it("does not dispatch another steward run while one is active", async () => {
    const { db, handler, logs, runs, workflows } = setup();
    const now = Date.now();

    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
      ["wr_running", "closed-loop-steward", "steward", "running", now - 60_000],
    );
    db.run(
      "INSERT INTO metrics (id, name, owner, current, threshold, target, priority, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["arc.quality", "Arc quality", "arc", 0.4, 0.8, 0.95, "P1", now],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["arc.quality", "threshold", "quality below threshold", now - 15 * 60_000],
    );

    await handler();

    expect(runs).toEqual([]);
    expect(workflows).toEqual([]);
    expect(logs.some((msg) => msg.includes("prior steward") && msg.includes("still running"))).toBe(true);
  });
});
