import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { create } from "../agents/may/handlers/metrics-snapshot.ts";
import { closeDb, getDb } from "../src/lib/requests.js";

describe("metrics-snapshot session health metrics", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    delete process.env.MAY_AGENT_BUILD_METRICS_PATH;
    for (const dir of tempDirs.splice(0)) {
      closeDb(dir);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("measures failure triage as an outcome metric and aftermath coverage as liveness", async () => {
    const root = join(tmpdir(), `metrics-session-health-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(root);
    mkdirSync(join(root, "agents"), { recursive: true });
    mkdirSync(join(root, "src/lib"), { recursive: true });
    writeFileSync(join(root, "src/lib/manager.ts"), "export {}\n");

    const db = getDb(root);
    const now = Date.now();
    const ended = now - 10 * 60_000;

    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt, error) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["s_failed_triaged", "arc", "task", "interrupted", ended - 60_000, ended, "boom"],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt, error) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["s_failed_untriaged", "dev", "task", "error", ended - 50_000, ended, "boom"],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s_done_good", "scout", "task", "done", ended - 40_000, ended],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt, error) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["s_old_failed", "arc", "task", "error", now - 4 * 3600_000, now - 4 * 3600_000 + 60_000, "old"],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt, error) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["s_self", "evaluator", "task", "interrupted", ended - 30_000, ended, "self"],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
      ["s_stale_running", "arc", "task", "running", now - 31 * 60_000],
    );

    db.run(
      `INSERT INTO evaluations (
        sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
        verdict, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["s_failed_triaged", "arc", 0.2, 0.8, 0, 1, "needs_improvement", now],
    );
    db.run(
      `INSERT INTO evaluations (
        sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
        verdict, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["s_done_good", "scout", 0.85, 0.8, 5, 0, "good", now],
    );

    const emitted: any[] = [];
    const handler = create({
      sdk: {
        getDb: () => db,
        paths: { root, agents: join(root, "agents") },
        log: () => {},
        emit: (event: any) => emitted.push(event),
      },
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    const metric = (id: string) => db.prepare("SELECT current, target, threshold, priority FROM metrics WHERE id = ?").get(id) as any;

    expect(metric("session.failed-triage-rate-3h")).toMatchObject({
      current: 0.5,
      target: 1,
      threshold: 0.8,
      priority: "P1",
    });
    expect(metric("evaluator.aftermath-coverage-rate-3h")).toMatchObject({
      current: 0.6667,
      target: 0.8,
      threshold: 0.2,
      priority: "P3",
    });
    expect(metric("evaluator.low-quality-rate-24h")).toMatchObject({
      current: 0.5,
      target: 0.1,
      threshold: 0.3,
      priority: "P2",
    });
    expect(metric("evaluator.stale-running-session-count")).toMatchObject({
      current: 1,
      target: 0,
      threshold: 0,
      priority: "P1",
    });
  });

  it("measures evaluator review and learning routing from events", async () => {
    const root = join(tmpdir(), `metrics-evaluator-events-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(root);
    mkdirSync(join(root, "agents"), { recursive: true });
    mkdirSync(join(root, "src/lib"), { recursive: true });
    writeFileSync(join(root, "src/lib/manager.ts"), "export {}\n");

    const db = getDb(root);
    const now = Date.now();
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["evaluation.routed", JSON.stringify({ sessionId: "s_triage", lane: "needs_triage" }), now - 60_000],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["evaluation.routed", JSON.stringify({ sessionId: "s_success", lane: "success_candidate" }), now - 50_000],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["evaluation.routed", JSON.stringify({ sessionId: "s_routine", lane: "routine_ok" }), now - 40_000],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["evaluation.reviewed", JSON.stringify({ sessionId: "s_triage", lane: "needs_triage" }), now - 30_000],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["evaluation.reviewed", JSON.stringify({ sessionId: "s_success", lane: "success_candidate", verdict: "good", reviewedVerdict: "needs_improvement" }), now - 25_000],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["evaluation.false_good", JSON.stringify({ sessionId: "s_success", heuristicVerdict: "good", reviewedVerdict: "needs_improvement" }), now - 24_000],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["evaluation.triage_closed", JSON.stringify({ sessionId: "s_triage" }), now - 20_000],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["evaluation.success_candidate", JSON.stringify({ sessionId: "s_success" }), now - 10_000],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["evaluation.learning_created", JSON.stringify({ sessionId: "s_success" }), now - 5_000],
    );

    const handler = create({
      sdk: {
        getDb: () => db,
        paths: { root, agents: join(root, "agents") },
        log: () => {},
        emit: () => {},
      },
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    const metric = (id: string) => db.prepare("SELECT current, target, threshold, priority FROM metrics WHERE id = ?").get(id) as any;
    expect(metric("evaluator.meaningful-review-rate-24h")).toMatchObject({ current: 1, target: 0.9, threshold: 0.7, priority: "P2" });
    expect(metric("evaluator.triage-closure-rate-24h")).toMatchObject({ current: 1, target: 0.9, threshold: 0.7, priority: "P2" });
    expect(metric("evaluator.false-good-rate-sample")).toMatchObject({ current: 1, target: 0.05, threshold: 0.2, priority: "P2" });
    expect(metric("evaluator.success-candidates-24h")).toMatchObject({ current: 1, target: 1, threshold: 0, priority: "P3" });
    expect(metric("evaluator.success-learnings-24h")).toMatchObject({ current: 1, target: 1, threshold: 0, priority: "P3" });
  });

  it("keeps rolling-window count metrics as gauges without stale rate config", async () => {
    const root = join(tmpdir(), `metrics-window-count-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(root);
    mkdirSync(join(root, "agents"), { recursive: true });
    mkdirSync(join(root, "src/lib"), { recursive: true });
    writeFileSync(join(root, "src/lib/manager.ts"), "export {}\n");

    const db = getDb(root);
    const now = Date.now();
    db.run(
      "INSERT INTO metrics (id, name, owner, type, current, target, threshold, unit, status, speed, alert_op, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "project.iterations-24h",
        "Project iterations (24h)",
        "may",
        "counter",
        5,
        10,
        0,
        "count",
        "active",
        "fast",
        "<",
        JSON.stringify({ alert: { mode: "rate", min_rate: 1, per: "hour" } }),
        now - 60_000,
        now - 60_000,
      ],
    );

    const emitted: any[] = [];
    const handler = create({
      sdk: {
        getDb: () => db,
        paths: { root, agents: join(root, "agents") },
        log: () => {},
        emit: (event: any) => emitted.push(event),
      },
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    const metric = db.prepare("SELECT type, target, threshold, config FROM metrics WHERE id = ?").get("project.iterations-24h") as any;
    expect(metric).toMatchObject({
      type: "gauge",
      target: 10,
      threshold: 1,
      config: null,
    });
  });

  it("counts only active project iteration events", async () => {
    const root = join(tmpdir(), `metrics-project-iterations-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(root);
    mkdirSync(join(root, "agents"), { recursive: true });
    mkdirSync(join(root, "src/lib"), { recursive: true });
    writeFileSync(join(root, "src/lib/manager.ts"), "export {}\n");

    const db = getDb(root);
    const now = Date.now();
    db.run(
      "INSERT INTO projects (id, path, name, owner, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ["active-work", "shared/projects/active-work", "active-work", "may", "active", now],
    );
    db.run(
      "INSERT INTO projects (id, path, name, owner, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ["closed-work", "shared/projects/closed-work", "closed-work", "may", "closed", now],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["project.iteration", JSON.stringify({ projectId: "may/active-work" }), now - 60_000],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["project.iteration", JSON.stringify({ project: "/app/agents/shared/projects/active-work", iteration: 2 }), now - 50_000],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["project.iteration", JSON.stringify({ projectId: "may/closed-work" }), now - 40_000],
    );
    db.run(
      "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
      ["project.iteration", JSON.stringify({ projectId: "unknown/missing-work" }), now - 30_000],
    );

    const handler = create({
      sdk: {
        getDb: () => db,
        paths: { root, agents: join(root, "agents") },
        log: () => {},
        emit: () => {},
      },
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    const metric = db.prepare("SELECT current FROM metrics WHERE id = ?").get("project.iterations-24h") as any;
    const snapshot = db.prepare("SELECT value, sample_size FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 1").get("project.iterations-24h") as any;
    expect(metric.current).toBe(2);
    expect(snapshot).toMatchObject({ value: 2, sample_size: 4 });
  });

  it("retires noncritical metrics and resolves their open alerts", async () => {
    const root = join(tmpdir(), `metrics-retired-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(root);
    mkdirSync(join(root, "agents"), { recursive: true });
    mkdirSync(join(root, "src/lib"), { recursive: true });
    writeFileSync(join(root, "src/lib/manager.ts"), "export {}\n");

    const db = getDb(root);
    const now = Date.now();
    for (const metricId of [
      "v2.spec-coverage-rate",
      "capability.self-directed-iteration-rate-24h",
      "agent.dev.low-quality-streak",
    ]) {
      db.run(
        "INSERT INTO metrics (id, name, owner, type, current, target, threshold, unit, status, speed, alert_op, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [metricId, metricId, "may", "gauge", 0, 1, 0.5, "ratio", "active", "fast", "<", now - 60_000, now - 60_000],
      );
      db.run(
        "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
        [metricId, "threshold", `${metricId} breached`, now - 60_000],
      );
    }

    const handler = create({
      sdk: {
        getDb: () => db,
        paths: { root, agents: join(root, "agents") },
        log: () => {},
        emit: () => {},
      },
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    const retired = db.prepare(
      "SELECT COUNT(*) as c FROM metrics WHERE status = 'retired' AND id IN ('v2.spec-coverage-rate', 'capability.self-directed-iteration-rate-24h', 'agent.dev.low-quality-streak')",
    ).get() as any;
    const openRetiredAlerts = db.prepare(
      "SELECT COUNT(*) as c FROM metric_alerts WHERE resolved_at IS NULL AND metric_id IN ('v2.spec-coverage-rate', 'capability.self-directed-iteration-rate-24h', 'agent.dev.low-quality-streak')",
    ).get() as any;

    expect(retired.c).toBe(3);
    expect(openRetiredAlerts.c).toBe(0);
  });
});
