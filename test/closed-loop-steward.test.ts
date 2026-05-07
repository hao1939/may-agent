import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { create } from "../agents/may/handlers/closed-loop-steward.ts";
import { closeDb, getDb } from "../src/lib/requests.js";

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
    const workflows: Array<{ name: string; task: string; source?: string }> = [];
    const handler = create({
      sdk: {
        paths: { root, agents: agentsRoot },
        getDb: () => db,
        log: (_level: string, msg: string) => logs.push(msg),
        runAgent: async (agent: string, task: string, opts?: { source?: string }) => {
          runs.push({ agent, task, source: opts?.source });
          return { sessionId: "s_steward", status: "done" };
        },
        runWorkflow: async (name: string, task: string, opts?: { source?: string }) => {
          workflows.push({ name, task, source: opts?.source });
          return { status: "done", summary: "triaged" };
        },
      },
    } as any, { handlerConfig: { lookbackMs: 60 * 60_000 } } as any);

    return { db, handler, logs, runs, workflows };
  }

  it("skips when there is no open alert or recent delivery failure", async () => {
    const { handler, logs, runs } = setup();

    await handler();

    expect(runs).toEqual([]);
    expect(logs.some((msg) => msg.includes("Skip: no open metric alerts"))).toBe(true);
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

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ agent: "may", source: "closed-loop-steward" });
    expect(runs[0].task).toContain("metric=arc.quality");
    expect(runs[0].task).toContain("owner=arc");
    expect(runs[0].task).toContain("s_owner_action:done:heartbeat-arc");
    expect(runs[0].task).toContain("latest judgment: operation=fix_root_cause");
    expect(runs[0].task).toContain("session=s_owner_action");
    expect(runs[0].task).toContain("message.delivery_failed");
    expect(runs[0].task).toContain("to=functions.message");
    expect(runs[0].task).toContain("Do not create a project for this cron itself");
    expect(runs[0].task).toContain("metric.alert_judged");
    expect(workflows).toEqual([]);
  });

  it("routes unjudged P1 alerts through metric-alert-triage itself", async () => {
    const { db, handler, workflows, runs } = setup();
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

    expect(workflows).toHaveLength(1);
    expect(workflows[0]).toMatchObject({ name: "metric-alert-triage", source: "arc" });
    expect(workflows[0].task).toContain("missing metric.alert_judged event");
    expect(workflows[0].task).toContain('"metricId": "arc.quality"');
    expect(runs).toHaveLength(1);
  });

  it("does not dispatch another steward run while one is active", async () => {
    const { db, handler, logs, runs } = setup();
    const now = Date.now();

    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, source, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s_running", "may", "steward", "running", "closed-loop-steward", now - 60_000],
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
    expect(logs.some((msg) => msg.includes("prior steward session still running"))).toBe(true);
  });
});
