import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { create } from "../agents/may/handlers/metrics-snapshot.ts";
import { closeDb, getDb } from "../src/lib/requests.js";
import { createMetricService } from "../src/lib/metrics.js";

describe("metrics-snapshot session health metrics", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    delete process.env.MAY_AGENT_BUILD_METRICS_PATH;
    for (const dir of tempDirs.splice(0)) {
      closeDb(dir);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function sdk(root: string, db: ReturnType<typeof getDb>, emit: (event: any) => void = () => {}) {
    return {
      getDb: () => db,
      paths: { root, agents: join(root, "agents") },
      log: () => {},
      emit,
      metrics: createMetricService({
        getDb: () => db,
        emit: (type, data) => emit({ type, ...(data || {}) }),
        measuredBy: "metrics-snapshot",
      }),
    };
  }

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
    db.run(
      `INSERT INTO evaluations (
        sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
        verdict, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["s_self", "evaluator", 0.5, 0.5, 1, 0, "acceptable", now],
    );

    const emitted: any[] = [];
    const handler = create({
      sdk: sdk(root, db, (event: any) => emitted.push(event)),
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    const metric = (id: string) => db.prepare("SELECT current, target, threshold, priority FROM metrics WHERE id = ?").get(id) as any;

    expect(metric("session.failed-triage-rate-3h")).toMatchObject({
      current: 1,
      target: 1,
      threshold: 0.8,
      priority: "P1",
    });
    expect(
      db.prepare("SELECT sample_size FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 1")
        .get("session.failed-triage-rate-3h"),
    ).toMatchObject({ sample_size: 2 });
    expect(metric("evaluator.aftermath-coverage-rate-3h")).toMatchObject({
      current: 0.6667,
      target: 0.8,
      threshold: 0.2,
      priority: "P3",
    });
    expect(metric("eval.llm-evals-24h")).toMatchObject({
      current: 2,
      target: 4,
      threshold: 1,
      priority: "P2",
    });
    expect(metric("evaluator.low-quality-rate-24h")).toMatchObject({
      current: 0.5,
      target: 0.1,
      threshold: 0.8,
      priority: "P3",
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
      sdk: sdk(root, db),
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    const metric = (id: string) => db.prepare("SELECT current, target, threshold, priority FROM metrics WHERE id = ?").get(id) as any;
    expect(metric("evaluator.meaningful-review-rate-24h")).toMatchObject({ current: 1, target: 0.9, threshold: 0.7, priority: "P2" });
    expect(metric("evaluator.triage-closure-rate-24h")).toMatchObject({ current: 1, target: 0.9, threshold: 0.7, priority: "P2" });
    expect(metric("evaluator.false-good-rate-sample")).toMatchObject({ current: 1, target: 0.05, threshold: 0.6, priority: "P2" });
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
      sdk: sdk(root, db, (event: any) => emitted.push(event)),
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    const metric = db.prepare("SELECT type, target, threshold, config FROM metrics WHERE id = ?").get("project.iterations-24h") as any;
    expect(metric).toMatchObject({
      type: "gauge",
      target: 0,
      threshold: 0,
      config: null,
    });
  });

  it("does not count terminal no-recovery finish-block digests as unresolved dirty exits", async () => {
    const root = join(tmpdir(), `metrics-finish-blocked-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(root);
    mkdirSync(join(root, "agents"), { recursive: true });
    mkdirSync(join(root, "src/lib"), { recursive: true });
    writeFileSync(join(root, "src/lib/manager.ts"), "export {}\n");

    const db = getDb(root);
    const now = Date.now();
    const issueJson = JSON.stringify(["terminal status: interrupted", "finish blocked by uncommitted changes"]);

    const insertSession = db.prepare(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt, outcome) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const insertEval = db.prepare(
      `INSERT INTO evaluations (
        sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
        verdict, issues, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertDigest = db.prepare(
      `INSERT INTO session_digests (
        sessionId, agent, trigger, step, task, what_happened, outcome,
        action, action_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    insertSession.run("s_no_recovery", "may", "steward", "interrupted", now - 20_000, now - 10_000, "interrupted");
    insertEval.run("s_no_recovery", "may", 0.2, 0.5, 0, 1, "needs_improvement", issueJson, now - 9_000);
    insertDigest.run(
      "s_no_recovery",
      "may",
      "auto_resume",
      1,
      "steward",
      "Auto-resume classified the session as closed.",
      null,
      "nothing",
      "No recoverable work worth resuming",
      now - 8_000,
    );

    insertSession.run("s_unresolved", "dev", "work", "interrupted", now - 18_000, now - 7_000, "interrupted");
    insertEval.run("s_unresolved", "dev", 0.2, 0.5, 0, 1, "needs_improvement", issueJson, now - 6_000);

    insertSession.run("s_repaired", "scout", "work", "done", now - 16_000, now - 5_000, "done");
    insertEval.run("s_repaired", "scout", 0.75, 0.8, 2, 0, "good", issueJson, now - 4_000);
    insertDigest.run(
      "s_repaired",
      "scout",
      "finish",
      1,
      "work",
      "Committed own changes and finished successfully.",
      "success",
      null,
      null,
      now - 3_000,
    );

    const rawQuery = `
SELECT COUNT(*) AS value
FROM evaluations e
WHERE e.createdAt >= (unixepoch('now') * 1000 - 86400000)
  AND e.issues LIKE '%finish blocked by uncommitted changes%'`;
    const unresolvedQuery = `
WITH latest_digest AS (
  SELECT sd.*
  FROM session_digests sd
  JOIN (
    SELECT sessionId, MAX(created_at) AS max_created_at
    FROM session_digests
    GROUP BY sessionId
  ) m ON m.sessionId = sd.sessionId AND m.max_created_at = sd.created_at
)
SELECT COUNT(*) AS value
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
LEFT JOIN latest_digest ld ON ld.sessionId = e.sessionId
WHERE e.createdAt >= (unixepoch('now') * 1000 - 86400000)
  AND e.issues LIKE '%finish blocked by uncommitted changes%'
  AND e.issues NOT LIKE '%review override:%'
  AND NOT (
    COALESCE(ld.action, '') = 'nothing'
    AND COALESCE(ld.action_reason, '') LIKE '%No recoverable work worth resuming%'
  )
  AND (
    s.status != 'done'
    OR s.outcome != 'done'
    OR COALESCE(ld.outcome, 'no_digest') NOT IN ('success', 'partial')
  )`;

    db.run(
      "INSERT INTO metrics (id, name, owner, type, target, threshold, unit, status, alert_op, source_query, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "session.finish-blocked-uncommitted-count-24h",
        "Raw finish-block friction",
        "dev",
        "health",
        0,
        50,
        "count",
        "active",
        ">",
        rawQuery,
        now,
        now,
      ],
    );
    db.run(
      "INSERT INTO metrics (id, name, owner, type, target, threshold, unit, status, alert_op, source_query, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "session.finish-blocked-unresolved-count-24h",
        "Unresolved finish-blocked dirty exits",
        "dev",
        "health",
        0,
        0,
        "count",
        "active",
        ">",
        unresolvedQuery,
        now,
        now,
      ],
    );

    const handler = create({
      sdk: sdk(root, db),
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    const metric = (id: string) => db.prepare("SELECT current FROM metrics WHERE id = ?").get(id) as any;
    expect(metric("session.finish-blocked-uncommitted-count-24h").current).toBe(3);
    expect(metric("session.finish-blocked-unresolved-count-24h").current).toBe(1);
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
      sdk: sdk(root, db),
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    const metric = db.prepare("SELECT current FROM metrics WHERE id = ?").get("project.iterations-24h") as any;
    const snapshot = db.prepare("SELECT value, sample_size FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 1").get("project.iterations-24h") as any;
    expect(metric.current).toBe(2);
    expect(snapshot).toMatchObject({ value: 2, sample_size: 4 });
  });

  it("measures critical runtime signals with explicit owners", async () => {
    const root = join(tmpdir(), `metrics-critical-signals-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(root);
    mkdirSync(join(root, "agents", "may"), { recursive: true });
    mkdirSync(join(root, "agents", "scout"), { recursive: true });
    mkdirSync(join(root, "src/lib"), { recursive: true });
    writeFileSync(join(root, "src/lib/manager.ts"), "export {}\n");
    writeFileSync(join(root, "agents", "may", "agent.json"), JSON.stringify({
      name: "may",
      description: "system owner",
      domain: "system",
      model: "test",
      tools: [],
    }));
    writeFileSync(join(root, "agents", "scout", "agent.json"), JSON.stringify({
      name: "scout",
      description: "research",
      domain: "research",
      model: "test",
      tools: [],
    }));
    writeFileSync(join(root, "agents", "may", "cron.json"), JSON.stringify([
      { name: "heartbeat", enabled: true, handlerConfig: { agent: "may", workflow: "may-heartbeat" } },
      { name: "heartbeat-scout", enabled: true, handlerConfig: { agent: "scout", workflow: "scout-heartbeat" } },
      { name: "heartbeat-disabled", enabled: false, handlerConfig: { agent: "disabled", workflow: "disabled-heartbeat" } },
    ]));

    const db = getDb(root);
    const now = Date.now();
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, source, startedAt, endedAt, opCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["hb_may", "may", "[heartbeat] May", "done", "workflow:may-heartbeat", now - 20 * 60_000, now - 19 * 60_000, 2],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt, error, opCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["s_zero_op", "arc", "call model", "error", now - 10 * 60_000, now - 9 * 60_000, "Connection error", 0],
    );
    mkdirSync(join(root, "sessions", "history", "s_zero_op"), { recursive: true });
    writeFileSync(
      join(root, "sessions", "history", "s_zero_op", "session.jsonl"),
      [
        JSON.stringify({ role: "user", content: [{ type: "text", text: "call model" }] }),
        JSON.stringify({ role: "assistant", content: [], stopReason: "error", errorMessage: "Connection error." }),
      ].join("\n") + "\n",
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt, error, opCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["s_tool_error", "arc", "after tools", "error", now - 8 * 60_000, now - 7 * 60_000, "tool failed", 2],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt, error, opCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["s_empty_stop", "evaluator", "review", "error", now - 6 * 60_000, now - 5 * 60_000, null, 0],
    );
    mkdirSync(join(root, "sessions", "history", "s_empty_stop"), { recursive: true });
    writeFileSync(
      join(root, "sessions", "history", "s_empty_stop", "session.jsonl"),
      [
        JSON.stringify({ role: "user", content: [{ type: "text", text: "review" }] }),
        JSON.stringify({ role: "assistant", content: [], stopReason: "stop" }),
      ].join("\n") + "\n",
    );
    db.run(
      "INSERT INTO events (event_type, owner, data, timestamp) VALUES (?, ?, ?, ?)",
      ["agent.config_invalid", "may", JSON.stringify({ count: 2, message: "Unknown model" }), now - 5 * 60_000],
    );
    db.run(
      "INSERT INTO events (event_type, owner, data, timestamp) VALUES (?, ?, ?, ?)",
      ["message.delivery_failed", "may", JSON.stringify({ from: "evaluator", to: "functions.message", reason: "invalid target" }), now - 4 * 60_000],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      ["guard.triggered", "workflow", "may", JSON.stringify({ guard: "verify-after-write", demandType: "warn", action: "warned" }), now - 3 * 60_000],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      ["guard.triggered", "workflow", "may", JSON.stringify({ guard: "verify-after-write", demandType: "block", action: "blocked" }), now - 2 * 60_000],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      ["guard.triggered", "workflow", "may", JSON.stringify({ guard: "verify-after-write", demandType: "run_step", action: "skipped_duplicate" }), now - 1 * 60_000],
    );

    const handler = create({
      sdk: sdk(root, db),
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    const metric = (id: string) => db.prepare("SELECT current, owner, target, threshold, priority FROM metrics WHERE id = ?").get(id) as any;
    expect(metric("agent.heartbeat-dark-count-2h")).toMatchObject({ current: 1, owner: "may", target: 0, threshold: 0, priority: "P0" });
    expect(metric("agent.config-invalid-count-1h")).toMatchObject({ current: 2, owner: "may", target: 0, threshold: 0, priority: "P0" });
    expect(metric("session.first-turn-error-count-1h")).toMatchObject({ current: 1, owner: "may", target: 0, threshold: 5, priority: "P1" });
    expect(metric("session.empty-assistant-stop-count-1h")).toMatchObject({ current: 1, owner: "may", target: 0, threshold: 0, priority: "P1" });
    expect(metric("message.delivery-failed-count-1h")).toMatchObject({ current: 1, owner: "may", target: 0, threshold: 0, priority: "P1" });
    expect(metric("guard.triggered-count-24h")).toMatchObject({ current: 3, owner: "may", target: 0, threshold: 1300, priority: "P3" });
    expect(metric("guard.warned-count-24h")).toMatchObject({ current: 1, owner: "may", target: 0, threshold: 900, priority: "P3" });
    expect(metric("guard.blocked-count-15m")).toMatchObject({ current: 1, owner: "may", target: 0, threshold: 15, priority: "P1" });
    expect(metric("guard.repeat-trigger-count-24h")).toMatchObject({ current: 1, owner: "may", target: 0, threshold: 5, priority: "P2" });
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
      sdk: sdk(root, db),
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

  it("measures event bus subscriber failures as a health signal", async () => {
    const root = join(tmpdir(), `metrics-subscriber-failure-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(root);
    mkdirSync(join(root, "agents"), { recursive: true });
    mkdirSync(join(root, "src/lib"), { recursive: true });
    writeFileSync(join(root, "src/lib/manager.ts"), "export {}\n");

    const db = getDb(root);
    const now = Date.now();
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      ["subscriber.failed", "event-bus", "may", JSON.stringify({ originalEventType: "metric.breach", subscriberPriority: "normal" }), now - 60_000],
    );

    const handler = create({
      sdk: sdk(root, db),
    } as any, {} as any);

    await handler({ type: "trigger.metrics-snapshot" } as any);

    expect(
      db.prepare("SELECT current, target, threshold, priority, type FROM metrics WHERE id = ?")
        .get("infra.bus.subscriber-failed-count-1h"),
    ).toMatchObject({
      current: 1,
      target: 0,
      threshold: 0,
      priority: "P1",
      type: "health",
    });
  });
});
