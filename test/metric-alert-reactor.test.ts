import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { create } from "../app/agents/may/handlers/metric-alert-reactor.ts";
import { closeDb, getDb } from "../src/lib/requests.js";
import { createQueryService } from "../src/lib/query-service.js";

describe("metric-alert-reactor", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      closeDb(dir);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function setup() {
    const root = join(tmpdir(), `metric-alert-reactor-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const agentsRoot = join(root, "agents");
    tempDirs.push(root);
    mkdirSync(join(agentsRoot, "arc"), { recursive: true });
    writeFileSync(join(agentsRoot, "arc", "agent.json"), JSON.stringify({ name: "arc" }));

    const runs: Array<{ owner: string; task: string; source?: string }> = [];
    const workflows: Array<{ name: string; task: string; source?: string }> = [];
    const logs: string[] = [];
    const handler = create({
      sdk: {
        paths: { root, agents: agentsRoot, shared: join(root, "shared"), projects: join(root, "projects") },
        getDb: () => {
          throw new Error("db unavailable");
        },
        query: {
          alerts: () => {
            throw new Error("db unavailable");
          },
          metricAlertReactorState: () => {
            throw new Error("db unavailable");
          },
        },
        emit: () => {},
        log: (_level: string, msg: string) => logs.push(msg),
        runAgent: async (owner: string, task: string, opts?: { source?: string }) => {
          runs.push({ owner, task, source: opts?.source });
          return { sessionId: "s_alert", status: "done" };
        },
        runWorkflow: async (name: string, task: string, opts?: { source?: string }) => {
          workflows.push({ name, task, source: opts?.source });
          return { status: "done", summary: "triaged" };
        },
      },
    } as any, {} as any);

    return { handler, runs, workflows, logs };
  }

  function setupWithDb() {
    const root = join(tmpdir(), `metric-alert-reactor-db-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const agentsRoot = join(root, "agents");
    tempDirs.push(root);
    mkdirSync(join(agentsRoot, "arc"), { recursive: true });
    writeFileSync(join(agentsRoot, "arc", "agent.json"), JSON.stringify({ name: "arc" }));
    mkdirSync(join(agentsRoot, "may"), { recursive: true });
    writeFileSync(join(agentsRoot, "may", "agent.json"), JSON.stringify({ name: "may" }));

    const db = getDb(root);
    const workflows: Array<{ name: string; task: string; source?: string }> = [];
    const logs: string[] = [];
    const handler = create({
      sdk: {
        paths: { root, agents: agentsRoot, shared: join(root, "shared"), projects: join(root, "projects") },
        getDb: () => db,
        query: createQueryService({ getDb: () => db }),
        emit: () => {},
        log: (_level: string, msg: string) => logs.push(msg),
        runWorkflow: async (name: string, task: string, opts?: { source?: string }) => {
          workflows.push({ name, task, source: opts?.source });
          return { status: "done", summary: "triaged" };
        },
      },
    } as any, {} as any);

    return { db, handler, workflows, logs };
  }

  function insertOpenP1Alert(db: ReturnType<typeof getDb>, now: number) {
    db.run(
      "INSERT INTO metrics (id, name, owner, current, threshold, target, priority, alert_op, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["arc.quality", "Arc quality", "arc", 0.4, 0.8, 0.95, "P1", "<", now],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["arc.quality", "threshold", "quality below threshold", now - 2 * 60 * 60_000],
    );
    return (db.prepare("SELECT id FROM metric_alerts WHERE metric_id = ?").get("arc.quality") as { id: number }).id;
  }

  it("defers P1 alerts to heartbeat context", async () => {
    const { handler, runs, logs } = setup();

    await handler({
      type: "metric.breach",
      data: {
        owner: "arc",
        metricId: "arc.quality",
        metricName: "Arc quality",
        current: 0.4,
        threshold: 0.8,
        target: 0.95,
        message: "quality below threshold",
        priority: "P1",
      },
    } as any);

    expect(runs).toEqual([]);
    expect(logs.some((msg) => msg.includes("Deferring arc.quality (P1) to metric context"))).toBe(true);
  });

  it("forks the owner for P0 alerts", async () => {
    const { handler, runs, workflows } = setup();

    await handler({
      type: "metric.breach",
      data: {
        owner: "arc",
        metricId: "arc.down",
        metricName: "Arc down",
        current: 0,
        threshold: 1,
        target: 1,
        message: "critical failure",
        priority: "P0",
      },
    } as any);

    expect(runs).toEqual([]);
    expect(workflows).toHaveLength(1);
    expect(workflows[0]).toMatchObject({ name: "metric-alert-triage", source: "arc" });
    expect(workflows[0].task).toContain("Run metric alert triage for arc.down");
    expect(workflows[0].task).toContain('"type": "metric.breach"');
    expect(workflows[0].task).toContain('"metricId": "arc.down"');
  });

  it("reruns P0 triage when a recent completed session emitted no judgment", async () => {
    const { db, handler, workflows, logs } = setupWithDb();
    const now = Date.now();
    db.run(
      "INSERT INTO metrics (id, name, owner, current, threshold, target, priority, alert_op, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["arc.down", "Arc down", "arc", 2, 1, 0, "P0", ">", now],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["arc.down", "threshold", "critical failure", now - 60_000],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, source, status, startedAt, endedAt, task) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["s_recent", "arc", "metric-alert-reactor:arc.down", "done", now - 10 * 60_000, now - 9 * 60_000, "old triage"],
    );

    await handler();

    expect(workflows).toHaveLength(1);
    expect(workflows[0]).toMatchObject({ name: "metric-alert-triage", source: "arc" });
    expect(logs.some((msg) => msg.includes("ended without judgment"))).toBe(true);
  });

  it("dedups P0 alerts when a recent triage workflow emitted a judgment", async () => {
    const { db, handler, workflows, logs } = setupWithDb();
    const now = Date.now();
    db.run(
      "INSERT INTO metrics (id, name, owner, current, threshold, target, priority, alert_op, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["arc.down", "Arc down", "arc", 2, 1, 0, "P0", ">", now],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["arc.down", "threshold", "critical failure", now - 60_000],
    );
    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["wr_recent", "metric-alert-triage", "Run metric alert triage for arc.down", "done", now - 5 * 60_000, now - 4 * 60_000],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["metric.alert_judged", JSON.stringify({ metricId: "arc.down", operation: "upgrade_or_escalate" }), now - 4 * 60_000],
    );

    await handler();

    expect(workflows).toEqual([]);
    expect(logs.some((msg) => msg.includes("recent triage workflow wr_recent emitted judgment"))).toBe(true);
  });

  it("triages an old P1 alert that has no judgment", async () => {
    const { db, handler, workflows } = setupWithDb();
    const now = Date.now();
    insertOpenP1Alert(db, now);

    await handler();

    expect(workflows).toHaveLength(1);
    expect(workflows[0]).toMatchObject({ name: "metric-alert-triage", source: "arc" });
    expect(workflows[0].task).toContain('"metricId": "arc.quality"');
  });

  it("treats trigger event payloads as unresolved-alert scans", async () => {
    const { db, handler, workflows, logs } = setupWithDb();
    const now = Date.now();
    insertOpenP1Alert(db, now);

    await handler({
      type: "trigger.metric-alert-reactor",
      source: "event",
      entry: "metric-alert-reactor",
      timestamp: now,
      data: { type: "trigger.metric-alert-reactor" },
    });

    expect(workflows).toHaveLength(1);
    expect(workflows[0]).toMatchObject({ name: "metric-alert-triage", source: "arc" });
    expect(logs.some((msg) => msg.includes("Missing metricId"))).toBe(false);
  });

  it("triages an old P2 alert that has no judgment", async () => {
    const { db, handler, workflows } = setupWithDb();
    const now = Date.now();
    db.run(
      "INSERT INTO metrics (id, name, owner, current, threshold, target, priority, alert_op, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["arc.coverage", "Arc coverage", "arc", 0.4, 0.8, 0.95, "P2", "<", now],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["arc.coverage", "threshold", "coverage below threshold", now - 2 * 60 * 60_000],
    );

    await handler();

    expect(workflows).toHaveLength(1);
    expect(workflows[0]).toMatchObject({ name: "metric-alert-triage", source: "arc" });
    expect(workflows[0].task).toContain('"metricId": "arc.coverage"');
  });

  it("keeps fresh P2 alerts in metric context", async () => {
    const { db, handler, workflows, logs } = setupWithDb();
    const now = Date.now();
    db.run(
      "INSERT INTO metrics (id, name, owner, current, threshold, target, priority, alert_op, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["arc.coverage", "Arc coverage", "arc", 0.4, 0.8, 0.95, "P2", "<", now],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["arc.coverage", "threshold", "coverage below threshold", now - 5 * 60_000],
    );

    await handler();

    expect(workflows).toEqual([]);
    expect(logs.some((msg) => msg.includes("P2 arc.coverage alert age"))).toBe(true);
  });

  it("retriages a judged P1 alert when a newer snapshot still breaches", async () => {
    const { db, handler, workflows, logs } = setupWithDb();
    const now = Date.now();
    const alertId = insertOpenP1Alert(db, now);
    const judgmentAt = now - 20 * 60_000;
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      [
        "metric.alert_judged",
        JSON.stringify({ alertId, metricId: "arc.quality", owner: "arc", operation: "upgrade_or_escalate", evidence: "owner notified" }),
        judgmentAt,
      ],
    );
    db.run(
      "INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
      ["arc.quality", 0.4, now - 60_000, "metrics-snapshot"],
    );

    await handler();

    expect(workflows).toHaveLength(1);
    expect(logs.some((msg) => msg.includes("still breaching after judgment"))).toBe(true);
  });

  it("waits for a newer metrics snapshot before retriaging a judged P1 alert", async () => {
    const { db, handler, workflows, logs } = setupWithDb();
    const now = Date.now();
    const alertId = insertOpenP1Alert(db, now);
    const judgmentAt = now - 20 * 60_000;
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      [
        "metric.alert_judged",
        JSON.stringify({ alertId, metricId: "arc.quality", owner: "arc", operation: "fix_root_cause", evidence: "patch landed" }),
        judgmentAt,
      ],
    );
    db.run(
      "INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
      ["arc.quality", 0.4, judgmentAt - 60_000, "metrics-snapshot"],
    );

    await handler();

    expect(workflows).toEqual([]);
    expect(logs.some((msg) => msg.includes("awaiting next metrics snapshot"))).toBe(true);
  });
});
