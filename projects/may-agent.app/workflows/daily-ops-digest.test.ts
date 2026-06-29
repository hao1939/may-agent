import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestRuntime } from "@may-agent/sdk/testing";
import type { SqliteDb, WorkflowContext } from "@may-agent/sdk";
import { execute } from "./daily-ops-digest.ts";

type EmittedEvent = { type: string; [key: string]: unknown };

describe("daily-ops-digest", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function setup() {
    const root = join(
      tmpdir(),
      `may-agent-daily-ops-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const appDir = join(root, "projects", "may-agent.app");
    const emitted: EmittedEvent[] = [];
    const notifications: string[] = [];
    tempDirs.push(root);
    mkdirSync(appDir, { recursive: true });

    const runtime = createTestRuntime({
      root,
      persist: root,
      agents: join(root, "agents"),
      shared: join(root, "shared"),
      projects: join(root, "projects"),
      emit: (type, data) => emitted.push({ type, ...(data ?? {}) }),
    });

    const ctx: WorkflowContext = {
      task: `app: ${appDir}\nBuild daily ops digest.`,
      agent: "tech-lead",
      emit: (event) => emitted.push(event),
      dispatchEvent: (eventType, data = {}) =>
        emitted.push({ type: eventType, ...data }),
      getDb: () => runtime.db,
      query: runtime.sdk.query,
      log: () => {},
      notify: (message) => notifications.push(message),
      metrics: runtime.sdk.metrics,
      persistDir: root,
      projectRoot: root,
      agentsRoot: runtime.agents,
      sharedRoot: runtime.shared,
      projectsRoot: runtime.projects,
      runAgent: runtime.sdk.runAgent,
      runWorkflow: runtime.sdk.runWorkflow,
      runFunction: async (label, fn) => ({
        ok: true,
        status: "done",
        agent: "tech-lead",
        sessionId: label,
        result: await fn(),
      }),
      summarize: (result) => String(result.result ?? result.status),
      done: (summary) => ({ type: "done", summary }),
      blocked: (reason, context) => ({ type: "blocked", reason, context }),
      escalate: (reason, context) => ({ type: "escalate", reason, context }),
      createSession: async () => ({
        prompt: async () => {},
        lastText: () => "",
        close: () => {},
      }),
    };

    return {
      appDir,
      db: runtime.db,
      emitted,
      notifications,
      ctx,
      close: runtime.close,
    };
  }

  function insertMetric(
    db: SqliteDb,
    id: string,
    owner: string,
    priority: string,
  ) {
    const now = Date.now();
    db.run(
      `INSERT INTO metrics (
        id, name, type, owner, current, target, threshold, priority,
        status, alert_op, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, id, "health", owner, 5, 0, 1, priority, "active", ">", now, now],
    );
  }

  it("writes a report, notifies the human, and wakes the owner for open/noisy alerts", async () => {
    const { appDir, db, emitted, notifications, ctx, close } = setup();
    const now = Date.now();

    insertMetric(db, "runtime.daemon-heartbeat-stale", "tech-lead", "P0");
    insertMetric(
      db,
      "runtime.stale-running-session-count",
      "agent:evaluator",
      "P2",
    );

    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      [
        "runtime.daemon-heartbeat-stale",
        "threshold",
        "daemon heartbeat is stale",
        now - 2 * 60 * 60_000,
      ],
    );

    for (let i = 0; i < 3; i++) {
      db.run(
        "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at, resolved_at) VALUES (?, ?, ?, ?, ?)",
        [
          "runtime.stale-running-session-count",
          "threshold",
          `stale session transient ${i}`,
          now - (i + 1) * 60 * 60_000,
          now - i * 30 * 60_000,
        ],
      );
    }

    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "metric.alert_judged",
        "metric-alert-triage",
        "agent:tech-lead",
        JSON.stringify({
          metricId: "runtime.stale-running-session-count",
          operation: "calibrate_metric",
        }),
        now - 10 * 60_000,
      ],
    );

    const result = await execute(ctx);
    close();

    expect(result.type).toBe("done");
    expect(result.summary).toContain("4 alert(s) reviewed");
    expect(result.summary).toContain("1 open");
    expect(result.summary).toContain("1 noisy metric group");

    expect(emitted.map((event) => event.type)).toEqual([
      "project.ops_digest.created",
      "project.owner.requested",
    ]);
    expect(emitted[0]).toMatchObject({
      project: "may-agent",
      alertCount: 4,
      openAlertCount: 1,
      noisyMetricCount: 1,
    });
    expect(emitted[1]).toMatchObject({
      project: "may-agent",
      reason: "daily-ops-digest",
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain("Daily ops digest: 4 alert(s) reviewed");
    expect(notifications[0]).toContain(".state/daily-ops-digests/");

    const reportPath = emitted[0].reportPath as string;
    expect(existsSync(reportPath)).toBe(true);
    const report = readFileSync(reportPath, "utf8");
    expect(report).toContain("# Daily Ops Digest");
    expect(report).toContain("runtime.daemon-heartbeat-stale");
    expect(report).toContain("runtime.stale-running-session-count");
    expect(report).toContain("latest judgment: calibrate_metric");
  });

  it("still notifies and records a quiet report without waking the owner", async () => {
    const { emitted, notifications, ctx, close } = setup();

    const result = await execute(ctx);
    close();

    expect(result).toEqual({
      type: "done",
      summary:
        "Daily ops digest generated: 0 alert(s) reviewed, 0 open, 0 noisy metric group(s), 0 missing owner group(s).",
    });
    expect(emitted.map((event) => event.type)).toEqual([
      "project.ops_digest.created",
    ]);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain("0 alert(s) reviewed");
  });
});
