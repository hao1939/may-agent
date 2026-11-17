import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, spyOn } from "bun:test";
import { EventBus } from "../../src/app/core/events/bus.js";
import {
  attachDaemonEventSubscribers,
  attachDaemonMetricTimers,
  attachEventPersistence,
  METRIC_EVALUATION_INTERVAL_MS,
  METRIC_SOURCE_COLLECTION_INTERVAL_MS,
} from "../../src/app/daemon-events.js";
import { closeDb, getDb } from "../../src/lib/db/connection.js";
import { createEventInterface } from "../../src/app/core/events/interface.js";
import { createMetricService } from "../../src/lib/metrics.js";

describe("daemon event subscribers", () => {
  it("runs metric collection and evaluation from unrefed Host timers without trigger events", async () => {
    const root = mkdtempSync(join(tmpdir(), "daemon-metric-timers-"));
    const bus = new EventBus();
    const scheduled: Array<{ callback: () => void; intervalMs: number; unrefCount: number }> = [];
    const cleared: unknown[] = [];
    const setInterval = ((callback: () => void, intervalMs: number) => {
      const timer = { callback, intervalMs, unrefCount: 0, unref() { timer.unrefCount++; return timer; } };
      scheduled.push(timer);
      return timer;
    }) as unknown as typeof globalThis.setInterval;
    const clearInterval = ((timer: unknown) => cleared.push(timer)) as typeof globalThis.clearInterval;
    const pendingTimeouts: Array<() => void> = [];
    const realSetTimeout = globalThis.setTimeout;
    const timeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation(((callback: TimerHandler, delay?: number, ...args: any[]) => {
      if (delay === 0) {
        pendingTimeouts.push(() => typeof callback === "function" && callback(...args));
        return { unref() { return this; } } as unknown as ReturnType<typeof setTimeout>;
      }
      return realSetTimeout(callback, delay, ...args);
    }) as typeof globalThis.setTimeout);
    let runtime: ReturnType<typeof attachDaemonMetricTimers> | undefined;
    let idle: Promise<void> | undefined;
    const flushPendingTimeouts = async () => {
      for (let attempts = 0; attempts < 1_000; attempts++) {
        pendingTimeouts.shift()?.();
        await Promise.resolve();
        await Promise.resolve();
        if (pendingTimeouts.length === 0) await Promise.resolve();
      }
    };
    try {
      attachEventPersistence({ bus, persistDir: root });
      const metrics = createMetricService({ getDb: () => getDb(root) });
      metrics.define({ id: "timer.collection", sourceQuery: "SELECT 7 AS value" });
      metrics.define({ id: "timer.evaluation", threshold: 1, alertOp: ">" });
      metrics.record("timer.evaluation", 2);
      runtime = attachDaemonMetricTimers({ bus, persistDir: root, setInterval, clearInterval });

      expect(METRIC_SOURCE_COLLECTION_INTERVAL_MS).toBe(300_000);
      expect(METRIC_EVALUATION_INTERVAL_MS).toBe(60_000);
      expect(scheduled.map(({ intervalMs }) => intervalMs)).toEqual([300_000, 60_000]);
      expect(scheduled.map(({ unrefCount }) => unrefCount)).toEqual([1, 1]);
      scheduled[0]!.callback();
      scheduled[1]!.callback();
      runtime.close();
      let valueWhenIdleResolved: number | undefined;
      idle = runtime.idle().then(() => {
        valueWhenIdleResolved = metrics.get("timer.collection")?.observation?.value;
      });
      await Promise.resolve();
      expect(cleared).toEqual(scheduled);
      expect(valueWhenIdleResolved).toBeUndefined();
      expect(metrics.get("timer.collection")?.observation).toBeNull();

      await flushPendingTimeouts();
      await idle;
      expect(valueWhenIdleResolved).toBe(7);
      expect(getDb(root).prepare("SELECT COUNT(*) AS n FROM metric_alerts WHERE metric_id = ?").get("timer.evaluation"))
        .toEqual({ n: 1 });
      expect(getDb(root).prepare(
        "SELECT COUNT(*) AS n FROM events WHERE event_type IN ('trigger.metrics-snapshot', 'trigger.metrics-evaluate')",
      ).get()).toEqual({ n: 0 });

    } finally {
      runtime?.close();
      await flushPendingTimeouts();
      await idle;
      timeoutSpy.mockRestore();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("rejects metric edits for missing resources or a mismatched alert before acknowledging them", () => {
    const root = mkdtempSync(join(tmpdir(), "metric-target-"));
    try {
      const db = getDb(root);
      const bus = new EventBus();
      attachEventPersistence({ bus, persistDir: root });
      const events = createEventInterface({ bus, db, hasApp: () => false, hasAgent: () => false,
        hasSession: () => false, validateAppInput: () => { throw new Error("invalid App input"); } });
      db.exec("INSERT INTO metrics(id, threshold, updated_at) VALUES ('health', 10, 0), ('other', 5, 0)");
      db.exec("INSERT INTO metric_alerts(id, metric_id, created_at) VALUES (7, 'health', 1)");
      const edits = [
        { type: "metric.threshold_changed", data: { metricId: "missing", to: 20 } },
        { type: "metric.alert_resolved", data: { metricId: "health", alertId: 99 } },
        { type: "metric.alert_resolved", data: { metricId: "other", alertId: 7 } },
      ];
      for (const edit of edits) {
        expect(() => events.publish(edit, { source: "test" })).toThrow("not found");
      }
      expect(db.prepare("SELECT count(*) AS n FROM events WHERE event_type LIKE 'metric.%'").get()).toEqual({ n: 0 });
      expect(db.prepare("SELECT resolved_at FROM metric_alerts WHERE id = 7").get()).toEqual({ resolved_at: null });
      const resolve = () => events.publish({ type: "metric.alert_resolved",
        data: { metricId: "health", alertId: 7 } }, { source: "test" });
      resolve();
      const first = db.prepare("SELECT resolved_at FROM metric_alerts WHERE id = 7").get();
      resolve();
      expect(db.prepare("SELECT resolved_at FROM metric_alerts WHERE id = 7").get()).toEqual(first);
    } finally { closeDb(root); rmSync(root, { recursive: true, force: true }); }
  });

  it("metric admission rolls back on storage failure; retry and replay retain the latest edit", () => {
    const root = mkdtempSync(join(tmpdir(), "metric-admission-"));
    try {
      const db = getDb(root);
      const bus = new EventBus();
      attachEventPersistence({ bus, persistDir: root });
      const events = createEventInterface({ bus, db, hasApp: () => false, hasAgent: () => false,
        hasSession: () => false, validateAppInput: () => { throw new Error("invalid App input"); } });
      db.exec("INSERT INTO metrics(id, threshold, updated_at) VALUES ('health', 10, 0)");
      db.exec("CREATE TRIGGER refuse_metric BEFORE UPDATE ON metrics BEGIN SELECT RAISE(ABORT, 'write failed'); END");
      const edit = (to: number) => events.publish({ type: "metric.threshold_changed", idempotencyKey: `edit-${to}`,
        data: { metricId: "health", to } }, { source: "test" });
      expect(() => edit(20)).toThrow("write failed");
      expect(db.prepare("SELECT count(*) AS n FROM events WHERE event_type = 'metric.threshold_changed'").get()).toEqual({ n: 0 });
      expect(db.prepare("SELECT threshold FROM metrics WHERE id = 'health'").get()).toEqual({ threshold: 10 });
      db.exec("DROP TRIGGER refuse_metric");
      const first = edit(20);
      edit(30);
      expect(edit(20).eventId).toBe(first.eventId);
      closeDb(root);
      expect(getDb(root).prepare("SELECT threshold FROM metrics WHERE id = 'health'").get()).toEqual({ threshold: 30 });
    } finally { closeDb(root); rmSync(root, { recursive: true, force: true }); }
  });
  for (const kind of ["call", "job"] as const) {
    it(`keeps errors and interruption as evidence for a ${kind}, without automatic intervention`, async () => {
      const persistDir = mkdtempSync(join(tmpdir(), "daemon-stuck-ownership-"));
      const bus = new EventBus();
      const events: any[] = [];
      try {
        attachEventPersistence({ bus, persistDir });
        let resumes = 0;
        attachDaemonEventSubscribers({ bus, manager: { resumeSession: () => { resumes++; } } as any, persistDir, projectRoot: persistDir });
        bus.subscribe(event => events.push(event));
        bus.emit({ type: "session.start", data: { sessionId: "stuck", agent: "worker", kind } } as any);
        for (let turn = 0; turn < 6; turn++) {
          bus.emit({ type: "turn_end", sessionId: "stuck", agent: "worker", toolCalls: 1, errorCount: 1 } as any);
        }
        bus.emit({ type: "session.end", data: { sessionId: "stuck", agent: "worker", kind,
          status: "interrupted", outcome: "interrupted", opCount: 6, summary: "Caller stopped" } } as any);
        await new Promise<void>(resolve => setImmediate(resolve));
        expect(events.filter(event => event.type === "turn_end")).toHaveLength(6);
        expect(events.filter(event => event.type === "session.cancel.requested")).toEqual([]);
        expect(events.filter(event => event.type === "escalation.created")).toEqual([]);
        expect(resumes).toBe(0);

      } finally {
        closeDb(persistDir);
        rmSync(persistDir, { recursive: true, force: true });
      }
    });
  }

  it("projects metric mutations only from their durable canonical events", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-metric-events-"));
    const bus = new EventBus();
    try {
      const db = getDb(persistDir);
      db.run("INSERT INTO metrics (id, threshold, updated_at) VALUES (?, ?, ?)", ["metric.test", 1, 0]);
      db.run("INSERT INTO metric_alerts (id, metric_id, created_at) VALUES (?, ?, ?)", [7, "metric.test", 1]);
      attachEventPersistence({ bus, persistDir });
      bus.emit({
        type: "metric.threshold_changed",
        source: "test",
        owner: "agent:may",
        timestamp: 123,
        data: { metricId: "metric.test", from: 1, to: 3 },
      });
      bus.emit({
        type: "metric.alert_resolved",
        source: "test",
        owner: "agent:may",
        timestamp: 456,
        data: { metricId: "metric.test", alertId: 7 },
      });
      expect(db.prepare("SELECT threshold, updated_at FROM metrics WHERE id = ?").get("metric.test")).toEqual({
        threshold: 3,
        updated_at: 123,
      });
      expect(db.prepare("SELECT resolved_at FROM metric_alerts WHERE id = ?").get(7)).toEqual({ resolved_at: 456 });
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("retains context suggestions as evidence without changing the agent's guidance", async () => {
    const root = mkdtempSync(join(tmpdir(), "session-report-"));
    try {
      const agentDir = join(root, "agents", "worker");
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, "context.md"), "Existing guidance\n");
      const bus = new EventBus();
      attachEventPersistence({ bus, persistDir: root });
      attachDaemonEventSubscribers({ bus, manager: {} as any, persistDir: root, projectRoot: root });
      const suggestions = [{ action: "add", content: "Proposed guidance" }];
      bus.emit({
        type: "session.end", source: "runtime", owner: "agent:worker",
        data: {
          sessionId: "reported-session", agent: "worker", status: "done",
          finishParams: { status: "done", summary: "Review complete", context_updates: suggestions },
        },
      });
      const row = getDb(root).prepare("SELECT data FROM events WHERE event_type = 'session.end'").get() as { data: string };
      expect(JSON.parse(row.data).finishParams.context_updates).toEqual(suggestions);
      expect(readFileSync(join(agentDir, "context.md"), "utf8")).toBe("Existing guidance\n");
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps blocked session.end local until an owner explicitly escalates", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-events-"));
    const bus = new EventBus();
    const events: any[] = [];
    const manager = {
      resumeSession: () => {
        throw new Error("test: resume not wired");
      },
    };

    try {
      attachDaemonEventSubscribers({
        bus,
        manager: manager as any,
        persistDir,
        projectRoot: persistDir,
      });
      bus.subscribe((event) => events.push(event));

      bus.emit({
        type: "session.end",
        sessionId: "s_1",
        agent: "scout",
        outcome: "need input",
        summary: "blocked",
        durationMs: 10,
        status: "done",
        finishParams: {
          status: "blocked",
          summary: "need input",
          blockers: [{ reason: "missing deployment approval", context: "deploy cannot continue" }],
          next_steps: "Ask May to route the approval request.",
        },
      });

      expect(events.some((event) => event.type === "escalation.created")).toBe(false);
      expect(events.some((event) => event.type === "session.escalated")).toBe(false);
      expect(events.some((event) => event.type === "session.completed")).toBe(false);
      expect(events.some((event) => event.type === "session.receipt")).toBe(false);
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("does not manufacture another terminal event for error session.end", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-events-error-"));
    const bus = new EventBus();
    const events: any[] = [];
    const manager = {
      resumeSession: () => {
        throw new Error("test: resume not wired");
      },
    };

    try {
      attachDaemonEventSubscribers({
        bus,
        manager: manager as any,
        persistDir,
        projectRoot: persistDir,
      });
      bus.subscribe((event) => events.push(event));

      bus.emit({
        type: "session.end",
        sessionId: "s_error",
        agent: "dev",
        outcome: "error",
        summary: "failed",
        durationMs: 10,
        status: "error",
        error: "boom",
        task: "fix issue",
      });

      expect(events.some((event) => event.type === "session.completed")).toBe(false);
      expect(events.some((event) => event.type === "session.receipt")).toBe(false);
      expect(events.some((event) => event.type === "session.failed")).toBe(false);
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });
});
